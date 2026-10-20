import {writeFileSync} from 'node:fs';
import {MedplumClient} from '@medplum/core';
import context from '../config/enrollment/references.json' with {type:'json'};
import {acceptancePolicies} from '../src/enrollment-access.js';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
async function main(){
  const m=new MedplumClient({baseUrl:expectedBaseUrl});
  try{
    if(!process.env.MEDPLUM_CLIENT_ID||!process.env.MEDPLUM_CLIENT_SECRET)throw Error('Credentials required');
    await m.startClientLogin(process.env.MEDPLUM_CLIENT_ID,process.env.MEDPLUM_CLIENT_SECRET);
    const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string}};
    if(me.project?.id!==expectedProjectId)throw Error('Wrong project');
    for(const [key,policy] of Object.entries(acceptancePolicies(context))){
      const result=await m.validateResource(policy);
      if(result.issue?.some(i=>['fatal','error'].includes(i.severity)))throw Error('Invalid policy');
      writeFileSync(`config/security/enrollment-${key}-policy.json`,JSON.stringify(policy,null,2)+'\n');
    }
    console.log(JSON.stringify({validatedPolicies:2,persisted:false}));
  }finally{m.clear();}
}
main().catch(()=>{console.error('Policy preparation failed; details suppressed');process.exitCode=1;});
