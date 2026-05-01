// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TEEType} from "@iexec-nox/nox-protocol-contracts/contracts/shared/TypeUtils.sol";

contract MockNoxCompute {
    mapping(bytes32 => bytes32) private _values;
    mapping(bytes32 => TEEType) private _types;
    mapping(bytes32 => bool) private _isPublic;
    mapping(bytes32 => bool) private _publicDecryptable;
    mapping(bytes32 => mapping(address => bool)) private _allowed;
    mapping(bytes32 => mapping(address => bool)) private _allowedTransient;

    function wrapAsPublicHandle(bytes32 value, TEEType teeType) external returns (bytes32) {
        bytes32 handle = _newHandle(value, teeType, true);
        return handle;
    }

    function validateInputProof(bytes32, address, bytes calldata, TEEType) external {}

    function validateDecryptionProof(
        bytes32 handle,
        bytes calldata decryptionProof
    ) external view returns (bytes memory) {
        bytes32 v = _values[handle];
        TEEType t = _types[handle];
        if (t == TEEType.Bool) {
            bytes1 expected = v == bytes32(0) ? bytes1(0x00) : bytes1(0x01);
            require(decryptionProof.length == 1);
            require(decryptionProof[0] == expected);
            return decryptionProof;
        }
        if (t == TEEType.Uint256) {
            require(decryptionProof.length == 32);
            require(bytes32(decryptionProof) == v);
            return decryptionProof;
        }
        revert();
    }

    function add(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        unchecked {
            result = _newHandle(bytes32(a + b), TEEType.Uint256, false);
        }
    }

    function sub(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        unchecked {
            result = _newHandle(bytes32(a - b), TEEType.Uint256, false);
        }
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
            success = _newHandle(bytes32(uint256(ok ? 1 : 0)), TEEType.Bool, false);
            result = _newHandle(bytes32(c), TEEType.Uint256, false);
        }
    }

    function safeSub(
        bytes32 leftHandOperand,
        bytes32 rightHandOperand
    ) external returns (bytes32 success, bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        bool ok = a >= b;
        success = _newHandle(bytes32(uint256(ok ? 1 : 0)), TEEType.Bool, false);
        uint256 c = ok ? (a - b) : a;
        result = _newHandle(bytes32(c), TEEType.Uint256, false);
    }

    function select(
        bytes32 condition,
        bytes32 ifTrue,
        bytes32 ifFalse
    ) external view returns (bytes32 result) {
        return _values[condition] == bytes32(0) ? ifFalse : ifTrue;
    }

    function lt(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        result = _newHandle(bytes32(uint256(a < b ? 1 : 0)), TEEType.Bool, false);
    }

    function le(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        result = _newHandle(bytes32(uint256(a <= b ? 1 : 0)), TEEType.Bool, false);
    }

    function gt(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        result = _newHandle(bytes32(uint256(a > b ? 1 : 0)), TEEType.Bool, false);
    }

    function ge(bytes32 leftHandOperand, bytes32 rightHandOperand) external returns (bytes32 result) {
        uint256 a = uint256(_values[leftHandOperand]);
        uint256 b = uint256(_values[rightHandOperand]);
        result = _newHandle(bytes32(uint256(a >= b ? 1 : 0)), TEEType.Bool, false);
    }

    function isAllowed(bytes32 handle, address account) external view returns (bool) {
        if (_isPublic[handle]) return true;
        if (_allowed[handle][account]) return true;
        if (_allowedTransient[handle][account]) return true;
        return false;
    }

    function validateAllowedForAll(address, bytes32[] calldata) external pure {}

    function allow(bytes32 handle, address account) external {
        _allowed[handle][account] = true;
    }

    function allowTransient(bytes32 handle, address account) external {
        _allowedTransient[handle][account] = true;
    }

    function disallowTransient(bytes32 handle, address account) external {
        _allowedTransient[handle][account] = false;
    }

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

    function _newHandle(bytes32 value, TEEType teeType, bool isPublic) private returns (bytes32 handle) {
        bytes32 h = keccak256(abi.encodePacked(block.chainid, teeType, value, isPublic));
        uint256 u = uint256(h);
        if (isPublic) {
            u &= ~(uint256(1) << (8 * (31 - 6)));
        } else {
            u |= (uint256(1) << (8 * (31 - 6)));
        }
        handle = bytes32(u);
        _values[handle] = value;
        _types[handle] = teeType;
        _isPublic[handle] = isPublic;
    }
}
