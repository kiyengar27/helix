# Helix project handoff

Updated October 20, 2026. Use this file and live GitHub state instead of relying on chat history.

## Current milestone

[Issue #8](https://github.com/kiyengar27/helix/issues/8) is closed: synthetic headless enrollment and access acceptance passed. PR #21 merged at 2b83f9165e46d369cfa8bde7df471065a0785a0f. All 41 local tests and main CI passed. This closeout documentation is on docs/8-acceptance-closeout; check its PR state before continuing.

Next: [issue #9](https://github.com/kiyengar27/helix/issues/9), minimal headless encounter and prescribing intent. Begin with a concise resource/state/ownership proposal and official Medplum guidance before implementation. Patient → eligible clinician → Encounter → prescribing intent → follow-up Task. No real prescription or Photon transmission. Then #10 Photon/pharmacy sandbox, #11 broader care workflows, #12 application experience. Keep stages through #11 headless.

## Deployed inventory

45 care-delivery resources: Organization 1, Location 14 (five markets, five clinics, two virtual sites, two jurisdiction areas), HealthcareService 8, Practitioner 8, PractitionerRole 10, Schedule 4. Plus six synthetic Patients and five RelatedPersons.

Markets: North Bay CA, South Bay CA, Austin Metro, Dallas North, Dallas South. Offerings: Primary Care, Acute Care, Cardiology, Urology, Rheumatology, Infusion Therapy, Transitions of Care, Complex Care. Patient affiliation is Helix with optional PCP; no patient home-market field. Backlog #19 covers future ownership/history. #14 physician offboarding is deferred. #6 and #15 are closed.

## Live evidence

- Care-delivery PLAN 39434179867 and DEPLOY 39438818281: 31 creates, eight controlled updates, six retained. All 45 verified.
- Initial enrollment PLAN 39445548745 and DEPLOY 39445743926: six Patients and five RelatedPersons.
- Realistic names/tags PR #20: PLAN 39448832813; DEPLOY 39449067169; 11 updates, no creates/deletes. Independent verification passed.
- Enrollment lifecycle/access PR #21: owner created separate scoped runtime and clinical clients. Read-only acceptance PLAN digest 9c1ecb2b2ec11e6e949ca33c214e71505f35b52f84beae1266e54cb1294c718d. Owner explicitly authorized five-write local apply.
- Live acceptance passed: address change, PCP removal, original Patient restoration, relationship deactivation/restoration. IDs, identifiers and original business fields retained; version metadata advanced. Clinical write denied, stale registration write rejected, existing unrelated patient hidden by direct read/search. Proxy grant/revoke/inactive-relationship behavior passed through the synthetic trusted adapter.
- Fresh independent verification passed all 11 enrollment records and all 45 care-delivery resources at 2026-10-20T15:47:37.487Z. Evidence recorded in closed issue #8. No patient/proxy accounts or durable proxy grants exist.

## Access and execution boundaries

Foundation credentials remain Patient-denied. Separate enrollment provisioning credentials manage the exact 11 fixtures. Separate runtime and clinical acceptance clients cover only Eleanor Bennett and Laura Bennett; runtime can read/search/update, clinical can read/search only. See code/config/security/ and docs/patient-enrollment.md. No wildcard clinical or admin grants.

Local acceptance commands use MEDPLUM_ENROLLMENT, MEDPLUM_ENROLLMENT_RUNTIME and MEDPLUM_ENROLLMENT_CLINICAL client variables from ignored .env. No credential values belong in docs/chat/logs. The runtime/clinical acceptance secrets are local; current GitHub workflows do not execute the acceptance runner. Authentication and durable proxy-grant storage remain explicit future application integration boundaries. The acceptance harness uses synthetic principals/process-local grants; it is not a production authentication service, legal authority verifier or deployed proxy portal.

## Deployment rules

Main-only staging, owner environment approval, no admin bypass. Public CI has no deployment credentials. Care-delivery and enrollment GitHub workflows use separate credentials/artifacts and shared staging concurrency. PLAN is nonpersistent; DEPLOY requires its successful same-commit reviewed PLAN run ID, configuration/project/snapshot/version integrity and 24-hour expiry. Obtain explicit authorization before dispatching writes, then leave environment approval to owner.

The local enrollment acceptance runner has its own clean-commit/snapshot-bound reviewed plan, five version-checked writes and restoration on success. If interrupted, inspect the two synthetic records and review recovery; no automatic rollback. Do not rerun an old acceptance plan after successful writes because versions have advanced. Plans/raw operational material stay ignored under code/reports/.

Controlled declarative updates are limited to declared care-delivery fields and enrollment names/Helix classification tags. Enrollment service edits are a separate runtime boundary; fixture drift fails closed. Live clinic closure remains blocked pending dependency audits. No deletion, automatic future-status synchronization or verified real licensure. CA/TX are the only explicit fixture jurisdictions; nationwide eligibility remains an onboarding target.

## Working preferences

Concise communication; no autonomous browser navigation. Issue-first, sizeable milestones; branch → checks → PR → reviewed merge. Do not merge without owner instruction. All setup is declarative/code-driven except account bootstrap, secrets and approvals. Present branch cleanup before deletion; old merged branches may remain. Maintain ADR-001 for domain, ADR-002 for reconciliation, ADR-003 for tooling. Read AGENTS.md, README.md and relevant official Medplum source after compaction. Keep synthetic payloads out of public logs/artifacts. Software license is not selected.
