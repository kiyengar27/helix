import type {Address, HumanName, Patient, Reference, RelatedPerson, PractitionerRole, Bundle} from '@medplum/fhirtypes';
import {ageBand} from './enrollment.js';

/** Supplied by a trusted authentication adapter, never by request JSON. */
export interface Principal {id:string;role:'registration'|'clinical'|'proxy';patients:readonly string[]}
export interface ProxyGrant {
  id:string;principalId:string;patient:string;relationship:string;
  identityEvidence:string;authorityEvidence:string;reviewer:string;
  reviewedBirthDate:string;reviewedAgeBand:string;validFrom:string;validUntil:string;
  actions:readonly ['read-demographics'];revokedAt?:string;
}
export interface EnrollmentStore {
  patient(reference:string):Promise<Patient>;
  relationship(reference:string):Promise<RelatedPerson>;
  /** Must read current durable state on every request. */
  grant(principalId:string,patient:string):Promise<ProxyGrant|undefined>;
  /** Atomic version-checked transaction; no blind writes. */
  transaction(bundle:Bundle):Promise<void>;
}
function denied():never {throw Error('Enrollment access denied');}
function timestamp(value:string):number {const n=Date.parse(value);if(!Number.isFinite(n))denied();return n;}
function patientRef(value:string):void {if(!/^Patient\/[A-Za-z0-9.-]+$/.test(value))denied();}
function staff(principal:Principal,patient:string,write=false):void {
  patientRef(patient);
  if(!principal.id||!principal.patients.includes(patient)||!['registration','clinical'].includes(principal.role)||(write&&principal.role!=='registration'))denied();
}
export function reviewGrant(input:Omit<ProxyGrant,'reviewedBirthDate'|'reviewedAgeBand'>,patient:Patient,relationship:RelatedPerson,now:string):ProxyGrant {
  if(!patient.id||!patient.birthDate||input.patient!==`Patient/${patient.id}`||input.relationship!==`RelatedPerson/${relationship.id}`||relationship.patient.reference!==input.patient||relationship.active!==true)denied();
  if(!input.id||!input.principalId||!input.identityEvidence.trim()||!input.authorityEvidence.trim()||!input.reviewer.trim()||input.revokedAt||input.actions.length!==1||input.actions[0]!=='read-demographics')denied();
  const instant=timestamp(now),from=timestamp(input.validFrom),until=timestamp(input.validUntil);
  if(from>instant||until<=instant||until<=from)denied();
  return {...structuredClone(input),reviewedBirthDate:patient.birthDate,reviewedAgeBand:ageBand(patient.birthDate,now.slice(0,10))};
}
export function revokeGrant(grant:ProxyGrant,now:string):ProxyGrant {
  timestamp(now);return {...structuredClone(grant),revokedAt:grant.revokedAt??now};
}
/** Only demographic projection is available to proxies; no clinical record API. */
export class EnrollmentService {
  constructor(private readonly store:EnrollmentStore){}
  async demographics(principal:Principal,reference:string,now:string){
    patientRef(reference);
    if(principal.role!=='proxy')staff(principal,reference);
    else if(!principal.id||!principal.patients.includes(reference))denied();
    const patient=await this.store.patient(reference);
    if(`Patient/${patient.id}`!==reference)denied();
    if(principal.role==='proxy'){
      const grant=await this.store.grant(principal.id,reference);
      if(!grant||grant.principalId!==principal.id||grant.patient!==reference||grant.revokedAt||!grant.identityEvidence||!grant.authorityEvidence||!grant.reviewer||grant.actions.length!==1||grant.actions[0]!=='read-demographics')denied();
      const instant=timestamp(now);
      if(instant<timestamp(grant.validFrom)||instant>=timestamp(grant.validUntil)||!patient.birthDate||grant.reviewedBirthDate!==patient.birthDate||grant.reviewedAgeBand!==ageBand(patient.birthDate,now.slice(0,10)))denied();
      const relationship=await this.store.relationship(grant.relationship);
      if(`RelatedPerson/${relationship.id}`!==grant.relationship||relationship.patient.reference!==reference||relationship.active!==true)denied();
    }
    return {resourceType:'Patient' as const,id:patient.id,name:structuredClone(patient.name),birthDate:patient.birthDate};
  }
  async update(principal:Principal,reference:string,expectedVersion:string,change:{name?:HumanName[];address?:Address[];pcp?:Reference<PractitionerRole>|null}){
    staff(principal,reference,true);
    if(!expectedVersion||Object.keys(change).some(k=>!['name','address','pcp'].includes(k)))denied();
    const patient=await this.store.patient(reference);
    if(`Patient/${patient.id}`!==reference||patient.meta?.versionId!==expectedVersion)throw Error('Stale enrollment version');
    const next=structuredClone(patient);
    if(change.name!==undefined)next.name=structuredClone(change.name);
    if(change.address!==undefined)next.address=structuredClone(change.address);
    if(change.pcp!==undefined){
      if(change.pcp===null)delete next.generalPractitioner;
      else {if(!/^PractitionerRole\/[A-Za-z0-9.-]+$/.test(change.pcp.reference??''))denied();next.generalPractitioner=[structuredClone(change.pcp)];}
    }
    await this.store.transaction({resourceType:'Bundle',type:'transaction',entry:[{resource:next,request:{method:'PUT',url:reference,ifMatch:`W/"${expectedVersion}"`}}]});
  }
  async endRelationship(principal:Principal,patient:string,reference:string,version:string){
    staff(principal,patient,true);
    if(!/^RelatedPerson\/[A-Za-z0-9.-]+$/.test(reference)||!version)denied();
    const current=await this.store.relationship(reference);
    if(`RelatedPerson/${current.id}`!==reference||current.patient.reference!==patient)denied();
    if(current.meta?.versionId!==version)throw Error('Stale enrollment version');
    await this.store.transaction({resourceType:'Bundle',type:'transaction',entry:[{resource:{...structuredClone(current),active:false},request:{method:'PUT',url:reference,ifMatch:`W/"${version}"`}}]});
  }
}
