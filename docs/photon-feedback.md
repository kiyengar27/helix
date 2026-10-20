# Photon evaluation notes — issue #10

Progress slowly, one reviewed step at a time. No patient has been sent to Photon and no order/SMS has been created.

## Confirmed

- Neutron sandbox OAuth client-credentials exchange succeeded using documented audience/endpoints. Returned scopes support patient sync and order operations but exclude prescription writing. Token was neither logged nor persisted. PHOTON_CLIENT_ID/SECRET exist only in local ignored .env; no Photon GitHub secrets requested yet.
- Daniel Wilson's Medplum fixture has name, complete DOB and stable Patient reference. It initially has neither explicit birth sex nor phone/full postal address. Do not infer birth sex from name or administrative gender.
- Photon createPatient requires name, DOB, sex and phone; externalId and address are optional. API reference defines sex as sex at birth and exposes gender separately. Omitted allergy/medication history is not equivalent to verified none.

## Current preparation

Declare explicit synthetic birth-sex values for the two integration patients: Daniel M, Eleanor F. Store using the published FHIR R4 US Core birthsex extension, not Patient.gender. Keep identities, unrelated extensions, demographics and encounters. No phone number is added at this step. Expected reviewed enrollment plan: two extension updates, nine retained resources; no policy expansion, creates or deletes. Code/validation success does not mean deployed.

## SMS findings and questions

Photon's self-serve article describes testing with one's own phone. No supported special synthetic number or built-in captured-message inbox was found in reviewed public docs; this is an open vendor question, not proof that none exists. Mailosaur documents account-dedicated SMS numbers with linked private inboxes. It is a candidate for external testing; Photon acceptance/delivery to such numbers has not been tested. A fabricated number may satisfy formatting but cannot serve as an SMS inbox. Do not use a public shared inbox for prescription links. Do not purchase or configure a provider until owner selection.

Ask Photon: Is there a supported no-delivery test number or sandbox inbox, what action triggers SMS, and how can authorized caregiver recipient routing be modeled without replacing the patient's identity/phone? Record the exact documented/observed answer and reproducible test before claiming behavior. These notes have not been sent to Photon.

## References

- [Photon authentication](https://docs.photon.health/docs/authentication)
- [Patient sync](https://docs.photon.health/docs/sync-patients) and [API reference](https://reference.photon.health/#mutation-createPatient)
- [Photon self-serve sandbox SMS example](https://photonhealth.com/blog/introducing-photon-self-serve)
- [Mailosaur dedicated test numbers](https://mailosaur.com/docs/sms-testing/phone-numbers)
- [US Core 6.1 birthsex extension, FHIR R4](https://hl7.org/fhir/us/core/STU6.1/StructureDefinition-us-core-birthsex.html). Published standard extension, not a custom Helix field or a declaration of full US Core conformance.
