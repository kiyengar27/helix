import {execFileSync} from 'node:child_process';
import {MedplumClient} from '@medplum/core';
import {PhotonSandbox} from '../src/photon-client.js';
import {mapPatient,findPatient,assertMappedPatient,makeSyncPlan,assertSyncPlan,syncOne,type SyncReceipt,type SyncPlan} from '../src/photon-patient-sync.js';
import {withPhotonLock,writePrivate,readPrivate} from '../src/photon-state.js';
import {digest} from '../src/deployment.js';
import {expectedBaseUrl,expectedProjectId} from '../src/foundation.js';
import context from '../config/encounters/references.json' with {type:'json'};
import config from '../config/photon/patient-sync.json' with {type:'json'};
const directory='reports/photon',planPath=`${directory}/daniel-plan.json`,receiptPath=`${directory}/daniel-receipt.json`;
async function main(){
  const mode=process.argv[2];if(!['--plan','--apply','--verify'].includes(mode)||process.argv.length!==3)throw Error('Choose plan, apply or verify');
  if(config.environment!=='neutron'||config.patientCase!=='independent-adult'||config.mutation!=='createPatient'||config.allowOrders||config.allowPatientUpdates||!config.includePrivateTestPhone)throw Error('Unsupported sync configuration');
  if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('Commit before planning');
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  await withPhotonLock(`${directory}/sync.lock`,async()=>{
    const photon=new PhotonSandbox(),medplum=new MedplumClient({baseUrl:expectedBaseUrl});
    try{
      const clientId=process.env.PHOTON_CLIENT_ID,secret=process.env.PHOTON_CLIENT_SECRET,phone=process.env.PHOTON_TEST_PHONE;
      const medId=process.env.MEDPLUM_ENCOUNTER_CLIENT_ID,medSecret=process.env.MEDPLUM_ENCOUNTER_CLIENT_SECRET;
      if(!clientId||!secret||!phone||!medId||!medSecret)throw Error('Local sandbox credentials/test phone required');
      await photon.login(clientId,secret);await photon.assertPatientSchema();
      await medplum.startClientLogin(medId,medSecret);
      const me=await medplum.get(new URL('auth/me',expectedBaseUrl).toString()) as {project?:{id?:string}};
      if(me.project?.id!==expectedProjectId)throw Error('Wrong Medplum project');
      const patient=await medplum.readResource('Patient',context.patients['independent-adult'].split('/')[1],{cache:'no-store'});
      if(patient.managingOrganization?.reference!==context.organization||!patient.identifier?.some(i=>i.system==='urn:helix:staging:synthetic-patient'&&i.value===config.patientCase)||!patient.meta?.tag?.some(t=>t.system==='urn:helix:data-classification'&&t.code==='synthetic'))throw Error('Wrong synthetic patient');
      const payload=mapPatient(patient,expectedProjectId,phone),clientDigest=digest(clientId),receipt=readPrivate<SyncReceipt>(receiptPath);
      if(receipt&&(receipt.externalId!==payload.externalId||receipt.clientDigest!==clientDigest||!['pending','verified'].includes(receipt.status)))throw Error('Invalid receipt scope');
      const existing=await findPatient(photon,payload.externalId,config.maxPatientPages,config.pageSize);
      if(existing){if(receipt?.photonId&&receipt.photonId!==existing.id)throw Error('Mapped Photon ID changed');assertMappedPatient(await photon.read(existing.id),payload);}
      if(receipt&&!existing)throw Error('Pending/verified patient missing; inspect outcome, never auto-recreate');
      if(mode==='--verify'){
        if(!existing||receipt?.status!=='verified'||receipt.photonId!==existing.id)throw Error('Verified link missing');
        console.log(JSON.stringify({verified:true,patientCount:1,environment:'neutron',mutations:0}));return;
      }
      const saved=mode==='--apply'?readPrivate<SyncPlan>(planPath):undefined;
      if(mode==='--apply'&&!saved)throw Error('Reviewed plan required');
      const plan=makeSyncPlan({commit,project:expectedProjectId,clientDigest,configurationDigest:digest(config),sourceDigest:digest(patient),payloadDigest:digest(payload),receiptDigest:digest(receipt??null),externalId:payload.externalId,createdAt:saved?.createdAt??new Date().toISOString(),action:existing?'reuse':'create',...(existing?{photonId:existing.id}:{})});
      if(mode==='--plan'){
        writePrivate(planPath,plan);
        console.log(JSON.stringify({environment:'neutron',patient:'Daniel Wilson',action:plan.action,creates:existing?0:1,updates:0,orders:0,privateTestPhoneIncluded:true,patientCreationSmsBehavior:'unverified',digest:plan.digest,mutations:0}));return;
      }
      assertSyncPlan(saved!,plan,Date.now(),config.planLifetimeHours);
      const result=await syncOne(photon,payload,clientDigest,receipt,r=>writePrivate(receiptPath,r),plan.action==='create',config.maxPatientPages,config.pageSize);
      console.log(JSON.stringify({environment:'neutron',created:result.created,verified:true,patientCount:1,orders:0,communicationObserved:'check test recipient; creation behavior unverified'}));
    }finally{photon.clear();medplum.clear();}
  });
}
main().catch(()=>{console.error('Photon sync stopped. Credentials, phone, patient payloads and API errors suppressed. Inspect private receipt/plan and request reconciliation; do not delete pending state or blindly retry a create.');process.exitCode=1;});
