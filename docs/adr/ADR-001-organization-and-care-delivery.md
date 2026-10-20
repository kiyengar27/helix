# ADR-001: Separate practice, geography, offerings, and patient care responsibility

Status: Proposed
Date: October 16, 2026
Product requirements: [PRD-001](../PRD-001-organization-and-care-delivery.md)

## Context

Helix needs shared patient identity across primary care, cardiology, urology, rheumatology, infusion, transitions, and complex care. Patient-level market ownership is deferred; providers may deliver multiple services across jurisdictions. Practice affiliation, PCP continuity, booking eligibility, and data authorization must remain distinct.

## Decision

Use FHIR R4 resources with the following responsibilities. This ADR proposes the architecture; unresolved field conventions below remain implementation gates.

| Concept | Representation and convention |
|---|---|
| Practice | One initial `Organization`: Helix Medical Group. The Medplum `Project` is the staging isolation boundary, not the medical group. |
| Organization evolution | Add `Organization.partOf` for actual internal divisions. Use `OrganizationAffiliation` for relationships among separate organizations where appropriate. |
| Geography | Geographic-area `Location` resources for the five operational markets. Physical clinics reference their containing market through `Location.partOf`, with Helix as managing organization. Markets are not clinical divisions. |
| Virtual delivery | Virtual `Location` resources and explicit service/schedule configuration. Virtual delivery does not bypass jurisdiction eligibility. Exact profiles and mode encoding must be validated before provisioning. |
| Patient relationship | `Patient.managingOrganization` references Helix as record custodian. This is the initial operational affiliation convention, not a general enrollment-history mechanism. |
| PCP | Optional `Patient.generalPractitioner` reference. It is separate from episodic provider assignment and access authorization. |
| Offerings | `HealthcareService` resources owned through `providedBy`. Start with primary care, acute care, cardiology, urology, rheumatology, infusion, transitions, and complex-care offerings. Split more granular offerings only when operations require it. |
| Specialty | `PractitionerRole.specialty` expresses clinician specialty. Infusion is a treatment offering; it may serve multiple specialties. |
| Provider roles | One `Practitioner` per clinician. Use separate `PractitionerRole` records where organization, service, jurisdiction eligibility, or validity differs. For service-specific licensure, follow Medplum's per-service role pattern. |
| Patient care responsibility | `EpisodeOfCare` captures the patient, responsible organization, case type, lifecycle, period, and optional care manager/team. Use for ongoing responsibility; do not require an episode for every isolated visit. |
| Care team | Patient-specific `CareTeam` resources, referencing `PractitionerRole` participants where relevant, with explicit roles and periods. Team membership is not queue ownership or an automatic permission grant. |
| Care plan and activity | `CarePlan` for goals/planned care; `Encounter` for visits; `Appointment` for booking; `Task` for work. Link visits to cases using `Encounter.episodeOfCare`. |
| Referrals | `ServiceRequest` represents the request; associated `Task` resources track coordination. Referral coordination is initially shared operations, not a separately enrolled clinical offering. |
| Authorization | Explicit `AccessPolicy` rules attached through `ProjectMembership`, tested on related resource types. No automatic inheritance from organization hierarchy, location, licenses, or team membership. |

## Implementation gates

1. **Home-market ownership:** Deferred to issue #19; do not add a patient-level field/history in initial enrollment. Residence, visit location and care-program responsibility remain separate.
2. **Program identity:** Use a controlled `EpisodeOfCare.type` vocabulary initially to identify programs. Define its mapping to `HealthcareService`; R4 has no dedicated episode-to-service field. Do not insert invented fields. Add a documented extension only if a direct reference becomes necessary.
3. **Offering availability:** Specify supported markets, physical/virtual locations, eligible roles, and schedules. Geographic coverage and the physical site list are different concepts; do not assume a location hierarchy alone computes service coverage.
4. **Credentials and booking:** Follow Medplum's service/jurisdiction role pattern, with credential evidence and validity tracked explicitly. Scheduling availability does not enforce licensure. The controlled booking path must select eligible schedules and revalidate before final assignment.
5. **Access matrix:** Define organization/service/role/patient scope, exceptions, and minimum necessary access. Validate search and direct read/write behavior for patients and related clinical resources. Record custody alone does not propagate permissions.
6. **Queues:** Choose a supported owner representation and safe claim/reassignment convention before implementing coordination queues; distinguish pooled work from patient-specific CareTeams.

