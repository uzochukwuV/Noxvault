// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "../identity/IIdentityRegistry.sol";
import {IInvoiceProofVerifier} from "./IInvoiceProofVerifier.sol";
import {IConfidentialInvoiceProofVerifier} from "./IConfidentialInvoiceProofVerifier.sol";
import {RiskManager} from "../risk/RiskManager.sol";
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
        Cancelled,
        Disputed
    }

    struct Invoice {
        address issuer;
        uint256 faceValue;
        uint64 dueDate;
        address settlementRecipient;
        bytes32 metadataHash;
        bytes32 invoiceRef;
        bytes32 obligorHash;
        bytes32 obligorGroupHash;
        uint8 riskTier;
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
    mapping(address => bool) public isServicer;
    RiskManager public riskManager;

    struct RiskTierMigrationRequest {
        uint8 requestedTier;
        bool pending;
    }

    mapping(uint256 => RiskTierMigrationRequest) public riskTierMigrationRequests;

    event VaultUpdated(address indexed vault, bool allowed);
    event ServicerUpdated(address indexed servicer, bool allowed);
    event RiskManagerUpdated(address indexed riskManager);

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
    event InvoiceDisputed(uint256 indexed invoiceId);
    event InvoiceDisputeResolved(uint256 indexed invoiceId);
    event InvoiceDefaulted(uint256 indexed invoiceId);
    event RiskTierMigrationRequested(uint256 indexed invoiceId, uint8 fromTier, uint8 toTier);
    event RiskTierMigrationApproved(uint256 indexed invoiceId, uint8 fromTier, uint8 toTier);

    constructor(IIdentityRegistry _identityRegistry) Ownable(msg.sender) {
        identityRegistry = _identityRegistry;
    }

    function setVault(address vault, bool allowed) external onlyOwner {
        isVault[vault] = allowed;
        emit VaultUpdated(vault, allowed);
    }

    function setServicer(address servicer, bool allowed) external onlyOwner {
        isServicer[servicer] = allowed;
        emit ServicerUpdated(servicer, allowed);
    }

    function setRiskManager(RiskManager newRiskManager) external onlyOwner {
        riskManager = newRiskManager;
        emit RiskManagerUpdated(address(newRiskManager));
    }

    function requestRiskTierMigration(uint256 invoiceId, uint8 newTier) external {
        Invoice storage inv = _invoices[invoiceId];
        require(inv.issuer == msg.sender);
        require(newTier != inv.riskTier);
        riskTierMigrationRequests[invoiceId] = RiskTierMigrationRequest({requestedTier: newTier, pending: true});
        emit RiskTierMigrationRequested(invoiceId, inv.riskTier, newTier);
    }

    function approveRiskTierMigration(uint256 invoiceId) external onlyOwner {
        RiskTierMigrationRequest memory req = riskTierMigrationRequests[invoiceId];
        require(req.pending);

        Invoice storage inv = _invoices[invoiceId];
        uint8 fromTier = inv.riskTier;
        uint8 toTier = req.requestedTier;
        inv.riskTier = toTier;
        delete riskTierMigrationRequests[invoiceId];

        RiskManager rm = riskManager;
        if (address(rm) != address(0)) {
            if (inv.confidential) {
                euint256 outstanding = Nox.sub(inv.fundedAmountEncrypted, inv.repaidAmountEncrypted);
                Nox.allow(outstanding, address(rm));
                rm.migrateConfidentialTier(fromTier, toTier, outstanding);
            } else {
                uint256 outstandingPlain = inv.fundedAmount >= inv.repaidAmount ? inv.fundedAmount - inv.repaidAmount : 0;
                rm.migratePlainTier(fromTier, toTier, outstandingPlain);
            }
        }

        emit RiskTierMigrationApproved(invoiceId, fromTier, toTier);
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        return _invoices[invoiceId];
    }

    function getFundingData(
        uint256 invoiceId
    )
        external
        view
        returns (
            Status status,
            address issuer,
            address settlementRecipient,
            bytes32 obligorHash,
            bytes32 obligorGroupHash,
            uint8 riskTier
        )
    {
        Invoice storage inv = _invoices[invoiceId];
        return (inv.status, inv.issuer, inv.settlementRecipient, inv.obligorHash, inv.obligorGroupHash, inv.riskTier);
    }

    function createInvoice(
        uint256 faceValue,
        uint64 dueDate,
        address settlementRecipient,
        bytes32 metadataHash,
        bytes32 invoiceRef,
        bytes32 obligorHash,
        bytes32 obligorGroupHash,
        uint8 riskTier,
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
            invoiceRef: invoiceRef,
            obligorHash: obligorHash,
            obligorGroupHash: obligorGroupHash,
            riskTier: riskTier
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
        inv.obligorHash = obligorHash;
        inv.obligorGroupHash = obligorGroupHash;
        inv.riskTier = riskTier;
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
        bytes32 obligorHash,
        bytes32 obligorGroupHash,
        uint8 riskTier,
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
                invoiceRef: invoiceRef,
                obligorHash: obligorHash,
                obligorGroupHash: obligorGroupHash,
                riskTier: riskTier
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
        inv.obligorHash = obligorHash;
        inv.obligorGroupHash = obligorGroupHash;
        inv.riskTier = riskTier;
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
        require(isServicer[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Funded || inv.status == Status.Disputed);
        euint256 newRepaid = Nox.add(inv.repaidAmountEncrypted, amount);
        inv.repaidAmountEncrypted = newRepaid;
        Nox.allowThis(newRepaid);
        Nox.allow(newRepaid, inv.issuer);
        Nox.allow(newRepaid, owner());
        emit InvoiceRepaidEncrypted(invoiceId, euint256.unwrap(newRepaid));
    }

    function markDisputed(uint256 invoiceId) external {
        require(isServicer[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Funded);
        inv.status = Status.Disputed;
        emit InvoiceDisputed(invoiceId);
    }

    function resolveDispute(uint256 invoiceId) external {
        require(isServicer[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Disputed);
        inv.status = Status.Funded;
        emit InvoiceDisputeResolved(invoiceId);
    }

    function markDefaulted(uint256 invoiceId) external {
        require(isServicer[msg.sender]);
        Invoice storage inv = _invoices[invoiceId];
        require(inv.status == Status.Funded || inv.status == Status.Disputed);
        inv.status = Status.Defaulted;
        emit InvoiceDefaulted(invoiceId);
    }
}
