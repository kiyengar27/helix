import type {AccessPolicy} from '@medplum/fhirtypes';
import {compileEnrollmentFixtures,type EnrollmentReferences} from './enrollment-fixtures.js';
import configuration from '../config/enrollment/acceptance.json' with {type:'json'};
export function acceptancePolicies(context:EnrollmentReferences):{runtime:AccessPolicy;clinical:AccessPolicy}{
  const fixtures=compileEnrollmentFixtures(context).filter(e=>e.resource.identifier?.[0].value===configuration.managedCase);
  if(fixtures.length!==2)throw Error('Acceptance requires exactly one patient and relationship');
  const rules=(write:boolean)=>fixtures.map(({resource})=>({resourceType:resource.resourceType,interaction:write?['read','search','update'] as const:['read','search'] as const,criteria:`${resource.resourceType}?identifier=${resource.identifier![0].system}|${resource.identifier![0].value}`}));
  return {
    runtime:{resourceType:'AccessPolicy',name:'Helix Staging Enrollment Runtime',resource:[
      ...rules(true).map(r=>({...r,interaction:[...r.interaction]})),
      {resourceType:'Organization',interaction:['read','search'],criteria:`Organization?_id=${context.organization.split('/')[1]}`},
      {resourceType:'PractitionerRole',interaction:['read','search'],criteria:`PractitionerRole?_id=${context.pcpRole.split('/')[1]}`},
    ]},
    clinical:{resourceType:'AccessPolicy',name:'Helix Staging Clinical Acceptance Reader',resource:rules(false).map(r=>({...r,interaction:[...r.interaction]}))},
  };
}
