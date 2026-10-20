import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Patient} from '@medplum/fhirtypes';
import {birthSexExtension} from '../src/patient-demographics.js';
import {mapPatient,findPatient,syncOne,makeSyncPlan,assertSyncPlan,type PatientRemote,type SyncReceipt} from '../src/photon-patient-sync.js';
import {PhotonSandbox,type PhotonPatient,type PhotonPatientInput} from '../src/photon-client.js';
const source:Patient={resourceType:'Patient',id:'synthetic-one',active:true,name:[{given:['Jordan','Test'],family:'Example'}],birthDate:'1986-10-20',extension:[birthSexExtension('M')]};
const payload=mapPatient(source,'project-one','+12025550102');
function fake(){
  const rows:PhotonPatient[]=[];let creates=0;let failAfterCreate=false;
  const remote:PatientRemote={list:async(after,first)=>{const start=after?rows.findIndex(p=>p.id===after)+1:0;return rows.slice(start,start+first);},read:async id=>{const p=rows.find(p=>p.id===id);if(!p)throw Error('missing');return p;},create:async input=>{creates++;const p={...input,id:`pat-${creates}`};rows.push(p);if(failAfterCreate)throw Error('network timeout');return p;}};
  return {rows,remote,count:()=>creates,fail:()=>{failAfterCreate=true;}};
}
test('maps explicit birth sex, complete DOB and names without adding gender, clinical history or logging contacts',()=>{
  assert.equal(payload.sex,'MALE');assert.equal(payload.name.middle,'Test');assert.equal(payload.externalId,'medplum:project-one:Patient/synthetic-one');
  assert.equal('gender' in payload,false);assert.equal('allergies' in payload,false);assert.equal('medicationHistory' in payload,false);
  assert.throws(()=>mapPatient({...source,extension:[],gender:'male'},'project-one','+12025550102'));
  assert.throws(()=>mapPatient({...source,birthDate:'1986'},'project-one','+12025550102'));
  assert.throws(()=>mapPatient({...source,birthDate:'1986-02-30'},'project-one','+12025550102'));
  assert.throws(()=>mapPatient(source,'project-one','not-a-number'));
  assert.equal(mapPatient({...source,extension:[birthSexExtension('UNK')]},'project-one','+12025550102').sex,'UNKNOWN');
});
test('first reviewed sync creates once, verifies and repeated sync reuses the same Photon identity',async()=>{
  const f=fake();let receipt:SyncReceipt|undefined;
  const save=(r:SyncReceipt)=>{receipt=r;};
  const result=await syncOne(f.remote,payload,'client',receipt,save,true,20,1);
  assert.equal(result.created,true);assert.equal(receipt!.status,'verified');assert.equal(f.count(),1);
  const repeated=await syncOne(f.remote,payload,'client',receipt,save,true,20,1);
  assert.equal(repeated.created,false);assert.equal(repeated.photonId,result.photonId);assert.equal(f.count(),1);
});
test('uncertain creation is not automatically retried; matching remote result can later be reconciled',async()=>{
  const f=fake();f.fail();let receipt:SyncReceipt|undefined;
  await assert.rejects(syncOne(f.remote,payload,'client',receipt,r=>{receipt=r;},true));
  assert.equal(receipt!.status,'pending');assert.equal(f.count(),1);
  const result=await syncOne(f.remote,payload,'client',receipt,r=>{receipt=r;},false);
  assert.equal(result.created,false);assert.equal(f.count(),1);assert.equal(receipt!.status,'verified');
});
test('pending outcome absent remotely blocks recreation and receipt persistence failure blocks the first mutation',async()=>{
  const f=fake();const receipt:SyncReceipt={externalId:payload.externalId,clientDigest:'client',status:'pending'};
  await assert.rejects(syncOne(f.remote,payload,'client',receipt,()=>{},true));assert.equal(f.count(),0);
  await assert.rejects(syncOne(f.remote,payload,'client',undefined,()=>{throw Error('disk full');},true));assert.equal(f.count(),0);
  await assert.rejects(syncOne(f.remote,payload,'client',undefined,()=>{},false));assert.equal(f.count(),0);
});
test('duplicate identities, mapped field drift and wrong-client receipts fail closed without mutations',async()=>{
  const f=fake();f.rows.push({...payload,id:'a'},{...payload,id:'b'});
  await assert.rejects(syncOne(f.remote,payload,'client',undefined,()=>{},true));assert.equal(f.count(),0);
  f.rows.pop();f.rows[0].sex='FEMALE';await assert.rejects(syncOne(f.remote,payload,'client',undefined,()=>{},true));assert.equal(f.count(),0);
  await assert.rejects(syncOne(f.remote,payload,'client',{externalId:payload.externalId,clientDigest:'other',status:'pending'},()=>{},true));
});
test('incomplete or repeating pagination is never interpreted as patient absence',async()=>{
  const remote:PatientRemote={list:async()=>[{id:'same',externalId:'unrelated'}],read:async()=>{throw Error('unused');},create:async()=>{throw Error('must not create');}};
  await assert.rejects(findPatient(remote,payload.externalId,1,1),/incomplete/);
  await assert.rejects(findPatient(remote,payload.externalId,3,1),/pagination/);
});
test('reviewed plan rejects source/config/client/receipt/phone changes, tampering and expiry without containing raw phone',()=>{
  const data={commit:'a'.repeat(40),project:'project-one',clientDigest:'client-hash',configurationDigest:'config-hash',sourceDigest:'source-hash',payloadDigest:'payload-hash',receiptDigest:'receipt-hash',externalId:payload.externalId,createdAt:'2026-10-20T20:00:00Z',action:'create' as const};
  const p=makeSyncPlan(data),now=Date.parse('2026-10-20T20:01:00Z');assert.doesNotThrow(()=>assertSyncPlan(p,p,now));
  for(const key of ['commit','project','clientDigest','configurationDigest','sourceDigest','payloadDigest','receiptDigest'])assert.throws(()=>assertSyncPlan(p,makeSyncPlan({...data,[key]:'changed'}),now));
  assert.throws(()=>assertSyncPlan({...p,digest:'wrong'},p,now));assert.throws(()=>assertSyncPlan(p,p,now+86400000));assert.ok(!JSON.stringify(p).includes(payload.phone));
});
test('HTTP adapter is sandbox-only and never retries a failed GraphQL mutation or accepts partial-error data',async()=>{
  const calls:string[]=[];let requests=0;
  const transport:typeof fetch=async(url,options)=>{
    calls.push(String(url));assert.equal(options!.redirect,'error');
    if(String(url).includes('/oauth/token'))return Response.json({access_token:'test-token'});
    requests++;return Response.json({data:{createPatient:{id:'unexpected',externalId:payload.externalId}},errors:[{message:'private patient details'}]});
  };
  const client=new PhotonSandbox(transport);await client.login('test-client','test-secret');await assert.rejects(client.create(payload),/details suppressed/);
  assert.equal(requests,1);assert.ok(calls.every(url=>url.startsWith('https://auth.neutron.health/')||url.startsWith('https://api.neutron.health/')));client.clear();
  await assert.rejects(client.read('a'),/authentication required/);assert.equal(requests,1);
});
