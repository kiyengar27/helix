import {MedplumClient} from '@medplum/core';
import type {Bundle} from '@medplum/fhirtypes';
import type {EnrollmentStore} from './enrollment-service.js';
/** Trusted backend adapter. Never expose its client credentials to staff or proxies. */
export function medplumEnrollmentStore(client:MedplumClient,grant:EnrollmentStore['grant']):EnrollmentStore {
  const id=(reference:string,type:string)=>{if(!new RegExp(`^${type}/[A-Za-z0-9.-]+$`).test(reference))throw Error('Invalid reference');return reference.split('/')[1];};
  return {
    patient:reference=>client.readResource('Patient',id(reference,'Patient'),{cache:'no-store'}),
    relationship:reference=>client.readResource('RelatedPerson',id(reference,'RelatedPerson'),{cache:'no-store'}),
    grant,
    transaction:async(bundle:Bundle)=>{
      const result=await client.executeBatch(bundle);
      if(result.type!=='transaction-response'||result.entry?.length!==bundle.entry?.length||result.entry?.some(e=>!e.response?.status?.startsWith('2')))throw Error('Enrollment transaction failed');
    },
  };
}
