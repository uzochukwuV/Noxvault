// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TEEType} from "@iexec-nox/nox-protocol-contracts/contracts/shared/TypeUtils.sol";

contract MockNoxCompute {
    mapping(bytes32 => bytes32) private _values;
    mapping(bytes32 => bool) private _publicDecryptable;

    function wrapAsPublicHandle(bytes32 value, TEEType teeType) external returns (bytes32) {
        bytes32 handle = _publicHandle(value, teeType);
        _values[handle] = value;
        return handle;
    }

    function validateInputProof(bytes32, address, bytes calldata, TEEType) external {}

    function validateDecryptionProof(
        bytes32,
        bytes calldata decryptionProof
    ) external pure returns (bytes memory) {
        if (decryptionProof.length >= 32) {
            return decryptionProof[decryptionProof.length - 32:];
        }
        return decryptionProof;
    }

    function add(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        unchecked {
            result = _publicHandle(bytes32(a + b), TEEType.Uint256);
        }
        _values[result] = bytes32(a + b);
    }

    function sub(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        unchecked {
            result = _publicHandle(bytes32(a - b), TEEType.Uint256);
        }
        _values[result] = bytes32(a - b);
    }

    function safeAdd(
        bytes32 leftHandOperand,
        bytes32 rightHandOperand
    ) external returns (bytes32 success, bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        unchecked {
            uint256 c = a + b;
            bool ok = c >= a;
            success = _publicHandle(bytes32(uint256(ok ? 1 : 0)), TEEType.Bool);
            result = _publicHandle(bytes32(c), TEEType.Uint256);
            _values[success] = bytes32(uint256(ok ? 1 : 0));
            _values[result] = bytes32(c);
        }
    }

    function safeSub(
        bytes32 leftHandOperand,
        bytes32 rightHandOperand
    ) external returns (bytes32 success, bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        bool ok = a >= b;
        success = _publicHandle(bytes32(uint256(ok ? 1 : 0)), TEEType.Bool);
        uint256 c = ok ? (a - b) : a;
        result = _publicHandle(bytes32(c), TEEType.Uint256);
        _values[success] = bytes32(uint256(ok ? 1 : 0));
        _values[result] = bytes32(c);
    }

    function select(
        bytes32 condition,
        bytes32 ifTrue,
        bytes32 ifFalse
    ) external view returns (bytes32 result) {
        return _values[condition] == bytes32(0) ? ifFalse : ifTrue;
    }

    function isAllowed(bytes32, address) external pure returns (bool) {
        return true;
    }

    function validateAllowedForAll(address, bytes32[] calldata) external pure {}

    function allow(bytes32, address) external pure {}

    function allowTransient(bytes32, address) external pure {}

    function disallowTransient(bytes32, address) external pure {}

    function addViewer(bytes32, address) external pure {}

    function isViewer(bytes32 handle, address) external view returns (bool) {
        return _publicDecryptable[handle];
    }

    function allowPublicDecryption(bytes32 handle) external {
        _publicDecryptable[handle] = true;
    }

    function isPubliclyDecryptable(bytes32 handle) external view returns (bool) {
        return _publicDecryptable[handle];
    }

    function _publicHandle(bytes32 value, TEEType teeType) private view returns (bytes32) {
        bytes32 h = keccak256(abi.encodePacked(block.chainid, teeType, value));
        uint256 u = uint256(h);
        u &= ~(uint256(1) << (8 * (31 - 6)));
        return bytes32(u);
    }
}

