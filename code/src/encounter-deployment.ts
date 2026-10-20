import type {AccessPolicy,Encounter,Resource,Expression} from '@medplum/fhirtypes';
import scenarios from '../config/encounters/scenarios.json' with {type:'json'};
import {compileEncounters,encounterIdentifierSystem,type EncounterContext} from './encounters.js';
import {canonical,identifier,type ManagedEntry} from './deployment.js';
import {ownedTags} from './synthetic-data.js';
export function encounterEntries(context:EncounterContext):ManagedEntry[]{return compileEncounters(context).entry!.map(e=>({fullUrl:e.fullUrl!,resource:e.resource!}));}
export function encounterPolicy(context:EncounterContext):AccessPolicy {
  const rules:NonNullable<AccessPolicy['resource']>=[];
  for(const type of ['Encounter','MedicationRequest','Task'] as const){
    const entries=encounterEntries(context).filter(e=>e.resource.resourceType===type);
    const constraint:Expression[]=type==='Encounter'?[
      {language:'text/fhirpath',expression:"%before.exists().not() implies status = 'planned'"},
      {language:'text/fhirpath',expression:"%before.exists() implies (status = %before.status or (%before.status = 'planned' and (status = 'in-progress' or status = 'cancelled')) or (%before.status = 'in-progress' and (status = 'finished' or status = 'cancelled')))"},
      {language:'text/fhirpath',expression:'%before.exists() implies subject.reference = %before.subject.reference'},
    ]:[{language:'text/fhirpath',expression:type==='MedicationRequest'?"status = 'draft' and intent = 'proposal'":"status = 'draft' and intent = 'plan'"}];
    rules.push({resourceType:type,interaction:type==='Encounter'?['read','search','create','update','history','vread']:['read','search','create'],criteria:`${type}?identifier=${entries.map(e=>identifier(e.resource)).sort().join(',')}`,writeConstraint:constraint});
  }
  for(const [type,refs] of [['Patient',Object.values(context.patients)],['RelatedPerson',Object.values(context.relatedPeople)],['PractitionerRole',Object.values(context.roles)],['Location',Object.values(context.locations)],['Organization',[context.organization]]] as const){
    rules.push({resourceType:type,interaction:['read','search'],criteria:`${type}?_id=${[...new Set(refs.map(r=>r.split('/')[1]))].sort().join(',')}`});
  }
  return {resourceType:'AccessPolicy',name:'Helix Staging Encounter Service',resource:rules};
}
/** Bootstrap retains valid runtime visit states; never resets an existing visit to planned. */
export function bootstrapEntries(context:EncounterContext,current:Map<string,Resource>):ManagedEntry[]{
  return encounterEntries(context).map(e=>{
    const existing=current.get(e.fullUrl);if(!existing)return e;
    if(canonical(ownedTags(existing.meta))!==canonical(ownedTags(e.resource.meta)))throw Error('Synthetic tag drift');
    const resource=structuredClone(e.resource);resource.meta=structuredClone(existing.meta);
    if(resource.resourceType==='Encounter'){
      if(existing.resourceType!=='Encounter'||!['planned','in-progress','finished','cancelled'].includes(existing.status))throw Error('Unexpected visit state');
      resource.status=existing.status;
    }
    return {...e,resource};
  });
}
export function flowVisits(context:EncounterContext,current:Map<string,Resource>):Encounter[]{
  return encounterEntries(context).filter(e=>e.resource.resourceType==='Encounter').map(e=>{
    const r=current.get(e.fullUrl);if(r?.resourceType!=='Encounter'||r.status!=='planned'||!r.id||!r.meta?.versionId)throw Error('Flow requires two planned versioned visits; no reset or replay');
    return r;
  });
}
