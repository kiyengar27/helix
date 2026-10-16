# Helix contributor and agent guidance

## Resume and source of truth

1. Read README.md and docs/STATUS.md before starting work.
2. Inspect Git status and current branch; preserve unrelated changes.
3. Read the relevant PRD, ADR, implementation, and official Medplum guidance before coding.
4. After context compaction, reread these files and relevant source; chat history is not authoritative project state.

Official Medplum source is optionally linked at `medplum-link/`; setup is in docs/development.md. Docs are under `packages/docs/docs/`. If the link is missing, use official Medplum docs/source rather than guessing. Do not modify the reference checkout for Helix implementation.

## Product boundaries

- Helix is a multispecialty group with one patient identity, optional PCP, one current home market, and independent services, care episodes, and teams.
- Follow docs/PRD-001 and ADR-001. Home-market persistence, program mapping, and detailed authorization remain implementation decisions.
- Use synthetic data only. Hosted free-plan staging uses local workflow logic; recheck plan capabilities before relying on hosted automation.
- Do not navigate the browser automatically. Give concise manual instructions when needed.

## Implementation

- Use FHIR R4 and explicit @medplum/fhirtypes types; reuse @medplum/core and official examples.
- JSON configuration is authoritative for foundation definitions. TypeScript manages deployment mechanics.
- Keep stable identifiers. Use conditional creation and transaction Bundles with resolvable urn:uuid references. Do not implement search-then-create.
- Current deployment is create-only; drift blocks writes. Updates/deletions need a separately reviewed design.
- Do not invent clinical codes, resource fields, search parameters, or operations.
- Scheduling availability does not enforce licensure. Access policies enforce permissions independently of routing, organization, market, and care-team relationships.
- Read relevant scheduling guidance before changing availability; Medplum uses implicit availability rather than precreated open Slots.

## Security and delivery

- Never expose or commit secrets, .env files, patient data, node_modules, reports, or medplum-link.
- Public CI runs without credentials. Never execute untrusted contribution code with deployment secrets.
- Work on branches and use pull requests; run `make build` from code/. Do not bypass main protection.
- `make plan` is authenticated but does not persist clinical resources; `make deploy` writes. Verify authorization, environment, and project before writes.
- Update ADR-003 for system/language/tooling decisions rather than creating an ADR per tool. Update ADR-002 for deployment semantics.
- Update docs/STATUS.md at meaningful checkpoints: completed work, evidence, pending work, constraints, and exact next action. Do not record secrets or depend on chat-only context.
- Keep generated operational artifacts under ignored code/reports/. Documentation belongs in docs/; do not carry chat-specific output-directory conventions into this repository.
