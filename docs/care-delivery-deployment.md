# Deploying the care-delivery structure

Issue #6. Implementation is reviewable in code; no resources or permissions are changed by merging. Do not dispatch a deployment until the policy and a successful authoritative PLAN have been reviewed.

## What is compiled

The compiler combines foundation.json, proposed resource definitions, coverage, operating-model rotation templates and effective clinic lifecycle. It adds HealthcareService.location/coverageArea and four FHIR R4 Schedules with Medplum SchedulingParameters (service, timezone, configurable duration and recurring windows). No open Slots are created. Market participation, program assignments, preferences and future service/partner configuration remain application manifests in Git, not invented FHIR resources or access-control rules.

Initial authoritative PLAN and approved DEPLOY confirmed 45 resources total: 31 creates (27 structure + 4 Schedules), eight HealthcareService coverage updates, six retained resources. Independent verification passed. Future plans compare live state; do not assume these initial changes recur.

## Local commands (from code/)

```sh
make build
npm run preview -- --as-of 2026-10-20T12:00:00Z
npm run policy -- --out config/security/care-delivery-policy.json
npm run validate:server
npm run plan
# Review reports/plan.json before proceeding:
npm run apply -- --plan-file reports/plan.json
```

Preview/policy are local. Server validation performs no persistent writes and can run with the previous client policy if Medplum permits $validate. Plan/apply require committed configuration, the intended project, and the exact generated policy (plus Medplum's read-only schema rules). Credentials remain local or in staging environment secrets. Authenticated error output is controlled and excludes raw SDK responses.

## Owner security checkpoint

Review code/config/security/care-delivery-policy.json before replacing the existing policy resource's content. Preserve its existing id/meta when editing JSON, or edit its fields rather than creating another policy. Keep the client's ProjectMembership linked to that policy and retain human administrator access.

The generated policy permits explicit managed identifiers on Organization, Location, HealthcareService, Practitioner, PractitionerRole and Schedule. Update is allowed only for identifier groups containing managed service coverage, physical clinic status and schedule activation. No Patient, membership, credential-management or delete permissions are added. This grants resource-level update authority; the deployment code further limits changed fields. It is not a server-enforced field-level restriction. Identifiers are trusted-writer scope, not proof of resource provenance.

Adding future identifiers changes policy; code generates it rather than silently expanding live access. No security changes are performed by the provisioning identity. After owner application, use a fresh login; confirm effective policy, allowed searches and unrelated denied access before PLAN.

## Reviewed-plan contract

PLAN validates compiled resources and records a digest, Git commit, target project, as-of timestamp and per-resource existence/version/content hashes. It records managed fields that would change. Arrays are order-sensitive, object keys canonicalized. Extra server fields are not overwritten. Keep the artifact for review; it contains no raw server resource snapshots or credentials.

DEPLOY requires a successful PLAN run ID from this repository's staging workflow, main branch and the exact same commit. It downloads only the corresponding successful-plan artifact, verifies plan integrity, age (maximum 24 hours), configuration and current resource versions/content. A changed/missing/newly appeared resource, changed commit or crossed clinic lifecycle boundary forces replanning. The owner approval remains separate for PLAN and DEPLOY; never approve on their behalf.

Transactions use conditional POST for new resources and version-checked PUT (ifMatch) for allowed field updates. Retained resources are not written. PUT payloads preserve current unrelated fields. Unexpected managed drift blocks the entire operation. No automatic DELETE, destructive recovery or policy writes exist. Post-deployment verification rereads every identifier without cached results and requires all resources to match. Verification failure does not undo a transaction already committed; inspect state before correction.

An initially missing resource could appear after the final search; conditional POST prevents duplicates, and post-verification checks its resulting content. Concurrent updates to written resources fail version checks; untouched retained resources are not locked and are checked afterward. This is not a distributed lock.

## GitHub sequence

1. Merge the implementation only after CI passes; do not treat merge as deployment approval.
2. Owner applies the reviewed generated policy. Confirm least-privilege checks.
3. Dispatch PLAN on main and obtain owner environment approval.
4. Review its creates/updates/retains, fields, commit and digest; retain its run ID.
5. Dispatch DEPLOY with that plan_run_id for the same main commit; owner approves the explicitly labeled job.
6. Inspect transaction and verification evidence. A new main commit or expired plan requires another PLAN.

## Deliberate limitations

Clinic suspension/closure status changes are blocked in this deployment version because live bookings/tasks have not been audited. The local lifecycle capability still previews impacts and suppresses new routing. No automatic status timer, clinic closure execution or physician offboarding is implemented. Schedule.active may be toggled by reviewed updates, but provider-session edits, credential changes and role offboarding require further update contracts. Same-day rotation templates for one practitioner are rejected if overlapping; differing timezones on that day fail closed until DST-aware interval validation is implemented. The four current examples use different days.

Only the four example rotations have concrete schedules; other catalog coverage does not imply bookable availability. All 45 resources and the generated policy passed real-server validation; the first expanded transaction and reviewed-artifact handoff succeeded. Type/mock tests and deployment success do not establish credential validity, clinical access correctness or end-to-end booking outcomes.

## Reference implementations

- [Medplum scheduling availability](https://www.medplum.com/docs/scheduling/defining-availability).
- [Medplum transaction version checks](https://www.medplum.com/docs/fhir-datastore/fhir-batch-requests).
- [GitHub artifact download](https://github.com/actions/download-artifact), including run-id and github-token for a prior run.
- [GitHub workflow run metadata](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run).

## Completed deployment evidence — October 20, 2026

- [Authoritative PLAN](https://github.com/kiyengar27/helix/actions/runs/39434179867): 31 creates, eight location/coverage updates, six retained.
- [Owner-approved DEPLOY](https://github.com/kiyengar27/helix/actions/runs/39438818281): success; 31 transaction statuses 201 and eight 200; all 45 verified.
- Commit: 670b9767e1ca6a2081b05d75143ba9819f6b2a21. Saved plan digest: 66f6c7bdbc8eeae33489233b90c7ccb005171b811272553662a08cda0c17b1e9.
- Independent fresh local verification passed at 2026-10-20T14:25:57.806Z. No duplicates or managed drift. Owner-applied effective policy matched generated scope; unrelated patient/admin searches were denied.

Artifacts have 14-day retention. This durable summary records outcomes without credentials or raw patient payloads. Updates under this closeout PR are documentation-only and need no Medplum deployment. A new main commit requires a new plan for any future live change.
