# Patient enrollment, market history and related people

Status: Proposed contract for review, issue #8. No patient fixtures, relationships, logins, permissions or live resources are deployed by this change.

## Initial design

- One Patient record belongs to Helix through managingOrganization as record custodian. This does not automatically grant access.
- Optional generalPractitioner references a PCP independently of practice affiliation and individual visits.
- Intake may be unassigned. Once assigned, the patient has at most one home market at a time; a permanent move closes the old assignment and starts the next without creating another Patient.
- Visit jurisdiction is supplied for each visit and does not rewrite home-market history. A trip is not a market transfer.

## Market history representation

Propose a single complex Patient extension at `urn:helix:extension:home-market-history`, with repeating assignment subextensions. Each assignment contains market (valueReference to Location), effectiveFrom (valueInstant) and optional effectiveUntil (valueInstant).

Intervals are explicitly start-inclusive/end-exclusive. These are custom instant elements, not a FHIR Period with altered end semantics. A move uses the same instant to end one assignment and start another. Empty history supports unassigned intake; gaps represent unassigned periods. Reject overlap, invalid timestamps, unknown markets and retroactive overwrites. Historical correction needs a separate reviewed operation.

This URN is a proposed canonical identity, not a registered Medplum feature. Define/validate the extension's StructureDefinition/profile before deployment. A dedicated search parameter or custom compartment is not assumed. Do not use this extension alone as an access-control filter.

`src/enrollment.ts` implements pure typed transforms: validate/read history, assign home market, evaluate home market at time, and preserve patient identity/custodian/PCP/unrelated extensions. Persistence must use a controlled service with authorization, version checking, server validation, safe retries and audit. No API endpoint is enabled here.

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

1. Review this contract, age-band handling and minimal matrix.
2. Define the extension profile, separate enrollment identity/policy, synthetic case catalog and private operational outputs. All setup stays declarative/code-driven.
3. Implement authorized API/headless persistence and tests: enrollment retry, CA→TX move, optional PCP, older-adult caregiver, under-12 parent, 12/13 review, 14–17 adolescent and birthday/revocation behavior.
4. Validate with Medplum, show the resource/permission plan, and use separate owner-approved staging plan/deploy runs.

Tests in this PR are anonymous local contract tests only, not actual patient scenarios or evidence of enforced clinical authorization. Issue #8 stays open through live acceptance checks. No Photon or application UI is included.

## Official implementation references

- Local Medplum FHIR Patient/RelatedPerson types and extension definitions.
- [Medplum profiles](https://www.medplum.com/docs/fhir-datastore/profiles).
- [Medplum access policies](https://www.medplum.com/docs/access/access-policies), including writeConstraint and related-resource compartment guidance.
