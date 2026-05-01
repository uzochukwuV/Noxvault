## iExec Nox Hackathon Feedback

Project: Noxvault (Confidential Receivables Financing / Invoice Factoring)

### What worked well
- Confidential token development workflow was approachable when following the documentation and examples.
- Encrypted handle patterns + access control enabled building “bank-grade” confidentiality primitives without changing EVM developer ergonomics too much.
- The confidential token demo + faucet were helpful for getting started quickly.

### What was confusing / hard
- Debugging encrypted workflows can be non-obvious (it’s not always clear whether failures are due to permissioning, proof validation, or an integration mismatch).
- It’s easy to accidentally mix “local mock” assumptions with “real network” assumptions; a clearer checklist for what must change for Sepolia would help.
- Guidance for end-to-end UX patterns (front-end + disclosures + audit views) could be more opinionated.

### Missing / wishlist
- More deploy-ready templates targeting popular stacks (Hardhat + Next.js) with:
  - Example disclosure flows
  - Common compliance patterns (auditor/regulator roles)
  - Minimal “starter dashboards” for issuers/investors/servicers
- More troubleshooting docs for common errors (proof validation failures, allowlists, and compute contract interaction).

### Tools/resources used
- Docs: https://docs.iex.ec/nox-protocol/getting-started/welcome
- Wizard: https://cdefi-wizard.iex.ec/
- Demo: https://cdefi.iex.ec/

