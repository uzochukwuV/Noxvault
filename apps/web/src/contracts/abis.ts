import type { Abi } from "viem";

export const invoiceRegistryAbi = [
  {
    type: "function",
    name: "createInvoiceConfidential",
    stateMutability: "nonpayable",
    inputs: [
      { name: "faceValueHandle", type: "bytes32" },
      { name: "faceValueProof", type: "bytes" },
      { name: "dueDate", type: "uint64" },
      { name: "settlementRecipient", type: "address" },
      { name: "metadataHash", type: "bytes32" },
      { name: "invoiceRef", type: "bytes32" },
      { name: "obligorHash", type: "bytes32" },
      { name: "obligorGroupHash", type: "bytes32" },
      { name: "riskTier", type: "uint8" },
      { name: "verifier", type: "address" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [{ name: "invoiceId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getInvoice",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "issuer", type: "address" },
          { name: "faceValue", type: "uint256" },
          { name: "dueDate", type: "uint64" },
          { name: "settlementRecipient", type: "address" },
          { name: "metadataHash", type: "bytes32" },
          { name: "invoiceRef", type: "bytes32" },
          { name: "obligorHash", type: "bytes32" },
          { name: "obligorGroupHash", type: "bytes32" },
          { name: "riskTier", type: "uint8" },
          { name: "verifier", type: "address" },
          { name: "confidential", type: "bool" },
          { name: "status", type: "uint8" },
          { name: "fundedAmount", type: "uint256" },
          { name: "repaidAmount", type: "uint256" },
          { name: "faceValueEncrypted", type: "bytes32" },
          { name: "fundedAmountEncrypted", type: "bytes32" },
          { name: "repaidAmountEncrypted", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "requestRiskTierMigration",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "newTier", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approveRiskTierMigration",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256" }],
    outputs: [],
  },
] as const satisfies Abi;

export const vaultAbi = [
  {
    type: "function",
    name: "fundInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "amountHandle", type: "bytes32" },
      { name: "amountProof", type: "bytes" },
      { name: "riskProofsBundle", type: "bytes" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const servicingAbi = [
  {
    type: "function",
    name: "finalizePayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "uint256" },
      { name: "paymentId", type: "uint256" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const disclosureAbi = [
  {
    type: "function",
    name: "discloseInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceRegistry", type: "address" },
      { name: "invoiceId", type: "uint256" },
      { name: "viewer", type: "address" },
      { name: "fieldsMask", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "discloseInvestorShares",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "investor", type: "address" },
      { name: "viewer", type: "address" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const wrapperAbi = [
  {
    type: "function",
    name: "wrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "mintedHandle", type: "bytes32" }],
  },
  {
    type: "function",
    name: "confidentialTransferAndCall",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amountHandle", type: "bytes32" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "transferred", type: "bytes32" }],
  },
] as const satisfies Abi;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const satisfies Abi;

export const verifierAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;

export const noxComputeAbi = [
  {
    type: "function",
    name: "wrapAsPublicHandle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "value", type: "bytes32" },
      { name: "teeType", type: "uint256" },
    ],
    outputs: [{ name: "handle", type: "bytes32" }],
  },
] as const satisfies Abi;

