import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Patient,RelatedPerson,Bundle} from '@medplum/fhirtypes';
import {EnrollmentService,reviewGrant,revokeGrant,type EnrollmentStore,type ProxyGrant,type Principal} from '../src/enrollment-service.js';
function setup(birthDate='2013-10-21'){
  let patient:Patient={resourceType:'Patient',id:'one',identifier:[{system:'urn:test',value:'stable'}],meta:{versionId:'1'},birthDate,name:[{family:'Example'}],managingOrganization:{reference:'Organization/helix'},generalPractitioner:[{reference:'PractitionerRole/pcp'}]};
  let relationship:RelatedPerson={resourceType:'RelatedPerson',id:'parent',meta:{versionId:'1'},active:true,patient:{reference:'Patient/one'}};
  let grant:ProxyGrant|undefined;
  const writes:Bundle[]=[];
  const store:EnrollmentStore={patient:async()=>structuredClone(patient),relationship:async()=>structuredClone(relationship),grant:async()=>grant,transaction:async bundle=>{
    writes.push(bundle);
    for(const e of bundle.entry??[]){
      const r=e.resource!;
      const old=r.resourceType==='Patient'?patient:relationship;
      assert.equal(e.request?.method,'PUT');assert.equal(e.request?.ifMatch,`W/"${old.meta!.versionId}"`);
      r.meta={...r.meta,versionId:String(Number(old.meta!.versionId)+1)};
      if(r.resourceType==='Patient')patient=structuredClone(r);else if(r.resourceType==='RelatedPerson')relationship=structuredClone(r);
    }
  }};
  const registration:Principal={id:'registrar',role:'registration',patients:['Patient/one']};
  const clinical:Principal={...registration,id:'clinician',role:'clinical'};
  const proxy:Principal={...registration,id:'proxy-one',role:'proxy'};
  return {service:new EnrollmentService(store),registration,clinical,proxy,writes,
    patient:()=>patient,relationship:()=>relationship,setGrant:(g:ProxyGrant)=>{grant=g;},
    review:()=>reviewGrant({id:'grant-one',principalId:proxy.id,patient:'Patient/one',relationship:'RelatedPerson/parent',identityEvidence:'verification/one',authorityEvidence:'review/one',reviewer:'reviewer',validFrom:'2026-10-20T00:00:00Z',validUntil:'2027-10-20T00:00:00Z',actions:['read-demographics']},patient,relationship,'2026-10-20T12:00:00Z')};
}
const now='2026-10-20T12:00:00Z';
test('registration changes preserve identity, custody and optional PCP; stale and clinical writes denied',async()=>{
  const s=setup();
  await s.service.update(s.registration,'Patient/one','1',{address:[{state:'TX'}]});
  assert.equal(s.patient().id,'one');assert.equal(s.patient().identifier![0].value,'stable');
  assert.equal(s.patient().managingOrganization?.reference,'Organization/helix');
  assert.equal(s.patient().generalPractitioner![0].reference,'PractitionerRole/pcp');
  await assert.rejects(s.service.update(s.registration,'Patient/one','1',{address:[{state:'CA'}]}),/Stale/);
  await s.service.update(s.registration,'Patient/one','2',{pcp:null});
  assert.equal(s.patient().generalPractitioner,undefined);
  await s.service.update(s.registration,'Patient/one','3',{pcp:{reference:'PractitionerRole/replacement'}});
  assert.equal(s.patient().generalPractitioner![0].reference,'PractitionerRole/replacement');
  await assert.rejects(s.service.update(s.clinical,'Patient/one','4',{name:[]}),/denied/);
  await assert.rejects(s.service.update(s.registration,'Patient/one','4',{birthDate:'2000-01-01'} as never),/denied/);
  assert.equal(s.writes.length,3);
});
test('unrelated-patient access is denied before writes; clinical reader sees only demographic projection',async()=>{
  const s=setup();
  await assert.rejects(s.service.demographics(s.clinical,'Patient/other',now),/denied/);
  await assert.rejects(s.service.update(s.registration,'Patient/other','1',{}),/denied/);
  const result=await s.service.demographics(s.clinical,'Patient/one',now);
  assert.equal(result.id,'one');assert.equal('identifier' in result,false);assert.equal('managingOrganization' in result,false);
  assert.equal(s.writes.length,0);
});
test('relationship alone never grants proxy access; verified grant is patient/principal specific and revocable',async()=>{
  const s=setup();
  await assert.rejects(s.service.demographics(s.proxy,'Patient/one',now),/denied/);
  const grant=s.review();s.setGrant(grant);
  assert.equal((await s.service.demographics(s.proxy,'Patient/one',now)).id,'one');
  await assert.rejects(s.service.demographics({...s.proxy,id:'someone-else'},'Patient/one',now),/denied/);
  await assert.rejects(s.service.demographics(s.proxy,'Patient/other',now),/denied/);
  s.setGrant(revokeGrant(grant,now));
  await assert.rejects(s.service.demographics(s.proxy,'Patient/one',now),/denied/);
});
test('crossing review age boundaries, corrected DOB and grant expiry require new review',async()=>{
  for(const year of ['2014','2012','2008']){
    const s=setup(`${year}-10-21`);s.setGrant(s.review());
    await s.service.demographics(s.proxy,'Patient/one',now);
    await assert.rejects(s.service.demographics(s.proxy,'Patient/one','2026-10-21T00:00:00Z'),/denied/);
  }
  const s=setup();s.setGrant(s.review());
  await assert.rejects(s.service.demographics(s.proxy,'Patient/one','2027-10-20T00:00:00Z'),/denied/);
  s.patient().birthDate='2013-10-19';
  await assert.rejects(s.service.demographics(s.proxy,'Patient/one',now),/denied/);
});
test('ending caregiver arrangement preserves relationship history and immediately denies proxy',async()=>{
  const s=setup('1940-01-01');s.setGrant(s.review());
  await s.service.endRelationship(s.registration,'Patient/one','RelatedPerson/parent','1');
  assert.equal(s.relationship().id,'parent');assert.equal(s.relationship().active,false);
  await assert.rejects(s.service.demographics(s.proxy,'Patient/one',now),/denied/);
  await assert.rejects(s.service.endRelationship(s.registration,'Patient/one','RelatedPerson/parent','1'),/Stale/);
});
test('review rejects absent identity/authority, inactive or mismatched relationships',()=>{
  const s=setup();s.relationship().active=false;assert.throws(()=>s.review(),/denied/);
  s.relationship().active=true;s.relationship().patient.reference='Patient/other';assert.throws(()=>s.review(),/denied/);
});

