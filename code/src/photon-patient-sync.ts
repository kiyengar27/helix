import type {Patient} from '@medplum/fhirtypes';
import {requiredBirthSex} from './patient-demographics.js';
import {canonical,digest} from './deployment.js';
import type {PatientLink,PhotonPatient,PhotonPatientInput} from './photon-client.js';
export interface PatientRemote {list(after:string|undefined,first:number):Promise<PatientLink[]>;read(id:string):Promise<PhotonPatient>;create(input:PhotonPatientInput):Promise<PatientLink>}
export interface SyncReceipt {externalId:string;clientDigest:string;status:'pending'|'verified';photonId?:string}
export interface SyncPlan {version:1;commit:string;project:string;clientDigest:string;configurationDigest:string;sourceDigest:string;payloadDigest:string;receiptDigest:string;externalId:string;createdAt:string;action:'create'|'reuse';photonId?:string;digest:string}
export function mapPatient(patient:Patient,project:string,phone:string):PhotonPatientInput {
  if(!patient.id||!project||patient.active!==true)throw Error('Active stable patient required');
  const names=(patient.name??[]).filter(n=>!n.use||n.use==='official');
  if(names.length!==1||!names[0].given?.[0]?.trim()||!names[0].family?.trim()||names[0].period)throw Error('Review patient name selection');
  if(!/^\d{4}-\d\d-\d\d$/.test(patient.birthDate??'')||!Number.isFinite(Date.parse(patient.birthDate+'T00:00:00Z'))||new Date(patient.birthDate+'T00:00:00Z').toISOString().slice(0,10)!==patient.birthDate)throw Error('Complete birth date required');
  if(patient.birthDate!>new Date().toISOString().slice(0,10))throw Error('Future birth date');
  if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Private E.164 test phone required');
  const code=requiredBirthSex(patient),sex=({M:'MALE',F:'FEMALE',UNK:'UNKNOWN'} as const)[code];
  const [first,...middle]=names[0].given;
  return {externalId:`medplum:${project}:Patient/${patient.id}`,name:{first,last:names[0].family,...(middle.length?{middle:middle.join(' ')}:{})},dateOfBirth:patient.birthDate!,sex,phone};
}
export async function findPatient(remote:PatientRemote,externalId:string,maxPages:number,pageSize:number):Promise<PatientLink|undefined>{
  let after:string|undefined;const cursors=new Set<string>(),ids=new Set<string>();const matches:PatientLink[]=[];
  for(let page=0;page<maxPages;page++){
    const rows=await remote.list(after,pageSize);
    if(rows.length>pageSize)throw Error('Unexpected pagination size');
    for(const row of rows){if(ids.has(row.id))throw Error('Unstable patient pagination');ids.add(row.id);if(row.externalId===externalId)matches.push(row);}
    if(rows.length<pageSize){if(matches.length>1)throw Error('Duplicate Photon external identity');return matches[0];}
    const next=rows.at(-1)?.id;if(!next||cursors.has(next))throw Error('Unstable pagination');cursors.add(next);after=next;
  }
  throw Error('Patient scan incomplete; do not create');
}
export function assertMappedPatient(actual:PhotonPatient,expected:PhotonPatientInput):void {
  const normalized={externalId:actual.externalId,name:{first:actual.name.first,last:actual.name.last,...(actual.name.middle?{middle:actual.name.middle}:{})},dateOfBirth:actual.dateOfBirth,sex:actual.sex,phone:actual.phone};
  if(canonical(normalized)!==canonical(expected))throw Error('Photon mapping differs; no automatic update');
}
export function makeSyncPlan(input:Omit<SyncPlan,'version'|'digest'>):SyncPlan {const data={version:1 as const,...input};return {...data,digest:digest(data)};}
export function assertSyncPlan(saved:SyncPlan,fresh:SyncPlan,now=Date.now(),lifetimeHours=24):void {
  const {digest:hash,...data}=saved;const age=now-Date.parse(saved.createdAt);
  if(hash!==digest(data)||canonical(saved)!==canonical(fresh)||!Number.isFinite(age)||age<0||age>lifetimeHours*3600000)throw Error('Sync plan expired or changed; replan');
}
/** Persist pending BEFORE the single create. All exceptions leave it pending; never retry blindly. */
export async function syncOne(remote:PatientRemote,input:PhotonPatientInput,clientDigest:string,receipt:SyncReceipt|undefined,save:(r:SyncReceipt)=>void,allowCreate=false,maxPages=20,pageSize=50):Promise<{created:boolean;photonId:string}>{
  if(receipt&&(receipt.externalId!==input.externalId||receipt.clientDigest!==clientDigest))throw Error('Receipt belongs to another patient/client');
  const existing=await findPatient(remote,input.externalId,maxPages,pageSize);
  if(existing){
    if(receipt?.photonId&&receipt.photonId!==existing.id)throw Error('Photon link changed');
    assertMappedPatient(await remote.read(existing.id),input);
    save({externalId:input.externalId,clientDigest,status:'verified',photonId:existing.id});return {created:false,photonId:existing.id};
  }
  if(receipt)throw Error('Existing or uncertain link missing remotely; reconcile manually, do not recreate');
  if(!allowCreate)throw Error('Patient creation was not in reviewed plan');
  save({externalId:input.externalId,clientDigest,status:'pending'});
  const created=await remote.create(input);
  save({externalId:input.externalId,clientDigest,status:'pending',photonId:created.id});
  const verified=await findPatient(remote,input.externalId,maxPages,pageSize);
  if(!verified||verified.id!==created.id)throw Error('Create reconciliation failed');
  assertMappedPatient(await remote.read(created.id),input);
  save({externalId:input.externalId,clientDigest,status:'verified',photonId:created.id});return {created:true,photonId:created.id};
}
