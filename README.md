# Helix

Helix is a synthetic-data prototype of a multispecialty medical group on Medplum. It models one practice, five operational markets, and eight clinical offerings using FHIR R4.

The repository is public. It contains no patient data or deployment credentials. Production deployment is not configured.

## Start here

- [Developer setup](docs/development.md): clone, install, build, and preview without credentials.
- [Deployment runbook](docs/deployment.md): staging checks, GitHub controls, and recovery.
- [Project handoff](docs/STATUS.md): current state, next work, and session-resume instructions.
- [Product requirements](docs/PRD-001-organization-and-care-delivery.md).
- [Architecture decisions](docs/adr/): domain model, declarative configuration, and system/tooling choices.
- [Contributing](CONTRIBUTING.md) and [agent guidance](AGENTS.md).

## Quick start

Requires Node.js 24.2+ within major 24, npm, and Make.

```sh
git clone https://github.com/kiyengar27/helix.git
cd helix/code
npm ci
make build
make preview
```

These steps require no Medplum credentials and make no Medplum API calls. npm downloads dependencies.

## Repository layout

| Path | Purpose |
|---|---|
| `code/config/` | Declarative FHIR foundation and target project configuration |
| `code/src/` | Configuration loader and transaction construction |
| `code/scripts/` | Authenticated plan, deployment, and verification |
| `code/tests/` | Local configuration invariants |
| `.github/workflows/` | CI and manually dispatched staging workflow |
| `docs/` | Requirements, decisions, runbooks, and handoff |

## Deployment semantics

JSON describes resources; TypeScript deploys through the Medplum SDK. The tool creates missing resources by stable identifiers, retains existing matches, and blocks on differences in managed fields. It does not update, delete, or automatically roll back resources. See [ADR-002](docs/adr/ADR-002-declarative-json-configuration.md).

The initial foundation is deployed and verified in the owner's Helix staging project. Owner-approved hosted plan and deployment are enabled and verified with restricted environment credentials. Other developers must use their own synthetic project and update its target configuration intentionally.

Public visibility permits inspection and forks; it does not grant deployment access. No software license has been selected yet.
