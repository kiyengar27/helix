import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {MedplumClient,getStatus,OperationOutcomeError} from '@medplum/core';
import type {AccessPolicy,Resource,Encounter} from '@medplum/fhirtypes';
import context from '../config/encounters/references.json' with {type:'json'};
import scenarios from '../config/encounters/scenarios.json' with {type:'json'};
import {encounterPolicy,encounterEntries,bootstrapEntries,flowVisits} from '../src/encounter-deployment.js';
import {buildPlan,assertReviewedPlan,transactionFor,queryFor,digest,canonical,assertPolicy,type DeploymentPlan} from '../src/deployment.js';
import {transitionEncounter,encounterDelivery,encounterSummary} from '../src/encounters.js';
import {isDeliveryEligible} from '../src/care-delivery.js';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
async function main(){
  const args=process.argv.slice(2),mode=args[0];if(!['--plan','--apply','--verify','--flow-plan','--flow-apply'].includes(mode))throw Error('Invalid mode');
  for(let i=1;i<args.length;i+=2)if(!['--out','--plan-file'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid options');
  const option=(key:string,fallback:string)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
  const flow=mode.startsWith('--flow'),path=option('--out',`reports/encounters/${flow?'flow-':''}plan.json`);
  const apply=mode.endsWith('apply'),saved=apply?JSON.parse(readFileSync(option('--plan-file',path),'utf8')):undefined;
  const commit=process.env.GITHUB_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!process.env.GITHUB_SHA&&execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit before planning');
  const id=process.env.MEDPLUM_ENCOUNTER_CLIENT_ID,secret=process.env.MEDPLUM_ENCOUNTER_CLIENT_SECRET;if(!id||!secret)throw Error('Separate encounter credentials required');
  const m=new MedplumClient({baseUrl:expectedBaseUrl});
  try{
    await m.startClientLogin(id,secret);
    const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string};accessPolicy?:AccessPolicy};
    if(me.project?.id!==expectedProjectId)throw Error('Wrong project');assertPolicy(encounterPolicy(context),me.accessPolicy??{resourceType:'AccessPolicy'});
    // Recheck live context and current delivery eligibility, not only historical authored time.
    await m.readResource('Organization',context.organization.split('/')[1],{cache:'no-store'});
    for(const c of scenarios.cases){
      if(!isDeliveryEligible(encounterDelivery(c.key)))throw Error('Current delivery scope ineligible');
      const patient=await m.readResource('Patient',context.patients[c.patientCase as keyof typeof context.patients].split('/')[1],{cache:'no-store'});
      if(patient.active!==true||patient.managingOrganization?.reference!==context.organization)throw Error('Patient context changed');
      const role=await m.readResource('PractitionerRole',context.roles[c.role as keyof typeof context.roles].split('/')[1],{cache:'no-store'});
      if(role.active!==true||role.organization?.reference!==context.organization)throw Error('Role context changed');
      const location=await m.readResource('Location',context.locations[c.location as keyof typeof context.locations].split('/')[1],{cache:'no-store'});
      if(location.status!=='active')throw Error('Location inactive');
      if(c.relatedPersonCase){const r=await m.readResource('RelatedPerson',context.relatedPeople[c.relatedPersonCase as keyof typeof context.relatedPeople].split('/')[1],{cache:'no-store'});if(r.active!==true||r.patient.reference!==`Patient/${patient.id}`)throw Error('Caregiver context changed');}
    }
    const entries=encounterEntries(context);
    const snapshot=async()=>{
      const current=new Map<string,Resource>();
      for(const e of entries){const found=await m.searchResources(e.resource.resourceType,`${queryFor(e.resource)}&_count=2`,{cache:'no-store'});if(found.length>1)throw Error('Duplicate encounter identity');if(found[0])current.set(e.fullUrl,found[0]);}
      return current;
    };
    for(const e of entries){const outcome=await m.validateResource(e.resource);if(outcome.issue?.some(i=>['fatal','error'].includes(i.severity)))throw Error('Validation failed');}
    const current=await snapshot(),asOf=saved?.asOf??new Date().toISOString();
    const plan=buildPlan(bootstrapEntries(context,current),current,commit,asOf);
    if(flow){
      if(plan.changes.some(c=>c.action!=='retain'))throw Error('Bootstrap must be verified before flow');
      const visits=flowVisits(context,current);
      const data={project:expectedProjectId,commit,asOf,configurationDigest:digest({entries,policy:encounterPolicy(context)}),snapshotDigest:digest([...current]),writes:4,operation:'start-and-finish-two-encounters'};
      const reviewed={...data,digest:digest(data)};
      if(mode==='--flow-plan'){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(reviewed,null,2)+'\n');console.log(JSON.stringify({writes:4,creates:0,deletes:0,medicationWrites:0,digest:reviewed.digest}));return;}
      const age=Date.now()-Date.parse(saved.asOf);if(!Number.isFinite(age)||age<0||age>86400000||canonical(saved)!==canonical(reviewed))throw Error('Flow plan expired or changed');
      const reject=async(op:()=>Promise<unknown>,statuses:number[])=>{
        try{await op();}catch(e){if(e instanceof OperationOutcomeError&&statuses.includes(getStatus(e.outcome)))return;throw e;}
        throw Error('Denied operation unexpectedly accepted');
      };
      let rejected=0;
      for(const visit of visits){
        await reject(()=>m.updateResource({...visit,status:'finished'},{headers:{'If-Match':`W/"${visit.meta!.versionId}"`}}),[400,403]);rejected++;
        const active=await m.updateResource(transitionEncounter(visit,'in-progress'),{headers:{'If-Match':`W/"${visit.meta!.versionId}"`}});
        await reject(()=>m.updateResource(transitionEncounter(active,'finished'),{headers:{'If-Match':`W/"${visit.meta!.versionId}"`}}),[412]);rejected++;
        const finished=await m.updateResource(transitionEncounter(active,'finished'),{headers:{'If-Match':`W/"${active.meta!.versionId}"`}});
        if(finished.status!=='finished')throw Error('Finish verification failed');
        const history=await m.readHistory('Encounter',visit.id!,{count:100},{cache:'no-store'});
        for(const state of ['planned','in-progress','finished'])if(!history.entry?.some(e=>e.resource?.status===state))throw Error('Version history evidence missing');
        await reject(()=>m.updateResource({...finished,status:'in-progress'},{headers:{'If-Match':`W/"${finished.meta!.versionId}"`}}),[400,403]);rejected++;
      }
      const after=await snapshot();if(buildPlan(bootstrapEntries(context,after),after,commit,asOf).changes.some(c=>c.action!=='retain'))throw Error('Flow drift');
      console.log(JSON.stringify({flowVerified:2,writes:4,rejected,medicationProposalsRemainDraft:true,versionHistoryVerified:true,externalTransmission:false}));return;
    }
    if(mode==='--plan'){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({counts:plan.changes.reduce<Record<string,number>>((a,c)=>(a[c.action]=(a[c.action]??0)+1,a),{}),digest:plan.digest,...encounterSummary()}));return;}
    if(mode==='--verify'){if(plan.changes.some(c=>c.action!=='retain'))throw Error('Verification differs');console.log(JSON.stringify({verified:6,...encounterSummary()}));return;}
    assertReviewedPlan(saved as DeploymentPlan,plan,commit);
    const tx=transactionFor(bootstrapEntries(context,current),current,plan);
    if(tx.entry!.length){const result=await m.executeBatch(tx);if(result.type!=='transaction-response'||result.entry?.length!==tx.entry!.length||result.entry.some(e=>!e.response?.status?.startsWith('2')))throw Error('Transaction failed');}
    const after=await snapshot();if(buildPlan(bootstrapEntries(context,after),after,commit,asOf).changes.some(c=>c.action!=='retain'))throw Error('Post-deployment drift');
    console.log(JSON.stringify({verified:6,submitted:tx.entry!.length,...encounterSummary()}));
  }finally{m.clear();}
}
main().catch(()=>{console.error('Encounter operation failed; inspect scoped policy, reviewed plan and state. Payload/error details suppressed. An interrupted flow needs review; never reset finished visits.');process.exitCode=1;});
