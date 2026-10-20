import {MedplumClient,OperationOutcomeError,getStatus} from '@medplum/core';
import type {AccessPolicy} from '@medplum/fhirtypes';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
import {encounterEntries,encounterPolicy} from '../src/encounter-deployment.js';
import {assertPolicy,queryFor} from '../src/deployment.js';
import context from '../config/encounters/references.json' with {type:'json'};
async function main(){
  const clients:MedplumClient[]=[];
  const login=async(prefix:string)=>{
    const id=process.env[`${prefix}_CLIENT_ID`],secret=process.env[`${prefix}_CLIENT_SECRET`];if(!id||!secret)throw Error('Separate credentials required');
    const m=new MedplumClient({baseUrl:expectedBaseUrl});clients.push(m);await m.startClientLogin(id,secret);
    const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string};accessPolicy?:AccessPolicy};if(me.project?.id!==expectedProjectId)throw Error('Wrong project');
    if(prefix==='MEDPLUM_ENCOUNTER')assertPolicy(encounterPolicy(context),me.accessPolicy??{resourceType:'AccessPolicy'});return m;
  };
  try{
    const encounter=await login('MEDPLUM_ENCOUNTER'),enrollment=await login('MEDPLUM_ENROLLMENT'),clinical=await login('MEDPLUM_ENROLLMENT_CLINICAL');
    let checks=0;
    const denied=async(op:()=>Promise<unknown>)=>{try{await op();}catch(e){if(e instanceof OperationOutcomeError&&[403,404].includes(getStatus(e.outcome))){checks++;return;}throw e;}throw Error('Expected denial');};
    for(const e of encounterEntries(context)){
      const found=await encounter.searchResources(e.resource.resourceType,`${queryFor(e.resource)}&_count=2`,{cache:'no-store'});if(found.length!==1)throw Error('Missing/duplicate scenario resource');
      for(const m of [enrollment,clinical]){
        await denied(()=>m.readResource(e.resource.resourceType,found[0].id!,{cache:'no-store'}));
        const hidden=await m.searchResources(e.resource.resourceType,queryFor(e.resource),{cache:'no-store'}).catch(e=>{if(e instanceof OperationOutcomeError&&getStatus(e.outcome)===403)return [];throw e;});
        if(hidden.length)throw Error('Unexpected search visibility');checks++;
      }
    }
    console.log(JSON.stringify({accessVerified:true,checks,persisted:false}));
  }finally{clients.forEach(c=>c.clear());}
}
main().catch(()=>{console.error('Encounter access verification failed; raw details suppressed');process.exitCode=1;});
