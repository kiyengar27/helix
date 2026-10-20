import type { RelatedPerson } from '@medplum/fhirtypes';
import contract from '../config/enrollment/contract.json' with { type: 'json' };

export function ageOn(birthDate:string,referenceDate:string):number {
  function date(value:string){
    if(!/^\d{4}-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Complete valid birth/reference date required');
    return value.split('-').map(Number);
  }
  const [year,month,day]=date(birthDate),[refYear,refMonth,refDay]=date(referenceDate);
  const age=refYear-year-Number(refMonth<month||(refMonth===month&&refDay<day));
  if(birthDate>referenceDate)throw new Error('Future birth date');
  return age;
}
export function ageBand(birthDate:string,referenceDate:string):string {
  const age=ageOn(birthDate,referenceDate);
  return contract.ageBands.find(b=>age>=b.minimum&&(b.maximumExclusive===null||age<b.maximumExclusive))!.key;
}
export function relationshipDraft(patientReference:string,identifierValue:string,relationship:'caregiver'|'parent'|'guardian'):RelatedPerson {
  if(!/^(Patient\/[A-Za-z0-9.-]+|urn:uuid:[0-9a-f-]{36})$/.test(patientReference)||!identifierValue.trim()||!contract.relationships.includes(relationship))throw new Error('Valid relationship identity and patient reference required');
  return {resourceType:'RelatedPerson',identifier:[{system:'urn:helix:staging:related-person',value:identifierValue}],active:true,patient:{reference:patientReference},relationship:[{text:relationship}]};
}
/** A relationship exists; authorization does not. Return review requirements rather than a grant. */
export function proxyAssessment(patientReference:string,birthDate:string,relationship:RelatedPerson,referenceDate:string) {
  if(relationship.patient.reference!==patientReference)throw new Error('Relationship belongs to another patient');
  const band=ageBand(birthDate,referenceDate);
  return {ageBand:band,accessGranted:false as const,relationshipActive:relationship.active===true,
    reviewRequired:band==='adult'?'adult-authorization-or-representative-authority':'guardian-authority-and-minor-privacy-review',
    identityVerificationRequired:true,capacityInferredFromAge:false,
    policyEnforced:false,notes:'No authentication, consent, or resource permission is enabled by this assessment.'};
}
