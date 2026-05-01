# Noxvault Frontend PRD

## Summary
Noxvault is a hackathon-focused dApp demonstrating confidential receivables financing (invoice factoring) using iExec Nox Confidential Tokens (ERC-7984) and Nox Protocol compute. The frontend must enable an end-to-end “bank-style” flow for multiple roles (Investor, Issuer, Operator, Servicer, Auditor, Admin) and produce verifiable on-chain transactions (tx hashes) on both Local Hardhat and Arbitrum Sepolia.

## Problem
Institutional credit workflows cannot run on fully transparent chains because it leaks:
- exposures and concentration
- counterparty relationships
- repayment performance signals
- strategy and liquidity posture

The frontend should communicate what remains confidential (handles/positions) while still giving users operational control, auditability, and a clean demo path.

## Goals
- End-to-end workflow in a web UI:
  - Investor deposits liquidity into confidential vault
  - Issuer creates a confidential invoice (auditor-signed proof)
  - Operator funds invoice (confidential settlement + risk checks)
  - Issuer repays (confidential) and Servicer finalizes payment
  - Admin approves tier migration requests
  - Disclosure Officer grants selective disclosure to Auditor
  - Auditor views disclosed invoice packet + disclosed investor share handle(s)
- Works on:
  - Local Hardhat (demo recording)
  - Arbitrum Sepolia (submission deployment)
- Provides clear, consistent tx feedback:
  - tx hash, status, confirmations, explorer link
- Minimal but real “bank-grade” UX:
  - role-based navigation
  - guardrails for wrong network / missing contract addresses

## Non-goals (v1)
- Full production custody/compliance UX (KYC onboarding, multi-sig, policy approvals beyond what contracts expose)
- Private UI metadata (addresses and timing are still visible on-chain)
- Full cryptographic proof UX (real proof generation is out-of-scope for local demo; on Sepolia, proofs may be integrated later)

## Target users (hackathon personas)
- Investor / LP: deposits, views confidential position handle(s)
- Issuer: creates invoice, requests tier migration, repays
- Operator (credit ops): funds invoices from vault
- Servicer (collections): finalizes payments (after report events)
- Auditor / Regulator: views selectively disclosed data
- Admin / Disclosure Officer: configures caps, roles, approvals, disclosures

## UX principles
- Show amounts as:
  - “Confidential handle” in confidential mode
  - explicit numeric values only where the protocol is intentionally public (plain mode)
- Every action ends with:
  - tx hash + status
  - “copy hash” button
  - explorer link (network-aware)
- Avoid displaying secrets; never log private keys or mnemonics.

## User journeys

### Journey A — “Bank-style” demo (confidential)
1) Investor connects → deposits liquidity to vault
2) Issuer connects → creates confidential invoice (auditor-signed)
3) Operator connects → funds invoice
4) Issuer connects → repays (confidential transfer-and-call)
5) Servicer connects → finalizes payment
6) Issuer requests tier migration → Admin approves → UI shows tier updated
7) Disclosure Officer grants auditor access → Auditor sees disclosed packet

### Journey B — Risk policy demonstration
1) Admin sets caps (pool/issuer/invoice + obligor/group/tier)
2) Operator attempts funding exceeding caps → tx reverts → UI shows reason and recommended next action

## Information architecture (pages)
- `/` Overview + Connect + Network switch + Address status
- `/investor` Deposit + Portfolio
- `/issuer` Create invoice + Invoices list + Repay + Request tier migration
- `/operator` Invoice list + Fund invoice
- `/servicer` Payments list + Finalize payment
- `/admin` Configure risk caps + Roles + Approve tier migration + Disclosures
- `/auditor` Disclosed invoice view + Disclosed investor shares
- `/dev` (optional) developer utilities: paste addresses, reset local cached state

## Functional requirements
- Wallet connect + chain switching (Hardhat + Arbitrum Sepolia)
- Contract address configuration via environment variables (per network)
- Event-driven lists (invoices, payments) with polling fallback
- Transaction handling:
  - simulate/readiness check where possible
  - send tx
  - wait for receipt
  - show receipt info (gas used, block number)
- Typed data signing for invoice proof:
  - Auditor signs EIP-712 typed data
  - Issuer submits to `createInvoiceConfidential(...)`

## Content requirements (hackathon)
- In-app “Demo Mode” checklist + step-by-step prompts
- A “What’s confidential?” explainer panel (short)
- “Export audit packet” from Auditor page (JSON containing invoice id, tx hashes, handles, timestamps)

## Success criteria
- A first-time user can run Journey A end-to-end on local Hardhat in < 10 minutes.
- The same journey is possible on Arbitrum Sepolia once contracts are deployed and addresses configured.
- The UI displays tx hashes for each step and updates state from chain data.

## Open questions (track as TODOs, do not block v1)
- Whether to support both plain and confidential vaults in UI v1 (recommended: confidential-first)
- Whether to generate real proof bundles on Sepolia or rely on an operator/oracle service

