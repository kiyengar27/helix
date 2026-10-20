# One-patient Neutron sync

Issue #10, first integration slice. This implements only Daniel Wilson's synthetic patient identity sync. No patient creation has been authorized or executed yet. Prescriptions, orders, benefits, webhooks and caregiver messaging remain later steps.

## Boundaries

code/config/photon/patient-sync.json declares the sandbox, one source scenario, pagination limits and a 24-hour reviewed-plan lifetime. Endpoint URLs are fixed to auth.neutron.health and api.neutron.health; no production override. Only createPatient is implemented; the adapter has no update/order/prescribing method or automatic HTTP retry. It does not write to Medplum.

Source reads use existing MEDPLUM_ENCOUNTER_CLIENT_ID/SECRET, whose Patient permissions are read-only and scoped. The script verifies the Medplum project, exact synthetic identifier, group and synthetic marker. It maps the deployed Patient ID to a project-qualified externalId; official single name to first/middle/last; complete date of birth; explicit birthsex M/F/UNK to live-schema MALE/FEMALE/UNKNOWN. No administrative-gender inference, fabricated clinical history or empty allergy assertion is sent. The private PHOTON_TEST_PHONE is included from ignored .env, never copied into Medplum/Git/logs. No extra EHR mapping guide is included; that request was vendor feedback.

Local PHOTON_CLIENT_ID/SECRET are used only for Neutron OAuth. Tokens stay in process memory and are cleared from the client afterward. No Photon GitHub secrets or workflow are needed in this slice. Public CI runs local mocked tests only.

## Plan, apply, verify

1. From a clean reviewed checkout, run `make photon-patient-plan` in code/. This builds/tests, verifies current Photon schema, reads Daniel, scans paginated Photon patient IDs/externalIds and checks any exact match. It makes no API mutations. It writes only an ignored local plan/lock; no raw clinical/contact payload. Expect one create if Daniel is absent, otherwise zero creates and reuse only if all mapped fields agree.
2. Present the count-only plan to the owner and obtain explicit authorization before `make photon-patient-apply`. The command requires the same commit, client, configuration, source snapshot, payload hash (including private phone), receipt state and remote match as the reviewed unexpired plan. Rechecking happens before any mutation. Local lock prevents simultaneous runs using the same state directory.
3. Apply writes a durable private pending receipt before one createPatient attempt. It records the returned Photon ID, rechecks the exact external identity and mapped fields, then marks the receipt verified. Existing exact matches are reused; no patient update occurs. Success prints counts only, not tokens, phone or raw patient payloads.
4. Run `make photon-patient-verify` independently. A verified local receipt and matching Photon record must exist. A subsequent PLAN must show reuse, not another create. Apply of a reviewed reuse plan performs no API mutation.

The plan lives at ignored code/reports/photon/daniel-plan.json; link/attempt state at daniel-receipt.json. Private files use mode 0600; new directories 0700. Preserve/back up this state privately across machines; it is not a public artifact or a durable organization-wide production mapping registry. A changed/missing verified link blocks recreation. No Photon ID is yet written back into Medplum, and no two-system atomic transaction is claimed.

## Duplicate and failure semantics

The currently observed PatientFilter supports name only. The command pages through ID/externalId pairs and requires the scan to complete within configured limits; it does not use fuzzy name matching as identity. Multiple matching externalIds, repeated cursors, duplicate returned IDs, malformed pages, field differences or incomplete scans stop the operation. A direct patient(id) call uses Photon ID after a link exists; externalId lookup by that argument is not assumed.

No public uniqueness/atomic create-idempotency guarantee has been verified. This is serialized local execution with read/reconciliation and a persisted pending marker, not a server-atomic conditional create. Another independent writer remains outside the local lock; do not concurrently create this patient through the UI/another machine. Existing FHIR identifier-conditional writes remain unchanged.

On a timeout, GraphQL error (including partial data), process interruption or failed post-create verification, do not automatically retry creation. The pending receipt stays. A fresh PLAN may find a single exact matching record and propose reuse; reviewed apply can reconcile it without creating another. If no match is visible, leave pending state intact and resolve with Photon/operator inspection. Never delete the receipt to force a retry. An unexpected creation may have happened despite a reported failure. If a process crash leaves sync.lock, first verify no sync is running, inspect pending state, and remove only the stale lock after review. Ordinary failures release the lock but retain the receipt. Losing local state weakens protection; recover the link before any further create.

## Communication review

This command sends no explicit SMS request and creates no prescription/order. Photon documentation associates the patient SMS experience with order creation, but a notification-free createPatient contract is not verified. Because the owner-selected real test phone is included, review possible sandbox contact behavior before authorizing the first create. Observe the test recipient afterward; do not assert that a successful API response proves no communication occurred.

## Evidence and next step

Current acceptance is local contract/failure tests plus read-only Neutron schema/identity inspection. Neither a new patient nor repeat-run live behavior is proven until the owner-approved first create and independent verify. Keep #10 open. Caregiver flows, authorized prescriber UI access, catalog/regimen selection, orders, financial scenarios and webhooks are not enabled by this slice.

Implementation sources: [Photon authentication](https://docs.photon.health/docs/authentication), [patient sync](https://docs.photon.health/docs/sync-patients), [patient queries/mutations](https://reference.photon.health/) and authenticated Neutron schema inspection. Public phone requiredness differs from observed live schema; the command includes an explicitly reviewed private test phone. Vendor feedback and rough thoughts belong on the owner-selected Notion page, not in implementation PRs.

## Proposed sync timing for the later service

Photon recommends syncing records as they are created/updated in the source backend, and requires a patient to exist before prescribing. For Helix, the proposed hybrid is: first sync when a patient becomes part of the prescribing workflow; event-driven relevant-field updates for linked patients; a synchronous ensure-linked/current check before opening prescribing; and periodic reconciliation for missed events. Do not wait until final prescription transmission to discover a missing patient. A nightly job alone leaves the interactive workflow dependent on stale/missing records. Whether to pre-sync every enrolled patient or only a prescribing cohort is a Helix product/data-sharing choice, not a vendor mandate.

This is a recommendation for review, not implemented scheduling. The current command only creates/reuses Daniel and deliberately rejects mapped-field differences. It has no automatic update, event consumer or nightly job. [Photon recommendation](https://docs.photon.health/docs/integration-guide).
