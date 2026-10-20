# Helix project handoff

Updated October 20, 2026. Use this file and live GitHub state instead of relying on chat history.

## Current milestone

[Issue #9](https://github.com/kiyengar27/helix/issues/9) is closed after successful deployment and live lifecycle/access acceptance. PR #24 merged at c1fcbf7ce18d4064d99681991819c137191868dd; 52 tests and hosted checks passed. This documentation closeout is on docs/9-acceptance-closeout; check its PR status before continuing. #8 remains closed.

Next: [issue #10](https://github.com/kiyengar27/helix/issues/10), Photon/pharmacy sandbox integration. Review official Photon docs, sandbox account/API capabilities, drug/product/regimen requirements, authorized prescriber setup, caregiver recipient support and financial-feature fidelity. Retain the two cases: Eleanor/Laura infection/amoxicillin concept and independent adult Daniel GLP-1/Wegovy concept. No verified drug strength/dose, clinical eligibility, insurance, PA or savings outcome exists yet. The owner wants Photon app/embedded and SMS secure-link testing using a privately configured personal test phone; no phone number has been captured in Git or fixtures. Verify sandbox SMS behavior before sending. #11 broader workflows and #12 application experience follow; keep the core integrations headless.

## Deployed inventory

45 care-delivery resources: Organization 1, Location 14 (five markets, five clinics, two virtual sites, two jurisdiction areas), HealthcareService 8, Practitioner 8, PractitionerRole 10, Schedule 4. Plus six synthetic Patients and five RelatedPersons, two finished Encounters, two draft/proposal MedicationRequests and two draft/plan Tasks.

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

## Stage 3 completion evidence

PR #23 model/compiler and PR #24 deployment/lifecycle code are merged. Hosted PLAN 39485163062 succeeded after synchronizing the two encounter secrets from verified local values; first PLAN 39484936030 failed before resource writes. DEPLOY 39485504459 succeeded: six creates, no Patient/foundation writes, no signing/transmission/SMS.

Owner approved separate local flow plan digest dc42738ac894c2033f6ef791b86d61b9a20f80366e5dd2337aad7dfbf33f19ed. Four version-checked updates finished both visits; six skipped/stale/reopen requests were rejected; native planned/in-progress/finished history verified. All 24 read/search isolation checks passed against existing enrollment/clinical identities. Independent post-flow verification confirmed six encounter, eleven enrollment and forty-five care-delivery resources at 2026-10-20T19:43:04.852Z. Evidence recorded on closed #9. All 52 tests passed before deployment.

The dedicated Helix Staging Encounter Service policy/client and local/staging MEDPLUM_ENCOUNTER secrets are configured; ENCOUNTER_ENABLED=true is a repository variable. This is a synthetic backend test identity, not an authorized human prescriber. Two completed encounters are historical and must not be reset. Bootstrap should retain all six resources after progress; its saved precreation plan and the consumed lifecycle plan must not be reused. For another lifecycle episode, review new stable scenario identities. Encounter-verify and access checks are read-only. Follow encounter-deployment.md for controls and interrupted-run recovery.

## Active Photon checkpoint — slow, reviewed steps

#10 is active. PR #25 is merged at 309d4fd. Neutron access confirmed; local PHOTON_CLIENT_ID/SECRET authentication succeeded, no token logged/persisted. No Photon patient, prescription, order or SMS exists from our integration. User requests slow step-by-step review and specific documentation/integration feedback. Track findings in photon-feedback.md. No browser automation or vendor messages authorized.

Branch feat/10-patient-sync-demographics prepares standard birthsex extensions for Daniel M and Eleanor F only, independent of administrative gender; no phone is added. All 55 tests and nonpersistent Medplum validation passed. After review/merge, show enrollment PLAN (expected two updates/nine retained), then request deployment authorization. Existing policies unchanged. SMS alternatives: Mailosaur private test number/inbox documented but not selected or tested with Photon; no documented Photon magic test number found. Owner must choose a private messaging destination before Photon patient creation. Keep PHOTON credentials local for now. Do not skip ahead to orders, provider login or SMS.

## Required sex update

Owner requires sex mandatory. Branch feat/10-required-birth-sex expands explicit birth-sex configuration to all six Patients and requires it in fixture compilation/mapping validation. The earlier two-patient PLAN 39488477407 was cancelled while waiting; no live updates. Prepare a fresh enrollment PLAN after review/merge, expected six extension updates/five retains. No Medplum base-schema/UI/global-write constraint or policy expansion introduced. Owner chose a private personal test phone, saved only as PHOTON_TEST_PHONE in ignored .env; never copy it into docs, Git or logs. No Photon sync or SMS yet.

## Photon feedback clarification

Owner's request for a cross-EHR field-mapping guide is feedback for Photon, not a Helix guide implementation. Captured in photon-feedback.md with examples requested for Medplum/Epic/athenahealth. Do not contact Photon without explicit authorization. Neutron schema inspection showed nullable patient phone despite required phone in public examples; no runtime/notification behavior inferred. Birth-sex deployment 39489323792 and independent 11-record verification succeeded. Next slow step: establish duplicate-safe patient sync and messaging side effects before reviewing/authorizing Daniel's single-patient creation. No Photon records/messages created.
