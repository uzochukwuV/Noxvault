// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Nox, euint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {InvoiceRegistry} from "../invoice/InvoiceRegistry.sol";
import {ERC7984FactoringVault} from "../vault/ERC7984FactoringVault.sol";

contract DisclosureManager is Ownable2Step {
    uint8 public constant FIELD_FACE_VALUE = 1;
    uint8 public constant FIELD_FUNDED = 2;
    uint8 public constant FIELD_REPAID = 4;

    mapping(address => bool) public isAuditor;
    mapping(address => bool) public isRegulator;
    mapping(address => bool) public isDisclosureOfficer;

    event AuditorUpdated(address indexed auditor, bool allowed);
    event RegulatorUpdated(address indexed regulator, bool allowed);
    event DisclosureOfficerUpdated(address indexed officer, bool allowed);
    event InvoiceDisclosed(uint256 indexed invoiceId, address indexed viewer, uint8 fields);
    event InvestorSharesDisclosed(address indexed vault, address indexed investor, address indexed viewer);

    error Unauthorized(address sender);

    constructor() Ownable(msg.sender) {}

    function setAuditor(address auditor, bool allowed) external onlyOwner {
        isAuditor[auditor] = allowed;
        emit AuditorUpdated(auditor, allowed);
    }

    function setRegulator(address regulator, bool allowed) external onlyOwner {
        isRegulator[regulator] = allowed;
        emit RegulatorUpdated(regulator, allowed);
    }

    function setDisclosureOfficer(address officer, bool allowed) external onlyOwner {
        isDisclosureOfficer[officer] = allowed;
        emit DisclosureOfficerUpdated(officer, allowed);
    }

    function discloseInvoice(
        InvoiceRegistry invoiceRegistry,
        uint256 invoiceId,
        address viewer,
        uint8 fields
    ) external {
        if (!isDisclosureOfficer[msg.sender] && msg.sender != owner()) revert Unauthorized(msg.sender);
        if (!isAuditor[viewer] && !isRegulator[viewer] && viewer != owner()) revert Unauthorized(viewer);

        InvoiceRegistry.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);

        if ((fields & FIELD_FACE_VALUE) != 0) {
            _allowIfNonZero(inv.faceValueEncrypted, viewer);
        }
        if ((fields & FIELD_FUNDED) != 0) {
            _allowIfNonZero(inv.fundedAmountEncrypted, viewer);
        }
        if ((fields & FIELD_REPAID) != 0) {
            _allowIfNonZero(inv.repaidAmountEncrypted, viewer);
        }

        emit InvoiceDisclosed(invoiceId, viewer, fields);
    }

    function discloseInvestorShares(
        ERC7984FactoringVault vault,
        address investor,
        address viewer
    ) external {
        if (!isDisclosureOfficer[msg.sender] && msg.sender != owner()) revert Unauthorized(msg.sender);
        if (!isAuditor[viewer] && !isRegulator[viewer] && viewer != owner()) revert Unauthorized(viewer);

        euint256 bal = vault.sharesOf(investor);
        _allowIfNonZero(bal, viewer);
        emit InvestorSharesDisclosed(address(vault), investor, viewer);
    }

    function _allowIfNonZero(euint256 handle, address viewer) private {
        if (euint256.unwrap(handle) == bytes32(0)) return;
        Nox.allow(handle, viewer);
    }
}

