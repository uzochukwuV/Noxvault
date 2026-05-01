// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAttestationRegistry {
    struct Attestation {
        bytes32 uid;
        bytes32 schemaId;
        address attester;
        address subject;
        bytes32 dataHash;
        uint64 time;
        uint64 expirationTime;
        bool revoked;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}

