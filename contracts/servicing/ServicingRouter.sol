// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {InvoiceRegistry} from "../invoice/InvoiceRegistry.sol";
import {RiskManager} from "../risk/RiskManager.sol";
import {Nox, euint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract ServicingRouter is Ownable2Step {
    struct Payment {
        euint256 amount;
        address payer;
        uint64 reportedAt;
        bool disputed;
        bool finalized;
        bytes32 referenceHash;
        bytes32 disputeReasonHash;
    }

    InvoiceRegistry public immutable invoiceRegistry;
    RiskManager public riskManager;
    uint64 public disputeWindow = 1 days;

    mapping(address => bool) public isServicer;
    mapping(address => bool) public isResolver;

    mapping(uint256 => uint256) public nextPaymentId;
    mapping(uint256 => mapping(uint256 => Payment)) private _payments;

    event ServicerUpdated(address indexed servicer, bool allowed);
    event ResolverUpdated(address indexed resolver, bool allowed);
    event DisputeWindowUpdated(uint64 newWindow);
    event RiskManagerUpdated(address indexed riskManager);

    event PaymentReported(
        uint256 indexed invoiceId,
        uint256 indexed paymentId,
        address indexed payer,
        bytes32 amountHandle,
        bytes32 referenceHash
    );
    event PaymentDisputed(uint256 indexed invoiceId, uint256 indexed paymentId, bytes32 reasonHash);
    event PaymentResolved(uint256 indexed invoiceId, uint256 indexed paymentId, bool accepted, bytes32 amountHandle);
    event PaymentFinalized(uint256 indexed invoiceId, uint256 indexed paymentId, bytes32 amountHandle);
    event InvoiceDefaulted(uint256 indexed invoiceId, bytes32 reasonHash);

    error Unauthorized(address sender);
    error InvalidPayment(uint256 invoiceId, uint256 paymentId);
    error DisputeWindowOpen(uint64 nowTs, uint64 deadlineTs);
    error DisputeWindowClosed(uint64 nowTs, uint64 deadlineTs);

    constructor(InvoiceRegistry _invoiceRegistry) Ownable(msg.sender) {
        invoiceRegistry = _invoiceRegistry;
    }

    function setRiskManager(RiskManager newRiskManager) external onlyOwner {
        riskManager = newRiskManager;
        emit RiskManagerUpdated(address(newRiskManager));
    }

    function setServicer(address servicer, bool allowed) external onlyOwner {
        isServicer[servicer] = allowed;
        emit ServicerUpdated(servicer, allowed);
    }

    function setResolver(address resolver, bool allowed) external onlyOwner {
        isResolver[resolver] = allowed;
        emit ResolverUpdated(resolver, allowed);
    }

    function setDisputeWindow(uint64 newWindow) external onlyOwner {
        disputeWindow = newWindow;
        emit DisputeWindowUpdated(newWindow);
    }

    function getPayment(uint256 invoiceId, uint256 paymentId) external view returns (Payment memory) {
        return _payments[invoiceId][paymentId];
    }

    function reportPayment(
        uint256 invoiceId,
        euint256 amount,
        address payer,
        bytes32 referenceHash
    ) external returns (uint256 paymentId) {
        if (!invoiceRegistry.isVault(msg.sender) && !isServicer[msg.sender]) revert Unauthorized(msg.sender);

        paymentId = nextPaymentId[invoiceId]++;
        Payment storage p = _payments[invoiceId][paymentId];
        p.amount = amount;
        p.payer = payer;
        p.reportedAt = uint64(block.timestamp);
        p.disputed = false;
        p.finalized = false;
        p.referenceHash = referenceHash;

        Nox.allowThis(amount);
        Nox.allow(amount, invoiceRegistry.owner());
        Nox.allow(amount, payer);

        emit PaymentReported(invoiceId, paymentId, payer, euint256.unwrap(amount), referenceHash);
    }

    function disputePayment(uint256 invoiceId, uint256 paymentId, bytes32 reasonHash) external {
        InvoiceRegistry.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);
        if (msg.sender != inv.issuer && msg.sender != invoiceRegistry.owner()) revert Unauthorized(msg.sender);

        Payment storage p = _payments[invoiceId][paymentId];
        if (p.reportedAt == 0) revert InvalidPayment(invoiceId, paymentId);

        uint64 deadline = p.reportedAt + disputeWindow;
        if (block.timestamp > deadline) revert DisputeWindowClosed(uint64(block.timestamp), deadline);
        if (p.finalized) revert InvalidPayment(invoiceId, paymentId);

        p.disputed = true;
        p.disputeReasonHash = reasonHash;
        invoiceRegistry.markDisputed(invoiceId);
        emit PaymentDisputed(invoiceId, paymentId, reasonHash);
    }

    function resolveDispute(
        uint256 invoiceId,
        uint256 paymentId,
        bool acceptPayment,
        bytes calldata proofsBundle
    ) external {
        if (!isResolver[msg.sender] && msg.sender != invoiceRegistry.owner()) revert Unauthorized(msg.sender);

        Payment storage p = _payments[invoiceId][paymentId];
        if (p.reportedAt == 0) revert InvalidPayment(invoiceId, paymentId);
        if (!p.disputed) revert InvalidPayment(invoiceId, paymentId);
        if (p.finalized) revert InvalidPayment(invoiceId, paymentId);

        p.finalized = true;
        if (acceptPayment) {
            invoiceRegistry.markRepaidEncrypted(invoiceId, p.amount, proofsBundle);
            InvoiceRegistry.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);
            if (address(riskManager) != address(0)) {
                riskManager.commitConfidentialRepayment(
                    inv.issuer,
                    inv.obligorHash,
                    inv.obligorGroupHash,
                    inv.riskTier,
                    p.amount,
                    proofsBundle
                );
            }
        }
        invoiceRegistry.resolveDispute(invoiceId);
        emit PaymentResolved(invoiceId, paymentId, acceptPayment, euint256.unwrap(p.amount));
    }

    function finalizePayment(uint256 invoiceId, uint256 paymentId, bytes calldata proofsBundle) external {
        Payment storage p = _payments[invoiceId][paymentId];
        if (p.reportedAt == 0) revert InvalidPayment(invoiceId, paymentId);
        if (p.finalized) revert InvalidPayment(invoiceId, paymentId);
        if (p.disputed) revert InvalidPayment(invoiceId, paymentId);

        uint64 deadline = p.reportedAt + disputeWindow;
        if (block.timestamp < deadline) revert DisputeWindowOpen(uint64(block.timestamp), deadline);

        p.finalized = true;
        invoiceRegistry.markRepaidEncrypted(invoiceId, p.amount, proofsBundle);
        InvoiceRegistry.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);
        if (address(riskManager) != address(0)) {
            riskManager.commitConfidentialRepayment(
                inv.issuer,
                inv.obligorHash,
                inv.obligorGroupHash,
                inv.riskTier,
                p.amount,
                proofsBundle
            );
        }
        emit PaymentFinalized(invoiceId, paymentId, euint256.unwrap(p.amount));
    }

    function markDefaulted(uint256 invoiceId, bytes32 reasonHash) external {
        if (!isServicer[msg.sender] && msg.sender != invoiceRegistry.owner()) revert Unauthorized(msg.sender);
        invoiceRegistry.markDefaulted(invoiceId);
        emit InvoiceDefaulted(invoiceId, reasonHash);
    }
}
