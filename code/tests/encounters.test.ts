import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Encounter,MedicationRequest,Task} from '@medplum/fhirtypes';
import {compileEncounters,encounterDelivery,transitionEncounter,cancelMedicationIntent,encounterSummary,type EncounterContext} from '../src/encounters.js';
import {isDeliveryEligible} from '../src/care-delivery.js';
const context:EncounterContext={organization:'Organization/helix',patients:{'older-adult-caregiver':'Patient/eleanor','independent-adult':'Patient/daniel'},relatedPeople:{'older-adult-caregiver':'RelatedPerson/laura'},roles:{'role-alex-morgan-acute-care':'PractitionerRole/acute','role-alex-morgan-primary-care':'PractitionerRole/primary'},locations:{'clinic-north-bay-ca':'Location/northbay','virtual-tx':'Location/virtualtx'}};
test('two scenarios have stable conditional identities and patient/clinician/visit/intent/task links',()=>{
  const bundle=compileEncounters(context);assert.deepEqual(bundle,compileEncounters(context));assert.equal(bundle.entry!.length,6);
  for(let i=0;i<6;i+=3){
    const [visit,rx,task]=bundle.entry!.slice(i,i+3);
    const e=visit.resource as Encounter,m=rx.resource as MedicationRequest,t=task.resource as Task;
    assert.equal(m.subject.reference,e.subject!.reference);assert.equal(m.encounter!.reference,visit.fullUrl);
    assert.equal(t.for!.reference,e.subject!.reference);assert.equal(t.focus!.reference,rx.fullUrl);assert.equal(t.encounter!.reference,visit.fullUrl);
    assert.equal(m.requester!.reference,e.participant![0].individual!.reference);
  }
  assert.ok(bundle.entry!.every(e=>e.request!.method==='POST'&&e.request!.ifNoneExist));
  assert.equal(new Set(bundle.entry!.map(e=>e.fullUrl)).size,6);
});
test('caregiver participation is distinct from patient identity and no proxy permission or contact is implied',()=>{
  const entries=compileEncounters(context).entry!;
  const caregiver=entries[0].resource as Encounter,adult=entries[3].resource as Encounter;
  assert.equal(caregiver.subject!.reference,'Patient/eleanor');assert.equal(caregiver.participant![1].individual!.reference,'RelatedPerson/laura');
  assert.equal(adult.subject!.reference,'Patient/daniel');assert.equal(adult.participant!.length,1);
  assert.ok(!JSON.stringify(entries).includes('telecom'));assert.ok(entries.every(e=>!['Consent','AccessPolicy'].includes(e.resource!.resourceType)));
});
test('draft medication concepts cannot be mistaken for active or externally transmitted prescriptions',()=>{
  const entries=compileEncounters(context).entry!;
  for(const {resource} of entries){
    assert.ok(resource!.meta!.tag?.some(t=>t.code==='synthetic'));
    if(resource!.resourceType==='MedicationRequest'){
      assert.equal(resource.status,'draft');assert.equal(resource.intent,'proposal');
      assert.equal(resource.dosageInstruction,undefined);assert.equal(resource.dispenseRequest,undefined);
      assert.equal(resource.medicationCodeableConcept?.coding,undefined);
      assert.equal(cancelMedicationIntent(resource).status,'cancelled');
      assert.throws(()=>cancelMedicationIntent({...resource,status:'active',intent:'order'}));
    }
  }
});
test('encounter state transitions reject skipped steps and terminal reopening',()=>{
  const e=compileEncounters(context).entry![0].resource as Encounter;
  assert.throws(()=>transitionEncounter(e,'finished'));
  const started=transitionEncounter(e,'in-progress');const finished=transitionEncounter(started,'finished');
  assert.throws(()=>transitionEncounter(finished,'in-progress'));assert.equal(e.status,'planned');
  assert.equal(transitionEncounter(e,'cancelled').status,'cancelled');
});
test('actual visit jurisdiction controls routing independently of access; missing verified references fail',()=>{
  for(const key of ['caregiver-infection','adult-glp1']){
    const request=encounterDelivery(key);assert.equal(isDeliveryEligible(request,'2026-10-20T16:00:00Z'),true);
    assert.equal(isDeliveryEligible({...request,visitJurisdiction:'NY'},'2026-10-20T16:00:00Z'),false);
  }
  assert.throws(()=>compileEncounters({...context,relatedPeople:{}}));
  assert.throws(()=>compileEncounters({...context,patients:{'independent-adult':'RelatedPerson/wrong'}}));
});
test('public encounter preview contains counts only with no drug, person or contact payload',()=>{
  const s=encounterSummary();assert.equal(s.encounters,2);assert.equal(s.externalTransmission,false);assert.equal(s.smsEnabled,false);
  for(const field of ['medicationCodeableConcept','subject','telecom','patientCase'])assert.ok(!JSON.stringify(s).includes(field));
});
