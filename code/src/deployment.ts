import { ownedTags, mergeSyntheticMeta } from './synthetic-data.js';
import { createHash } from 'node:crypto';
import type { AccessPolicy, Bundle, Resource, Schedule, HealthcareService } from '@medplum/fhirtypes';
import { previewCareDelivery, isDeliveryEligible } from './care-delivery.js';
import { expectedProjectId } from './foundation.js';
import operations from '../config/proposals/care-delivery.operations.json' with { type: 'json' };
import coverage from '../config/proposals/care-delivery.coverage.json' with { type: 'json' };
import { clinicReferences, clinicLifecycle } from './clinic-lifecycle.js';

export type UpdateScope = 'care-delivery' | 'enrollment-display';
export interface ManagedEntry { fullUrl: string; resource: Resource }
export interface PlannedChange {
  fullUrl: string; resourceType: Resource['resourceType']; identifier: string;
  action: 'create' | 'retain' | 'update'; fields: string[];
  id?: string; version?: string; currentDigest?: string;
}
export interface DeploymentPlan {
  schemaVersion: 1; updateScope: UpdateScope; projectId: string; commit: string; asOf: string; createdAt: string;
  configurationDigest: string; changes: PlannedChange[]; digest: string;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export function identifier(resource: Resource): string {
  if (!('identifier' in resource) || !Array.isArray(resource.identifier) || resource.identifier.length!==1) throw new Error('Exactly one managed identifier required');
  const id = resource.identifier[0];
  if (!id?.system || !id.value) throw new Error('Missing managed identifier');
  return `${id.system}|${id.value}`;
}
export const queryFor = (resource: Resource): string => new URLSearchParams({identifier:identifier(resource)}).toString();

export function compileDelivery(asOf: string): ManagedEntry[] {
  const preview = previewCareDelivery(asOf);
  const entries = preview.resources.entry!.map(e=>({fullUrl:e.fullUrl!,resource:e.resource!}));
  const byUrl = new Map(entries.map(e=>[e.fullUrl,e.resource]));
  for (const offering of coverage.offerings) {
    const resource = byUrl.get(offering.service);
    if (resource?.resourceType!=='HealthcareService') throw new Error('Unknown service');
    const service: HealthcareService = resource;
    service.location = [...new Set(offering.delivery.map(d=>d.location))].sort().map(reference=>({reference}));
    service.coverageArea = [...new Set(offering.delivery.flatMap(d=>d.markets))].sort().map(reference=>({reference}));
  }
  for (const session of operations.rotationTemplates) {
    const market = operations.markets.find(m=>m.market===session.market);
    const provider = operations.providers.find(p=>p.roles.some(r=>r.role===session.role));
    const role = provider?.roles.find(r=>r.role===session.role);
    if (!market || !role || !provider || !['mon','tue','wed','thu','fri','sat','sun'].includes(session.day) || !/^\d{2}:\d{2}$/.test(session.start) || !/^\d{2}:\d{2}$/.test(session.end) || session.start>=session.end) throw new Error('Invalid rotation');
    if(!Number.isInteger(session.durationMinutes)||session.durationMinutes<=0||Number(session.start.slice(0,2))>23||Number(session.end.slice(0,2))>23||Number(session.start.slice(3))>59||Number(session.end.slice(3))>59) throw new Error('Invalid session time/duration');
    new Intl.DateTimeFormat('en-US',{timeZone:session.timezone});
    // Inactive-site schedules are retained but disabled. Other scope mismatches always fail.
    const scopeTime = clinicLifecycle.clinics.find(c=>c.location===session.location)?.events.find(e=>e.state==='active')?.effectiveAt ?? asOf;
    if (!isDeliveryEligible({...session,visitJurisdiction:market.jurisdiction,mode:session.mode as 'virtual'|'in-clinic'},scopeTime)) throw new Error('Ineligible rotation');
    // Fail closed for same-day cross-timezone sessions: a later scheduler must validate DST-aware overlap.
    const peers=operations.rotationTemplates.filter(s=>s.key!==session.key && s.day===session.day && operations.providers.find(p=>p.roles.some(r=>r.role===s.role))?.practitioner===provider.practitioner);
    if (peers.some(s=>s.timezone!==session.timezone || (s.start<session.end && session.start<s.end))) throw new Error('Overlapping or ambiguous provider rotations');
    const loc=byUrl.get(session.location);
    const schedule: Schedule = {
      resourceType:'Schedule',identifier:[{system:'urn:helix:staging:care-delivery',value:`schedule-${session.key}`}],
      active:loc?.resourceType==='Location' && loc.status==='active',
      actor:[{reference:session.role},{reference:session.location}],comment:`Synthetic rotation: ${session.key}`,
      serviceType:[{text:(byUrl.get(role.service) as HealthcareService).name ?? 'Synthetic service',extension:[{url:'https://medplum.com/fhir/service-type-reference',valueReference:{reference:role.service}}]}],
      extension:[{url:'https://medplum.com/fhir/StructureDefinition/SchedulingParameters',extension:[
        {url:'service',valueReference:{reference:role.service}}, {url:'timezone',valueCode:session.timezone},
        {url:'duration',valueDuration:{value:session.durationMinutes,unit:'min',system:'http://unitsofmeasure.org',code:'min'}},
        {url:'availability',extension:[{url:'availableTime',extension:[{url:'daysOfWeek',valueCode:session.day},{url:'availableStartTime',valueTime:`${session.start}:00`},{url:'availableEndTime',valueTime:`${session.end}:00`}]}]},
      ]}],
    };
    // The role UUID namespace is stable; Schedule identity derives deterministically from the stable role + template key.
    const hex=digest(`schedule:${session.key}`).slice(0,32);
    const fullUrl=`urn:uuid:${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
    entries.push({fullUrl,resource:schedule});
  }
  const urls=new Set(entries.map(e=>e.fullUrl));
  if(urls.size!==entries.length || new Set(entries.map(e=>`${e.resource.resourceType}|${identifier(e.resource)}`)).size!==entries.length) throw new Error('Duplicate resource identity');
  function check(value:unknown):void {
    if(Array.isArray(value)) return value.forEach(check);
    if(value && typeof value==='object') {
      const o=value as Record<string,unknown>;
      if(typeof o.reference==='string' && !urls.has(o.reference)) throw new Error('Unresolved reference');
      Object.values(o).forEach(check);
    }
  }
  entries.forEach(e=>check(e.resource));
  return entries;
}
export function updateFields(entry: ManagedEntry, scope:UpdateScope='care-delivery'): string[] {
  if(scope==='enrollment-display') return ['Patient','RelatedPerson'].includes(entry.resource.resourceType)?['name','meta.tag']:[];
  if(entry.resource.resourceType==='HealthcareService') return ['location','coverageArea'];
  if(entry.resource.resourceType==='Location' && clinicReferences.includes(entry.fullUrl)) return ['status'];
  if(entry.resource.resourceType==='Schedule') return ['active'];
  return [];
}
export function generatePolicy(entries: ManagedEntry[]): AccessPolicy {
  const groups=new Map<string,{resourceType:Resource['resourceType'];ids:string[];update:boolean}>();
  for(const entry of entries) {
    const update=updateFields(entry).length>0;
    const key=`${entry.resource.resourceType}:${update}`;
    if(!groups.has(key)) groups.set(key,{resourceType:entry.resource.resourceType,ids:[],update});
    groups.get(key)!.ids.push(identifier(entry.resource));
  }
  return {resourceType:'AccessPolicy',name:'Helix Staging Foundation Provisioning',resource:[...groups.values()].map(g=>({resourceType:g.resourceType,interaction:g.update?['read','search','create','update']:['read','search','create'],criteria:`${g.resourceType}?identifier=${g.ids.sort().join(',')}`}))};
}
export function assertPolicy(expected: AccessPolicy, actual: AccessPolicy): void {
  const readInteractions=['read','search','vread','history'];
  const filtered=actual.resource?.filter(r=>!(
    ['SearchParameter','StructureDefinition'].includes(r.resourceType) &&
    (r.readonly===true || !!r.interaction?.length) &&
    (!r.interaction || r.interaction.every(i=>readInteractions.includes(i)))
  ));
  const norm=(rules:AccessPolicy['resource'])=>rules?.map(r=>({resourceType:r.resourceType,criteria:r.criteria,interaction:[...(r.interaction??[])].sort()})).sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  if(canonical(norm(expected.resource))!==canonical(norm(filtered))) throw new Error('Effective policy differs from generated scoped policy; owner policy review required');
}
function rewrite<T>(value:T, references:Map<string,string>):T {
  if(Array.isArray(value)) return value.map(v=>rewrite(v,references)) as T;
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='reference' && typeof v==='string' ? references.get(v)??v : rewrite(v,references)])) as T;
  return value;
}
export function buildPlan(entries:ManagedEntry[], current:Map<string,Resource>, commit:string, asOf:string, now=new Date().toISOString(), updateScope:UpdateScope='care-delivery'):DeploymentPlan {
  const refs=new Map([...current].map(([url,r])=>[url,`${r.resourceType}/${r.id}`]));
  const changes:PlannedChange[]=entries.map(entry=>{
    const existing=current.get(entry.fullUrl);
    const desired=rewrite(entry.resource,refs);
    const fields=existing?Object.keys(desired).filter(k=>!(updateScope==='enrollment-display'&&k==='meta')).filter(k=>canonical((desired as unknown as Record<string,unknown>)[k])!==canonical((existing as unknown as Record<string,unknown>)[k])):[];
    if(existing && updateScope==='enrollment-display' && canonical(ownedTags(desired.meta))!==canonical(ownedTags(existing.meta)))fields.push('meta.tag');
    const allowed=updateFields(entry,updateScope);
    if(fields.some(f=>!allowed.includes(f))) throw new Error(`Unmanaged drift on ${entry.resource.resourceType}: ${fields.join(',')}`);
    if(existing && (!existing.id || !existing.meta?.versionId)) throw new Error('Versioned current resource required');
    if(existing && entry.resource.resourceType==='Location' && fields.includes('status') && entry.resource.status!=='active') throw new Error('Clinic suspension/closure needs a live dependency audit; not enabled in this deployment');
    return {fullUrl:entry.fullUrl,resourceType:entry.resource.resourceType,identifier:identifier(entry.resource),action:!existing?'create':fields.length?'update':'retain',fields,...(existing?{id:existing.id!,version:existing.meta!.versionId!,currentDigest:digest(existing)}:{})};
  });
  const data={schemaVersion:1 as const,updateScope,projectId:expectedProjectId,commit,asOf,createdAt:now,configurationDigest:digest({entries,operations,coverage,clinicLifecycle}),changes};
  return {...data,digest:digest(data)};
}
export function assertReviewedPlan(saved:DeploymentPlan, fresh:DeploymentPlan, commit:string,now=Date.now()):void {
  const {digest:hash,...data}=saved;
  if(digest(data)!==hash || saved.projectId!==expectedProjectId || saved.commit!==commit || fresh.commit!==commit || saved.schemaVersion!==1) throw new Error('Reviewed plan integrity/project/commit mismatch');
  const age=now-Date.parse(saved.createdAt);
  const snapshotAge=now-Date.parse(saved.asOf);
  if(!Number.isFinite(snapshotAge)||snapshotAge<0||snapshotAge>24*60*60*1000) throw new Error('Plan expired or snapshot is future-dated; replan');
  if(!Number.isFinite(age)||age<0||age>24*60*60*1000) throw new Error('Plan expired; create and review a new plan');
  if(saved.updateScope!==fresh.updateScope || saved.configurationDigest!==fresh.configurationDigest || canonical(saved.changes)!==canonical(fresh.changes) || saved.asOf!==fresh.asOf) throw new Error('Configuration or server state changed since reviewed plan');
  // A future lifecycle transition requires replanning rather than applying an outdated status snapshot.
  if(clinicLifecycle.clinics.some(c=>c.events.some(e=>Date.parse(e.effectiveAt)>Date.parse(saved.asOf)&&Date.parse(e.effectiveAt)<=now))) throw new Error('Lifecycle boundary crossed; replan');
}
export function transactionFor(entries:ManagedEntry[],current:Map<string,Resource>,plan:DeploymentPlan):Bundle {
  const refs=new Map([...current].map(([url,r])=>[url,`${r.resourceType}/${r.id}`]));
  const byUrl=new Map(entries.map(e=>[e.fullUrl,e]));
  return {resourceType:'Bundle',type:'transaction',entry:plan.changes.filter(c=>c.action!=='retain').map(change=>{
    const entry=byUrl.get(change.fullUrl)!;
    if(change.action==='create') return {fullUrl:entry.fullUrl,resource:rewrite(entry.resource,refs),request:{method:'POST' as const,url:entry.resource.resourceType,ifNoneExist:queryFor(entry.resource)}};
    const resource=structuredClone(current.get(change.fullUrl)!) as Resource;
    const target=resource as unknown as Record<string,unknown>;
    const desired=rewrite(entry.resource,refs) as unknown as Record<string,unknown>;
    for(const field of change.fields){
      if(!updateFields(entry,plan.updateScope).includes(field))throw new Error('Field outside reviewed update scope');
      if(field==='meta.tag')resource.meta=mergeSyntheticMeta(resource.meta,entry.resource.meta);
      else target[field]=desired[field];
    }
    return {fullUrl:entry.fullUrl,resource,request:{method:'PUT' as const,url:`${resource.resourceType}/${resource.id}`,ifMatch:`W/"${change.version}"`}};
  })};
}
