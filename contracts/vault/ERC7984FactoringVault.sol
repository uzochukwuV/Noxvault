// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentityRegistry} from "../identity/IIdentityRegistry.sol";
import {InvoiceRegistry} from "../invoice/InvoiceRegistry.sol";
import {IServicingRouter} from "../servicing/IServicingRouter.sol";
import {RiskManager} from "../risk/RiskManager.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984Receiver.sol";
import {Nox, ebool, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract ERC7984FactoringVault is Ownable2Step, Pausable, ReentrancyGuard, IERC7984Receiver {
    uint256 public constant INVESTOR_ROLE = 1;
    uint256 public constant OPERATOR_ROLE = 3;

    IERC7984 public immutable cashToken;
    IIdentityRegistry public immutable identityRegistry;
    InvoiceRegistry public immutable invoiceRegistry;
    IServicingRouter public servicingRouter;
    RiskManager public riskManager;

    address public operator;

    euint256 public totalShares;
    mapping(address => euint256) public sharesOf;

    struct RedeemRequest {
        address owner;
        euint256 shares;
        bool cancelled;
        bool fulfilled;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => RedeemRequest) public redeemRequests;

    event OperatorUpdated(address indexed operator);
    event ServicingRouterUpdated(address indexed servicingRouter);
    event RiskManagerUpdated(address indexed riskManager);
    event DepositReceived(address indexed investor, bytes32 amountHandle);
    event RepaymentReceived(uint256 indexed invoiceId, bytes32 amountHandle);
    event RedeemRequested(uint256 indexed requestId, address indexed investor, bytes32 sharesHandle);
    event RedeemCancelled(uint256 indexed requestId);
    event RedeemFulfilled(uint256 indexed requestId, bytes32 amountHandle);
    event InvoiceFunded(uint256 indexed invoiceId, bytes32 amountHandle);

    constructor(
        IERC7984 _cashToken,
        IIdentityRegistry _identityRegistry,
        InvoiceRegistry _invoiceRegistry,
        address _operator
    ) Ownable(msg.sender) {
        cashToken = _cashToken;
        identityRegistry = _identityRegistry;
        invoiceRegistry = _invoiceRegistry;
        _setOperator(_operator);

        totalShares = euint256.wrap(bytes32(0));
        Nox.allowThis(totalShares);
        Nox.allow(totalShares, owner());
        Nox.allow(totalShares, operator);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setOperator(address newOperator) external onlyOwner {
        _setOperator(newOperator);
    }

    function setServicingRouter(IServicingRouter newServicingRouter) external onlyOwner {
        servicingRouter = newServicingRouter;
        emit ServicingRouterUpdated(address(newServicingRouter));
    }

    function setRiskManager(RiskManager newRiskManager) external onlyOwner {
        riskManager = newRiskManager;
        emit RiskManagerUpdated(address(newRiskManager));
    }

    function requestRedeem(
        externalEuint256 sharesHandle,
        bytes calldata sharesProof
    ) external whenNotPaused returns (uint256 requestId) {
        require(identityRegistry.isVerified(msg.sender, INVESTOR_ROLE));
        euint256 shares = Nox.fromExternal(sharesHandle, sharesProof);
        requestId = nextRequestId++;
        redeemRequests[requestId] = RedeemRequest({
            owner: msg.sender,
            shares: shares,
            cancelled: false,
            fulfilled: false
        });
        Nox.allowThis(shares);
        Nox.allow(shares, msg.sender);
        Nox.allow(shares, operator);
        emit RedeemRequested(requestId, msg.sender, euint256.unwrap(shares));
    }

    function cancelRedeem(uint256 requestId) external whenNotPaused {
        RedeemRequest storage r = redeemRequests[requestId];
        require(r.owner == msg.sender);
        require(!r.cancelled);
        require(!r.fulfilled);
        r.cancelled = true;
        emit RedeemCancelled(requestId);
    }

    function fulfillRedeem(
        uint256 requestId,
        externalEuint256 amountHandle,
        bytes calldata amountProof
    ) external whenNotPaused nonReentrant {
        require(msg.sender == operator);
        RedeemRequest storage r = redeemRequests[requestId];
        require(!r.cancelled);
        require(!r.fulfilled);

        euint256 amount = Nox.fromExternal(amountHandle, amountProof);

        sharesOf[r.owner] = Nox.sub(sharesOf[r.owner], r.shares);
        totalShares = Nox.sub(totalShares, r.shares);
        r.fulfilled = true;

        _allowShares(r.owner);
        Nox.allowThis(totalShares);
        Nox.allow(totalShares, owner());
        Nox.allow(totalShares, operator);

        Nox.allowTransient(amount, address(cashToken));
        cashToken.confidentialTransfer(r.owner, amount);
        emit RedeemFulfilled(requestId, euint256.unwrap(amount));
    }

    function fundInvoice(
        uint256 invoiceId,
        externalEuint256 amountHandle,
        bytes calldata amountProof
    ) external whenNotPaused nonReentrant {
        require(address(riskManager) == address(0));
        require(msg.sender == operator);
        euint256 amount = Nox.fromExternal(amountHandle, amountProof);
        (InvoiceRegistry.Status status, , address settlementRecipient, , ) = invoiceRegistry.getFundingData(invoiceId);
        require(status == InvoiceRegistry.Status.Created);

        Nox.allowTransient(amount, address(cashToken));
        euint256 transferred = cashToken.confidentialTransfer(settlementRecipient, amount);
        invoiceRegistry.markFundedEncrypted(invoiceId, transferred);
        emit InvoiceFunded(invoiceId, euint256.unwrap(transferred));
    }

    function fundInvoice(
        uint256 invoiceId,
        externalEuint256 amountHandle,
        bytes calldata amountProof,
        bytes calldata riskProofsBundle
    ) external whenNotPaused nonReentrant {
        require(address(riskManager) != address(0));
        require(msg.sender == operator);

        euint256 amount = Nox.fromExternal(amountHandle, amountProof);
        (
            InvoiceRegistry.Status status,
            address issuer,
            address settlementRecipient,
            bytes32 obligorHash,
            uint8 riskTier
        ) = invoiceRegistry.getFundingData(invoiceId);
        require(status == InvoiceRegistry.Status.Created);
        euint256 transferred = _transferOut(settlementRecipient, amount);
        invoiceRegistry.markFundedEncrypted(invoiceId, transferred);
        _riskCommitAfterTransfer(issuer, obligorHash, riskTier, transferred, riskProofsBundle);
        emit InvoiceFunded(invoiceId, euint256.unwrap(transferred));
    }

    function _transferOut(address to, euint256 amount) private returns (euint256 transferred) {
        Nox.allowTransient(amount, address(cashToken));
        transferred = cashToken.confidentialTransfer(to, amount);
    }

    function _riskCommitAfterTransfer(
        address issuer,
        bytes32 obligorHash,
        uint8 riskTier,
        euint256 transferred,
        bytes calldata riskProofsBundle
    ) private {
        (euint256 newIssuerOut, euint256 newPoolOut) = riskManager.verifyConfidentialFunding(
            issuer,
            obligorHash,
            riskTier,
            transferred,
            riskProofsBundle
        );
        riskManager.commitConfidentialFunding(issuer, transferred, newIssuerOut, newPoolOut);
    }

    function onConfidentialTransferReceived(
        address,
        address from,
        euint256 amount,
        bytes calldata data
    ) external returns (ebool) {
        require(msg.sender == address(cashToken));

        if (data.length == 0) {
            require(identityRegistry.isVerified(from, INVESTOR_ROLE));
            sharesOf[from] = Nox.add(sharesOf[from], amount);
            totalShares = Nox.add(totalShares, amount);

            _allowShares(from);
            Nox.allowThis(totalShares);
            Nox.allow(totalShares, owner());
            Nox.allow(totalShares, operator);

            emit DepositReceived(from, euint256.unwrap(amount));
        } else {
            require(data.length == 32);
            uint256 invoiceId = abi.decode(data, (uint256));
            address router = address(servicingRouter);
            require(router != address(0));
            servicingRouter.reportPayment(invoiceId, amount, from, bytes32(0));
            emit RepaymentReceived(invoiceId, euint256.unwrap(amount));
        }

        ebool accepted = Nox.toEbool(true);
        Nox.allowTransient(accepted, msg.sender);
        return accepted;
    }

    function _setOperator(address newOperator) private {
        require(newOperator != address(0));
        require(identityRegistry.isVerified(newOperator, OPERATOR_ROLE));
        operator = newOperator;
        emit OperatorUpdated(newOperator);
    }

    function _allowShares(address investor) private {
        euint256 bal = sharesOf[investor];
        Nox.allowThis(bal);
        Nox.allow(bal, investor);
        Nox.allow(bal, operator);
    }
}
