import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {MedplumClient,getStatus,normalizeOperationOutcome} from '@medplum/core';
import type {AccessPolicy,Patient,RelatedPerson} from '@medplum/fhirtypes';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
import {acceptancePolicies} from '../src/enrollment-access.js';
import {assertPolicy,digest,canonical} from '../src/deployment.js';
import {EnrollmentService,reviewGrant,revokeGrant,type ProxyGrant} from '../src/enrollment-service.js';
import {medplumEnrollmentStore} from '../src/enrollment-store.js';
import context from '../config/enrollment/references.json' with {type:'json'};
import config from '../config/enrollment/acceptance.json' with {type:'json'};
const path='reports/enrollment/acceptance-plan.json';
async function main(){
  const mode=process.argv[2];if(!['--plan','--apply'].includes(mode)||process.argv.length!==3)throw Error('Choose plan or apply');
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit first');
  assert.equal(config.restoreAfterSuccess,true);
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const clients:MedplumClient[]=[];
  const login=async(prefix:string,policy?:AccessPolicy)=>{
    const id=process.env[`${prefix}_CLIENT_ID`],secret=process.env[`${prefix}_CLIENT_SECRET`];
    if(!id||!secret)throw Error('Separate credentials required');
    const m=new MedplumClient({baseUrl:expectedBaseUrl});clients.push(m);await m.startClientLogin(id,secret);
    const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string};accessPolicy?:AccessPolicy};
    if(me.project?.id!==expectedProjectId)throw Error('Wrong project');
    if(policy)assertPolicy(policy,me.accessPolicy??{resourceType:'AccessPolicy'});
    return m;
  };
  try{
    const policies=acceptancePolicies(context);
    const auditor=await login('MEDPLUM_ENROLLMENT');
    const runtime=await login('MEDPLUM_ENROLLMENT_RUNTIME',policies.runtime);
    const clinical=await login('MEDPLUM_ENROLLMENT_CLINICAL',policies.clinical);
    const find=async(type:'Patient'|'RelatedPerson',key:string)=>{
      const system=type==='Patient'?'urn:helix:staging:synthetic-patient':'urn:helix:staging:related-person';
      const found=await auditor.searchResources(type,{identifier:`${system}|${key}`,_count:'2'},{cache:'no-store'});
      assert.equal(found.length,1);return found[0];
    };
    const patient=await find('Patient',config.managedCase) as Patient;
    const relationship=await find('RelatedPerson',config.managedCase) as RelatedPerson;
    const excluded=await find('Patient',config.excludedCase) as Patient;
    const patientRef=`Patient/${patient.id}`,relationshipRef=`RelatedPerson/${relationship.id}`;
    assert.equal(relationship.patient.reference,patientRef);assert.equal(relationship.active,true);
    const saved=mode==='--apply'?JSON.parse(readFileSync(path,'utf8')):undefined;
    const createdAt=saved?.createdAt??new Date().toISOString();
    const data={project:expectedProjectId,commit,createdAt,configDigest:digest({config,policies}),patient:patient.id,relationship:relationship.id,excluded:excluded.id,snapshotDigest:digest({patient,relationship,excluded}),operations:['patient-address-change','patient-remove-pcp','patient-restore','relationship-deactivate','relationship-restore'],expectedWrites:5};
    const plan={...data,digest:digest(data)};
    const age=Date.now()-Date.parse(createdAt);if(!Number.isFinite(age)||age<0||age>86400000)throw Error('Expired plan');
    const forbidden=async(op:()=>Promise<unknown>)=>{try{await op();}catch(e){if(getStatus(normalizeOperationOutcome(e))===403||getStatus(normalizeOperationOutcome(e))===404)return;throw e;}throw Error('Expected denied operation succeeded');};
    // Read-only checks run in both modes. Existing excluded ID proves isolation, rather than testing a nonexistent record.
    await clinical.readResource('Patient',patient.id!,{cache:'no-store'});
    await runtime.readResource('Patient',patient.id!,{cache:'no-store'});
    for(const client of [runtime,clinical]){
      await forbidden(()=>client.readResource('Patient',excluded.id!,{cache:'no-store'}));
      const found=await client.searchResources('Patient',{_id:excluded.id!},{cache:'no-store'});assert.equal(found.length,0);
      await forbidden(()=>client.readResource('ProjectMembership','f99bac0a-7313-49c6-80c9-e4baeb1798b2',{cache:'no-store'}));
    }
    if(mode==='--plan'){
      mkdirSync('reports/enrollment',{recursive:true});writeFileSync(path,JSON.stringify(plan,null,2)+'\n');
      console.log(JSON.stringify({readIsolationVerified:true,expectedWrites:5,creates:0,deletes:0,digest:plan.digest,persisted:false}));return;
    }
    assert.equal(canonical(saved),canonical(plan),'Reviewed snapshot changed; replan');
    let grant:ProxyGrant|undefined;
    const store=medplumEnrollmentStore(runtime,async()=>grant),service=new EnrollmentService(store);
    // Synthetic principals are a trusted test adapter, not a deployed staff authentication service.
    const registrar={id:'acceptance-registration',role:'registration' as const,patients:[patientRef]};
    const proxy={id:'acceptance-proxy',role:'proxy' as const,patients:[patientRef]};
    await assert.rejects(service.demographics(proxy,patientRef,createdAt));
    grant=reviewGrant({id:'acceptance-grant',principalId:proxy.id,patient:patientRef,relationship:relationshipRef,identityEvidence:'synthetic-verified-identity',authorityEvidence:'synthetic-reviewed-authority',reviewer:'acceptance-reviewer',validFrom:createdAt,validUntil:new Date(Date.parse(createdAt)+3600000).toISOString(),actions:['read-demographics']},patient,relationship,createdAt);
    await service.demographics(proxy,patientRef,createdAt);
    grant=revokeGrant(grant,createdAt);await assert.rejects(service.demographics(proxy,patientRef,createdAt));
    // Denied write submits an unchanged resource, so an unexpectedly permissive policy cannot alter demographics.
    await forbidden(()=>clinical.updateResource(patient,{headers:{'If-Match':`W/"${patient.meta!.versionId}"`}}));
    let current=await store.patient(patientRef);
    await service.update(registrar,patientRef,current.meta!.versionId!,{address:config.addressChange});
    current=await store.patient(patientRef);assert.deepEqual(current.address,config.addressChange);assert.deepEqual(current.identifier,patient.identifier);
    await assert.rejects(service.update(registrar,patientRef,patient.meta!.versionId!,{address:[]}));
    await service.update(registrar,patientRef,current.meta!.versionId!,{pcp:null});
    current=await store.patient(patientRef);assert.equal(current.generalPractitioner,undefined);
    // Restore original values, including absence of address. Fixtures currently have one optional PCP at most.
    assert.ok((patient.generalPractitioner?.length??0)<=1);
    const restored=structuredClone(patient);restored.meta=current.meta;
    await store.transaction({resourceType:'Bundle',type:'transaction',entry:[{resource:restored,request:{method:'PUT',url:patientRef,ifMatch:`W/"${current.meta!.versionId}"`}}]});
    await service.endRelationship(registrar,patientRef,relationshipRef,relationship.meta!.versionId!);
    assert.equal((await store.relationship(relationshipRef)).active,false);
    grant={...grant,revokedAt:undefined};await assert.rejects(service.demographics(proxy,patientRef,createdAt));
    const inactive=await store.relationship(relationshipRef);
    await store.transaction({resourceType:'Bundle',type:'transaction',entry:[{resource:{...relationship,meta:inactive.meta},request:{method:'PUT',url:relationshipRef,ifMatch:`W/"${inactive.meta!.versionId}"`}}]});
    const strip=(r:Patient|RelatedPerson)=>{const {meta,...rest}=r;return rest;};
    assert.deepEqual(strip(await store.patient(patientRef)),strip(patient));assert.deepEqual(strip(await store.relationship(relationshipRef)),strip(relationship));
    console.log(JSON.stringify({passed:true,writes:5,restored:true,readIsolationVerified:true,clinicalWriteDenied:true,proxyLifecycleVerified:true}));
  }finally{clients.forEach(c=>c.clear());}
}
main().catch(()=>{console.error('Enrollment acceptance failed. Raw details suppressed. If apply began, inspect the two synthetic records before retrying; no automatic rollback.');process.exitCode=1;});