## Constraints and invariants

- One Helix patient identity across all initial services and markets.
- Patient identity remains stable across address/care-arrangement changes; no current-home-market invariant is imposed in initial enrollment.
- Visit location and residence/operational context are separate, including temporary travel.
- PCP designation is optional and does not prevent eligible providers from treating the patient.
- Provider identity is not duplicated per state, market, or specialty.
- Multiple concurrent episodes and teams are allowed.
- Use identifier-based conditional provisioning and transaction Bundles for interdependent resources; validate explicitly typed R4 resources.
- Hosted free-plan staging uses synthetic data and local workflow execution. Recheck plan capabilities before implementing hosted automation.

## Alternatives considered

| Alternative | Reason not selected initially |
|---|---|
| Organization per market/specialty | Adds hierarchy without distinct organizational responsibility; geography and offerings change independently. |
| Practitioner-centric patient attribution | Conflicts with pooled practice care and cross-specialty delivery. |
| CareTeam alone for program enrollment | Does not provide a separate case lifecycle and period of responsibility. |
| Episode for every interaction | Adds case-management overhead to standalone visits/tasks. |
| Separate patient per service or market | Fragments the longitudinal record and complicates transfers. |
| Broad access based only on licensure | Treatment eligibility and authorization answer different questions. |

## Consequences

The model supports new specialties, markets, treatment offerings, and concurrent programs without changing patient identity. It requires explicit conventions for program mapping, credentials, and authorization. Patient market history is deferred under #19. A service resource does not by itself implement enrollment, scheduling, or workflow automation.

A future multi-legal-entity structure may require revisiting record custody, affiliation, consent, and project isolation; this ADR does not assume that sharing a brand authorizes cross-entity record access.

## Validation before acceptance

Demonstrate the PRD journeys with synthetic resources; type-check and validate resource structures; verify repeatable provisioning; test market transfers and overlapping episodes; test authorization independently of routing and availability. No live configuration changes are authorized merely by accepting this document.

## Sources

Reviewed against the local official Medplum checkout, revision `19911b7`:

