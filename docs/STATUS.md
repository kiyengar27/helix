# Helix project handoff

Updated: October 20, 2026. Verify live GitHub/Medplum state before relying on this checkpoint.

## Resume

Read AGENTS.md, README.md, this file and relevant PRD/ADRs. Inspect current branch, working tree, issues, PRs and CI. Use official Medplum source via optional medplum-link; do not depend on chat history.

## Established state

- Repository: https://github.com/kiyengar27/helix. Owner checkout: ~/development/helix; implementation under code/.
- Medplum project Helix is synthetic staging; target is pinned in code/config/staging.json. No production environment, patients or provider logins are provisioned.
- FHIR R4 JSON + application manifests, TypeScript compiler/deployment, Node 24, npm lockfile and Make checks.
- One patient identity, optional PCP and separate visit jurisdiction remain agreed future concepts. Patient home-market ownership/history is deferred to #19.

## Completed milestones

Issue #3: restricted, owner-approved staging CI/CD. PRs #1/#4/#5/#7 merged.

Issue #6: care-delivery configuration and deployment implemented in merged PRs #13/#16; documentation closeout on docs/6-care-delivery-closeout. Issue closes on closeout PR merge. Clinic lifecycle local capability #15 is closed; physician offboarding #14 remains deferred.

Live managed inventory (45 resources):

| Type | Count |
|---|---:|
| Organization | 1 |
| Location | 14 (5 markets, 5 clinics, 2 virtual sites, 2 jurisdiction areas) |
| HealthcareService | 8 |
| Practitioner | 8 synthetic clinicians |
| PractitionerRole | 10 service-specific roles |
| Schedule | 4 sample rotations |

Markets: North Bay CA, South Bay CA, Austin Metro, Dallas North, Dallas South. Offerings: Primary Care, Acute Care, Cardiology, Urology, Rheumatology, Infusion Therapy, Transitions of Care, Complex Care.

## Live evidence

