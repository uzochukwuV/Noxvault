// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIdentityRegistry} from "../identity/IIdentityRegistry.sol";
import {InvoiceRegistry} from "../invoice/InvoiceRegistry.sol";
import {RiskManager} from "../risk/RiskManager.sol";

contract PlainFactoringVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant INVESTOR_ROLE = 1;
    uint256 public constant OPERATOR_ROLE = 3;

    IERC20 public immutable asset;
    IIdentityRegistry public immutable identityRegistry;
    InvoiceRegistry public immutable invoiceRegistry;
    RiskManager public riskManager;

    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    struct RedeemRequest {
        address owner;
        uint256 shares;
        bool cancelled;
        bool fulfilled;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => RedeemRequest) public redeemRequests;

    event Deposited(address indexed investor, uint256 amount, uint256 sharesMinted);
    event RedeemRequested(uint256 indexed requestId, address indexed investor, uint256 shares);
    event RedeemCancelled(uint256 indexed requestId);
    event RedeemFulfilled(uint256 indexed requestId, uint256 sharesBurned, uint256 amountOut);
    event InvoiceFunded(uint256 indexed invoiceId, uint256 amount);
    event InvoiceRepaid(uint256 indexed invoiceId, uint256 amount);
    event RiskManagerUpdated(address indexed riskManager);

    constructor(IERC20 _asset, IIdentityRegistry _identityRegistry, InvoiceRegistry _invoiceRegistry)
        Ownable(msg.sender)
    {
        asset = _asset;
        identityRegistry = _identityRegistry;
        invoiceRegistry = _invoiceRegistry;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setRiskManager(RiskManager newRiskManager) external onlyOwner {
        riskManager = newRiskManager;
        emit RiskManagerUpdated(address(newRiskManager));
    }

    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        require(identityRegistry.isVerified(msg.sender, INVESTOR_ROLE));
        require(amount != 0);
        asset.safeTransferFrom(msg.sender, address(this), amount);
        sharesOf[msg.sender] += amount;
        totalShares += amount;
        emit Deposited(msg.sender, amount, amount);
    }

    function requestRedeem(uint256 shares) external whenNotPaused returns (uint256 requestId) {
        require(identityRegistry.isVerified(msg.sender, INVESTOR_ROLE));
        require(shares != 0);
        requestId = nextRequestId++;
        redeemRequests[requestId] = RedeemRequest({
            owner: msg.sender,
            shares: shares,
            cancelled: false,
            fulfilled: false
        });
        emit RedeemRequested(requestId, msg.sender, shares);
    }

    function cancelRedeem(uint256 requestId) external whenNotPaused {
        RedeemRequest storage r = redeemRequests[requestId];
        require(r.owner == msg.sender);
        require(!r.cancelled);
        require(!r.fulfilled);
        r.cancelled = true;
        emit RedeemCancelled(requestId);
    }

    function fulfillRedeem(uint256 requestId, uint256 amountOut) external whenNotPaused nonReentrant {
        require(identityRegistry.isVerified(msg.sender, OPERATOR_ROLE));
        RedeemRequest storage r = redeemRequests[requestId];
        require(!r.cancelled);
        require(!r.fulfilled);
        require(r.shares <= sharesOf[r.owner]);
        require(amountOut != 0);

        sharesOf[r.owner] -= r.shares;
        totalShares -= r.shares;
        r.fulfilled = true;

        asset.safeTransfer(r.owner, amountOut);
        emit RedeemFulfilled(requestId, r.shares, amountOut);
    }

    function fundInvoice(uint256 invoiceId, uint256 amount) external whenNotPaused nonReentrant {
        require(identityRegistry.isVerified(msg.sender, OPERATOR_ROLE));
        require(amount != 0);
        InvoiceRegistry.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);
        require(inv.status == InvoiceRegistry.Status.Created);
        if (address(riskManager) != address(0)) {
            riskManager.consumePlainFunding(inv.issuer, amount);
        }
        asset.safeTransfer(inv.settlementRecipient, amount);
        invoiceRegistry.markFunded(invoiceId, amount);
        emit InvoiceFunded(invoiceId, amount);
    }

    function repayInvoice(uint256 invoiceId, uint256 amount) external whenNotPaused nonReentrant {
        require(amount != 0);
        asset.safeTransferFrom(msg.sender, address(this), amount);
        InvoiceRegistry.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);
        invoiceRegistry.markRepaid(invoiceId, amount);
        if (address(riskManager) != address(0)) {
            riskManager.recordPlainRepayment(inv.issuer, amount);
        }
        emit InvoiceRepaid(invoiceId, amount);
    }
}
