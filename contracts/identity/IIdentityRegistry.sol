// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IIdentityRegistry {
    function isVerified(address user, uint256 role) external view returns (bool);
}

