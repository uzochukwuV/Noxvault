// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAttestationRegistry} from "../attestations/IAttestationRegistry.sol";
import {IConfidentialInvoiceProofVerifier} from "./IConfidentialInvoiceProofVerifier.sol";

contract ConfidentialAttestationVerifier is Ownable2Step, IConfidentialInvoiceProofVerifier {
    IAttestationRegistry public immutable attestationRegistry;

    mapping(bytes32 => bool) public isSchemaAllowed;
    mapping(address => bool) public isAttesterAllowed;

    event SchemaAllowed(bytes32 indexed schemaId, bool allowed);
    event AttesterAllowed(address indexed attester, bool allowed);

    constructor(IAttestationRegistry _attestationRegistry) Ownable(msg.sender) {
        attestationRegistry = _attestationRegistry;
    }

    function setSchemaAllowed(bytes32 schemaId, bool allowed) external onlyOwner {
        isSchemaAllowed[schemaId] = allowed;
        emit SchemaAllowed(schemaId, allowed);
    }

    function setAttesterAllowed(address attester, bool allowed) external onlyOwner {
        isAttesterAllowed[attester] = allowed;
        emit AttesterAllowed(attester, allowed);
    }

    function verify(
        ConfidentialInvoiceProofContext calldata ctx,
        bytes calldata proof
    ) external view returns (bool) {
        bytes32 uid = abi.decode(proof, (bytes32));
        IAttestationRegistry.Attestation memory a = attestationRegistry.getAttestation(uid);
        if (a.uid == bytes32(0)) return false;
        if (a.revoked) return false;
        if (a.expirationTime != 0 && block.timestamp > a.expirationTime) return false;
        if (!isSchemaAllowed[a.schemaId]) return false;
        if (!isAttesterAllowed[a.attester]) return false;
        if (a.subject != ctx.issuer) return false;

        bytes32 expectedHash = keccak256(
            abi.encode(
                ctx.issuer,
                ctx.faceValueHandle,
                ctx.dueDate,
                ctx.settlementRecipient,
                ctx.metadataHash,
                ctx.invoiceRef,
                ctx.obligorHash,
                ctx.obligorGroupHash,
                ctx.riskTier
            )
        );
        return a.dataHash == expectedHash;
    }
}
