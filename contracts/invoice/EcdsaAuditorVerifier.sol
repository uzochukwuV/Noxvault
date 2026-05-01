// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IInvoiceProofVerifier} from "./IInvoiceProofVerifier.sol";

contract EcdsaAuditorVerifier is Ownable2Step, EIP712, IInvoiceProofVerifier {
    bytes32 private constant _TYPEHASH =
        keccak256(
            "InvoiceProof(address issuer,uint256 faceValue,uint64 dueDate,address settlementRecipient,bytes32 metadataHash,bytes32 invoiceRef,bytes32 obligorHash,uint8 riskTier,uint64 validUntil)"
        );

    mapping(address => bool) public isAuditor;

    event AuditorUpdated(address indexed auditor, bool allowed);

    constructor() Ownable(msg.sender) EIP712("InvoiceProof", "1") {}

    function setAuditor(address auditor, bool allowed) external onlyOwner {
        isAuditor[auditor] = allowed;
        emit AuditorUpdated(auditor, allowed);
    }

    function verify(InvoiceProofContext calldata ctx, bytes calldata proof) external view returns (bool) {
        (uint64 validUntil, bytes memory signature) = abi.decode(proof, (uint64, bytes));
        if (validUntil != 0 && block.timestamp > validUntil) return false;

        bytes32 structHash = keccak256(
            abi.encode(
                _TYPEHASH,
                ctx.issuer,
                ctx.faceValue,
                ctx.dueDate,
                ctx.settlementRecipient,
                ctx.metadataHash,
                ctx.invoiceRef,
                ctx.obligorHash,
                ctx.riskTier,
                validUntil
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        return isAuditor[signer];
    }
}
