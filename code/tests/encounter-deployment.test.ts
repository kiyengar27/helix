import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evalFhirPath,toTypedValue} from '@medplum/core';
import type {Encounter,Resource} from '@medplum/fhirtypes';
import context from '../config/encounters/references.json' with {type:'json'};
import checked from '../config/security/encounter-service-policy.json' with {type:'json'};
import {encounterEntries,encounterPolicy,bootstrapEntries,flowVisits} from '../src/encounter-deployment.js';
import {buildPlan,transactionFor,assertPolicy} from '../src/deployment.js';
const time='2026-10-20T19:00:00Z',sha='a'.repeat(40);
function snapshot(){
  const entries=encounterEntries(context),ids=new Map(entries.map((e,i)=>[e.fullUrl,`${e.resource.resourceType}/fixture-${i}`]));
  const rewrite=(v:unknown):unknown=>Array.isArray(v)?v.map(rewrite):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='reference'&&typeof x==='string'?ids.get(x)??x:rewrite(x)])):v;
  return new Map(entries.map((e,i)=>{const r=rewrite(e.resource) as Resource;r.id=`fixture-${i}`;r.meta={...r.meta,versionId:'1'};return [e.fullUrl,r];}));
}
test('bootstrap creates exactly six conditionally linked resources and repeat plan retains all',()=>{
  const entries=encounterEntries(context),empty=new Map<string,Resource>();
  const plan=buildPlan(entries,empty,sha,time);assert.equal(plan.changes.length,6);assert.ok(plan.changes.every(c=>c.action==='create'));
  assert.ok(transactionFor(entries,empty,plan).entry!.every(e=>e.request?.method==='POST'&&e.request.ifNoneExist));
  const current=snapshot();assert.ok(buildPlan(bootstrapEntries(context,current),current,sha,time).changes.every(c=>c.action==='retain'));
});
test('bootstrap preserves legitimate visit progress and rejects clinical/link/tag drift',()=>{
  const current=snapshot();const visit=[...current.values()].find(r=>r.resourceType==='Encounter')! as Encounter;visit.status='finished';
  assert.ok(buildPlan(bootstrapEntries(context,current),current,sha,time).changes.every(c=>c.action==='retain'));
  assert.throws(()=>flowVisits(context,current),/planned/);
  visit.subject={reference:'Patient/wrong'};assert.throws(()=>buildPlan(bootstrapEntries(context,current),current,sha,time),/Unmanaged drift/);
  const fresh=snapshot();[...fresh.values()][0].meta!.tag=[];assert.throws(()=>bootstrapEntries(context,fresh),/tag drift/);
});
test('policy is exact case scoped, immutable medication proposals and constraint integrity checked',()=>{
  const policy=encounterPolicy(context);assert.deepEqual(policy,checked);
  assert.ok(policy.resource!.every(r=>r.resourceType!=='*'&&!r.interaction?.includes('delete')));
  for(const type of ['MedicationRequest','Task'])assert.ok(!policy.resource!.find(r=>r.resourceType===type)!.interaction!.includes('update'));
  const altered=structuredClone(policy);altered.resource![0].writeConstraint=[];assert.throws(()=>assertPolicy(policy,altered));
});
test('Medplum FHIRPath constraints allow ordered progress and reject skips, reopening and patient reassignment',()=>{
  const constraints=encounterPolicy(context).resource!.find(r=>r.resourceType==='Encounter')!.writeConstraint!;
  const before={resourceType:'Encounter',status:'planned',subject:{reference:'Patient/one'}};
  const allows=(after:typeof before,old=before)=>constraints.every(c=>{const result=evalFhirPath(c.expression!,after,{'%before':toTypedValue(old)});return result.length===1&&result[0]===true;});
  assert.equal(allows({...before,status:'in-progress'}),true);
  assert.equal(allows({...before,status:'finished'}),false);
  assert.equal(allows({...before,status:'finished'},{...before,status:'in-progress'}),true);
  assert.equal(allows({...before,status:'in-progress'},{...before,status:'finished'}),false);
  assert.equal(allows({...before,status:'in-progress',subject:{reference:'Patient/other'}}),false);
});

test('creation constraints reject nonplanned visits and medication activation',()=>{
  const policy=encounterPolicy(context);
  for(const type of ['Encounter','MedicationRequest','Task']){
    const r=encounterEntries(context).find(e=>e.resource.resourceType===type)!.resource;
    const rules=policy.resource!.find(p=>p.resourceType===type)!.writeConstraint!;
    const check=(resource:Resource)=>rules.every(c=>{const v=evalFhirPath(c.expression!,resource,{'%before':{type:'undefined',value:undefined}});return v.length===1&&v[0]===true;});
    assert.equal(check(r),true);assert.equal(check({...r,status:'active'} as Resource),false);
  }
});