- [Modeling Provider Organizations](https://www.medplum.com/docs/administration/provider-directory/provider-organizations)
- [Longitudinal Patient Case Tracking](https://www.medplum.com/docs/careplans/longitudinal-patient-case-tracking)
- [State-by-State Licensure](https://www.medplum.com/docs/scheduling/state-by-state-licensure)
- [Access Policies](https://www.medplum.com/docs/access/access-policies)
- [Building with AI Coding Assistants](https://www.medplum.com/docs/building-with-ai-coding-assistants)

## Stage 1 design clarification — October 20, 2026 (proposed)

See [the care-delivery proposal](../care-delivery-proposal.md). Use separate Location identities for operational markets, clinic sites, logical virtual delivery locations, and state eligibility areas. Clinic.partOf references its market. PractitionerRole.location uses state areas per Medplum's service-specific licensure pattern; it does not encode the clinician's physical location or clinic assignment.

Use HealthcareService.location for sites and coverageArea for geographic coverage. Because those arrays do not capture a mode/site/market relation, define that relation in an explicit versioned application coverage manifest. It is not a custom FHIR resource or native Medplum enforcement feature. The later routing consumer and generated FHIR projections must be tested against it. This avoids a premature service-per-market/mode resource explosion.

Virtual Location.mode is instance; delivery mode is not an invented FHIR enum. Text-only physical types and specialty descriptions are provisional and require profile/terminology review. Synthetic eligibility is scenario data, not evidence of actual licensing or prescribing authority.

The proposal references existing stable fullUrls and must be compiled with the foundation or resolved against verified IDs before submission. Existing service resources require controlled field updates, which create-only provisioning does not support. Keep this material outside deployed configuration until the update/permission plan is accepted. ADR-002 governs reconciliation changes.

## Market-wide participation, clinic preferences and rotation

The operating-model manifest records market participation independently of PractitionerRole service/jurisdiction eligibility. Preferred clinics are nonexclusive hints; planned sessions name their role, site, market, mode and timezone. Do not mix state areas and clinic sites in PractitionerRole.location for this convention. Compile accepted rotation templates to the supported Medplum Schedule/SchedulingParameters model before calling scheduling operations; no precreated open Slots.

Nationwide is an onboarding target, not a licensed-jurisdiction shortcut. CA/TX fixtures remain the only explicitly eligible states. Market-specific transitions and complex-care assignments reuse service definitions but preserve separate responsibility; future cross-market offerings and external mental-health referrals must not collapse these boundaries or confer data access. No extra FHIR extension or implicit authorization is introduced by the application manifests.

## Clinic lifecycle projection — October 20, 2026

Use an application lifecycle manifest for effective-dated planned/active/suspended/closed clinic history. Project to FHIR R4 Location.status: inactive/active/suspended/inactive respectively; retain the richer business history in configuration rather than inventing Location status codes. Closed is terminal initially; temporary closures use suspended. Runtime scope checks must consult effective history for new care. Static Location.status alone will not apply future events; no background synchronization is implemented yet.

Keep inactive clinic references and expose configuration impacts before changes. Do not auto-delete coverage, appointments or historical resources. Removal from the manifest is rejected. A live controlled update requires a reviewed dependency audit and owner approval; the local impact report does not query live bookings. See ../clinic-lifecycle.md.

## Stage 1 implementation evidence — October 20, 2026

The reviewed organization/location/service/provider structure is deployed in staging: 45 managed resources, including four concrete recurring rotation Schedules. Authoritative PLAN and DEPLOY runs are linked in care-delivery-deployment.md; independent verification passed. This accepts the stage 1 structural slice, not unresolved patient history, legal structure, program enrollment, clinical access or booking behavior. Keep this ADR's broader proposal status until those decisions are resolved.

## Stage 2 enrollment and proxy contract — proposed October 20, 2026

Use standard Patient fields for practice record custody, optional PCP and address; actual visit location is captured by the visit workflow. Do not introduce a patient-level market field or custom history extension in issue #8. The original extension approach was withdrawn before deployment; evaluate it or alternatives only under backlog issue #19 when durable ownership is needed.

Use RelatedPerson for adult caregivers and parent/guardian relationships. Separate relationship data from verified identity/authority, consent evidence and enforced access. Product age bands under-12, 12–13, 14–17 and adult identify review scenarios; they do not define legal consent thresholds or grant access. Older age does not infer incapacity. No proxy access is enabled by the initial assessment helper. See ../patient-enrollment.md for the proposed matrix and review gate.

## Stage 2 lifecycle and mediated access

Use a headless enrollment service to enforce scoped registration edits and demographic-only proxy reads. Clinical acceptance identities have direct read/search only; registration writes are mediated by a dedicated backend runtime identity, separate from provisioning. Runtime policies initially cover only the named synthetic acceptance patient and relationship, never all Helix patients by implication.

Proxy relationships do not grant access. A trusted review creates an explicit patient/principal/action/time-bound grant with separate identity/authority evidence. Revocation, relationship inactivity, DOB correction and crossing a product review-age band invalidate access on subsequent reads. Production authentication, durable grant storage and consent/legal review remain separate integration work; the synthetic acceptance adapter does not prove them. See patient-enrollment.md for exact scope and live gates.

## Stage 3 proposed encounter and medication-intent boundary

Model encounters independently of patient affiliation, with actual visit Location/jurisdiction and eligible PractitionerRole. Optional RelatedPerson participation does not make the caregiver the medication subject or grant clinical/SMS access. Use a draft MedicationRequest with intent=proposal for incomplete prescribing intent, linked to the Encounter, and a draft plan Task for review. Do not convert to an active order implicitly. Initial scenarios contrast caregiver-assisted infection assessment and independent-adult GLP-1 financial review. Product/regimen selection, clinical evidence, financial eligibility, authenticated transitions and Photon transmission remain later gates. See ../encounter-prescribing-proposal.md; owner review pending.

## Explicit synthetic birth sex for Photon

Declare Daniel M and Eleanor F as explicit synthetic sex-at-birth fixtures. Use the published US Core 6.1 FHIR R4 birthsex extension (valueCode M/F), separately from administrative Patient.gender. Do not infer either from names. This introduces no patient market extension and makes no claim of full US Core conformance. Source and mapping rationale are recorded in photon-feedback.md. Keep test messaging destinations separate until owner selection and sandbox behavior review.

The subsequent owner requirement makes explicit birthSex mandatory across all six synthetic patient fixtures and at the integration mapping boundary. Do not silently fill missing values or infer from administrative gender. This requirement does not make sex mandatory in the FHIR R4 base Patient schema or arbitrary server writes.
