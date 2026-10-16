# ADR-001: Separate practice, geography, offerings, and patient care responsibility

Status: Proposed  
Date: October 16, 2026  
Product requirements: [PRD-001](../PRD-001-organization-and-care-delivery.md)

## Context

Helix needs shared patient identity across primary care, cardiology, urology, rheumatology, infusion, transitions, and complex care. Patients have one current operational home market, while providers may deliver multiple services across jurisdictions. Practice affiliation, PCP continuity, booking eligibility, and data authorization must remain distinct.

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

1. **Home-market history:** Choose and validate an effective-dated assignment representation. FHIR R4 Patient has no native home-market field. Do not overload address, PCP, or managingOrganization. Enforce at most one active assignment, and explicitly handle intake without one. Preserve historical assignments on moves.
2. **Program identity:** Use a controlled `EpisodeOfCare.type` vocabulary initially to identify programs. Define its mapping to `HealthcareService`; R4 has no dedicated episode-to-service field. Do not insert invented fields. Add a documented extension only if a direct reference becomes necessary.
3. **Offering availability:** Specify supported markets, physical/virtual locations, eligible roles, and schedules. Geographic coverage and the physical site list are different concepts; do not assume a location hierarchy alone computes service coverage.
4. **Credentials and booking:** Follow Medplum's service/jurisdiction role pattern, with credential evidence and validity tracked explicitly. Scheduling availability does not enforce licensure. The controlled booking path must select eligible schedules and revalidate before final assignment.
5. **Access matrix:** Define organization/service/role/patient scope, exceptions, and minimum necessary access. Validate search and direct read/write behavior for patients and related clinical resources. Record custody alone does not propagate permissions.
6. **Queues:** Choose a supported owner representation and safe claim/reassignment convention before implementing coordination queues; distinguish pooled work from patient-specific CareTeams.

## Constraints and invariants

- One Helix patient identity across all initial services and markets.
- One current home market per enrolled patient; moving changes assignment, not patient identity.
- Visit location and home market are separate, including temporary travel.
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

The model supports new specialties, markets, treatment offerings, and concurrent programs without changing patient identity. It requires explicit conventions for market history, program mapping, credentials, and authorization. A service resource does not by itself implement enrollment, scheduling, or workflow automation.

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
