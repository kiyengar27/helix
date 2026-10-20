import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Resource } from '@medplum/fhirtypes';
import { compileDelivery, generatePolicy, assertPolicy, canonical, buildPlan, assertReviewedPlan, transactionFor, digest } from '../src/deployment.js';
import { buildFoundation } from '../src/foundation.js';
const at='2026-10-20T12:00:00Z', commit='a'.repeat(40);
function fixture() {
  const entries=compileDelivery(at);
  const existing=new Map<string,Resource>();
  const foundation=buildFoundation().entry!;
  const mapping=new Map(foundation.map((e,i)=>[e.fullUrl!,`${e.resource!.resourceType}/existing-${i}`]));
  function resolve(value:unknown):unknown {
    if(Array.isArray(value))return value.map(resolve);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='reference'&&typeof v==='string'?mapping.get(v)??v:resolve(v)]));
    return value;
  }
  foundation.forEach((e,i)=>existing.set(e.fullUrl!,{...resolve(e.resource) as Resource,id:`existing-${i}`,meta:{versionId:'v1'}}));
  return {entries,existing};
}

test('compiler projects service coverage and typed recurring schedules without open Slots',()=>{
  const entries=compileDelivery(at);
  assert.equal(entries.length,45);
  assert.equal(entries.filter(e=>e.resource.resourceType==='Schedule').length,4);
  assert.equal(entries.filter(e=>e.resource.resourceType==='Slot').length,0);
  assert.equal(digest(compileDelivery(at)),digest(entries));
  for(const {resource} of entries){
    if(resource.resourceType==='HealthcareService'){assert.ok(resource.location?.length);assert.ok(resource.coverageArea?.length);}
    if(resource.resourceType==='Schedule'){
      assert.equal(resource.actor.length,2);
      const params=resource.extension![0].extension!;
      assert.ok(params.some(e=>e.url==='service' && e.valueReference));
      assert.ok(params.some(e=>e.url==='timezone' && e.valueCode));
      assert.ok(params.some(e=>e.url==='availability'));
    }
  }
});

test('initial plan is 31 creates, 8 controlled updates and 6 retained resources',()=>{
  const {entries,existing}=fixture();
  const plan=buildPlan(entries,existing,commit,at,at);
  assert.equal(plan.changes.filter(c=>c.action==='create').length,31);
  assert.equal(plan.changes.filter(c=>c.action==='update').length,8);
  assert.equal(plan.changes.filter(c=>c.action==='retain').length,6);
  assert.ok(plan.changes.filter(c=>c.action==='update').every(c=>c.fields.every(f=>['location','coverageArea'].includes(f))));
  assertReviewedPlan(plan,buildPlan(entries,existing,commit,at,at),commit,Date.parse(at));
});

test('updates preserve unmanaged fields, include version checks and never emit DELETE',()=>{
  const {entries,existing}=fixture();
  for(const r of existing.values())if(r.resourceType==='HealthcareService')r.telecom=[{system:'url',value:'https://example.invalid/retained'}];
  const plan=buildPlan(entries,existing,commit,at,at);
  const transaction=transactionFor(entries,existing,plan);
  assert.equal(transaction.entry!.length,39);
  for(const e of transaction.entry!){
    assert.notEqual(e.request!.method,'DELETE');
    if(e.request!.method==='PUT'){
      assert.equal(e.request!.ifMatch,'W/"v1"');
      assert.ok(e.resource?.resourceType==='HealthcareService' && e.resource.telecom?.length===1);
    }else assert.ok(e.request!.ifNoneExist);
  }
});

