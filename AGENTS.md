# Helix contributor and agent guidance

## Resume and source of truth

1. Read README.md and docs/STATUS.md before starting work.
2. Inspect Git status and current branch; preserve unrelated changes.
3. Read the relevant PRD, ADR, implementation, and official Medplum guidance before coding.
4. After context compaction, reread these files and relevant source; chat history is not authoritative project state.

Official Medplum source is optionally linked at `medplum-link/`; setup is in docs/development.md. Docs are under `packages/docs/docs/`. If the link is missing, use official Medplum docs/source rather than guessing. Do not modify the reference checkout for Helix implementation.

## Product boundaries

- Helix is a multispecialty group with one patient identity, optional PCP, and independent services, care episodes, and teams. Patient-level home-market assignment/history is deferred to issue #19.
- Follow docs/PRD-001 and ADR-001. Program mapping and detailed authorization remain implementation decisions; do not reintroduce patient market fields in issue #8.
- Use synthetic data only. Hosted free-plan staging uses local workflow logic; recheck plan capabilities before relying on hosted automation.
- Do not navigate the browser automatically. Give concise manual instructions when needed.

## Implementation

- Use FHIR R4 and explicit @medplum/fhirtypes types; reuse @medplum/core and official examples.
- All setup must be reproducible through versioned declarative configuration and deployment code, including policy definitions and reference linking. Manual work is limited to documented account/bootstrap requirements, secrets and approvals.
- JSON configuration is authoritative for foundation definitions. TypeScript manages deployment mechanics.
- Keep stable identifiers. Use conditional creation and transaction Bundles with resolvable urn:uuid references. Do not implement search-then-create.
- Follow ADR-002 and docs/care-delivery-deployment.md for bounded updates and reviewed-plan deployment. Unmanaged drift blocks writes; no delete reconciliation. Clinic live closure is not enabled.
- Do not invent clinical codes, resource fields, search parameters, or operations.
- Scheduling availability does not enforce licensure. Access policies enforce permissions independently of routing, organization, market, and care-team relationships.
- Read relevant scheduling guidance before changing availability; Medplum uses implicit availability rather than precreated open Slots.

## Security and delivery

- Never expose or commit secrets, .env files, patient data, node_modules, reports, or medplum-link.
- Public CI runs without credentials. Never execute untrusted contribution code with deployment secrets.
- Work on branches and use pull requests; run `make build` from code/. Do not bypass main protection.
- Present the resource plan before deployment; obtain authorization to dispatch apply/deploy, then leave GitHub environment approval to the owner. Present a cleanup plan before deleting merged branches.
- `make plan` is authenticated but does not persist clinical resources; `make deploy` writes. Verify authorization, environment, and project before writes.
- Update ADR-003 for system/language/tooling decisions rather than creating an ADR per tool. Update ADR-002 for deployment semantics.
- Update docs/STATUS.md at meaningful checkpoints: completed work, evidence, pending work, constraints, and exact next action. Do not record secrets or depend on chat-only context.
- Keep generated operational artifacts under ignored code/reports/. Documentation belongs in docs/; do not carry chat-specific output-directory conventions into this repository.

## Issue-first work tracking

- Before implementing any new change, create a GitHub issue or select an existing issue that covers it. This includes documentation, configuration, code, and deployment work.
- Record the problem, scope, acceptance criteria, and validation expectations in the issue. Do not include credentials or patient data.
- Reference the issue in branch names for new branches and in every implementation PR. Use `Closes #N` only when that PR satisfies the issue completely; otherwise use `Refs #N` and identify remaining work.
- Update the issue with meaningful progress, blockers, and verification evidence. Close it when the work is actually complete, preferably through the merged PR.
- Preserve active issue/PR references in docs/STATUS.md so another developer or resumed agent can continue without chat history.
- User requests authorize creating the corresponding issues; do not ask for repeated confirmation for ordinary issue tracking within this repository.
