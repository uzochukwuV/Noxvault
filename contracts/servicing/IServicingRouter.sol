// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {euint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

interface IServicingRouter {
    function reportPayment(
        uint256 invoiceId,
        euint256 amount,
        address payer,
        bytes32 referenceHash
    ) external returns (uint256 paymentId);
}

