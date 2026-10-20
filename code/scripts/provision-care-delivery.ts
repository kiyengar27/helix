import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MedplumClient } from '@medplum/core';
import type { AccessPolicy, Resource } from '@medplum/fhirtypes';
import { expectedBaseUrl, expectedProjectId } from '../src/foundation.js';
import { compileDelivery, generatePolicy, assertPolicy, queryFor, buildPlan, assertReviewedPlan, transactionFor, type DeploymentPlan, type ManagedEntry } from '../src/deployment.js';

function option(args:string[], key:string):string|undefined { const i=args.indexOf(key); return i<0?undefined:args[i+1]; }
async function main() {
  const args=process.argv.slice(2);
  const mode=args[0]??'--preview';
  if(!['--preview','--policy','--validate-only','--plan','--apply','--verify'].includes(mode)) throw new Error('Unknown deployment mode');
  const known=new Set(['--as-of','--out','--plan-file']);
  for(let i=1;i<args.length;i+=2) if(!known.has(args[i]) || !args[i+1] || args[i+1].startsWith('--')) throw new Error('Invalid arguments');
  const saved=mode==='--apply'?JSON.parse(readFileSync(option(args,'--plan-file')??'reports/plan.json','utf8')) as DeploymentPlan:undefined;
  const asOf=saved?.asOf??option(args,'--as-of')??new Date().toISOString();
  if(!['--preview','--policy'].includes(mode) && (Date.parse(asOf)>Date.now() || Date.now()-Date.parse(asOf)>24*3600000)) throw new Error('Plan expired or snapshot is future-dated; replan');
  const entries=compileDelivery(asOf);
  const policy=generatePolicy(entries);
  const output=(data:unknown,defaultPath?:string)=>{
    const path=option(args,'--out')??defaultPath;
    if(path){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(data,null,2)+'\n');}
    console.log(JSON.stringify(data,null,2));
  };
  if(mode==='--preview'){output({asOf,resources:{resourceType:'Bundle',type:'collection',entry:entries},policy});return;}
  if(mode==='--policy'){output(policy);return;}
  const baseUrl=process.env.MEDPLUM_BASE_URL??expectedBaseUrl;
  if(baseUrl!==expectedBaseUrl) throw new Error('Unexpected API base URL');
  const id=process.env.MEDPLUM_CLIENT_ID, secret=process.env.MEDPLUM_CLIENT_SECRET;
  if(!id||!secret) throw new Error('Missing credentials');
  const commit=process.env.GITHUB_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!process.env.GITHUB_SHA && execFileSync('git',['status','--porcelain','--untracked-files=normal'],{encoding:'utf8'}).trim()) throw new Error('Commit configuration before authenticated plan/apply');
  const m=new MedplumClient({baseUrl});
  try {
    await m.startClientLogin(id,secret);
    const me=await m.get(new URL('auth/me',baseUrl).toString()) as {project?:{id?:string};accessPolicy?:AccessPolicy};
    if(me.project?.id!==expectedProjectId) throw new Error('Unexpected Medplum project');
    if(mode!=='--validate-only') assertPolicy(policy,me.accessPolicy??{resourceType:'AccessPolicy'});
    async function validate(resources:Resource[]) {
      for(const resource of resources){
        const result=await m.validateResource(resource);
        const errors=result.issue?.filter(i=>['fatal','error'].includes(i.severity));
        if(errors?.length){console.error(JSON.stringify({resourceType:resource.resourceType,errors:errors.map(i=>({code:i.code,expression:i.expression,text:i.details?.text}))}));throw new Error('FHIR validation failed');}
      }
    }
    await validate(entries.map(e=>e.resource));
    if(mode==='--validate-only'){output({projectId:expectedProjectId,validatedResources:entries.length,persisted:false});return;}
    async function snapshot(items:ManagedEntry[]) {
      const current=new Map<string,Resource>();
      for(const entry of items){
        const found=await m.searchResources(entry.resource.resourceType,`${queryFor(entry.resource)}&_count=2`,{cache:'no-store'});
        if(found.length>1) throw new Error('Duplicate managed identifier');
        if(found[0]) current.set(entry.fullUrl,found[0]);
      }
      return current;
    }
    const current=await snapshot(entries);
    const plan=buildPlan(entries,current,commit,asOf);
    if(mode==='--plan'){output(plan,'reports/plan.json');return;}
    if(mode==='--verify') {
      if(plan.changes.some(c=>c.action!=='retain')) throw new Error('Verification differs from desired configuration');
      output({projectId:expectedProjectId,verified:entries.length,asOf});return;
    }
    assertReviewedPlan(saved!,plan,commit);
    const transaction=transactionFor(entries,current,plan);
    await validate(transaction.entry!.map(e=>e.resource!));
    if(transaction.entry!.length){
      const result=await m.executeBatch(transaction);
      if(result.type!=='transaction-response'||result.entry?.length!==transaction.entry!.length||result.entry.some(e=>!e.response?.status?.startsWith('2')))throw new Error('Unexpected transaction response; inspect staging state');
      output({projectId:expectedProjectId,planDigest:saved!.digest,results:result.entry.map(e=>({status:e.response?.status,location:e.response?.location}))});
    } else output({projectId:expectedProjectId,planDigest:saved!.digest,submitted:0});
    const verified=buildPlan(entries,await snapshot(entries),commit,asOf);
    if(verified.changes.some(c=>c.action!=='retain')) throw new Error('Post-deployment verification failed');
    output({projectId:expectedProjectId,verified:entries.length});
  } finally {m.clear();}
}
main().catch(error=>{
  // Only emit our own controlled messages; SDK exceptions may contain request/response data.
  const text=error instanceof Error?error.message:'';
  const safe=['Effective policy differs','Reviewed plan','Plan expired','Configuration or server state','Lifecycle boundary','Unmanaged drift','Clinic suspension/closure','Verification differs','Commit configuration','Missing credentials','Unexpected Medplum','FHIR validation failed'];
  console.error(safe.some(prefix=>text.startsWith(prefix))?text:'Deployment failed; inspect the plan, permissions and target. Sensitive SDK details suppressed.');
  process.exitCode=1;
});
