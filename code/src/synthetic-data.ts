import type { Coding, Meta } from '@medplum/fhirtypes';
/** Project-defined administrative classification, not clinical terminology or an access grant. */
export const syntheticTagSystem='urn:helix:data-classification';
export const syntheticTag: Coding={system:syntheticTagSystem,code:'synthetic',display:'Synthetic test data'};
export const syntheticMeta = (): Meta => ({tag:[{...syntheticTag}]});
/** Only the Helix classification namespace is managed; retain all other tags and metadata. */
export function ownedTags(meta:Meta|undefined):Coding[]{return (meta?.tag??[]).filter(t=>t.system===syntheticTagSystem);}
export function mergeSyntheticMeta(current:Meta|undefined,desired:Meta|undefined):Meta {
  return {...structuredClone(current??{}),tag:[...(current?.tag??[]).filter(t=>t.system!==syntheticTagSystem),...ownedTags(desired)]};
}