- Owner applied generated care-delivery policy; effective scope matched code. Patient, ProjectMembership and ClientApplication searches denied.
- [PLAN 39434179867](https://github.com/kiyengar27/helix/actions/runs/39434179867): 31 creates, eight coverage updates, six retained.
- [DEPLOY 39438818281](https://github.com/kiyengar27/helix/actions/runs/39438818281): success after owner approval; 31 responses 201, eight responses 200; all 45 verified.
- Deployed commit: 670b9767e1ca6a2081b05d75143ba9819f6b2a21.
- Independent fresh local npm run verify passed for all 45 at 2026-10-20T14:25:57.806Z. No duplicates or managed drift.
- Build has 23 tests covering configuration, routing scope, lifecycle and deployment integrity/concurrency. Tests and compiled resource/policy server validation passed. Hosted reviewed-artifact transfer and first expanded transaction are now proven.

## Deployment rules and limits

Main-only staging with owner environment approval, no admin bypass, restricted environment secrets and explicit PLAN/DEPLOY names. PLAN artifacts bind commit/project/configuration and server snapshots; DEPLOY requires its successful same-commit plan_run_id and rejects expired/stale plans. See docs/care-delivery-deployment.md.

Controlled updates only: service location/coverage, clinic status and Schedule.active. Live clinic suspension/closure is blocked pending dependency audits. No deletion, rollback, automatic future status synchronization, runtime clinical authorization or verified licensing. Configured schedules do not prove booking outcomes; only four examples have concrete availability. Market programs/preferences/participation remain application configuration in Git. Nationwide virtual is a target; fixtures explicitly support only CA/TX.

## Next milestone

[Issue #8](https://github.com/kiyengar27/helix/issues/8): patient enrollment, caregivers/guardians and access. Start with a concise proposed enrollment representation and access matrix for owner review. Do not add patient fixtures or change permissions before that review. Early Photon sandbox prerequisites can be investigated under #10 without starting integration implementation.

Then #9 minimal headless encounter/prescribing intent; #10 Photon/pharmacy sandbox; #11 broader care workflows; #12 application experience. Stages through #11 remain headless. #14 physician offboarding is backlog, not a blocker.

## Working preferences

Concise communication; no autonomous browser navigation. One sizeable GitHub issue per milestone; branch → tests → PR → reviewed merge. All setup is code/declarative except documented bootstrap, secrets and approvals. Show resource/permission plans before writes; obtain dispatch authorization and leave GitHub environment approval to the owner. Present branch cleanup before deleting branches; merged #13/#16 branches may still remain. Maintain ADR-002 for deployment and ADR-003 for tooling. Keep secrets/patient payloads out of Git/chat/artifacts. Software license is not selected.

## Resume prompt

> Read AGENTS.md and docs/STATUS.md. Check live Git/CI state. Continue issue #8 with a concise design plan before implementation. Do not navigate the browser, print credentials or apply changes without reviewed plans and owner approval.

## Active stage 2 work

Issue #8 on feat/8-enrollment-contract, draft PR #18: standard practice affiliation/optional PCP and typed RelatedPerson/proxy-review helpers. Scope includes older-adult caregiver, under-12 parent, ages 12/13 and 14–17, with no automatic access or capacity assumption. Patient home-market extension/history was removed before deployment and is deferred to issue #19. Do not reintroduce a custom patient market field during enrollment work.

Local anonymous contract tests only; no patient fixtures, writes, profiles, policies or identities created. Existing provisioning client remains patient-denied. Next gate: review the reduced enrollment and caregiver access matrix, then implement separate enrollment identity/policies and synthetic headless scenarios.

## Stage 2 fixture preparation

Draft PR #18 now prepares six synthetic Patients and five RelatedPersons, with a separate generated enrollment policy and pinned deployed group/PCP references. All payloads/policy passed server validation without saving resources. Separate plan/apply/verify commands and gated enrollment.yml use only new MEDPLUM_ENROLLMENT credentials; ENROLLMENT_ENABLED remains unset. Foundation permissions unchanged. Next checkpoint: owner reviews PR, then creates the new scoped enrollment policy/client (instructions in docs/patient-enrollment.md). No Patient/RelatedPerson records, staff logins or proxy grants exist yet. Demographic updates and real authorization acceptance tests remain open under #8.

## Current checkpoint: realistic enrollment names

PR #18 merged; initial enrollment PLAN 39445548745 and DEPLOY 39445743926 succeeded on main 01b495651b1766308e0ca4968ae6c1cdf43e7e98. Staging has six Patients and five RelatedPersons, independently verified. Separate enrollment credentials and ENROLLMENT_ENABLED are configured. Earlier preparation-only notes above are historical. Issue #8 remains open for access acceptance and remaining enrollment flows.

Active branch feat/8-realistic-enrollment-names prepares invented names plus synthetic classification tags, retaining identity and relationships. All 11 payloads and generated policy passed nonpersistent server validation. No name/tag updates or policy expansion have been applied. Next: review/merge this PR, owner updates existing enrollment policy to allow scoped resource updates, run/review enrollment PLAN, then authorize DEPLOY and leave environment approval to owner. Never expand foundation permissions. See patient-enrollment.md for exact boundaries.

## Latest checkpoint: issue #8 lifecycle/access acceptance

PR #20 merged at 82e9d36345c4f36f9b91178e56ec6903f497d6b8. PLAN 39448832813 and DEPLOY 39449067169 succeeded: 11 name/tag updates, no creates/deletes; independent verification confirmed all 11. Earlier pending-name notes are historical.

Active branch feat/8-enrollment-access adds scoped registration edits, clinical demographic reads and proxy grant/revoke/review-boundary checks; separate Medplum runtime/clinical policies; reviewed local five-write acceptance runner. All 41 local tests pass; both policies server-validated without persistence. No new policies/clients or acceptance mutations applied. Next: review/merge PR, owner creates the two non-admin acceptance clients/policies and saves separate credentials, then run read-only acceptance PLAN. Present five-write plan and obtain authorization before apply. Restore/verify fixture state and record live evidence before closing #8. Full human authentication and durable production proxy-grant storage are future integration boundaries, not delivered by the synthetic harness. See patient-enrollment.md.
