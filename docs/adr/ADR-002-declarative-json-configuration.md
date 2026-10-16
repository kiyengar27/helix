# ADR-002: Declarative FHIR JSON configuration with a thin deployment layer

Status: Accepted
Date: October 16, 2026
Related: [ADR-001: Organization and care delivery](ADR-001-organization-and-care-delivery.md)

## Context

Helix needs repeatable provisioning of its organization, markets, and service offerings in Medplum staging. The initial implementation constructed these resources inside TypeScript. During implementation, we chose to move the resource definitions into declarative JSON files so the intended configuration can be inspected and reviewed independently of deployment code.

The decision concerns how configuration is authored and maintained. Medplum API calls remain the transport used to deploy it.

## Decision

Store desired foundation resources as native FHIR R4 JSON and deploy them through a thin TypeScript layer using the Medplum SDK.

- `code/config/foundation.json` holds resource definitions and stable transaction reference identities.
- `code/config/staging.json` identifies the intended API endpoint and project.
- Credentials remain in the local, ignored `.env` file; configuration contains no secrets.
- The deployment layer checks configuration, constructs identifier-based conditional requests, authenticates, verifies the target project, and submits a transaction Bundle.
- Local preview renders the outgoing Bundle without connecting to Medplum.

This decision applies to managed foundation configuration. Interactive workflows, scheduling, patient care actions, and runtime business logic may still call APIs directly when appropriate.

## Rationale

| Criterion | Declarative JSON configuration | Resource definitions embedded in procedural API scripts |
|---|---|---|
| Review | Resource changes are visible as configuration diffs | Review must separate data changes from control flow |
| Separation of concerns | Definitions and deployment behavior evolve separately | Definitions and execution logic tend to change together |
| Repeatability | Stable identifiers and a shared deployment path | Depends on each script implementing safeguards consistently |
| FHIR compatibility | Uses Medplum's native resource payload format | Requires constructing the same payloads in code |
| Future comparison | Provides an explicit baseline for later drift detection | Intended configuration may be distributed across execution paths |
| Authoring flexibility | Best for relatively static configuration | Better for dynamic behavior and computation |

Direct API calls are necessary for deployment, but do not need to be the authoring format for static practice configuration. Declarative files centralize that configuration; the deployment layer centralizes operational safeguards.

## Why JSON rather than YAML

JSON is the native FHIR interchange format and can be inspected alongside official examples without a translation layer. It avoids YAML-specific implicit typing and parser conventions. Its lack of comments and greater verbosity are accepted; explanatory context belongs in documentation and ADRs.

YAML may be reconsidered if configuration size or repeated patterns justify an authoring layer. Any future YAML layer must produce validated FHIR JSON and preserve predictable types and references.

## Why not Terraform-style infrastructure management

The initial requirement is repeatable creation of a small foundation, not full resource lifecycle management. We are not introducing a Terraform provider, separate state management, or automatic deletion at this stage.

The current implementation is declarative authoring with create-only deployment. It is not a complete desired-state reconciler:

- Preview shows outgoing resources, not a server-aware create/update/delete plan.
- Identifier-based conditional creation retains existing matching resources.
- Editing JSON does not update an existing resource.
- Removing JSON does not delete a resource.
- Changing a managed identifier may create another resource.

Conditional creation is a deployment behavior, not an inherent property of JSON. It could also be implemented in procedural scripts.

## Consequences

### Benefits

- Configuration is reviewable without executing provisioning code.
- The deployment mechanism can be tested and reused across resource definitions.
- Stable configuration provides a foundation for later comparison, controlled updates, and additional environments.
- Deployment credentials are kept separate from shareable definitions.

### Costs and limitations

- Plain JSON does not provide templates, comments, or computed values.
- TypeScript compilation alone cannot fully validate externally authored FHIR JSON; parsing, runtime checks, and server-side validation remain necessary.
- Existing resources can drift from configuration until comparison and update handling are implemented.
- Transaction references and identifiers require deliberate management.
- Conditional-create collision handling and repeat-run behavior must be verified against Medplum before relying on them operationally.

## Guardrails

1. Keep stable business identifiers; do not change them merely to rename a resource.
2. Use transaction Bundles for interdependent entries and resolvable `urn:uuid` references.
3. Check the intended project before writes and restrict the API destination.
4. Keep preview local and clearly distinguish it from a server-aware plan.
5. Do not add automatic updates or deletion without defining field ownership, conflict handling, and review behavior in a subsequent decision.
6. Validate resources against FHIR R4 and relevant Medplum guidance; type-check the deployment layer.
7. Keep initial configuration synthetic and compatible with hosted free-plan staging.

## Verification at decision time

The foundation contains one organization, five markets, and eight offerings. Type-checking and local preview checks passed, including stable references and conditional-create request generation. No foundation resources have been submitted to Medplum; server-side validation and repeat-run verification remain pending.

## Revisit when

We need controlled updates, drift detection, multiple environment overlays, frequent manual changes to managed fields, or a larger configuration requiring composition. Define ownership and reconciliation semantics before adding those features.

## References

- [Medplum: Building with AI Coding Assistants](https://www.medplum.com/docs/building-with-ai-coding-assistants)
- Official Medplum SDK implementation: `medplum-link/packages/core/src/client.ts`, including conditional creation and transaction execution.
- Helix implementation: `code/config/`, `code/src/foundation.ts`, and `code/scripts/provision-foundation.ts`.
