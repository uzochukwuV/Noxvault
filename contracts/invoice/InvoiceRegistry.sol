// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "../identity/IIdentityRegistry.sol";
import {IInvoiceProofVerifier} from "./IInvoiceProofVerifier.sol";
import {IConfidentialInvoiceProofVerifier} from "./IConfidentialInvoiceProofVerifier.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract InvoiceRegistry is Ownable2Step {
    uint256 public constant INVESTOR_ROLE = 1;
    uint256 public constant ISSUER_ROLE = 2;
    uint256 public constant OPERATOR_ROLE = 3;

    enum Status {
        None,
        Created,
        Funded,
        Repaid,
        Defaulted,
        Cancelled
    }

    struct Invoice {
        address issuer;
        uint256 faceValue;
        uint64 dueDate;
        address settlementRecipient;
        bytes32 metadataHash;
        bytes32 invoiceRef;
        address verifier;
        bool confidential;
        Status status;
        uint256 fundedAmount;
        uint256 repaidAmount;
        euint256 faceValueEncrypted;
        euint256 fundedAmountEncrypted;
        euint256 repaidAmountEncrypted;
    }

    IIdentityRegistry public immutable identityRegistry;
    uint256 public nextInvoiceId = 1;

    mapping(uint256 => Invoice) private _invoices;
    mapping(bytes32 => bool) public invoiceRefUsed;
    mapping(address => bool) public isVault;

    event VaultUpdated(address indexed vault, bool allowed);

    event InvoiceCreated(uint256 indexed invoiceId, bytes32 indexed invoiceRef, address indexed issuer);
    event InvoiceCreatedConfidential(
        uint256 indexed invoiceId,
        bytes32 indexed invoiceRef,
        address indexed issuer,
        bytes32 faceValueHandle
    );

    event InvoiceFunded(uint256 indexed invoiceId, uint256 amount);
    event InvoiceRepaid(uint256 indexed invoiceId, uint256 amount, bool fullyRepaid);

    event InvoiceFundedEncrypted(uint256 indexed invoiceId, bytes32 amountHandle);
    event InvoiceRepaidEncrypted(uint256 indexed invoiceId, bytes32 amountHandle);

    constructor(IIdentityRegistry _identityRegistry) Ownable(msg.sender) {
        identityRegistry = _identityRegistry;
    }

    function setVault(address vault, bool allowed) external onlyOwner {
        isVault[vault] = allowed;
        emit VaultUpdated(vault, allowed);
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        return _invoices[invoiceId];
    }

    function createInvoice(
        uint256 faceValue,
        uint64 dueDate,
        address settlementRecipient,
        bytes32 metadataHash,
        bytes32 invoiceRef,
        address verifier,
        bytes calldata proof
    ) external returns (uint256 invoiceId) {
        require(identityRegistry.isVerified(msg.sender, ISSUER_ROLE));
        require(settlementRecipient != address(0));
        require(verifier != address(0));
        require(!invoiceRefUsed[invoiceRef]);

        IInvoiceProofVerifier.InvoiceProofContext memory ctx = IInvoiceProofVerifier.InvoiceProofContext({
            issuer: msg.sender,
            faceValue: faceValue,
            dueDate: dueDate,
            settlementRecipient: settlementRecipient,
            metadataHash: metadataHash,
            invoiceRef: invoiceRef
        });
        require(IInvoiceProofVerifier(verifier).verify(ctx, proof));

        invoiceRefUsed[invoiceRef] = true;
        invoiceId = nextInvoiceId++;

        Invoice storage inv = _invoices[invoiceId];
        inv.issuer = msg.sender;
        inv.faceValue = faceValue;
        inv.dueDate = dueDate;
        inv.settlementRecipient = settlementRecipient;
        inv.metadataHash = metadataHash;
        inv.invoiceRef = invoiceRef;
        inv.verifier = verifier;
        inv.confidential = false;
        inv.status = Status.Created;

        emit InvoiceCreated(invoiceId, invoiceRef, msg.sender);
    }

    function createInvoiceConfidential(
        externalEuint256 faceValueHandle,
        bytes calldata faceValueProof,
        uint64 dueDate,
        address settlementRecipient,
        bytes32 metadataHash,
        bytes32 invoiceRef,
        address verifier,
        bytes calldata proof
    ) external returns (uint256 invoiceId) {
        require(identityRegistry.isVerified(msg.sender, ISSUER_ROLE));
        require(settlementRecipient != address(0));
        require(verifier != address(0));
        require(!invoiceRefUsed[invoiceRef]);

        euint256 faceValueEncrypted = Nox.fromExternal(faceValueHandle, faceValueProof);
        bytes32 faceValueHandleInternal = euint256.unwrap(faceValueEncrypted);

        IConfidentialInvoiceProofVerifier.ConfidentialInvoiceProofContext memory ctx = IConfidentialInvoiceProofVerifier
            .ConfidentialInvoiceProofContext({
                issuer: msg.sender,
                faceValueHandle: faceValueHandleInternal,
                dueDate: dueDate,
                settlementRecipient: settlementRecipient,
                metadataHash: metadataHash,
                invoiceRef: invoiceRef
            });
        require(IConfidentialInvoiceProofVerifier(verifier).verify(ctx, proof));

        invoiceRefUsed[invoiceRef] = true;
        invoiceId = nextInvoiceId++;

        Invoice storage inv = _invoices[invoiceId];
        inv.issuer = msg.sender;
        inv.faceValue = 0;
        inv.dueDate = dueDate;
        inv.settlementRecipient = settlementRecipient;
        inv.metadataHash = metadataHash;
        inv.invoiceRef = invoiceRef;
        inv.verifier = verifier;
        inv.confidential = true;
        inv.status = Status.Created;
        inv.faceValueEncrypted = faceValueEncrypted;

        Nox.allowThis(faceValueEncrypted);
        Nox.allow(faceValueEncrypted, msg.sender);
        Nox.allow(faceValueEncrypted, owner());

        emit InvoiceCreatedConfidential(invoiceId, invoiceRef, msg.sender, faceValueHandleInternal);
    }

    function markFunded(uint256 invoiceId, uint256 amount) external {
        require(isVault[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Created);
        require(amount != 0);
        inv.status = Status.Funded;
        inv.fundedAmount = amount;
        emit InvoiceFunded(invoiceId, amount);
    }

    function markRepaid(uint256 invoiceId, uint256 amount) external {
        require(isVault[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Funded);
        require(amount != 0);
        inv.repaidAmount += amount;
        bool fullyRepaid = inv.repaidAmount >= inv.fundedAmount;
        if (fullyRepaid) {
            inv.status = Status.Repaid;
        }
        emit InvoiceRepaid(invoiceId, amount, fullyRepaid);
    }

    function markFundedEncrypted(uint256 invoiceId, euint256 amount) external {
        require(isVault[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Created);
        inv.status = Status.Funded;
        inv.fundedAmountEncrypted = amount;
        emit InvoiceFundedEncrypted(invoiceId, euint256.unwrap(amount));
    }

    function markRepaidEncrypted(uint256 invoiceId, euint256 amount) external {
        require(isVault[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Funded);
        inv.repaidAmountEncrypted = amount;
        emit InvoiceRepaidEncrypted(invoiceId, euint256.unwrap(amount));
    }
}
