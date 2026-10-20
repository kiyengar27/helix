import type { AccessPolicy, Patient, RelatedPerson } from '@medplum/fhirtypes';
import scenarios from '../config/enrollment/scenarios.json' with { type: 'json' };
import { ageBand, ageOn, relationshipDraft } from './enrollment.js';

export interface EnrollmentReferences { organization: string; pcpRole: string }
export interface EnrollmentFixture { fullUrl: string; resource: Patient | RelatedPerson }
export const patientIdentifierSystem='urn:helix:staging:synthetic-patient';

function reference(value:string,type:string):void {
  if(!new RegExp(`^${type}/[A-Za-z0-9.-]+$`).test(value))throw new Error('Resolve deployed context references before creating fixtures');
}
/** Deterministic synthetic payloads. Caller must keep raw results out of public logs/artifacts. */
export function compileEnrollmentFixtures(context:EnrollmentReferences):EnrollmentFixture[] {
  reference(context.organization,'Organization');reference(context.pcpRole,'PractitionerRole');
  const fixtures:EnrollmentFixture[]=[];
  const [year]=scenarios.referenceDate.split('-').map(Number);
  for(const scenario of scenarios.cases){
    if(!Number.isInteger(scenario.ageAtBaseline)||scenario.ageAtBaseline<0||!['CA','TX'].includes(scenario.residenceState))throw new Error('Invalid synthetic scenario');
    const birthDate=`${year-scenario.ageAtBaseline}${scenarios.referenceDate.slice(4)}`;
    if(ageOn(birthDate,scenarios.referenceDate)!==scenario.ageAtBaseline)throw new Error('Unstable age fixture');
    const patient:Patient={
      resourceType:'Patient',identifier:[{system:patientIdentifierSystem,value:scenario.key}],active:true,
      name:[{family:'HelixSynthetic',given:[scenario.key]}],birthDate,
      address:[{state:scenario.residenceState,country:'US'}],managingOrganization:{reference:context.organization},
      ...(scenario.assignPcp?{generalPractitioner:[{reference:context.pcpRole}]}:{}),
    };
    fixtures.push({fullUrl:scenario.patientFullUrl,resource:patient});
    if(scenario.relationship){
      const relationship=relationshipDraft(scenario.patientFullUrl,scenario.key,scenario.relationship as 'caregiver'|'parent'|'guardian');
      relationship.name=[{family:'HelixSynthetic',given:[`${scenario.relationship}-${scenario.key}`]}];
      if(!scenario.relationshipFullUrl)throw new Error('Missing relationship fullUrl');
      fixtures.push({fullUrl:scenario.relationshipFullUrl,resource:relationship});
    }
  }
  if(new Set(fixtures.map(f=>f.fullUrl)).size!==fixtures.length)throw new Error('Duplicate scenario fullUrl');
  return fixtures;
}
/** An explicit separate bootstrap policy; never attached automatically or added to the foundation scope. */
export function enrollmentServicePolicy(context:EnrollmentReferences):AccessPolicy {
  const fixtures=compileEnrollmentFixtures(context);
  const identifiers=(type:'Patient'|'RelatedPerson')=>fixtures.filter(f=>f.resource.resourceType===type).map(f=>{
    const id=f.resource.identifier![0];return `${id.system}|${id.value}`;
  }).sort().join(',');
  return {resourceType:'AccessPolicy',name:'Helix Staging Enrollment Service',resource:[
    {resourceType:'Organization',interaction:['read','search'],criteria:`Organization?_id=${context.organization.split('/')[1]}`},
    {resourceType:'PractitionerRole',interaction:['read','search'],criteria:`PractitionerRole?_id=${context.pcpRole.split('/')[1]}`},
    {resourceType:'Patient',interaction:['read','search','create'],criteria:`Patient?identifier=${identifiers('Patient')}`},
    {resourceType:'RelatedPerson',interaction:['read','search','create'],criteria:`RelatedPerson?identifier=${identifiers('RelatedPerson')}`},
  ]};
}
export function enrollmentSummary(){
  const bands:Record<string,number>={};
  const year=Number(scenarios.referenceDate.slice(0,4));
  for(const scenario of scenarios.cases){const band=ageBand(`${year-scenario.ageAtBaseline}${scenarios.referenceDate.slice(4)}`,scenarios.referenceDate);bands[band]=(bands[band]??0)+1;}
  return {classification:scenarios.classification,patients:scenarios.cases.length,relationships:scenarios.cases.filter(c=>c.relationship).length,ageBands:bands,proxyAccountsCreated:0,proxyGrantsCreated:0,patientMarketField:false};
}
