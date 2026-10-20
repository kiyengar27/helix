# Helix provisioning code

Start with the repository [README](../README.md), [developer setup](../docs/development.md), and [deployment runbook](../docs/deployment.md).

Requires Node.js major 24 (24.2+). Run `npm ci` here, then `make build` and `make preview`. Those local checks need no credentials. Authenticated commands read environment variables or the optional local .env link.

- `config/foundation.json`: resource definitions with stable identifiers and transaction fullUrls.
- `config/staging.json`: intended target project.
- `src/foundation.ts`: selected runtime checks and conditional transaction construction.
- `scripts/provision-foundation.ts`: plan, validate, apply, and verify.
- `tests/`: local inventory/relationship invariants.

The initial 14-resource foundation has passed server validation, deployment, drift checks, and repeated apply without duplicates. Hosted staging plan and deploy/verify have also passed with restricted credentials and owner approval. The tool does not update or delete resources; see ADR-002 for semantics and the runbook for recovery.
