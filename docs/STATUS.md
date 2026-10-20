# Helix project handoff

Updated: October 20, 2026. This file describes current state; verify live GitHub settings before relying on them.

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

Issue #3 is closed. Documentation closeout PR #7 is merged, its branch was removed locally and remotely, and main was synchronized. PRs #4 and #5 are merged, their branches were removed with owner approval, and main was synchronized before closeout work.

- Restricted policy applied to client membership; effective identifier-scoped read/search/create rules verified.
- Patient, ProjectMembership and ClientApplication searches denied with 403. No destructive denial tests performed.
- Staging environment secrets configured, STAGING_ENABLED=true, main-only access, owner reviewer, no admin bypass.
- [Hosted PLAN](https://github.com/kiyengar27/helix/actions/runs/38928287615) passed: 14 retained, no drift.
- [Hosted DEPLOY/verify](https://github.com/kiyengar27/helix/actions/runs/38928472739) passed: 14 transaction statuses of 200, no duplicates, no drift.
- Verified main commit: eabc55833c1aabd0232a14d0304fd11f4c1204ad.
- First-time creation under restricted policy remains untested; existing-resource transaction path is proven. See docs/deployment.md.

## Current work and next gate

Issue #6 on feat/6-care-delivery-design: proposed 27 additional resources, coverage matrix and operating-model manifest under code/config/proposals/, with docs/care-delivery-proposal.md and PRD/ADR-001 updates. These are review drafts, not consumed by deployment. No Medplum resources or permissions changed.

Next: owner reviews roster and coverage, then implement validated declarative compilation and controlled updates for existing HealthcareService location/coverage fields. Present the resource and permission plan before apply. Do not route proposal JSON through the current create-only deployer.

## Agreed milestone order

1. #6: care-delivery structure.
2. #8: patient enrollment, market history, and access.
3. #9: minimal headless encounter and prescribing intent.
4. #10: Photon/pharmacy sandbox integration; investigate prerequisites during stages 1–2.
5. #11: broader specialty and coordinated-care workflows.
6. #12: application experience.

Stages 1–5 stay headless. Work through one implementation milestone at a time. All setup is code/declarative, with documented bootstrap/secret-entry/approval exceptions.

## Constraints and unresolved decisions

Create-only deployment: differences block writes, no updates/deletes/automatic rollback. Adding identifiers or resource types requires reviewed policy updates. Authorization is independent of licensure, geography, team membership and routing. Market-assignment history, episode/program mapping, legal structure, detailed patient access and team/queue design remain unresolved under ADR-001. Software license is not selected.

## Working preferences

Concise communication. No autonomous browser navigation. One sizeable issue per milestone; use branch → checks → PR → owner merge. Maintain ADR-002 for deployment semantics and ADR-003 for technology/tooling decisions. Show a plan before apply; obtain authorization to launch deployment and let the owner approve GitHub's environment gate. Keep credentials and patient data out of chat, Git and artifacts.

## Resume prompt

> Read AGENTS.md and docs/STATUS.md. Inspect repository and CI state. Continue the next incomplete milestone from its issue, starting with a concise plan. Do not navigate the browser or print credentials. Show the plan before any deployment.

## Current proposal revision

PR #13 now includes whole-market provider participation, preferred clinics, role-specific modes/jurisdictions, nationwide virtual targets without blanket eligibility, ten market-program responsibility entries, and sample Bay Area rotation templates. Specialists support clinic delivery in all five markets; infusion remains physical-only at the two initial sites. Disabled future shared offerings and an external mental-health referral partnership are explicitly recorded. Local delivery-scope logic and preview are available; this is not scheduling or authorization enforcement. Run make build (nine tests) and npm run preview:care-delivery from code/. No deployment or permission changes. Next gate remains review before compiler/controlled-update implementation and server-side checks.

## Lifecycle follow-up

Issue #14 is deferred physician offboarding (not implemented). Issue #15 covers clinic lifecycle added to draft PR #13: declarative effective-dated history, status projection, nonactive-clinic new-routing denial and configuration impact preview. Fourteen local tests pass. No live updates, hard deletion, appointment cancellation, policy expansion or background status synchronization. Next implementation still needs the controlled-update path and owner-reviewed resource/permission plan.

## PR #13 review closeout

Owner requested review and merge of the declarative structure/lifecycle proposal. Review checks passed: local type-check and 14 tests, timestamped 41-resource collection preview, operating-model references, documentation links, and unchanged active foundation configuration/deployer/workflow. No blocking findings for this isolated proposal capability. Issue #15 closes with merge; issue #6 remains open for the deployment compiler, controlled updates, policy diff and live validation/deployment. No proposal resources have been deployed. Branch deletion requires a separate cleanup plan/approval.
