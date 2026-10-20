import type {Bundle,Encounter,MedicationRequest,Task} from '@medplum/fhirtypes';
import scenarios from '../config/encounters/scenarios.json' with {type:'json'};
import foundation from '../config/foundation.json' with {type:'json'};
import delivery from '../config/proposals/care-delivery.resources.json' with {type:'json'};
import {isDeliveryEligible,type DeliveryRequest} from './care-delivery.js';
import {syntheticMeta} from './synthetic-data.js';
export const encounterIdentifierSystem='urn:helix:staging:encounter-intent';
export type EncounterResource=Encounter|MedicationRequest|Task;
export interface EncounterContext {
  organization:string;
  /** Keys are existing declarative identifiers, values are verified server references. */
  patients:Record<string,string>;relatedPeople:Record<string,string>;
  roles:Record<string,string>;locations:Record<string,string>;
}
function reference(value:string|undefined,type:string):string {
  if(!value||!new RegExp(`^${type}/[A-Za-z0-9.-]+$`).test(value))throw Error('Verified encounter reference required');return value;
}
function configuredReference(key:string):string {
  const resource=[...foundation.entry,...delivery.entry].find(e=>e.resource.identifier?.some(i=>i.value===key));
  if(!resource)throw Error('Unknown delivery identifier');return resource.fullUrl;
}
export function encounterDelivery(key:string):DeliveryRequest {
  const c=scenarios.cases.find(c=>c.key===key);if(!c)throw Error('Unknown encounter scenario');
  if(c.mode!=='in-clinic'&&c.mode!=='virtual')throw Error('Unsupported visit mode');
  return {role:configuredReference(c.role),market:configuredReference(c.market),location:configuredReference(c.location),mode:c.mode,visitJurisdiction:c.visitJurisdiction};
}
/** Initial slice creates only planned visits and non-transmittable medication proposals. */
export function compileEncounters(context:EncounterContext):Bundle {
  reference(context.organization,'Organization');
  const entry:NonNullable<Bundle['entry']>=[];
  for(const c of scenarios.cases){
    if(!isDeliveryEligible(encounterDelivery(c.key),scenarios.authoredAt))throw Error('Ineligible encounter assignment');
    const patient=reference(context.patients[c.patientCase],'Patient');
    const role=reference(context.roles[c.role],'PractitionerRole');
    const location=reference(context.locations[c.location],'Location');
    const related=c.relatedPersonCase?reference(context.relatedPeople[c.relatedPersonCase],'RelatedPerson'):undefined;
    const identifier=(kind:string)=>[{system:encounterIdentifierSystem,value:`${c.key}-${kind}`}];
    const encounter:Encounter={resourceType:'Encounter',identifier:identifier('encounter'),meta:syntheticMeta(),status:'planned',class:scenarios.encounterClass,
      subject:{reference:patient},serviceProvider:{reference:context.organization},
      participant:[{individual:{reference:role}},...(related?[{individual:{reference:related}}]:[])],
      location:[{location:{reference:location}}],reasonCode:[{text:c.reason}],
    };
    const medication:MedicationRequest={resourceType:'MedicationRequest',identifier:identifier('medication-request'),meta:syntheticMeta(),
      status:'draft',intent:'proposal',subject:{reference:patient},encounter:{reference:c.fullUrls.encounter},requester:{reference:role},
      authoredOn:scenarios.authoredAt,medicationCodeableConcept:{text:c.medication},
      note:[{text:'Synthetic draft only. Clinical assessment, product selection, regimen, authorization and external transmission are not complete.'}],
    };
    const task:Task={resourceType:'Task',identifier:identifier('task'),meta:syntheticMeta(),status:'draft',intent:'plan',
      for:{reference:patient},encounter:{reference:c.fullUrls.encounter},focus:{reference:c.fullUrls.medicationRequest},requester:{reference:role},owner:{reference:role},
      authoredOn:scenarios.authoredAt,description:c.followUp,
    };
    for(const [fullUrl,resource] of [[c.fullUrls.encounter,encounter],[c.fullUrls.medicationRequest,medication],[c.fullUrls.task,task]] as const){
      const id=resource.identifier![0];
      entry.push({fullUrl,resource,request:{method:'POST',url:resource.resourceType,ifNoneExist:new URLSearchParams({identifier:`${id.system}|${id.value}`}).toString()}});
    }
  }
  if(new Set(entry.map(e=>e.fullUrl)).size!==entry.length)throw Error('Duplicate encounter identity');
  return {resourceType:'Bundle',type:'transaction',entry};
}
export function transitionEncounter(encounter:Encounter,next:Encounter['status']):Encounter {
  const allowed:Partial<Record<Encounter['status'],Encounter['status'][]>>={planned:['in-progress','cancelled'],'in-progress':['finished','cancelled']};
  if(!allowed[encounter.status]?.includes(next))throw Error('Invalid encounter transition');
  return {...structuredClone(encounter),status:next};
}
/** Never promotes a proposal to a signed order. That requires a separate reviewed prescribing boundary. */
export function cancelMedicationIntent(request:MedicationRequest):MedicationRequest {
  if(request.status!=='draft'||request.intent!=='proposal')throw Error('Only draft proposals can be cancelled here');
  return {...structuredClone(request),status:'cancelled'};
}
export function encounterSummary(){return {classification:scenarios.classification,scenarios:scenarios.cases.length,encounters:scenarios.cases.length,medicationProposals:scenarios.cases.length,followUpTasks:scenarios.cases.length,externalTransmission:false,smsEnabled:false};}
