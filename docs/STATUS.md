# Helix project handoff

Updated: October 16, 2026.

## Read first when resuming

Read AGENTS.md, README.md, this file, and the relevant ADR before edits. Inspect git status/current branch, recent commits, open PRs, and GitHub Actions results. This file is a checkpoint, not a substitute for live verification of external settings.

## Established state

- Public repository: https://github.com/kiyengar27/helix.
- Local owner checkout: ~/development/helix; implementation under code/.
- Official Medplum checkout: ~/development/medplum, referenced by ignored medplum-link.
- One Medplum project named Helix is used for synthetic staging. Target ID is in code/config/staging.json.
- Initial foundation deployed: Helix Medical Group, five operational markets, eight offerings.
- Markets: North Bay CA, South Bay CA, Austin Metro, Dallas North, Dallas South.
- Offerings: Primary Care, Acute Care, Cardiology, Urology, Rheumatology, Infusion Therapy, Transitions of Care, Complex Care.
- Patient identity belongs to the group; optional PCP, one home market, separate visit location, independent care episodes/teams. No patient implementation yet.
- FHIR JSON authoring, thin TypeScript deployment, Node 24, npm lockfile, Make checks.

## Evidence already obtained

Local type-check and two invariant tests passed. All 14 resources passed Medplum validation, were created, and matched the post-deploy plan. Repeated apply returned existing-resource status for all 14 with no new resources. Owner-local reports are ignored and not included in public Git.

Initial GitHub main CI succeeded: https://github.com/kiyengar27/helix/actions/runs/38922198012.

## CI/CD state

Main protection and staging owner approval were configured; only the owner is a collaborator. Staging is main-only and manually dispatched. Deployment is still disabled: no GitHub Medplum secrets uploaded and STAGING_ENABLED has not been enabled. Current local provisioning client has broad project permissions. Do not describe least-privilege deployment as completed.

## Current work

Documentation cleanup on docs/developer-onboarding: replace chat-dependent guidance, provide external developer setup/runbook, correct stale validation/runtime statements, and establish this durable handoff. Submit through a PR and check its CI.

## Next actions, in order

1. Documentation PR #1 is merged and issue #2 is closed. Continue secure staging issue #3.
2. Design a minimal provisioning access policy against official Medplum docs. Test the allowed operations and denied unrelated operations. Do not change credentials or security configuration without explicit review.
3. Configure staging environment secrets with the restricted identity; enable workflow; run plan and verify owner approval gate.
4. Decide market-assignment representation, program mapping, and patient authorization before introducing patient workflows.
5. Add clinics/virtual coverage, eligible provider roles, and synthetic patient flows through reviewed work items.

## Open decisions and limits

ADR-001 remains proposed; resolve home-market history, service/program mapping, legal organization structure, availability matrix, team/queue design, and detailed access matrix. Current deployment is create-only; differences block writes, and no update/delete rollback exists. Production, real patient data, frontend, and clinical integrations are out of scope. Select a software license before claiming open-source licensing.

## Working preferences

Keep responses concise. Do not navigate browser autonomously. Use official local Medplum docs/source. Keep secrets out of chat and tracked files. Update this handoff at milestones and record technology choices in ADR-003 rather than proliferating ADRs.

## Suggested resume prompt

> Read AGENTS.md and docs/STATUS.md. Inspect repository and CI state, then continue the next incomplete action. Use official Medplum references, keep responses concise, and do not navigate the browser. Never print credentials.

## Active tracking

- PR #1: https://github.com/kiyengar27/helix/pull/1 — onboarding and documentation cleanup; CI passed before the issue-first guidance update.
- Issue #2: https://github.com/kiyengar27/helix/issues/2 — establish issue-first work tracking; implemented in the documentation PR, pending merge.
- All subsequent implementation starts with a GitHub issue; check existing issues before creating another.

## Secure staging checkpoint

Issue #3: https://github.com/kiyengar27/helix/issues/3. Branch: feat/3-secure-staging. Proposed identifier-scoped read/search/create policy is in code/config/security/provisioning-policy.json. Owner instructions: docs/staging-access-setup.md. Await owner application to the provisioning client membership, then fresh-login verification. No policy applied, secrets uploaded, or workflow enabled yet.

Owner checkpoint clarification: the client-membership link redirected to sign-in; policy application has not been confirmed. Updated docs/staging-access-setup.md with authentication, Project → Clients fallback, identity checks, and not-found handling. Resume by waiting for owner confirmation, then verify fresh-login effective permissions.

## Restricted policy verified

Owner confirmed policy application. Fresh client login on October 16 confirmed the expected identifier-scoped read/search/create rules, without wildcard clinical access; Medplum also adds read-only SearchParameter/StructureDefinition access. All 14 foundation resources passed server validation and matched configuration. Searches for Patient, ProjectMembership, and ClientApplication each returned 403. No writes or destructive denial tests were performed; create/transaction behavior under the new policy still awaits deployment verification.

Next owner step: add MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET to GitHub staging environment secrets. Keep STAGING_ENABLED unset until the security-check implementation and PR are ready. Do not claim hosted pipeline completion yet. Earlier references to the client still being broadly privileged are historical and superseded by this checkpoint.
