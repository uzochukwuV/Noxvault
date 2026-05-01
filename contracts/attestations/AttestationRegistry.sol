// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAttestationRegistry} from "./IAttestationRegistry.sol";

contract AttestationRegistry is Ownable2Step, IAttestationRegistry {
    mapping(address => uint64) public nonces;
    mapping(bytes32 => Attestation) private _attestations;

    event Attested(bytes32 indexed uid, bytes32 indexed schemaId, address indexed attester, address subject);
    event Revoked(bytes32 indexed uid, address indexed revoker);

    constructor() Ownable(msg.sender) {}

    function attest(
        bytes32 schemaId,
        address subject,
        bytes32 dataHash,
        uint64 expirationTime
    ) external returns (bytes32 uid) {
        uint64 nonce = nonces[msg.sender]++;
        uid = keccak256(abi.encodePacked(msg.sender, nonce, schemaId, subject, dataHash));
        Attestation storage a = _attestations[uid];
        a.uid = uid;
        a.schemaId = schemaId;
        a.attester = msg.sender;
        a.subject = subject;
        a.dataHash = dataHash;
        a.time = uint64(block.timestamp);
        a.expirationTime = expirationTime;
        a.revoked = false;
        emit Attested(uid, schemaId, msg.sender, subject);
    }

    function revoke(bytes32 uid) external {
        Attestation storage a = _attestations[uid];
        require(a.uid != bytes32(0));
        require(a.attester == msg.sender || owner() == msg.sender);
        require(!a.revoked);
        a.revoked = true;
        emit Revoked(uid, msg.sender);
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }
}
