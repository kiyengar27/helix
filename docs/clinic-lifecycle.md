# Clinic lifecycle

Tracking: issue #15, closed through merged PR #13. The care-delivery compiler deploys active initial locations, but suspension/closure execution remains blocked pending live dependency audits. No automatic future lifecycle synchronization exists.

## Declarative history

`code/config/proposals/clinic-lifecycle.json` is the source of truth for the physical clinic lifecycle. Each clinic must appear exactly once and retain its stable location reference and ordered event history. Each event has state, UTC effectiveAt, and a nonempty reason. Initial active events import the synthetic starting state; new sites can begin planned.

| Business state | FHIR Location.status | New care routing |
|---|---|---|
| planned | inactive | Denied |
| active | active | Allowed subject to other checks |
| suspended | suspended | Denied |
| closed | inactive | Denied |

Allowed transitions: planned → active/closed; active → suspended/closed; suspended → active/closed. Closed is terminal in this version. Use suspended for temporary closure and active for reopening. A true reopening of a permanently closed site needs an explicit future policy, not an overwritten history or bypassed validation.

Removing a clinic entry is an error, not deletion. Historical links are retained. Before the first event, the clinic is treated as planned. Future events take effect in the local scope checker when evaluated at that timestamp; no background worker currently synchronizes Location.status to Medplum.

## Local inspection

From code/:

```sh
npm run preview:care-delivery -- 2026-10-20T00:00:00Z
make build
```

Preview projects FHIR status at the requested time and includes clinicLifecycleImpact: affected services, clinicians with that clinic preference, and matching rotation templates. It does not alter the original resource definitions or call Medplum. `isDeliveryEligible` accepts an explicit as-of timestamp and rejects nonactive physical clinics. Clinic preferences cannot override this denial.

For a suspension or closure, append an event with a later timestamp and reason, inspect its as-of impact, and submit a reviewed PR. Do not edit past events to conceal history. The current checks validate ordering and transitions; they do not enforce append-only changes against a prior Git revision.

## Live application boundaries

A controlled-update compiler, permission diff, owner-approved plan and live dependency audit are still required before any status is applied. Inspect future appointments, open tasks, patient communications and transfers before closing a site. The impact report explicitly marks liveDependencyAudit as not-performed; it is not proof that closure is safe.

Coverage entries, preferences and rotation templates are preserved for review/history. Scope checks suppress new care at a nonactive clinic; existing bookings are not automatically cancelled. There is no hard-delete, automatic reassignment or credential revocation. Virtual locations and jurisdiction areas are outside this physical-clinic lifecycle manifest.

To add another clinic, add its stable FHIR Location under the existing market, explicit lifecycle history, service coverage and relevant session templates. Do not duplicate its providers or create another market. New resources still require the reviewed provisioning policy and deployment path.
