# Noxvault Frontend Technical Architecture

## Overview
This document specifies a Next.js (App Router) frontend that integrates with Noxvault smart contracts for confidential invoice factoring. The frontend must support Local Hardhat and Arbitrum Sepolia through a network-aware configuration layer and produce end-to-end transaction flows with visible tx hashes.

## Stack
- Framework: Next.js (App Router), TypeScript
- Wallet: wagmi + viem + RainbowKit
- Styling: Tailwind CSS
- State:
  - server state: TanStack Query (read + invalidate on tx confirmations)
  - client UI state: React state + URL params
- Validation: zod (form validation)
- Build/host: Vercel (or equivalent) for hackathon hosting

## Project layout
- `apps/web`
  - `app/`
    - `layout.tsx` global shell, nav, theme
    - `page.tsx` overview
    - `investor/page.tsx`
    - `issuer/page.tsx`
    - `operator/page.tsx`
    - `servicer/page.tsx`
    - `admin/page.tsx`
    - `auditor/page.tsx`
  - `src/`
    - `config/`
      - `chains.ts` hardhat + arbitrum sepolia
      - `addresses.ts` env-driven address book per chain
    - `contracts/`
      - `abis/` (generated from Solidity or copied minimal ABIs)
      - `clients.ts` viem publicClient/walletClient helpers
      - `read.ts` typed read wrappers
      - `write.ts` typed write wrappers
    - `features/` role-focused modules
    - `components/` shared UI (tx drawer, forms, tables)
    - `lib/` formatters, explorers, error decode, constants

## Chain configuration

### Supported networks
- Local Hardhat: chainId 31337
- Arbitrum Sepolia: chainId 421614

### Address book
All contract addresses are injected via environment variables, per chain:
- `NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_RISK_MANAGER_ADDRESS`
- `NEXT_PUBLIC_POLICY_PACK_ADDRESS`
- `NEXT_PUBLIC_VAULT_ADDRESS`
- `NEXT_PUBLIC_SERVICING_ROUTER_ADDRESS`
- `NEXT_PUBLIC_DISCLOSURE_MANAGER_ADDRESS`
- `NEXT_PUBLIC_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_CASH_TOKEN_ADDRESS` (if needed for wrap/approve UI)

The UI must:
- show “Not configured” when missing
- disable actions that require missing addresses

## Data model (frontend)

### InvoiceView
- `invoiceId: bigint`
- `issuer: address`
- `status: number`
- `dueDate: bigint`
- `settlementRecipient: address`
- `invoiceRef: bytes32`
- `obligorHash: bytes32`
- `obligorGroupHash: bytes32`
- `riskTier: number`
- `confidential: boolean`
- `faceValueDisplay: string` (plain numeric or “handle”)

### PaymentView
- `invoiceId: bigint`
- `paymentId: bigint`
- `amountDisplay: string` (plain numeric or “handle”)
- `finalized: boolean`

## Contract integration map (reads/writes)

### Invoice Registry
Reads:
- `getInvoice(invoiceId)` for details
- events: `InvoiceCreated`, `InvoiceCreatedConfidential`, `InvoiceFunded*`, `InvoiceRepaid*`, `RiskTierMigrationRequested`, `RiskTierMigrationApproved`

Writes:
- `createInvoiceConfidential(...)`
- `requestRiskTierMigration(invoiceId, newTier)`
- `approveRiskTierMigration(invoiceId)` (owner/admin)

### Vault (confidential)
Writes:
- `fundInvoice(invoiceId, amountHandle, amountProof, riskProofsBundle)` (operator)
- deposit flow via cash token wrapper `confidentialTransferAndCall(vault, amountHandle, "0x")` (investor)

### Servicing Router
Reads:
- `PaymentReported` event (parse paymentId)
Writes:
- `finalizePayment(invoiceId, paymentId)`

### Risk controls
Writes (admin):
- `RiskManager.setPoolCap*`, `setIssuerCap*`, `setInvoiceCap*`
- `RiskPolicyPack.setIssuerObligorCap*`, `setIssuerGroupCap*`, `setTierCap*`

### Disclosure Manager
Writes (officer/admin):
- `discloseInvoice(invoiceRegistry, invoiceId, viewer, fieldsMask)`
- `discloseInvestorShares(vault, investor, viewer)`

## Proofs and “confidential handles” UX

### Typed-data signature (auditor proof)
The UI supports EIP-712 signing:
- Auditor signs typed data for the confidential invoice proof verifier
- Issuer submits the signature bytes in `createInvoiceConfidential(...)`

### Risk proof bundle
For local demo:
- allow a “demo bundle” (prebuilt bytes[]) to pass proof checks
For Sepolia:
- plug in a proof provider (operator/oracle service) or implement proper proof generation workflow

The UI must clearly label these as:
- “Demo proofs (local)” vs “Production proofs (Sepolia)”

## Transaction UX

### Tx pipeline
For every mutation:
1) preflight validation (addresses, chain, wallet connected)
2) send tx
3) show tx hash immediately
4) wait for confirmations (1 for demo)
5) refresh queries and event-derived lists

### Error handling
- decode revert reasons when available
- show human-readable guidance:
  - wrong network
  - missing role (identity gating)
  - risk limit exceeded
  - invoice status mismatch

## Security considerations
- Never store or request private keys/mnemonics in the UI.
- Use wallet signing only via standard connectors.
- Avoid logging sensitive data; strip console logs in production.
- Treat “handles” as sensitive; display but do not attempt to “decrypt” in UI unless disclosure explicitly allows and the underlying stack supports it.

## Demo mode
Add a “Demo Mode” overlay:
- a checklist of steps
- a tx hash list that builds as the user progresses
- an “Export demo report” JSON

## Build and run
Local dev:
- `pnpm` or `npm` within `apps/web`
- `npm run dev`

Environment:
- `.env.local` provides addresses

## Testing strategy (frontend)
- Smoke test: wallet connect + address book loads
- Integration smoke: run against local hardhat node and execute:
  - create invoice
  - fund
  - repay
  - finalize
- Optional: Playwright flow script for demo regression

