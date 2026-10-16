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

1. Review/merge documentation cleanup after CI.
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