test('apply rejects stale versions, newly appearing resources, plan tampering, expiry and different commits',()=>{
  const {entries,existing}=fixture();
  const saved=buildPlan(entries,existing,commit,at,at);
  const changed=structuredClone(existing);changed.values().next().value!.meta!.versionId='v2';
  assert.throws(()=>assertReviewedPlan(saved,buildPlan(entries,changed,commit,at,at),commit,Date.parse(at)));
  const inserted=entries.find(e=>!existing.has(e.fullUrl))!;
  const appeared=structuredClone(existing);appeared.set(inserted.fullUrl,{...inserted.resource,id:'new',meta:{versionId:'v1'}});
  assert.throws(()=>assertReviewedPlan(saved,buildPlan(entries,appeared,commit,at,at),commit,Date.parse(at)));
  assert.throws(()=>assertReviewedPlan({...saved,digest:'wrong'},saved,commit,Date.parse(at)));
  assert.throws(()=>assertReviewedPlan(saved,saved,'b'.repeat(40),Date.parse(at)));
  assert.throws(()=>assertReviewedPlan(saved,saved,commit,Date.parse(at)+25*3600000));
});

test('drift outside allowlist fails closed; canonical comparison ignores object key order',()=>{
  const {entries,existing}=fixture();
  const resource=[...existing.values()].find(r=>r.resourceType==='Organization')!;
  if(resource.resourceType==='Organization')resource.name='Unexpected edit';
  assert.throws(()=>buildPlan(entries,existing,commit,at),/Unmanaged drift/);
  assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));
  assert.notEqual(canonical([1,2]),canonical([2,1]));
});

test('policy is exact-identifier scoped, excludes patients/admin and is checked before authenticated planning',()=>{
  const policy=generatePolicy(compileDelivery(at));
  assert.ok(policy.resource!.every(r=>r.resourceType!=='*' && r.resourceType!=='Patient' && r.criteria?.includes('identifier=')));
  assert.ok(policy.resource!.every(r=>!r.interaction?.includes('delete')));
  assertPolicy(policy,policy);
  assert.throws(()=>assertPolicy(policy,{resourceType:'AccessPolicy',resource:[{resourceType:'*'}]}));
  const restricted=structuredClone(policy);restricted.resource![0].interaction=['read'];
  assert.throws(()=>assertPolicy(policy,restricted));
});

test('simulated transaction round-trip resolves mixed references and repeat plan is entirely retain',()=>{
  const {entries,existing}=fixture();
  const plan=buildPlan(entries,existing,commit,at,at);
  const transaction=transactionFor(entries,existing,plan);
  const ids=new Map(entries.map((e,i)=>[e.fullUrl,existing.has(e.fullUrl)?`${existing.get(e.fullUrl)!.resourceType}/${existing.get(e.fullUrl)!.id}`:`${e.resource.resourceType}/created-${i}`]));
  function resolve(value:unknown):unknown {
    if(Array.isArray(value))return value.map(resolve);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='reference'&&typeof v==='string'?ids.get(v)??v:resolve(v)]));
    return value;
  }
  const after=structuredClone(existing);
  for(const e of transaction.entry!){
    const id=ids.get(e.fullUrl!)!.split('/')[1];
    after.set(e.fullUrl!,{...resolve(e.resource) as Resource,id,meta:{versionId:'v2'}});
  }
  const repeated=buildPlan(entries,after,commit,at,at);
  assert.equal(repeated.changes.length,45);
  assert.ok(repeated.changes.every(c=>c.action==='retain'));
  assert.equal(transactionFor(entries,after,repeated).entry!.length,0);
});

import checkedPolicy from '../config/security/care-delivery-policy.json' with { type: 'json' };
test('committed generated policy cannot fall behind compiled identifiers',()=>{
  assert.equal(canonical(generatePolicy(compileDelivery(at))),canonical(checkedPolicy));
});

test('policy preflight permits read-only platform schema defaults but rejects schema writes',()=>{
  const policy=generatePolicy(compileDelivery(at));
  assertPolicy(policy,{...policy,resource:[...policy.resource!,{resourceType:'StructureDefinition',readonly:true}]});
  assert.throws(()=>assertPolicy(policy,{...policy,resource:[...policy.resource!,{resourceType:'SearchParameter',interaction:['read','create']}]}));
});
