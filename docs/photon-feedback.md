# Photon evaluation notes — issue #10

Progress slowly, one reviewed step at a time. No patient has been sent to Photon and no order/SMS has been created.

## Confirmed

- Neutron sandbox OAuth client-credentials exchange succeeded using documented audience/endpoints. Returned scopes support patient sync and order operations but exclude prescription writing. Token was neither logged nor persisted. PHOTON_CLIENT_ID/SECRET exist only in local ignored .env; no Photon GitHub secrets requested yet.
- Daniel Wilson's Medplum fixture has name, complete DOB and stable Patient reference. It initially has neither explicit birth sex nor phone/full postal address. Do not infer birth sex from name or administrative gender.
- Photon public patient-sync example/reference mark name, DOB, sex and phone required; the live Neutron schema observed on October 20, 2026 marks phone optional. externalId and address are optional. API reference defines sex as sex at birth and exposes gender separately. Omitted allergy/medication history is not equivalent to verified none.

## Current preparation

Require explicit synthetic birth-sex values for every patient fixture: Daniel M, Eleanor F, Oliver M, Maya F, Ethan M and Sofia F. Missing, blank, unsupported or duplicate values fail validation; no value is inferred from names/gender. Store using the published FHIR R4 US Core birthsex extension, not Patient.gender. Keep identities, unrelated extensions, demographics and encounters. No phone number is added at this step. Expected reviewed enrollment plan: six extension updates, five retained resources; no policy expansion, creates or deletes. Code/validation success does not mean deployed.

## SMS findings and questions

Photon's self-serve article describes testing with one's own phone. No supported special synthetic number or built-in captured-message inbox was found in reviewed public docs; this is an open vendor question, not proof that none exists. Mailosaur documents account-dedicated SMS numbers with linked private inboxes. It is a candidate for external testing; Photon acceptance/delivery to such numbers has not been tested. A fabricated number may satisfy formatting but cannot serve as an SMS inbox. Do not use a public shared inbox for prescription links. Do not purchase or configure a provider until owner selection.

Ask Photon: Is there a supported no-delivery test number or sandbox inbox, what action triggers SMS, and how can authorized caregiver recipient routing be modeled without replacing the patient's identity/phone? Record the exact documented/observed answer and reproducible test before claiming behavior. These notes have not been sent to Photon.

## References

- [Photon authentication](https://docs.photon.health/docs/authentication)
- [Patient sync](https://docs.photon.health/docs/sync-patients) and [API reference](https://reference.photon.health/#mutation-createPatient)
- [Photon self-serve sandbox SMS example](https://photonhealth.com/blog/introducing-photon-self-serve)
- [Mailosaur dedicated test numbers](https://mailosaur.com/docs/sms-testing/phone-numbers)
- [US Core 6.1 birthsex extension, FHIR R4](https://hl7.org/fhir/us/core/STU6.1/StructureDefinition-us-core-birthsex.html). Published standard extension, not a custom Helix field or a declaration of full US Core conformance.

The earlier two-patient PLAN 39488477407 was cancelled before execution after the mandatory-field decision. Use a new plan after merge. This requirement is enforced by Helix fixture compilation and the explicit patient-to-integration mapping validator; it does not change the base FHIR Patient schema or enforce manual edits by arbitrary Medplum clients. UNK is an explicit HL7 value, not a default. Live Neutron introspection exposed MALE/FEMALE/UNKNOWN; runtime acceptance and the policy for mapping unknown data still need testing before sync.

## Feedback to Photon: EHR field-mapping developer guide

User-requested documentation feedback, not a request to build a Helix cross-EHR guide. Recommend a Photon developer guide mapping common EHR fields from Medplum, Epic and athenahealth to Photon patient fields. Include required/optional fields, null/unknown behavior, administrative gender versus sex at birth, identifier scope and patient merges, names/DOB/phone/address transformations, and practical per-EHR examples with version/tenant caveats. Explain caregiver contact versus patient identity and when communication is triggered. This feedback has not been sent externally.

Concrete observed discrepancy: public createPatient examples/reference require phone, while the authenticated Neutron introspection returned nullable AWSPhone on October 20, 2026. This is a schema observation, not proof of runtime or SMS behavior. Document environment/version differences or align examples; include phone optionality and communication side effects in the proposed mapping guide.

## Latest execution checkpoint

Required birth-sex extensions deployed: PLAN 39488994095 and DEPLOY 39489323792 succeeded; independent verification passed all 11 enrollment records. Daniel's read-only preview used his stable Medplum patient identity, name/DOB and explicit M → MALE mapping. No preview payload was sent to Photon. User selected a personal test phone stored only in ignored local PHOTON_TEST_PHONE; never copy its value into this log or issue comments. No Photon patient, order or SMS has been created by this integration. Next: inspect sandbox externalId lookup/uniqueness and patient-creation communication behavior, then implement a reviewed one-patient sync before any mutation.
