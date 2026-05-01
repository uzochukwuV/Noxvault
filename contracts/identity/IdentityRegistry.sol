// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "./IIdentityRegistry.sol";

contract IdentityRegistry is Ownable2Step, IIdentityRegistry {
    mapping(address => mapping(uint256 => bool)) private _verified;

    event VerificationUpdated(address indexed user, uint256 indexed role, bool verified);

    constructor() Ownable(msg.sender) {}

    function isVerified(address user, uint256 role) external view returns (bool) {
        return _verified[user][role];
    }

    function setVerified(address user, uint256 role, bool verified) external onlyOwner {
        _verified[user][role] = verified;
        emit VerificationUpdated(user, role, verified);
    }
}
