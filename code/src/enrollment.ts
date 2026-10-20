import type { Extension, Patient, RelatedPerson } from '@medplum/fhirtypes';
import contract from '../config/enrollment/contract.json' with { type: 'json' };

export interface MarketAssignment { market: string; effectiveFrom: string; effectiveUntil?: string }
export const marketHistoryUrl = contract.marketHistoryExtension;
export function utcInstant(value: string): number {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) throw new Error('A complete UTC timestamp is required');
  const time=Date.parse(value);
  if (!Number.isFinite(time)||new Date(time).toISOString()!==value.replace(/Z$/,value.includes('.')?'Z':'.000Z')) throw new Error('Invalid timestamp');
  return time;
}
export function validateMarketHistory(history:readonly MarketAssignment[],knownMarkets:readonly string[]):void {
  let previousEnd=-Infinity;
  for(let i=0;i<history.length;i++){
    const assignment=history[i];
    if(!knownMarkets.includes(assignment.market))throw new Error('Unknown home market');
    const from=utcInstant(assignment.effectiveFrom);
    const until=assignment.effectiveUntil===undefined?Infinity:utcInstant(assignment.effectiveUntil);
    if(until<=from || from<previousEnd)throw new Error('Home-market assignments overlap or have invalid periods');
    if(until===Infinity && i!==history.length-1)throw new Error('Open assignment must be last');
    previousEnd=until;
  }
}
export function homeMarketAt(history:readonly MarketAssignment[],at:string,knownMarkets:readonly string[]):string|undefined {
  validateMarketHistory(history,knownMarkets);
  const time=utcInstant(at);
  return history.find(a=>utcInstant(a.effectiveFrom)<=time && (a.effectiveUntil===undefined||time<utcInstant(a.effectiveUntil)))?.market;
}
export function marketHistoryExtension(history:readonly MarketAssignment[],knownMarkets:readonly string[]):Extension {
  validateMarketHistory(history,knownMarkets);
  return {url:marketHistoryUrl,extension:history.map(assignment=>({url:'assignment',extension:[
    {url:'market',valueReference:{reference:assignment.market}},
    {url:'effectiveFrom',valueInstant:assignment.effectiveFrom},
    ...(assignment.effectiveUntil===undefined?[]:[{url:'effectiveUntil',valueInstant:assignment.effectiveUntil}]),
  ]}))};
}
export function readMarketHistory(patient:Patient,knownMarkets:readonly string[]):MarketAssignment[] {
  const wrappers=patient.extension?.filter(e=>e.url===marketHistoryUrl)??[];
  if(wrappers.length>1)throw new Error('Multiple market-history wrappers');
  if(!wrappers.length)return [];
  const history=(wrappers[0].extension??[]).map(assignment=>{
    if(assignment.url!=='assignment' || !assignment.extension)throw new Error('Invalid market history extension');
    const fields=assignment.extension;
    if(fields.some(f=>!['market','effectiveFrom','effectiveUntil'].includes(f.url))||fields.length!==new Set(fields.map(f=>f.url)).size)throw new Error('Unsupported or duplicate market-history field');
    const market=fields.find(f=>f.url==='market')?.valueReference?.reference;
    const effectiveFrom=fields.find(f=>f.url==='effectiveFrom')?.valueInstant;
    const effectiveUntil=fields.find(f=>f.url==='effectiveUntil')?.valueInstant;
    if(!market||!effectiveFrom)throw new Error('Incomplete market history');
    return {market,effectiveFrom,...(effectiveUntil===undefined?{}:{effectiveUntil})};
  });
  validateMarketHistory(history,knownMarkets);
  return history;
}
/** Pure transform; callers must persist with authorization, validation and optimistic concurrency. */
export function assignHomeMarket(patient:Patient,market:string,effectiveFrom:string,knownMarkets:readonly string[]):Patient {
  const history=readMarketHistory(patient,knownMarkets);
  const from=utcInstant(effectiveFrom);
  const current=history.at(-1);
  if(current && current.market===market && current.effectiveUntil===undefined && current.effectiveFrom===effectiveFrom)return structuredClone(patient);
  if(current && (from<=utcInstant(current.effectiveFrom) || (current.effectiveUntil!==undefined && from<utcInstant(current.effectiveUntil))))throw new Error('Retroactive or conflicting assignment requires a correction workflow');
  if(current && current.effectiveUntil===undefined)current.effectiveUntil=effectiveFrom;
  history.push({market,effectiveFrom});
  const extension=marketHistoryExtension(history,knownMarkets);
  return {...structuredClone(patient),extension:[...(patient.extension??[]).filter(e=>e.url!==marketHistoryUrl),extension]};
}
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
