# ADR-003: System and language choices

Status: Accepted; living decision record
Created: October 16, 2026
Last updated: October 16, 2026

## Purpose and maintenance

Maintain one consolidated record of Helix's system, language, runtime, and development-tool choices. Extend this ADR as implementation progresses rather than creating an ADR for every technology selection. Add the decision date, rationale, alternatives, consequences, and revisit trigger for each material choice. Preserve superseded decisions in the change history rather than silently replacing their rationale.

This ADR records technology choices. [ADR-001](ADR-001-organization-and-care-delivery.md) owns the domain model; [ADR-002](ADR-002-declarative-json-configuration.md) owns declarative configuration and deployment semantics. Link to those decisions rather than duplicating them.

## Current choices

| Area | Choice | Scope |
|---|---|---|
| Clinical data platform | Medplum hosted free plan | Synthetic-data staging and learning |
| Data standard | FHIR R4 | Clinical and organizational resources |
| Implementation language | TypeScript | Provisioning/deployment layer; future application language remains subject to review |
| Runtime | Node.js | Local script execution; use a supported version compatible with installed packages |
| Platform SDK | `@medplum/core` | Authentication and FHIR API operations |
| FHIR type definitions | `@medplum/fhirtypes` | Typed resource handling and compile-time checks |
| Static configuration | FHIR JSON | See ADR-002 |
| Development tools | npm, TypeScript compiler, tsx | Dependency management, type-checking, direct TypeScript execution |
| Dependency repeatability | Committed `package-lock.json`; `npm ci` | Reproduce resolved dependencies |
| Initial workflow execution | Local scripts | Hosted Bots are not part of the initial free-plan implementation |

## 1. Medplum and FHIR R4

Decision date: October 16, 2026.

Use the existing Medplum account/project and official SDK for a synthetic sample practice. FHIR R4 supplies the resource model for organizations, patients, services, care teams, episodes, and workflow records. Use the official repository linked at `medplum-link/` as the implementation reference.

This follows the user's selected platform and avoids building a custom clinical datastore for the prototype. It introduces dependency on Medplum behavior and requires explicit conventions for business concepts without native FHIR fields. Free-plan capabilities constrain execution and integrations; verify capabilities when adding features.

Alternatives such as a custom backend or self-hosted Medplum are deferred. Revisit hosting when real operational requirements, paid features, infrastructure control, or production deployment justify it. No production readiness is implied.

## 2. TypeScript for the deployment layer

Decision date: October 16, 2026.

Use TypeScript with the official Medplum SDK and FHIR type package.

### Rationale

- Medplum exposes a TypeScript SDK and typed FHIR resources, allowing reuse of supported authentication and resource-operation helpers.
- Explicit resource typing catches many invalid fields, discriminants, and SDK usage errors before execution.
- Official TypeScript examples and source implementations reduce translation effort and support review against real platform behavior.
- One deployment layer centralizes project checks, conditional requests, transaction submission, and safe error handling.
- The language can also support later application work, without committing to a frontend framework now.

### Alternatives considered

| Alternative | Trade-off |
|---|---|
| Python | Can use the same HTTP APIs and may suit analytics; would not directly reuse the selected TypeScript SDK and compile-time FHIR types. |
| Plain JavaScript | Similar execution model with less setup; loses TypeScript's compile-time resource and SDK checks. |
| Shell/cURL | Useful for small diagnostics; becomes harder to maintain for resource relationships, validation, and deployment safeguards. |
| TypeScript-only resource definitions | Provides strong authoring types but mixes configuration with implementation; ADR-002 selects JSON for static definitions. |

### Consequences and limits

TypeScript requires compilation checks, dependency management, and runtime tooling. Its benefits depend on explicit types and avoiding unchecked casts. JSON imported from disk is not automatically fully FHIR-validated merely because the surrounding code compiles. Runtime checks and Medplum server-side validation remain necessary; the current loader's selected checks are not a complete schema validator.

Revisit the language if a concrete integration, workload, or team requirement makes another runtime materially better. Additional languages should have a specific purpose rather than duplicating the deployment tool.

## 3. Node.js, npm, and local tooling

Decision date: October 16, 2026.

Use Node.js for TypeScript execution, npm for dependencies, `tsc --noEmit` for static checking, and `tsx` for running scripts without a separate emitted build directory. Use Node's environment-file support for locally supplied deployment credentials.

