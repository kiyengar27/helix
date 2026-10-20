import {MedplumClient} from '@medplum/core';
import type {EncounterContext} from './encounters.js';
import scenarios from '../config/encounters/scenarios.json' with {type:'json'};
import references from '../config/enrollment/references.json' with {type:'json'};
export async function resolveEncounterContext(foundation:MedplumClient,enrollment:MedplumClient):Promise<EncounterContext>{
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
    return context;
}