test('authority review requires both evidence references and an identified reviewer',()=>{
  const s=setup();const valid=s.review();
  const {reviewedBirthDate,reviewedAgeBand,...input}=valid;
  for(const field of ['identityEvidence','authorityEvidence','reviewer'] as const){
    assert.throws(()=>reviewGrant({...input,[field]:''},s.patient(),s.relationship(),now),/denied/);
  }
});

import {acceptancePolicies} from '../src/enrollment-access.js';
import context from '../config/enrollment/references.json' with {type:'json'};
import runtimePolicy from '../config/security/enrollment-runtime-policy.json' with {type:'json'};
import clinicalPolicy from '../config/security/enrollment-clinical-policy.json' with {type:'json'};
test('runtime and clinical policies scope one synthetic case; direct staff writes and unrelated records excluded',()=>{
  const p=acceptancePolicies(context);assert.deepEqual(p.runtime,runtimePolicy);assert.deepEqual(p.clinical,clinicalPolicy);
  assert.ok(p.runtime.resource!.every(r=>!r.interaction?.some(i=>['create','delete'].includes(i))));
  assert.ok(p.clinical.resource!.every(r=>r.interaction?.every(i=>['read','search'].includes(i))));
  for(const policy of Object.values(p))for(const rule of policy.resource!){
    assert.notEqual(rule.resourceType,'*');assert.ok(rule.criteria);
    assert.ok(!rule.criteria!.includes('independent-adult'));
  }
});