The initial README specifies Node 22+, but the supported runtime baseline must also satisfy the actual installed dependency engines; verify and pin a supported major before CI or shared deployment. Exact package resolutions belong in the lockfile rather than this ADR.

This keeps the initial toolchain small. It does not select a production runtime, CI provider, application host, database beyond Medplum, or frontend framework. Revisit direct execution versus a compiled build when packaging, CI, or deployment requirements make a build artifact useful.

## 4. Local execution and credentials

Decision date: October 16, 2026.

Run provisioning locally against the intended Helix staging project. Read credentials from the ignored root `.env`, linked into `code/.env`. Do not embed secrets in JSON, source, logs, or documentation. Check the target project before writing.

Local scripts fit the current hosted free-plan scope. They provide no background scheduler or always-on automation. Revisit execution hosting when unattended workflows are required; select a secret manager and execution identity before shared or hosted deployment.

## Verification expectations

- Type-check the deployment code and inspect generated transaction previews.
- Validate JSON at runtime and use server-side FHIR validation before relying on resources operationally.
- Verify actual provisioning and repeat-run behavior against staging separately from local checks.
- Review authorization and security-sensitive changes explicitly.

At creation of this ADR, local type-checking and foundation preview checks have passed. No foundation deployment or server-side validation has yet been performed.

## Deferred choices

Frontend framework; application hosting; CI/CD; queue/scheduler; shared secret storage; production deployment; comprehensive FHIR JSON schema validation. Record each here when a real requirement supports a decision.

## Change history

| Date | Change |
|---|---|
| October 16, 2026 | Established the living ADR; recorded Medplum/FHIR, TypeScript, Node/npm tooling, and local execution choices. |

## References

- Official Medplum SDK source: `medplum-link/packages/core/`.
- Official FHIR types: `medplum-link/packages/fhirtypes/`.
- [Medplum AI coding guidance](https://www.medplum.com/docs/building-with-ai-coding-assistants).
- Helix implementation and resolved dependencies: `code/package.json` and `code/package-lock.json`.

## 5. Git and CI/CD

Decision date: October 16, 2026.

Use Git and a private GitHub repository. GitHub Actions runs `make build` for pull requests and main-branch pushes, with a local configuration preview artifact. Node 24 is the shared runtime baseline. Dependencies are installed with `npm ci`.

Staging initially uses a manually dispatched main-branch workflow, serialized per environment. It rebuilds the selected commit, validates/plans before writes, and verifies after deployment. Deployment requires an explicit deploy selection and a repository enablement variable; this manual launch is not an independent approval. Configure GitHub environment protection where supported by the account plan. Separate environment secrets from repository code; do not upload developer .env files. Restrict the deployment identity before enabling unattended use.

No production workflow is included. Environment configuration, branch protections and secret provisioning require repository administration. GitHub environment availability and reviewer protection depend on plan and repository visibility. Do not make the repository public to obtain protection features.

## CI/CD implementation checkpoint — October 16, 2026

Make provides local build/test/preview and authenticated plan/verify/deploy entry points. Local build type-checks and runs two invariant tests; it emits no distributable. GitHub CI uses Node 24 and npm ci without Medplum credentials.

Staging uses an identifier-scoped client policy, staging environment secrets, main-only deployment, owner review, disabled admin bypass and serialized manual runs. Run/job names distinguish PLAN without resource writes from DEPLOY with writes allowed. The owner reviews the plan before authorizing deployment. Both hosted plan and repeated apply/verify passed; links and limits are maintained in docs/deployment.md. These are staging controls, not a production-readiness claim.

## Artifact-bound workflow update — October 20, 2026

Staging DEPLOY now takes plan_run_id, verifies a successful main PLAN run for the same commit/workflow, downloads its immutable artifact through actions/download-artifact, and validates its content/digest against current state. The workflow token adds actions:read for this read-only artifact lookup; no repository-write permission is added. Only successful PLAN runs publish the named plan artifact. Explicit run/job labels and owner environment approval remain.

## Separate encounter workflow

Reuse protected main, owner staging approval, shared concurrency and reviewed successful plan artifacts in encounters.yml. Only its separate MEDPLUM_ENCOUNTER credential pair is exposed to that job; enrollment/foundation identities are unchanged. Bootstrap is hosted CI/CD; the separately reviewed synthetic lifecycle runner remains local. Effective-policy comparison now checks writeConstraint, readonly and field restrictions as well as criteria/interactions, so lost constraints cannot silently pass preflight.
