# Patient enrollment and related people

Status: Six synthetic Patients and five RelatedPersons are deployed in staging under issue #8. No patient/proxy logins or access grants exist. A display-name update is prepared for review; it has not been applied.

## Initial design

- One Patient record belongs to Helix through managingOrganization as record custodian. This does not automatically grant access.
- Optional generalPractitioner references a PCP independently of practice affiliation and individual visits.
- No patient-level home-market field or assignment history is included in this stage.
- Residence uses the standard address; visits identify their actual location/jurisdiction. Market-specific care teams and program participation carry their own operational context without assigning an exclusive market to the Patient.
- Patient relocation preserves the existing Helix record. No custom market extension or history profile is required for this version.

## Deferred market ownership

[Issue #19](https://github.com/kiyengar27/helix/issues/19) tracks evaluating explicit home-market ownership/history if a concrete workflow requires it. The earlier extension and canonical URN proposal has been removed from active code and design before deployment. No replacement custom field or FHIR representation is selected.

## Caregiver and parent model

Use RelatedPerson.patient to link a caregiver, parent or guardian to a patient. Its relationship and active fields describe the relationship record, not authority, capacity, custody or permission. Patient.contact may carry emergency contacts but is not the proxy-access model.

| Scenario | Relationship model | Default access |
|---|---|---|
| Older adult with caregiver | RelatedPerson with caregiver role | None until identity and patient authorization or representative authority are verified |
| Child under 12 | Parent/guardian RelatedPerson | None until authority verification and approved policy |
| Ages 12 and 13 | Explicit intermediate review band | No automatic proxy grant; review sensitive-data and jurisdiction requirements |
| Ages 14–17 | Parent/guardian RelatedPerson with adolescent review | No blanket inherited access; scope must be explicit |
| Turning 18 | Relationship may remain | Re-review authorization; never automatically extend guardian privileges |

Age bands are product review/test categories, not legal consent thresholds. Older age never establishes incapacity. A relationship can remain meaningful without portal access. No default permission is inferred from parenthood, date of birth or caregiver status.

`relationshipDraft` builds a minimal typed RelatedPerson without inventing names or contact information. `proxyAssessment` returns review requirements and always accessGranted=false; it is not a consent engine or server-side policy. Identity verification, authority evidence, permitted actions/data, effective dates, revocation and audit must be modeled separately. Consent may document authorization where appropriate, but an active Consent resource alone would not enforce permissions. Birthday, revocation, relationship inactivity and jurisdiction changes must trigger reevaluation in the eventual authorization layer.

Keep each caregiver–patient relationship independently scoped. A parent with multiple children must not inherit siblings' access through a shared login; future identity linking can connect multiple RelatedPerson records without merging patient permissions.

## Proposed minimal access matrix

| Identity | Proposed scope | Current implementation |
|---|---|---|
| Existing foundation provisioner | No Patient/RelatedPerson access | Remains denied |
| Separate enrollment service | Explicit staging patient/relationship identifiers; enrollment-only writes | Separate identity deployed; exact synthetic identifier scope |
| Registration staff | Reviewed demographics/enrollment operations only | No policy assigned |
| Clinical staff | Deliberately scoped Helix record reads; treatment eligibility separate | No clinical access enabled |
| Patient / caregiver / parent | Explicit patient-specific reviewed grants | No account, grant or policy enabled |

This matrix needs owner approval and server-side read/search/write tests before fixtures are deployed. Do not issue wildcard clinical policies or expand the foundation identity to handle patients. Later related-resource policies must use each resource's own patient references/compartments; access does not propagate automatically through the Patient or RelatedPerson link. Sensitive sections and proxy limitations may require a controlled API rather than direct broad FHIR access; do not promise field/condition isolation until tested.

## Fast execution sequence

1. Review this contract, age-band handling and minimal matrix without a patient market field.
2. Define separate enrollment identity/policy, synthetic case catalog and private operational outputs. All setup stays declarative/code-driven; no market-history extension/profile.
3. Implement authorized API/headless persistence and tests: enrollment retry, address changes without identity duplication, optional PCP, older-adult caregiver, under-12 parent, 12/13 review, 14–17 adolescent and birthday/revocation behavior.
4. Validate with Medplum, show the resource/permission plan, and use separate owner-approved staging plan/deploy runs.

Tests in this PR are anonymous local contract tests only, not actual patient scenarios or evidence of enforced clinical authorization. Issue #8 stays open through live acceptance checks. No Photon or application UI is included.

## Official implementation references

- Local Medplum FHIR Patient/RelatedPerson types.
- [Medplum profiles](https://www.medplum.com/docs/fhir-datastore/profiles).
- [Medplum access policies](https://www.medplum.com/docs/access/access-policies), including writeConstraint and related-resource compartment guidance.

## Prepared synthetic cohort and execution path

The agreed contract now has six deterministic anonymous scenarios: older adult + caregiver, under-12 child + parent, age 12 + parent, age 13 + guardian, 15-year-old + parent, and independent adult. They compile to six Patients and five RelatedPersons. Dates are generated from a fixed scenario baseline, not the run date, so birthdays do not change identity or deployment definitions. Some cases have no PCP. No market extension is included.

All 11 payloads and the separate policy passed Medplum validation without persistence. `npm run preview:enrollment` displays counts only. `npm run prepare:enrollment` uses foundation credentials only to resolve the deployed group/PCP references and perform nonpersistent validation; it writes only reference configuration and the enrollment policy. Raw patient/relationship payloads are never saved by that command.

`plan:enrollment`, `apply:enrollment` and `verify:enrollment` use separate MEDPLUM_ENROLLMENT_CLIENT_ID/SECRET credentials. They use the same reviewed-plan/version checks as care-delivery deployment but only manage the 11 synthetic enrollment resources. Initial deployed policy allows explicit-identifier read/search/create. The proposed policy adds update on those same 11 records for the display-name migration; deletes, clinical records and credential administration remain denied. This initial deployment does not yet implement demographic edits, staff clinical permissions or proxy grants; those acceptance checks remain under #8.

The separate enrollment.yml workflow requires both STAGING_ENABLED and ENROLLMENT_ENABLED and the staging owner gate. It exposes only enrollment secrets, checks the successful same-commit enrollment PLAN run, and uses separate enrollment artifacts. Logs contain counts/status only; saved plans contain synthetic identifiers/version hashes, not demographics or raw resource snapshots. The foundation workflow and identity remain patient-denied.

### Display-name update and owner checkpoint

Names are declared in scenarios.json. Patient names: Eleanor Bennett, Oliver Chen, Maya Patel, Ethan Brooks, Sofia Martinez and Daniel Wilson. Related people: Laura Bennett, Grace Chen, Anita Patel, Rachel Turner and Elena Martinez. These are invented synthetic identities. Every fixture carries meta.tag with system urn:helix:data-classification and code synthetic; this administrative label is not an access control and may not appear in every UI view.

The enrollment deployment scope permits updates only to name and Helix-owned classification tags. It preserves IDs, identifiers, birth dates, addresses, PCPs, relationships, unrelated tags and other metadata. Unmanaged drift blocks deployment. Updates use version-checked PUTs; retry after success retains all 11 records. No delete or recreation is needed.

The Medplum policy grants resource-level update on the 11 exact identifiers; the field allowlist is enforced by our deployment code, not a server-enforced field restriction. Foundation credentials remain patient-denied.

After PR review and merge, the owner updates the existing **Helix Staging Enrollment Service** policy from code/config/security/enrollment-service-policy.json, preserving its resource ID and the current client assignment. Do not create a second client or replace the foundation policy. Then run the enrollment PLAN, review its counts/fields, authorize DEPLOY dispatch and approve the staging environment. Expect 11 updates, zero creates and zero deletes if current state matches. Verification must retain all 11.

Initial deployment evidence: PLAN 39445548745 and DEPLOY 39445743926 succeeded on commit 01b495651b1766308e0ca4968ae6c1cdf43e7e98. Staff authorization, demographic-edit workflows and proxy access acceptance remain open under issue #8.

## Enrollment lifecycle and access acceptance

Issue #8 follow-up introduces EnrollmentService and a Medplum store adapter. Registration can change name, address and optional PractitionerRole PCP, or deactivate a related person. Clinical principals can read the demographic projection. Every operation checks a trusted principal's explicit patient scope; writes preserve identity/custody and require the current resource version. The broader declarative fixture reconciler intentionally fails on changed fixture demographics; restore the acceptance fixture after testing rather than silently accepting drift.

Proxies receive only id/name/birthDate through the service. A grant requires verified-identity and reviewed-authority evidence references, an identified reviewer, patient/principal/relationship scope, explicit action and effective interval. These evidence references describe an already completed review; code cannot establish legal authority. Each read reloads the grant and relationship, checks activity, revocation, expiry, date-of-birth changes and review-age band. Crossing 12, 14 or 18 requires another review; crossing 13 remains in the agreed 12–13 band. Caregiver age never implies incapacity. No direct FHIR credentials or policy are issued to a proxy.

The trusted authentication and durable grant-store adapters remain integration boundaries. The acceptance runner uses explicitly synthetic principals and process-local grants to exercise the service; this is not a deployed authentication endpoint, durable consent registry or production authorization service. A future application must supply authenticated principals and a trusted grant/revocation store, never accept them from request JSON. No clinical resource or sibling access is exposed by this service.

### Separate acceptance identities — owner setup after PR merge

Generate/validate policies with `make enrollment-access-policy` from code/. Both policies are checked into config/security/. Never attach either to an administrator or reuse existing provisioning clients.

| Client and policy name | Checked-in policy | Permission |
|---|---|---|
| Helix Staging Enrollment Runtime | enrollment-runtime-policy.json | Read/search/update Eleanor and Laura only; read the pinned group/PCP; no create/delete |
| Helix Staging Clinical Acceptance Reader | enrollment-clinical-policy.json | Read/search Eleanor and Laura only; no writes |

Create each policy from its JSON, then create a non-admin ClientApplication assigned that policy. Store credentials locally in .env using MEDPLUM_ENROLLMENT_RUNTIME_CLIENT_ID/SECRET and MEDPLUM_ENROLLMENT_CLINICAL_CLIENT_ID/SECRET. Existing MEDPLUM_ENROLLMENT credentials are used solely by the acceptance auditor to discover stable IDs and snapshot versions, including an existing excluded patient. Do not paste credentials into chat. Bootstrap changes require owner review; no policies or clients are created automatically. These local acceptance credentials are not exposed to public CI; current GitHub deployment workflows do not run this test.

### Reviewed local acceptance

1. Merge reviewed code and synchronize a clean main. `make enrollment-acceptance-plan` type-checks/tests, verifies project and effective policies, checks allowed reads and exclusion of the existing independent adult by direct read and search. No resource writes occur. It saves hashes/IDs/versions only under ignored reports/enrollment/acceptance-plan.json, bound to the commit/config/snapshots with a 24-hour expiry.
2. Present the plan and obtain owner authorization before `make enrollment-acceptance-apply`. Expected: five successful writes, zero creates/deletes. Three Patient writes change address, remove PCP, then restore original fields; two RelatedPerson writes deactivate then restore. Every PUT uses If-Match. A denied clinical PUT submits the unchanged resource. A stale registrar write must fail. Revoked and inactive proxy reads must fail. Existing Patient IDs, identifiers, custody, demographics and relationship links must match after restoration; version metadata advances.
3. Run `npm run verify:enrollment` independently and record results on #8. Repeated planning resolves the same IDs and never creates resources. Local tests cover the minor/adult review boundaries and other grant checks.

An interrupted apply may leave an intentional test change; there is no automatic rollback. Inspect the two synthetic resources and prepare a reviewed restoration using the authoritative fixture JSON and current versions before retrying. Snapshots and errors must not expose raw demographics. Do not close #8 merely because local tests pass: the owner must complete these live acceptance gates. Distinguish these scoped synthetic machine identities from future authenticated human staff/proxy accounts.
