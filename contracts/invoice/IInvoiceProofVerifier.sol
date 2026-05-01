// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IInvoiceProofVerifier {
    struct InvoiceProofContext {
        address issuer;
        uint256 faceValue;
        uint64 dueDate;
        address settlementRecipient;
        bytes32 metadataHash;
        bytes32 invoiceRef;
    }

    function verify(InvoiceProofContext calldata ctx, bytes calldata proof) external view returns (bool);
}

