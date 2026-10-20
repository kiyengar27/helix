import {writeFileSync} from 'node:fs';
import {MedplumClient} from '@medplum/core';
import {compileEnrollmentFixtures,enrollmentServicePolicy,enrollmentSummary} from '../src/enrollment-fixtures.js';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';

async function main(){
  const id=process.env.MEDPLUM_CLIENT_ID,secret=process.env.MEDPLUM_CLIENT_SECRET;
  if(!id||!secret)throw new Error('Foundation reference-read credentials required');
  const m=new MedplumClient({baseUrl:expectedBaseUrl});
  try{
    await m.startClientLogin(id,secret);
    const me=await m.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string}};
    if(me.project?.id!==expectedProjectId)throw new Error('Wrong target project');
    const org=await m.searchResources('Organization','identifier=urn:helix:staging:foundation|helix-medical-group&_count=2',{cache:'no-store'});
    const role=await m.searchResources('PractitionerRole','identifier=urn:helix:staging:care-delivery|role-alex-morgan-primary-care&_count=2',{cache:'no-store'});
    if(org.length!==1||role.length!==1)throw new Error('Expected unique deployed context');
    const context={organization:`Organization/${org[0].id}`,pcpRole:`PractitionerRole/${role[0].id}`};
    const fixtures=compileEnrollmentFixtures(context),policy=enrollmentServicePolicy(context);
    for(const resource of [...fixtures.map(f=>f.resource),policy]){
      const result=await m.validateResource(resource);
      if(result.issue?.some(i=>['fatal','error'].includes(i.severity)))throw new Error('Enrollment payload validation failed; raw details suppressed');
    }
    writeFileSync('config/enrollment/references.json',JSON.stringify(context,null,2)+'\n');
    writeFileSync('config/security/enrollment-service-policy.json',JSON.stringify(policy,null,2)+'\n');
    console.log(JSON.stringify({...enrollmentSummary(),validated:true,policyPrepared:true,persisted:false},null,2));
  }finally{m.clear();}
}
main().catch(()=>{console.error('Enrollment preparation failed; verify target, scoped reference access and resource validity. No raw patient payloads logged.');process.exitCode=1;});
