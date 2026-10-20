# Stage 1 care-delivery proposal

Status: Proposed for review; issue #6. Date: October 20, 2026.

All setup is defined in versioned configuration and code. These files are a proposed input contract, not an approved deployment. No live setup or permission changes have occurred.

## Declarative inputs

- [FHIR resource collection](../code/config/proposals/care-delivery.resources.json): 27 proposed resources with stable identifiers/fullUrls. This is a collection, not an executable transaction.
- [Coverage manifest](../code/config/proposals/care-delivery.coverage.json): application configuration explicitly pairing service, mode, site, and covered markets. This is not a FHIR payload.
- Existing [foundation](../code/config/foundation.json): 14 unchanged resources. References in the proposal resolve against their stable fullUrls.

## Proposed clinics and delivery

One synthetic clinic in each market; virtual delivery locations for CA and TX. Two separate jurisdiction Locations express state eligibility. Do not place clinics beneath jurisdiction records: clinic.partOf references its operational market. No street addresses, license numbers, NPI, scheduling hours, or real endpoints are fabricated.

| Offering | Virtual | In-clinic |
|---|---|---|
| Primary / Acute Care | All five markets | All five clinics |
| Cardiology / Urology / Rheumatology | All five markets | North Bay CA and Austin Metro |
| Infusion Therapy | None | North Bay CA and Austin Metro |
| Transitions / Complex Care | All five markets | Not initially configured |

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

- Follow Medplum's service/jurisdiction role convention: PractitionerRole.location references eligible state areas, not a mixture of clinics and state areas. A separate future assignment convention will indicate a clinician's actual clinic staffing.
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

Schedules, patient enrollment, access for clinical users, care episodes and Photon are later milestones. Early Photon sandbox prerequisite discovery is tracked in #10.
