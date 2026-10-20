# Patient enrollment and related people

Status: Proposed contract for review, issue #8. No patient fixtures, relationships, logins, permissions or live resources are deployed by this change.

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
| Separate enrollment service | Explicit staging patient/relationship identifiers; enrollment-only writes | Not created or authorized |
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

`plan:enrollment`, `apply:enrollment` and `verify:enrollment` use separate MEDPLUM_ENROLLMENT_CLIENT_ID/SECRET credentials. They use the same reviewed-plan/version checks as care-delivery deployment but only manage the 11 synthetic enrollment resources. Initial policy allows explicit-identifier read/search/create; updates, deletes, clinical records and credential administration remain denied. This initial deployment does not yet implement demographic edits, staff clinical permissions or proxy grants; those acceptance checks remain under #8.

The separate enrollment.yml workflow requires both STAGING_ENABLED and ENROLLMENT_ENABLED and the staging owner gate. It exposes only enrollment secrets, checks the successful same-commit enrollment PLAN run, and uses separate enrollment artifacts. Logs contain counts/status only; saved plans contain synthetic identifiers/version hashes, not demographics or raw resource snapshots. The foundation workflow and identity remain patient-denied.

### Next owner checkpoint, after PR review

1. Create the separate AccessPolicy **Helix Staging Enrollment Service** using code/config/security/enrollment-service-policy.json. Do not replace the foundation policy.
2. Create client **Helix Staging Enrollment Service**, selecting that policy during creation; do not give administrator privileges.
3. Store its credentials as MEDPLUM_ENROLLMENT_CLIENT_ID and MEDPLUM_ENROLLMENT_CLIENT_SECRET, separately from existing credentials (local .env and later staging environment secrets). Do not paste values into chat.
4. Notify the implementation agent. Verify effective permissions and prepare PLAN before enabling/dispatching enrollment deployment. No patient/proxy accounts are created by the service client.

Account/bootstrap and secret steps are owner actions; all resource/policy definitions remain code-driven. ENROLLMENT_ENABLED has not been set and no identity or live fixture has been created by the agent.
