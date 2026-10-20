# Stage 1 care-delivery proposal

Status: Proposed for review; issue #6. Date: October 20, 2026.

All setup is defined in versioned configuration and code. These files are a proposed input contract, not an approved deployment. No live setup or permission changes have occurred.

## Declarative inputs

- [FHIR resource collection](../code/config/proposals/care-delivery.resources.json): 27 proposed resources with stable identifiers/fullUrls. This is a collection, not an executable transaction.
- [Coverage manifest](../code/config/proposals/care-delivery.coverage.json): application configuration explicitly pairing service, mode, site, and covered markets. This is not a FHIR payload.
- [Operating model](../code/config/proposals/care-delivery.operations.json): market participation, clinic preferences, role-specific delivery modes/eligible jurisdictions, market program responsibility, rotation templates, and disabled future services/partnerships. Application configuration, not FHIR fields.
- Existing [foundation](../code/config/foundation.json): 14 unchanged resources. References in the proposal resolve against their stable fullUrls.

## Proposed clinics and delivery

One synthetic clinic in each market; virtual delivery locations for CA and TX. Two separate jurisdiction Locations express state eligibility. Do not place clinics beneath jurisdiction records: clinic.partOf references its operational market. No real street addresses, license numbers, NPI, or endpoints are claimed. Synthetic rotation hours are explicitly marked as examples.

| Offering | Virtual | In-clinic |
|---|---|---|
| Primary / Acute Care | All five markets | All five clinics |
| Cardiology / Urology / Rheumatology | All five markets | All five clinics, subject to scheduled sessions |
| Infusion Therapy | None | North Bay CA and Austin Metro |
| Transitions / Complex Care | Separate operational programs in each of the five markets | Not initially configured |

This is catalog coverage, not a claim of appointment availability or adequate staffing. Traveling to an infusion site does not change the patient's home market. Referral arrangements for patients outside the site's initial coverage require a later explicit decision.

## Synthetic roster

| Clinician | Services | Eligibility scenario |
|---|---|---|
| Alex Morgan | Primary, Acute | CA + TX |
| Jordan Lee | Primary | TX only |
| Casey Patel | Cardiology | CA + TX |
| Riley Chen | Urology | CA + TX |
| Avery Shah | Rheumatology | CA + TX |
| Quinn Rivera | Infusion nursing | CA only |
| Taylor Brooks | Infusion nursing | TX only |
| Morgan Reed | Transitions, Complex-care management | CA + TX |

One Practitioner per person, one PractitionerRole per offered service: 8 Practitioners, 10 roles. All identities and eligibility are synthetic assumptions, not verified professional credentials. Infusion nursing roles do not establish prescribing authority or a complete infusion staffing model. Specialty displays use text pending terminology selection; no clinical codes are invented.

## FHIR and deployment choices

- Follow Medplum's service/jurisdiction role convention: PractitionerRole.location references eligible state areas, not a mixture of clinics and state areas. The operating model separately records whole-market participation and preferred clinics; rotation templates record the actual intended session site. Preferences are not restrictive eligibility rules.
- HealthcareService.location describes delivery sites; coverageArea describes geography. Their separate arrays cannot express every mode-by-market combination, so retain the explicit coverage manifest as the intended routing configuration. A future consumer must enforce that mapping.
- The two virtual locations are logical service-delivery identities. No R5 virtualService fields or invented virtual mode enum are used. Location.mode remains instance. Physical type and role terminology use human-readable text until verified codes are selected.
- Existing services need added location/coverage fields. The create-only deployer must not silently update them or use new identifiers to bypass drift. Resolve controlled updates under ADR-002 before applying coverage.
- Proposal files are isolated from foundation.json and not loaded by CI/CD deployment. A deployment compiler, transaction reference resolution, target validation, restricted-policy update, and full server checks remain required after model review.
- Generate scoped policy definitions from managed configuration in code; keep bootstrap/security identity separate from runtime provisioning. No policy changes are authorized by this proposal.

## Review and acceptance sequence

1. Review clinic/service matrix, roster, and jurisdiction-versus-site distinction.
2. Implement code generation/validation and a reviewed controlled-update path for existing service fields; update ADR-002.
3. Produce a resource-level create/update/retain plan and permission diff from declarative inputs.
4. Owner reviews changes before any deployment or security setup. Keep credentials external to configuration.
5. Server validation and approved staging deployment, then verify references, counts, coverage and repeatability.

Rotation templates are included for design review, but compiling them to Medplum Schedule/SchedulingParameters and detecting cross-schedule conflicts is still pending. Patient enrollment, access for clinical users, care episodes and Photon are later milestones. Early Photon sandbox prerequisite discovery is tracked in #10.

## Approved operating ground rules

- Providers are credentialed/approved to serve a whole operational market, not tied exclusively to one clinic. We model this as market participation separately from professional state/service credentials. A provider can participate in multiple markets.
- Starting with one clinic per market does not constrain future cardinality. New clinics reference the same market; update declarative coverage and rotation templates without creating duplicate practitioners or changing patient affiliation.
- Clinic preferences guide selection. Schedules govern where/when a provider works, including specialists rotating among clinics or across North Bay CA and South Bay CA. Actual slot availability and booking collision enforcement are not implemented by the scope checker.
- Most non-infusion providers support virtual and clinic care. Jordan Lee is a TX-only exception; Alex, Casey, Riley, Avery and Morgan have an all-50-states virtual eligibility target. A target never grants eligibility; current role-specific synthetic jurisdictions remain CA/TX. Infusion nursing is physical-only.
- Transitions and complex care share catalog definitions but have ten separate market-program assignments (two per market). Shared staff can support multiple assignments without merging responsibility across markets. Patient-specific teams/episodes are created in later stages.
- Dietitian and behavioral health are disabled future cross-market offerings with a nationwide target and service-specific eligibility requirements. The mental-health clinic partnership is a disabled external-referral relationship; it is not internal staff or an automatic record-access grant. Its Organization/affiliation and referral mappings will be defined when activated.

## Code and local preview

`npm run preview:care-delivery` from code/ renders the combined resource collection and application manifests without credentials or API calls. `src/care-delivery.ts` supplies a delivery-scope checker over those inputs. It requires market participation, service/mode coverage, location, and explicit visit-jurisdiction eligibility; preferred clinic and nationwide target cannot override a denial.

This checker is an executable design scenario, not verified credential evaluation, access control, or appointment availability. Its market input is the market delivering the service, not an automatic substitution for the patient's home market. Travel/home-market routing needs a separate policy. Production use also requires credential validity, exceptions and live session/booking checks. JSON graph tests and typed field projections do not replace full FHIR validation.

The four sample recurring sessions rotate Casey Patel between North Bay clinic (Monday), South Bay clinic (Tuesday), CA virtual care (Thursday) and TX virtual care (Friday), 09:00–12:00 in each session's explicit IANA timezone. These are synthetic templates, not appointments or asserted clinician working hours. They have no effective dates and are not deployed.

## Clinic lifecycle capability

[Clinic lifecycle](clinic-lifecycle.md) is now a declarative application capability under issue #15: planned/active/suspended/closed history, FHIR status projection, new-routing checks and a configuration-dependency report. See code/config/proposals/clinic-lifecycle.json and src/clinic-lifecycle.ts. No hard deletion, automatic reassignment, live appointment inspection or Medplum status updates are performed. Preview includes lifecycle impact at an explicit UTC timestamp.

Physician offboarding is deferred in issue #14 and is not implemented here.
