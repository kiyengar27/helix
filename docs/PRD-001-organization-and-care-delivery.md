# PRD-001: Helix organization and care delivery

Status: Draft for review
Date: October 16, 2026
Supporting decision: [ADR-001](adr/ADR-001-organization-and-care-delivery.md)

## Purpose

Establish a consistent organization model for Helix Medical Group spanning primary care, specialty care, treatment services, and coordinated care programs. Patients belong to Helix, with an optional PCP for continuity; visits and tasks may be handled by other eligible providers.

## Initial scope

| Dimension | Initial scope |
|---|---|
| Group practice | Helix Medical Group |
| Operational markets | North Bay CA; South Bay CA; Austin Metro; Dallas North; Dallas South |
| General clinical services | Primary Care; Acute Care |
| Specialties | Cardiology; Urology; Rheumatology |
| Treatment service | Infusion Therapy |
| Cross-specialty programs | Transitions of Care; Complex Care |
| Shared operations | Referral Coordination |
| Delivery modes | Virtual and in-clinic, enabled per offering and location |

Market labels are operational areas, not assertions of official metropolitan statistical area boundaries. Specialty and service-line classifications describe different dimensions: rheumatology is a specialty, while infusion is a treatment offering that can serve multiple specialties.

## Users

Practice administrators maintain the structure and offerings. Clinical operations staff coordinate intake, referrals, and transitions. Clinicians deliver eligible services. Care managers organize longitudinal care. Patients receive care across these functions using one Helix record.

## Requirements

| ID | Requirement |
|---|---|
| ORG-01 | Maintain one initial group-practice identity, distinct from the Medplum project/environment. Support future divisions or affiliated organizations without restructuring patient identity. |
| PAT-01 | Maintain one patient record across Helix services. PCP designation is optional and does not imply exclusive assignment. |
| MKT-01 | An enrolled patient has one current home market. Retain effective-dated assignment history and an explicit unassigned state during intake or exception handling. |
| MKT-02 | A permanent move changes home market without duplicating the patient. Review ongoing episodes, teams, and future bookings for continuity or transfer. |
| MKT-03 | Temporary travel changes visit location, not automatically home market. Confirm patient location for each virtual visit before checking provider eligibility. |
| SVC-01 | Configure offerings independently of markets. Select where each is available and whether delivery is virtual, in-clinic, or both. |
| SVC-02 | Separate specialty classification, clinical offerings, care programs, and shared operational functions. Do not require a separate organization for each. |
| PRV-01 | Maintain one clinician identity with potentially multiple organizational/service roles and eligible jurisdictions. Physical provider location is separate from jurisdiction eligibility. |
| PRV-02 | Route care using service eligibility, current credentials, patient visit jurisdiction, availability, and continuity preferences. Recheck eligibility at booking and service delivery. |
| CARE-01 | Track patient participation in transitions, complex care, and other ongoing cases with independent lifecycle, responsibility, and dates. Allow concurrent programs. |
| TEAM-01 | Assign patient-specific care teams with explicit participants, functions, and participation periods. Staff may participate in multiple teams. |
| REF-01 | Operate referral coordination as a shared back-office function, tracking referral intake, records, authorization when applicable, scheduling, and completion. |
| SEC-01 | Enforce access server-side. Market assignment, provider licensure, team membership, and record custody do not grant access automatically. |
| OPS-01 | Provision staging through repeatable, identifier-based scripts using synthetic data and locally executed logic compatible with the hosted free plan. |

## Example journeys and acceptance criteria

1. **Rheumatology and infusion:** A Dallas North patient retains their Helix identity and optional PCP while receiving rheumatology consultations and ordered infusion treatment. Each visit records its delivering provider and location; treatment results remain available to authorized care participants.
2. **Transition and complex care:** A patient can have a discharge-transition episode and a complex-care episode concurrently, with separately identified responsibility and teams. Closing one does not close the other.
3. **Permanent move:** Moving from North Bay CA to Dallas North changes the current market, preserves prior history, and triggers review of open work. The patient identifier remains unchanged.
4. **Virtual eligibility:** A multistate provider can be offered work only for the relevant service and visit jurisdiction where eligible. Home-market membership alone does not qualify the provider.
5. **Referral:** An authorized coordinator tracks a cardiology referral through completion without becoming the patient's PCP or specialist.
6. **Access:** An unauthorized user cannot retrieve restricted patient data directly through the API, even when they know resource IDs. Authorized cross-market continuity follows an explicit policy.

## Out of scope

Production launch, real patient data, billing implementation, automated legal credential verification, live prescribing/lab integrations, and paid hosted automation. This PRD does not define clinical protocols or final access policies.

## Decisions still required

- Whether Helix represents one legal medical group or a brand above multiple groups.
- Exact geographic boundaries and market-assignment rules.
- Initial offering-to-market and virtual/clinic availability matrix.
- Credential evidence, review, expiration, and suspension workflows.
- Detailed access matrix, including sensitive records and cross-market continuity.
- Team templates, task queues, escalation rules, and program completion criteria.

## Success measures

Initial staging demonstrates the six journeys above; no duplicate patient/provider identities are introduced by rerunning provisioning; all five markets and initial services are discoverable; unresolved representation choices are resolved before dependent implementation.
