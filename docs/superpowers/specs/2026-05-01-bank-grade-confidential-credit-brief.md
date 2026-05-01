# Confidential Institutional Credit Rail (Box/Nox)

## Executive memo (1 page)

### What we are building
A privacy-preserving, compliance-aware credit protocol that lets banks and fintech lenders originate, fund, service, and refinance **receivables / invoices** on-chain without leaking commercially sensitive exposures. It combines:
- **Confidential value** (encrypted balances and transfers) via ERC-7984-style confidential tokens and Nox/TEE compute.
- **Institutional permissioning** (identity gating and role-based operating controls).
- **Verifiable real‑world truth** (auditor signatures and/or attestations binding to invoice facts).
- **Fund operations** patterns (request/claim liquidity rather than instant bank‑run UX).

### Why this exists (institutional problem)
Institutions want the automation and atomic settlement of programmable finance, but cannot use fully transparent rails because transparency leaks:
- Client relationships, exposures, concentration, and pricing
- Repayment performance (early warning signals)
- Trading/treasury strategy and liquidity posture

Networks designed for institutions explicitly foreground **privacy + control** as prerequisites for multi-party adoption (e.g., Canton’s “privacy-enabled interoperable network of networks”) (https://www.canton.network/canton-network-press-release).

Similarly, bank-led tokenized collateral platforms position their value around settlement efficiency, collateral mobility, and reduced operational friction (e.g., J.P. Morgan’s Onyx/Kinexys digital assets narrative) (https://www.jpmorgan.com/insights/payments/wallets/blockchain-onyx-asset-tokenization).

### The thesis
**Credit needs the same institutional-grade privacy rails that cash/collateral tokenization is building—otherwise credit markets will not move on-chain at scale.**

### What this enables (three buyer personas)
**1) Trade Finance / Receivables desks**
- Confidential invoice notional & terms; privacy of obligor/supplier network.
- Faster funding cycles and auditable servicing.

**2) Treasury / Collateral management**
- Cashflow confidentiality for corporate treasury clients (avoid broadcasting liquidity events).
- Programmatic collateralization of receivables financing while preserving counterparty privacy.

**3) Digital Assets / Tokenization leads**
- A regulated, privacy-preserving primitive that complements permissioned tokenization standards (e.g., ERC-3643 identity/compliance framing) (https://docs.erc3643.org/erc-3643/~gitbook/pdf).
- A credible “bridge” from private ledgers to composable workflows without turning exposures into public market data.

### Differentiation (why Box/Nox matters)
Box/Nox provides a practical confidentiality model (encrypted values + access control + proof-based inputs) that is compatible with EVM development patterns, making it easier for institutional teams to pilot confidential workflows without adopting an entirely new execution environment.

### Where we are today (hackathon-ready)
- Confidential cashflows (ERC-7984 settlement vault) + confidential investor positions
- Confidential invoice notional (encrypted handle) + verifiable invoice proofs (auditor EIP-712 signature / attestations)
- Removal of “fully repaid” public signal for confidential mode (prevents easy lifecycle inference)

---

## Market map (who does “similar” things and why)

### Institutional privacy + interoperability networks
- **Canton Network**: privacy-enabled interoperable “network of networks” targeted at regulated institutions (https://www.canton.network/canton-network-press-release).

### Bank-led tokenized cash/collateral rails
- **J.P. Morgan Onyx/Kinexys**: tokenized collateral mobility and repo workflows; narrative centered on operational efficiency and collateral velocity (https://www.jpmorgan.com/insights/payments/wallets/blockchain-onyx-asset-tokenization).

### Permissioned token standards for regulated RWAs
- **ERC-3643**: on-chain identity/compliance for permissioned assets (https://docs.erc3643.org/erc-3643/~gitbook/pdf).

### Confidential compute design patterns (non-institution-specific but relevant)
- **TEE-based confidentiality** (e.g., Secret Network discusses TEEs for confidential computation, though not institution-native) (https://scrt.network/graypaper).
- **Confidential EVM runtime** (e.g., Oasis Sapphire markets confidential EVM features) (https://oasisprotocol.org/sapphire).

---

## Objections we expect (and bank-grade answers)

### “Privacy is incompatible with compliance.”
Not if privacy is **selective**:
- Identities can be verified and policy-gated while exposures remain confidential.
- Auditors/regulators can receive controlled disclosure artifacts.

### “We need auditability and reporting.”
We separate:
- **Public state**: minimal operational state required for settlement safety.
- **Confidential state**: exposures, amounts, positions.
- **Disclosable state**: audited extracts produced via policy (attestation, decryption permissions, proofs).

### “We can’t leak client relationships.”
Confidential amounts are necessary but not sufficient; we also minimize lifecycle signals and propose add-ons for relationship privacy (see roadmap).

### “We can’t rely on black-box compute.”
This is a governance and assurance problem:
- Vendor risk + attestation + monitoring
- Multi-operator redundancy, incident response, and cryptographic audit trails

---

## Threat model slide (what is private vs what still leaks)

### Private (by construction in our current design)
- Investor balances and transfers (encrypted handles)
- Invoice notional (encrypted handle; auditor signs the handle, not plaintext)
- Repayment amount (encrypted handle)
- “Fully repaid” signal (removed for confidential mode)

### Still observable on-chain (acknowledged)
- Addresses interacting and timing patterns
- Which invoice IDs are referenced (unless we add confidential invoice IDs / off-chain indirection)
- Wrap/unwrap edges for ERC20↔ERC7984 (wrap is an ERC-20 transfer and reveals amount)

### Mitigations (roadmap)
- Payment indirection, batching, and optional relayer patterns
- Confidential invoice identifiers (commitment-based addressing)
- Controlled disclosure policies and audit packages

---

## What’s missing for “institution-ready” (roadmap)

### Near-term (next)
1) **Servicing attestation model**
   - A designated servicer/oracle attests payment events and disputes.
2) **Credit/risk controls**
   - Concentration limits, issuer/debtor eligibility, per‑pool policy modules.
3) **Selective disclosure**
   - Explicit auditor/regulator view policy for specific handles and invoice packets.

### Mid-term
4) **Default + recovery waterfall**
   - Default events, workout flows, recoveries, and loss allocation logic.
5) **Reporting primitives**
   - Prove reserve / prove solvency / prove NAV at a point-in-time without exposing individual positions (can start with controlled disclosures; evolve to ZK proofs).

### Long-term
6) **Interoperability**
   - Integration paths into permissioned tokenization programs and digital cash rails.

