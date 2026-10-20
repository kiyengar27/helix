import {writeFileSync} from 'node:fs';
import {MedplumClient} from '@medplum/core';
import {resolveEncounterContext} from '../src/encounter-context.js';
import {encounterPolicy} from '../src/encounter-deployment.js';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
async function main(){
  const clients:MedplumClient[]=[];
  try{
    for(const prefix of ['MEDPLUM','MEDPLUM_ENROLLMENT']){
      const id=process.env[`${prefix}_CLIENT_ID`],secret=process.env[`${prefix}_CLIENT_SECRET`];if(!id||!secret)throw Error('Credentials required');
      const m=new MedplumClient({baseUrl:expectedBaseUrl});clients.push(m);await m.startClientLogin(id,secret);
      const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string}};if(me.project?.id!==expectedProjectId)throw Error('Wrong project');
    }
    const context=await resolveEncounterContext(clients[0],clients[1]),policy=encounterPolicy(context);
    const result=await clients[0].validateResource(policy);if(result.issue?.some(i=>['fatal','error'].includes(i.severity)))throw Error('Invalid policy');
    writeFileSync('config/encounters/references.json',JSON.stringify(context,null,2)+'\n');
    writeFileSync('config/security/encounter-service-policy.json',JSON.stringify(policy,null,2)+'\n');
    console.log(JSON.stringify({prepared:true,validatedPolicy:true,persisted:false}));
  }finally{clients.forEach(c=>c.clear());}
}
main().catch(()=>{console.error('Encounter preparation failed; details suppressed');process.exitCode=1;});
