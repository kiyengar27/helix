# Helix project handoff

Updated: October 16, 2026. This file describes current state; verify live GitHub settings before relying on them.

## Resume

Read AGENTS.md, README.md, this file, and relevant PRD/ADRs. Inspect Git status, open issues/PRs and CI before editing. Use official Medplum docs/source; do not depend on chat history.

## Established state

- Public repository: https://github.com/kiyengar27/helix.
- Owner checkout: ~/development/helix; code under code/.
- Official reference: ~/development/medplum via ignored medplum-link.
- Medplum project Helix is synthetic staging; target ID is in code/config/staging.json. No production environment exists.
- Deployed foundation: Helix Medical Group; North Bay CA, South Bay CA, Austin Metro, Dallas North, Dallas South; Primary Care, Acute Care, Cardiology, Urology, Rheumatology, Infusion Therapy, Transitions of Care, Complex Care.
- One practice-level patient identity, optional PCP, one home market and separate visit location are agreed concepts. Patient persistence/workflows are not implemented.
- Declarative FHIR R4 JSON; TypeScript deployment; Node 24; npm lockfile; Make local and server-aware checks.

## Completed staging milestone

Issue #3 implementation is operational; documentation closeout is on docs/3-staging-closeout pending review/merge. PRs #4 and #5 are merged, their branches were removed with owner approval, and main was synchronized before closeout work.

- Restricted policy applied to client membership; effective identifier-scoped read/search/create rules verified.
- Patient, ProjectMembership and ClientApplication searches denied with 403. No destructive denial tests performed.
- Staging environment secrets configured, STAGING_ENABLED=true, main-only access, owner reviewer, no admin bypass.
- [Hosted PLAN](https://github.com/kiyengar27/helix/actions/runs/38928287615) passed: 14 retained, no drift.
- [Hosted DEPLOY/verify](https://github.com/kiyengar27/helix/actions/runs/38928472739) passed: 14 transaction statuses of 200, no duplicates, no drift.
- Verified main commit: eabc55833c1aabd0232a14d0304fd11f4c1204ad.
- First-time creation under restricted policy remains untested; existing-resource transaction path is proven. See docs/deployment.md.

## Next milestone

[Issue #6](https://github.com/kiyengar27/helix/issues/6): clinics, virtual care, service coverage, and eligible provider roles. Begin by reading official location/provider/scheduling docs, then propose a small sample roster and coverage matrix for owner review. Do not immediately provision new resources or extend permissions.

After closeout PR merge, synchronize main and present a merged-branch cleanup plan before deletion. Do not enable automatic branch deletion without approval.

## Constraints and unresolved decisions

Create-only deployment: differences block writes, no updates/deletes/automatic rollback. Adding identifiers or resource types requires reviewed policy updates. Authorization is independent of licensure, geography, team membership and routing. Market-assignment history, episode/program mapping, legal structure, detailed patient access and team/queue design remain unresolved under ADR-001. Software license is not selected.

## Working preferences

Concise communication. No autonomous browser navigation. One sizeable issue per milestone; use branch → checks → PR → owner merge. Maintain ADR-002 for deployment semantics and ADR-003 for technology/tooling decisions. Show a plan before apply; obtain authorization to launch deployment and let the owner approve GitHub's environment gate. Keep credentials and patient data out of chat, Git and artifacts.

## Resume prompt

> Read AGENTS.md and docs/STATUS.md. Inspect repository and CI state. Continue the next incomplete milestone from its issue, starting with a concise plan. Do not navigate the browser or print credentials. Show the plan before any deployment.
