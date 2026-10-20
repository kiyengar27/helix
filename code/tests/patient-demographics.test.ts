import {test} from 'node:test';import assert from 'node:assert/strict';
import type {Resource} from '@medplum/fhirtypes';
import {compileEnrollmentFixtures} from '../src/enrollment-fixtures.js';
import {birthSexUrl,birthSexExtension,mergeBirthSex,requiredBirthSex} from '../src/patient-demographics.js';
import {buildPlan,transactionFor} from '../src/deployment.js';
const context={organization:'Organization/test',pcpRole:'PractitionerRole/test'};
test('every synthetic patient has one explicit birth-sex value without inferring gender',()=>{
  const patients=compileEnrollmentFixtures(context).filter(e=>e.resource.resourceType==='Patient');
  assert.equal(patients.filter(e=>e.resource.resourceType==='Patient'&&e.resource.extension?.some(x=>x.url===birthSexUrl)).length,6);
  for(const {resource:r} of patients){if(r.resourceType!=='Patient')continue;
    assert.equal(r.gender,undefined);assert.equal(r.telecom,undefined);
    if(r.identifier![0].value==='independent-adult')assert.equal(r.extension![0].valueCode,'M');
    if(r.identifier![0].value==='older-adult-caregiver')assert.equal(r.extension![0].valueCode,'F');
  }
});
test('birth-sex projection preserves unrelated extensions and rejects ambiguous or invalid values',()=>{
  const custom={url:'urn:other',valueString:'keep'};
  assert.deepEqual(mergeBirthSex([custom,birthSexExtension('M')],[birthSexExtension('F')]),[custom,birthSexExtension('F')]);
  assert.throws(()=>birthSexExtension('MALE'));assert.throws(()=>mergeBirthSex([birthSexExtension('M'),birthSexExtension('F')],[birthSexExtension('M')]));
});
test('reviewed profile scope updates only birth-sex extensions without demographic or identifier replacement',()=>{
  const entries=compileEnrollmentFixtures(context);const ids=new Map(entries.map((e,i)=>[e.fullUrl,`${e.resource.resourceType}/fixture-${i}`]));
  const current=new Map<string,Resource>(entries.map((e,i)=>{
    const r=structuredClone(e.resource);r.id=`fixture-${i}`;r.meta={...r.meta,versionId:'1'};
    if(r.resourceType==='Patient')r.extension=[{url:'urn:other',valueString:'keep'}];
    else r.patient.reference=ids.get(r.patient.reference!)!;
    return [e.fullUrl,r];
  }));
  const plan=buildPlan(entries,current,'a'.repeat(40),'2026-10-20T00:00:00Z',undefined,'enrollment-profile');
  assert.equal(plan.changes.filter(c=>c.action==='update').length,6);assert.equal(plan.changes.filter(c=>c.action==='retain').length,5);
  assert.ok(plan.changes.filter(c=>c.action==='update').every(c=>c.fields.length===1&&c.fields[0]==='extension:birthSex'));
  const tx=transactionFor(entries,current,plan);
  for(const e of tx.entry!){
    assert.equal(e.request!.method,'PUT');assert.equal(e.request!.ifMatch,'W/"1"');
    const r=e.resource!;assert.equal(r.resourceType,'Patient');if(r.resourceType!=='Patient')continue;
    assert.ok(r.extension!.some(x=>x.url==='urn:other'));assert.equal(r.gender,undefined);assert.equal(r.telecom,undefined);
    const before=current.get(e.fullUrl!)!;assert.equal(r.id,before.id);
    const {extension, ...rest}=r;const {extension:old,...oldRest}=before as typeof r;assert.deepEqual(rest,oldRest);
    current.set(e.fullUrl!,r);
  }
  assert.ok(buildPlan(entries,current,'a'.repeat(40),'2026-10-20T00:00:00Z',undefined,'enrollment-profile').changes.every(c=>c.action==='retain'));
});

test('mandatory birth sex rejects missing, blank, duplicate and unsupported values at the mapping boundary',()=>{
  for(const value of [undefined,null,'','male','invalid'])assert.throws(()=>birthSexExtension(value));
  assert.throws(()=>requiredBirthSex({resourceType:'Patient',gender:'male',name:[{given:['Daniel']}]}));
  assert.throws(()=>requiredBirthSex({resourceType:'Patient',extension:[{url:birthSexUrl}]}));
  assert.throws(()=>requiredBirthSex({resourceType:'Patient',extension:[birthSexExtension('M'),birthSexExtension('F')]}));
  assert.equal(requiredBirthSex({resourceType:'Patient',extension:[birthSexExtension('UNK')]}),'UNK');
  for(const {resource} of compileEnrollmentFixtures(context))if(resource.resourceType==='Patient')assert.ok(['M','F','UNK'].includes(requiredBirthSex(resource)));
});

import scenarios from '../config/enrollment/scenarios.json' with {type:'json'};
test('patient compiler fails if a required fixture value is removed rather than silently omitting the field',()=>{
  const scenario=scenarios.cases[0] as {birthSex?:string};const saved=scenario.birthSex;
  try{delete scenario.birthSex;assert.throws(()=>compileEnrollmentFixtures(context),/birth-sex/);}
  finally{scenario.birthSex=saved;}
});
