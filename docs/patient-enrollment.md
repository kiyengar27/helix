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
