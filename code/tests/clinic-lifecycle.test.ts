import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinicLifecycle, clinicStateAt, clinicStatusAt, clinicImpact, validateClinicLifecycle, type ClinicLifecycle } from '../src/clinic-lifecycle.js';
import { isDeliveryEligible, previewCareDelivery } from '../src/care-delivery.js';
import proposal from '../config/proposals/care-delivery.resources.json' with { type: 'json' };
import foundation from '../config/foundation.json' with { type: 'json' };
const ref = (key: string) => [...foundation.entry, ...proposal.entry].find(e=>e.resource.identifier[0].value===key)!.fullUrl;
const location = ref('clinic-north-bay-ca');
const history = (): ClinicLifecycle => {
  const model = structuredClone(clinicLifecycle);
  model.clinics.find(c=>c.location===location)!.events = [
    {state:'planned',effectiveAt:'2026-10-20T00:00:00Z',reason:'Prepare site'},
    {state:'active',effectiveAt:'2026-10-21T00:00:00Z',reason:'Open site'},
    {state:'suspended',effectiveAt:'2026-10-22T00:00:00Z',reason:'Maintenance'},
    {state:'active',effectiveAt:'2026-10-23T00:00:00Z',reason:'Reopen after maintenance'},
    {state:'closed',effectiveAt:'2026-10-24T00:00:00Z',reason:'Permanent closure'},
  ];
  return model;
};

test('effective boundaries map business states to FHIR status without losing history',()=>{
  const model=history();
  assert.equal(clinicStateAt(location,'2026-10-19T00:00:00Z',model),'planned');
  assert.equal(clinicStatusAt(location,'2026-10-20T23:59:59Z',model),'inactive');
  assert.equal(clinicStatusAt(location,'2026-10-21T00:00:00Z',model),'active');
  assert.equal(clinicStatusAt(location,'2026-10-22T00:00:00Z',model),'suspended');
  assert.equal(clinicStatusAt(location,'2026-10-23T00:00:00Z',model),'active');
  assert.equal(clinicStateAt(location,'2026-10-24T00:00:00Z',model),'closed');
  assert.equal(clinicStatusAt(location,'2026-10-24T00:00:00Z',model),'inactive');
  assert.equal(model.clinics.find(c=>c.location===location)!.events.length,5);
});

test('inactive clinics deny new routing even with eligible provider, preferred clinic and service coverage',()=>{
  const request={role:ref('role-casey-patel-cardiology'),market:ref('market-north-bay-ca'),visitJurisdiction:'CA',location,mode:'in-clinic' as const};
  for(const [date,expected] of [['2026-10-20',false],['2026-10-21',true],['2026-10-22',false],['2026-10-23',true],['2026-10-24',false]] as const){
    assert.equal(isDeliveryEligible(request,`${date}T12:00:00Z`,history()),expected);
  }
});

test('lifecycle rejects invalid dates, duplicate clinics, missing histories and resurrection',()=>{
  const mutate=(change:(model:ClinicLifecycle)=>void)=>{const model=history();change(model);assert.throws(()=>validateClinicLifecycle(model));};
  mutate(m=>m.clinics.push(m.clinics[0]));
  mutate(m=>m.clinics.pop());
  mutate(m=>m.clinics[0].events=[]);
  mutate(m=>m.clinics[0].events[1].effectiveAt='2026-02-30T00:00:00Z');
  mutate(m=>m.clinics[0].events[1].effectiveAt=m.clinics[0].events[0].effectiveAt);
  mutate(m=>m.clinics[0].events[1].reason='');
  mutate(m=>m.clinics[0].events.push({state:'active',effectiveAt:'2026-10-25T00:00:00Z',reason:'Not an allowed resurrection'}));
});

test('closure impact identifies configured dependencies without deleting or pretending to inspect live work',()=>{
  const snapshot=JSON.stringify(clinicLifecycle);
  const impact=clinicImpact(location,'2026-10-24T12:00:00Z',history());
  assert.equal(impact.state,'closed');assert.equal(impact.acceptsNewCare,false);
  assert.ok(impact.affectedServices.includes(ref('service-infusion-therapy')));
  assert.ok(impact.preferredBy.includes(ref('practitioner-casey-patel')));
  assert.ok(impact.rotationTemplates.includes('casey-mon'));
  assert.equal(impact.liveDependencyAudit,'not-performed');assert.equal(impact.deletesResources,false);
  assert.equal(JSON.stringify(clinicLifecycle),snapshot);
});

test('preview keeps clinic identities while projecting status for the selected timestamp',()=>{
  const before=previewCareDelivery('2026-10-19T00:00:00Z');
  const active=previewCareDelivery('2026-10-20T00:00:00Z');
  const site=(v:ReturnType<typeof previewCareDelivery>)=>v.resources.entry!.find(e=>e.fullUrl===location)!.resource;
  assert.equal(site(before)?.resourceType,'Location');
  assert.equal((site(before) as {status?:string}).status,'inactive');
  assert.equal((site(active) as {status?:string}).status,'active');
  assert.equal(before.resources.entry!.length,active.resources.entry!.length);
});
