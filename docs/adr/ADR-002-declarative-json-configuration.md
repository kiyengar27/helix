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

The foundation contains one organization, five markets, and eight offerings. Type-checking and local preview checks passed, including stable references and conditional-create request generation. At the original decision checkpoint no foundation resources had been submitted. Subsequent server validation, initial deployment, and repeat runs passed; hosted restricted-credential evidence is recorded in docs/deployment.md.

## Revisit when

We need controlled updates, drift detection, multiple environment overlays, frequent manual changes to managed fields, or a larger configuration requiring composition. Define ownership and reconciliation semantics before adding those features.

## References

- [Medplum: Building with AI Coding Assistants](https://www.medplum.com/docs/building-with-ai-coding-assistants)
- Official Medplum SDK implementation: `medplum-link/packages/core/src/client.ts`, including conditional creation and transaction execution.
- Helix implementation: `code/config/`, `code/src/foundation.ts`, and `code/scripts/provision-foundation.ts`.

## Deployment safeguards added October 16, 2026

The implementation now supports an authenticated plan with FHIR server validation, identifier lookup, create/retain reporting and managed-field comparison. Drift blocks apply; extra unmanaged fields remain untouched. Verification requires all expected resources to exist and match. Comparison is order-sensitive and is not full FHIR semantic equivalence.

Plan is presented before deployment; deploy still requires an explicit owner decision and a separate GitHub approval. There is no saved-plan binding: apply recomputes checks against the selected commit and current server state. No automatic updates/deletions or rollback were added. Hosted repeat apply retained all 14 resources; first-time creation under restricted permissions remains untested.

## Reviewed care-delivery plan and controlled updates — October 20, 2026

The care-delivery compiler adds coverage and four rotation Schedules. Extend create-only semantics with explicit field ownership: HealthcareService.location/coverageArea, physical clinic Location.status, and Schedule.active only. All other managed drift blocks. Clinic suspension/closure changes additionally remain blocked pending live dependency audits. Read current resources, preserve unrelated fields, and use version-checked PUT entries in a transaction; conditional POST remains the creation mechanism. No delete reconciliation is introduced.

A saved PLAN is bound to commit, project, configuration digest, as-of time and server existence/version/content. DEPLOY requires that successful same-commit PLAN artifact; reject altered/expired plans or changed server/configuration state. Replan after 24 hours or a crossed lifecycle boundary. GitHub retrieves artifacts only from successful main PLAN runs of the staging workflow; owner approval is per run. Read-after-write verification covers all identifiers, including retained records. These checks are optimistic concurrency, not a lock or rollback mechanism.

Generate the identifier-scoped AccessPolicy from the same desired resource set. Owner bootstrap applies permission changes separately; field-level restrictions are enforced by deployment code, not the resource-level policy. See ../care-delivery-deployment.md for sequence and untested live paths. Earlier create-only sections describe the original implementation and are superseded by this bounded update contract for the new deployment entry point.

## Enrollment display updates

Declare invented names in enrollment JSON and classify fixtures using a Helix administrative meta.tag. Preserve deployed identity rather than replacing records. A separate enrollment-display plan scope permits name and Helix-owned classification tags only; preserve unrelated metadata and reject other managed-field drift. Scope is bound into the reviewed plan. Medplum grants resource-level update on exact synthetic identifiers; deployment code enforces the narrower field allowlist. This does not establish field-level server authorization. The owner must review the generated policy expansion before deployment.

## Reviewed acceptance mutations

Acceptance scenario intent and identity policies remain declarative JSON. A dedicated local plan/apply runner binds a five-write synthetic lifecycle test to commit, configuration, project and current resource hashes, expiring after 24 hours. Owner authorization is required for apply. Writes use version checks and restore original business fields on success; interrupted execution requires reviewed recovery. Public build runs only local tests. This test runner is separate from desired-state reconciliation and does not broaden its field allowlists.

## Encounter bootstrap and runtime state

Keep identifier-conditional bootstrap separate from runtime Encounter transitions. Bootstrap may create planned visits and draft medication proposals/review tasks, but must retain legitimate progressed visits instead of resetting them. Reconciliation checks all declared content and owned synthetic tags while preserving server metadata. Runtime state adoption is limited to planned/in-progress/finished/cancelled; unexpected state/content blocks writes.

Use a separate snapshot-bound four-write lifecycle plan for two planned visits. Each update is version checked, policy-constrained and verified with native history. Never reopen/reset a terminal encounter to repeat a test. MedicationRequest/Task update permission is absent. Expected-denied API requests are negative checks, not successful writes. Actual server enforcement and conditional retry behavior require staging acceptance before issue closure.

## Enrollment profile preparation for Photon

Add a separately bound enrollment-profile update scope for names, Helix classification tags and the single standard birthsex extension on Patient only. Apply merges only that extension URL, preserving unrelated extensions/metadata and identity with If-Match. Reject duplicate birthsex values and other desired extension definitions. The prior enrollment-display scope remains unchanged; the enrollment command now selects the profile scope. The Medplum policy is unchanged; this is a narrowly enforced deployment-code allowlist, not a new server field-level permission.
