// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IConfidentialInvoiceProofVerifier {
    struct ConfidentialInvoiceProofContext {
        address issuer;
        bytes32 faceValueHandle;
        uint64 dueDate;
        address settlementRecipient;
        bytes32 metadataHash;
        bytes32 invoiceRef;
        bytes32 obligorHash;
        bytes32 obligorGroupHash;
        uint8 riskTier;
    }

    function verify(
        ConfidentialInvoiceProofContext calldata ctx,
        bytes calldata proof
    ) external view returns (bool);
}
