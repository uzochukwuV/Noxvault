# Noxvault

Confidential Receivables Financing (Invoice Factoring) built with iExec Nox Confidential Tokens (ERC-7984) and Nox Protocol compute.

This repository is a hackathon-ready, end-to-end reference implementation of a credit workflow (origination → funding → servicing → repayment) where commercially sensitive amounts and positions remain confidential, while compliance and audit access remain possible via selective disclosure.

## What it is

Noxvault is a privacy-preserving credit rail for funding real-world receivables (invoices) on-chain:
- **Invoices can be created as public or confidential** (confidential invoices use encrypted value handles).
- **Investors provide liquidity** (confidential balances and transfers).
- **Operators fund invoices** (confidential settlement to the issuer’s settlement recipient).
- **Servicers report and finalize repayments** (confidential repayment amounts, dispute window control).
- **Risk policy is enforced** (pool/issuer/invoice caps + concentration limits by obligor + obligor group + rating tier).
- **Auditors/regulators can be granted access** to specific encrypted handles without making amounts public.

## Why we’re building it

Traditional on-chain lending is transparent by default, but institutional credit workflows cannot broadcast:
- Exposures and concentration
- Counterparty relationships and supply-chain graphs
- Repayment performance signals (timing/amounts)
- Strategy, pricing, and liquidity posture

Noxvault demonstrates how to build **institution-grade private lending / RWA financing** on EVM-style smart contracts by combining:
- **Confidential value** (ERC-7984-style encrypted balances/transfers)
- **Verifiable real-world truth** (auditor signatures / attestations binding invoice facts)
- **Policy-gated operations** (identity/roles, risk limits, selective disclosure)

## Who it’s for

- **Hackathon judges**: an end-to-end working confidential DeFi + RWA use case.
- **Builders**: a reference architecture for confidential vaults, credit workflows, and disclosure controls.
- **Banks/fintech lenders**: a blueprint for confidential receivables credit that can interoperate with regulated workflows.

## How it works (high level)

**1) Origination**
- Issuer creates an invoice in [InvoiceRegistry.sol](file:///workspace/contracts/invoice/InvoiceRegistry.sol).
- Proofs bind invoice facts (issuer, due date, invoice ref, obligor hash, obligor group hash, risk tier, and the value handle in confidential mode).

**2) Liquidity**
- Investors deposit into the vault (confidential balances).

**3) Funding**
- Operator funds an invoice from the vault:
  - Plain: [PlainFactoringVault.sol](file:///workspace/contracts/vault/PlainFactoringVault.sol)
  - Confidential: [ERC7984FactoringVault.sol](file:///workspace/contracts/vault/ERC7984FactoringVault.sol)

**4) Servicing**
- Repayments are reported/finalized through [ServicingRouter.sol](file:///workspace/contracts/servicing/ServicingRouter.sol).

**5) Risk controls**
- Global caps and issuer caps live in [RiskManager.sol](file:///workspace/contracts/risk/RiskManager.sol).
- Concentration + rating-tier caps live in [RiskPolicyPack.sol](file:///workspace/contracts/risk/RiskPolicyPack.sol).
- Tier migration uses issuer-request / owner-approve, and re-buckets outstanding exposure without exposing amounts:
  - `requestRiskTierMigration(invoiceId, newTier)`
  - `approveRiskTierMigration(invoiceId)`

**6) Selective disclosure**
- [DisclosureManager.sol](file:///workspace/contracts/disclosure/DisclosureManager.sol) grants auditors/regulators access to specific encrypted handles (invoice fields, investor shares) without making values public.

## Repository tour (core contracts)

- Invoices: [InvoiceRegistry.sol](file:///workspace/contracts/invoice/InvoiceRegistry.sol)
- Confidential vault (ERC-7984 factoring): [ERC7984FactoringVault.sol](file:///workspace/contracts/vault/ERC7984FactoringVault.sol)
- Plain vault (ERC-20 factoring): [PlainFactoringVault.sol](file:///workspace/contracts/vault/PlainFactoringVault.sol)
- Servicing/disputes: [ServicingRouter.sol](file:///workspace/contracts/servicing/ServicingRouter.sol)
- Risk (pool/issuer/invoice caps): [RiskManager.sol](file:///workspace/contracts/risk/RiskManager.sol)
- Risk policy pack (obligor/group/tier caps): [RiskPolicyPack.sol](file:///workspace/contracts/risk/RiskPolicyPack.sol)
- Selective disclosure: [DisclosureManager.sol](file:///workspace/contracts/disclosure/DisclosureManager.sol)

## Quickstart (local)

### Prerequisites
- Node.js (project uses ESM)
- npm

### Install

```bash
npm ci
```

### Offline compile (no Hardhat)

```bash
npm run compile:offline
```

### Run tests

```bash
npm test
```

## End-to-end full flow (with Hardhat tx hashes)

This repo includes a full end-to-end script that prints transaction hashes and key events (create invoice → fund → tier migrate → repay → finalize → disclose).

### Terminal 1

```bash
npx hardhat node --hostname 127.0.0.1 --port 8545
```

### Terminal 2

```bash
node scripts/full-flow-rpc.js
```

## Deployment (Arbitrum Sepolia)

Hackathon requirement: deploy to Arbitrum Sepolia (or Arbitrum).

This repo currently focuses on:
- Protocol logic + tests
- A local end-to-end flow using a local Hardhat node

For Arbitrum Sepolia, you will wire the contracts to the real iExec Nox environment (Nox compute + confidential token stack) and deploy with Hardhat. The recommended path is:
- Follow iExec Nox docs: https://docs.iex.ec/nox-protocol/getting-started/welcome
- Use the smart contracts wizard: https://cdefi-wizard.iex.ec/
- Use the confidential token demo + faucet: https://cdefi.iex.ec/

At minimum, the deployment checklist is:
- Add Arbitrum Sepolia RPC + deployer key to your environment.
- Deploy and configure:
  - Identity registry, invoice registry, risk manager, risk policy pack, disclosure manager, servicing router, vault(s).
  - Set all cross-contract links (vault ↔ invoice registry ↔ servicing ↔ risk manager ↔ policy pack).
- Verify contracts on the explorer and provide deployed addresses in the README.

## Hackathon deliverables checklist

- Public GitHub repo with complete open-source code.
- README with clear setup, usage, and deployment instructions.
- End-to-end demo that works without mocked business data.
- Deployed on Arbitrum Sepolia / Arbitrum.
- `feedback.md` in the repo with feedback on iExec tools.
- Demo video (≤ 4 minutes).
- A functional front-end dApp.

## Developer resources

- iExec Nox docs: https://docs.iex.ec/nox-protocol/getting-started/welcome
- iExec Nox npm packages: https://www.npmjs.com/org/iexec-nox?activeTab=packages
- Confidential smart contracts wizard: https://cdefi-wizard.iex.ec/
- Developer resources: https://linktr.ee/iexec.tech
- Confidential token demo (faucet included): https://cdefi.iex.ec/
