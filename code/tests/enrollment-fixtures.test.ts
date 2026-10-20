import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEnrollmentFixtures,enrollmentServicePolicy,enrollmentSummary} from '../src/enrollment-fixtures.js';
import {generatePolicy,compileDelivery,canonical} from '../src/deployment.js';
const context={organization:'Organization/test-context',pcpRole:'PractitionerRole/test-pcp'};

test('synthetic enrollment compilation is stable, practice-scoped and does not add a patient market field',()=>{
  const fixtures=compileEnrollmentFixtures(context);
  assert.equal(fixtures.filter(f=>f.resource.resourceType==='Patient').length,6);
  assert.equal(fixtures.filter(f=>f.resource.resourceType==='RelatedPerson').length,5);
  assert.equal(canonical(fixtures),canonical(compileEnrollmentFixtures(context)));
  for(const {resource} of fixtures){
    if(resource.resourceType==='Patient'){
      assert.equal(resource.managingOrganization!.reference,context.organization);
      assert.equal(resource.extension,undefined);
      if(resource.generalPractitioner)assert.equal(resource.generalPractitioner[0].reference,context.pcpRole);
    }else assert.ok(fixtures.some(f=>f.fullUrl===resource.patient.reference&&f.resource.resourceType==='Patient'));
  }
});

test('enrollment credentials have separate explicit scope, no delete/admin or wildcard permissions',()=>{
  const policy=enrollmentServicePolicy(context);
  assert.ok(policy.resource!.every(r=>r.resourceType!=='*' && !r.interaction?.some(i=>['delete'].includes(i))));
  assert.ok(policy.resource!.filter(r=>['Patient','RelatedPerson'].includes(r.resourceType)).every(r=>r.criteria?.includes('identifier=')));
  const foundation=generatePolicy(compileDelivery('2026-10-20T12:00:00Z'));
  assert.ok(foundation.resource!.every(r=>!['Patient','RelatedPerson'].includes(r.resourceType)));
  assert.throws(()=>compileEnrollmentFixtures({organization:'Patient/wrong',pcpRole:context.pcpRole}));
});

test('public preview exposes counts only, not patient or caregiver payloads',()=>{
  const summary=enrollmentSummary();
  assert.equal(summary.patients,6);assert.equal(summary.relationships,5);
  assert.equal(summary.ageBands['12-13'],2);assert.equal(summary.ageBands['14-17'],1);
  assert.equal(summary.proxyGrantsCreated,0);assert.equal(summary.patientMarketField,false);
  const json=JSON.stringify(summary);
  for(const key of ['birthDate','address','given','family','resourceType','patientFullUrl'])assert.ok(!json.includes(key));
});

import checkedContext from '../config/enrollment/references.json' with {type:'json'};
import checkedPolicy from '../config/security/enrollment-service-policy.json' with {type:'json'};
import {buildPlan,transactionFor} from '../src/deployment.js';
test('checked-in enrollment policy tracks exactly the independent fixture scope',()=>{
  assert.equal(canonical(enrollmentServicePolicy(checkedContext)),canonical(checkedPolicy));
});
test('enrollment plan is create-only and uses conditional transactions with stable relationship links',()=>{
  const fixtures=compileEnrollmentFixtures(context);
  const plan=buildPlan(fixtures,new Map(),'a'.repeat(40),'2026-10-20T12:00:00Z');
  assert.equal(plan.changes.length,11);assert.ok(plan.changes.every(c=>c.action==='create'));
  const tx=transactionFor(fixtures,new Map(),plan);
  assert.ok(tx.entry!.every(e=>e.request?.method==='POST'&&e.request.ifNoneExist));
  const publicPlan=JSON.stringify(plan);
  for(const field of ['birthDate','address','HelixSynthetic'])assert.ok(!publicPlan.includes(field));
});

test('realistic display updates preserve identity, demographics, relationships and foreign metadata',()=>{
  const fixtures=compileEnrollmentFixtures(context);
  const refs=new Map(fixtures.map((e,i)=>[e.fullUrl,`${e.resource.resourceType}/fixture-${i}`]));
  const current=new Map(fixtures.map((e,i)=>{
    const r=structuredClone(e.resource);
    r.id=`fixture-${i}`;r.name=[{family:'HelixSynthetic',given:['scenario']}];
    r.meta={versionId:'7',tag:[{system:'urn:other',code:'keep'}],security:[{system:'urn:security',code:'keep'}]};
    if(r.resourceType==='RelatedPerson')r.patient.reference=refs.get(r.patient.reference!)!;
    return [e.fullUrl,r] as const;
  }));
  const plan=buildPlan(fixtures,current,'a'.repeat(40),'2026-10-20T12:00:00Z',undefined,'enrollment-display');
  assert.equal(plan.changes.length,11);
  assert.ok(plan.changes.every(c=>c.action==='update'&&canonical(c.fields)===canonical(['name','meta.tag'])));
  const tx=transactionFor(fixtures,current,plan);
  for(const e of tx.entry!){
    assert.equal(e.request!.method,'PUT');assert.equal(e.request!.ifMatch,'W/"7"');
    const before=current.get(e.fullUrl!)!,after=e.resource!;
    assert.equal(after.id,before.id);
    assert.deepEqual(after.meta!.security,before.meta!.security);
    assert.ok(after.meta!.tag!.some(t=>t.system==='urn:other'&&t.code==='keep'));
    const {name:n1,meta:m1,...restBefore}=before as typeof fixtures[number]['resource'];
    const {name:n2,meta:m2,...restAfter}=after as typeof fixtures[number]['resource'];
    assert.deepEqual(restAfter,restBefore);
    assert.ok(n2?.[0].given?.length && n2[0].family!=='HelixSynthetic');
    current.set(e.fullUrl!,after as typeof before);
  }
  assert.ok(buildPlan(fixtures,current,'a'.repeat(40),'2026-10-20T12:00:00Z',undefined,'enrollment-display').changes.every(c=>c.action==='retain'));
  const patient=current.get(fixtures[0].fullUrl)!;
  if(patient.resourceType==='Patient')patient.birthDate='1900-01-01';
  assert.throws(()=>buildPlan(fixtures,current,'a'.repeat(40),'2026-10-20T12:00:00Z',undefined,'enrollment-display'),/Unmanaged drift/);
});

test('foundation deployment cannot update enrollment display fields',()=>{
  const entries=compileEnrollmentFixtures(context);
  const r=structuredClone(entries[0].resource);r.id='fixture';r.meta={versionId:'1'};r.name=[{family:'Old'}];
  assert.throws(()=>buildPlan(entries,new Map([[entries[0].fullUrl,r]]),'a'.repeat(40),'2026-10-20T12:00:00Z'),/Unmanaged drift/);
});
