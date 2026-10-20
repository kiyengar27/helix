import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {MedplumClient} from '@medplum/core';
import type {AccessPolicy,Resource} from '@medplum/fhirtypes';
import {compileEnrollmentFixtures,enrollmentServicePolicy,enrollmentSummary} from '../src/enrollment-fixtures.js';
import context from '../config/enrollment/references.json' with {type:'json'};
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
import {assertPolicy,queryFor,buildPlan,assertReviewedPlan,transactionFor,type DeploymentPlan} from '../src/deployment.js';

async function main(){
  const args=process.argv.slice(2),mode=args[0];
  if(!['--plan','--apply','--verify'].includes(mode))throw Error('Choose plan, apply or verify');
  for(let i=1;i<args.length;i+=2)if(!['--out','--plan-file'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid options');
  const get=(key:string,fallback:string)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
  const saved=mode==='--apply'?JSON.parse(readFileSync(get('--plan-file','reports/enrollment/plan.json'),'utf8')) as DeploymentPlan:undefined;
  const commit=process.env.GITHUB_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!process.env.GITHUB_SHA&&execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit configuration before planning');
  const entries=compileEnrollmentFixtures(context),policy=enrollmentServicePolicy(context);
  const id=process.env.MEDPLUM_ENROLLMENT_CLIENT_ID,secret=process.env.MEDPLUM_ENROLLMENT_CLIENT_SECRET;
  if(!id||!secret)throw Error('Separate enrollment credentials required');
  const m=new MedplumClient({baseUrl:expectedBaseUrl});
  try{
    await m.startClientLogin(id,secret);
    const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string};accessPolicy?:AccessPolicy};
    if(me.project?.id!==expectedProjectId)throw Error('Wrong project');
    assertPolicy(policy,me.accessPolicy??{resourceType:'AccessPolicy'});
    // Confirm reference visibility and deliberately avoid using foundation credentials.
    await m.readResource('Organization',context.organization.split('/')[1]);
    await m.readResource('PractitionerRole',context.pcpRole.split('/')[1]);
    const snapshot=async()=>{
      const current=new Map<string,Resource>();
      for(const e of entries){
        const found=await m.searchResources(e.resource.resourceType,`${queryFor(e.resource)}&_count=2`,{cache:'no-store'});
        if(found.length>1)throw Error('Duplicate enrollment identity');
        if(found[0])current.set(e.fullUrl,found[0]);
      }
      return current;
    };
    for(const e of entries){const outcome=await m.validateResource(e.resource);if(outcome.issue?.some(i=>['fatal','error'].includes(i.severity)))throw Error('Validation failed');}
    const current=await snapshot(),asOf=saved?.asOf??new Date().toISOString();
    const plan=buildPlan(entries,current,commit,asOf,undefined,'enrollment-profile');
    if(mode==='--plan'){
      const path=get('--out','reports/enrollment/plan.json');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(plan,null,2)+'\n');
      console.log(JSON.stringify({projectId:expectedProjectId,counts:plan.changes.reduce<Record<string,number>>((a,c)=>(a[c.action]=(a[c.action]??0)+1,a),{}),digest:plan.digest,...enrollmentSummary()}));return;
    }
    if(mode==='--verify'){if(plan.changes.some(c=>c.action!=='retain'))throw Error('Verification differs');console.log(JSON.stringify({verified:entries.length,...enrollmentSummary()}));return;}
    assertReviewedPlan(saved!,plan,commit);
    const tx=transactionFor(entries,current,plan);
    if(tx.entry!.length){
      const result=await m.executeBatch(tx);
      if(result.type!=='transaction-response'||result.entry?.length!==tx.entry!.length||result.entry.some(e=>!e.response?.status?.startsWith('2')))throw Error('Transaction failed');
      console.log(JSON.stringify({submitted:tx.entry!.length,created:result.entry.filter(e=>e.response?.status==='201').length,updated:result.entry.filter(e=>e.response?.status==='200').length}));
    }
    const verified=buildPlan(entries,await snapshot(),commit,asOf,undefined,'enrollment-profile');
    if(verified.changes.some(c=>c.action!=='retain'))throw Error('Post-deployment verification differs');
    console.log(JSON.stringify({verified:entries.length,...enrollmentSummary()}));
  }finally{m.clear();}
}
main().catch(()=>{console.error('Enrollment operation failed; check separate credentials, scoped policy, reviewed plan and staging state. Raw payload/error details suppressed.');process.exitCode=1;});
