# Helix

Helix is a synthetic-data prototype of a multispecialty medical group on Medplum. It models one practice, five operational markets, eight clinical offerings, synthetic clinicians and recurring rotations using FHIR R4.

The repository is public. It contains no patient data or deployment credentials. Production deployment is not configured.

## Start here

- [Developer setup](docs/development.md): clone, install, build, and preview without credentials.
- [Deployment runbook](docs/deployment.md): staging checks, GitHub controls, and recovery.
- [Encounter deployment](docs/encounter-deployment.md): scoped setup, plan/deploy and live lifecycle acceptance.
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

JSON describes resources; TypeScript compiles and deploys them through the Medplum SDK. Stable identifiers prevent duplicate creation. Declared care-delivery fields and enrollment display fields support version-checked updates; unmanaged drift blocks writes. No automatic deletion or rollback exists. Apply requires a reviewed same-commit plan. See [ADR-002](docs/adr/ADR-002-declarative-json-configuration.md) and the [care-delivery deployment runbook](docs/care-delivery-deployment.md).

**Staging is deployed and verified:** 45 managed resources, including five clinics, two virtual sites, eight synthetic clinicians, ten roles and four rotation Schedules. The owner-approved pipeline has executed the expanded deployment successfully. Six synthetic Patients and five RelatedPersons are also deployed and verified. Enrollment lifecycle/access acceptance passed under [issue #8](https://github.com/kiyengar27/helix/issues/8). Headless encounter/prescribing-intent acceptance passed under [issue #9](https://github.com/kiyengar27/helix/issues/9): two finished visits, two draft medication proposals and two review Tasks. Photon sandbox integration is next under [issue #10](https://github.com/kiyengar27/helix/issues/10). Other developers need their own synthetic project and intentionally updated target configuration.

Public visibility permits inspection and forks; it does not grant deployment access. No software license has been selected yet.
