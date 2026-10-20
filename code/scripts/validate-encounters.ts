import {resolveEncounterContext} from '../src/encounter-context.js';
import {MedplumClient} from '@medplum/core';
import {compileEncounters,encounterSummary,type EncounterContext} from '../src/encounters.js';
import scenarios from '../config/encounters/scenarios.json' with {type:'json'};
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
import references from '../config/enrollment/references.json' with {type:'json'};
async function main(){
  const clients:MedplumClient[]=[];
  const login=async(prefix:string)=>{
    const id=process.env[`${prefix}_CLIENT_ID`],secret=process.env[`${prefix}_CLIENT_SECRET`];if(!id||!secret)throw Error('Credentials missing');
    const client=new MedplumClient({baseUrl:expectedBaseUrl});clients.push(client);await client.startClientLogin(id,secret);
    const me=await client.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string}};
    if(me.project?.id!==expectedProjectId)throw Error('Wrong project');return client;
  };
  try{
    const foundation=await login('MEDPLUM'),enrollment=await login('MEDPLUM_ENROLLMENT');
    const context=await resolveEncounterContext(foundation,enrollment);
    const bundle=compileEncounters(context);
    for(const e of bundle.entry!){
      const outcome=await foundation.validateResource(e.resource!);
      if(outcome.issue?.some(i=>['fatal','error'].includes(i.severity)))throw Error('FHIR validation failed');
    }
    console.log(JSON.stringify({...encounterSummary(),validated:bundle.entry!.length,persisted:false}));
  }finally{clients.forEach(c=>c.clear());}
}
main().catch(()=>{console.error('Encounter validation failed; raw payload/errors suppressed. No writes performed.');process.exitCode=1;});
