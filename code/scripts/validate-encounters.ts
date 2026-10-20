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
    const context:EncounterContext={organization:references.organization,patients:{},relatedPeople:{},roles:{},locations:{}};
    const resolve=async(client:MedplumClient,type:'Patient'|'RelatedPerson'|'PractitionerRole'|'Location',system:string,value:string)=>{
      const found=await client.searchResources(type,{identifier:`${system}|${value}`,_count:'2'},{cache:'no-store'});
      if(found.length!==1)throw Error('Missing/duplicate context');return found[0];
    };
    for(const c of scenarios.cases){
      const patient=await resolve(enrollment,'Patient','urn:helix:staging:synthetic-patient',c.patientCase);
      if(patient.resourceType!=='Patient'||patient.managingOrganization?.reference!==context.organization)throw Error('Wrong practice');
      context.patients[c.patientCase]=`Patient/${patient.id}`;
      if(c.relatedPersonCase){
        const r=await resolve(enrollment,'RelatedPerson','urn:helix:staging:related-person',c.relatedPersonCase);
        if(r.resourceType!=='RelatedPerson'||r.patient.reference!==context.patients[c.patientCase]||r.active!==true)throw Error('Inactive/mismatched caregiver');
        context.relatedPeople[c.relatedPersonCase]=`RelatedPerson/${r.id}`;
      }
      context.roles[c.role]=`PractitionerRole/${(await resolve(foundation,'PractitionerRole','urn:helix:staging:care-delivery',c.role)).id}`;
      context.locations[c.location]=`Location/${(await resolve(foundation,'Location','urn:helix:staging:care-delivery',c.location)).id}`;
    }
    const bundle=compileEncounters(context);
    for(const e of bundle.entry!){
      const outcome=await foundation.validateResource(e.resource!);
      if(outcome.issue?.some(i=>['fatal','error'].includes(i.severity)))throw Error('FHIR validation failed');
    }
    console.log(JSON.stringify({...encounterSummary(),validated:bundle.entry!.length,persisted:false}));
  }finally{clients.forEach(c=>c.clear());}
}
main().catch(()=>{console.error('Encounter validation failed; raw payload/errors suppressed. No writes performed.');process.exitCode=1;});
