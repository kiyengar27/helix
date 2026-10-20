export interface PhotonName {first:string;middle?:string;last:string}
export interface PhotonPatientInput {externalId:string;name:PhotonName;dateOfBirth:string;sex:'MALE'|'FEMALE'|'UNKNOWN';phone:string}
export interface PhotonPatient extends PhotonPatientInput {id:string}
export interface PatientLink {id:string;externalId?:string|null}
/** Only Neutron endpoints. No production URL, retry middleware, order or prescribing method. */
export class PhotonSandbox {
  private token='';
  constructor(private readonly transport:typeof fetch=fetch){}
  async login(clientId:string,secret:string):Promise<void>{
    if(!clientId||!secret||clientId!==clientId.trim()||secret!==secret.trim())throw Error('Invalid local Photon credentials');
    const r=await this.transport('https://auth.neutron.health/oauth/token',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:clientId,client_secret:secret,audience:'https://api.neutron.health',grant_type:'client_credentials'}),signal:AbortSignal.timeout(20000)});
    const data=await r.json() as {access_token?:string};if(!r.ok||!data.access_token)throw Error('Neutron authentication failed');this.token=data.access_token;
  }
  clear():void{this.token='';}
  private async request<T>(query:string,variables:unknown={}):Promise<T>{
    if(!this.token)throw Error('Neutron authentication required');
    const r=await this.transport('https://api.neutron.health/graphql',{method:'POST',redirect:'error',headers:{'content-type':'application/json',authorization:`Bearer ${this.token}`},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000)});
    const body=await r.json() as {data?:T;errors?:unknown[]};
    if(!r.ok||body.errors?.length||!body.data)throw Error('Neutron request failed; details suppressed');return body.data;
  }
  async assertPatientSchema():Promise<void>{
    const data=await this.request<{mutation:{fields:{name:string;args:{name:string;type:{kind:string;name:string|null;ofType?:{name:string|null}}}[]}[]};sex:{enumValues:{name:string}[]};name:{inputFields:{name:string;type:{kind:string;name:string|null;ofType?:{name:string|null}}}[]}}>(`query HelixPatientSchema{mutation:__type(name:"Mutation"){fields{name args{name type{kind name ofType{name}}}}}sex:__type(name:"SexType"){enumValues{name}}name:__type(name:"NameInput"){inputFields{name type{kind name ofType{name}}}}}`);
    const args=data.mutation?.fields.find(f=>f.name==='createPatient')?.args;
    const expected:Record<string,string>={externalId:'ID',name:'NameInput',dateOfBirth:'AWSDate',sex:'SexType',phone:'AWSPhone'};
    for(const [name,type] of Object.entries(expected)){const arg=args?.find(a=>a.name===name);if(!arg||(arg.type.name??arg.type.ofType?.name)!==type)throw Error('Patient schema changed');}
    if(data.sex?.enumValues.map(e=>e.name).sort().join(',')!=='FEMALE,MALE,UNKNOWN')throw Error('Sex enum changed');
    const nameFields=data.name?.inputFields;
    for(const required of ['first','last']){const field=nameFields?.find(f=>f.name===required);if(!field||(field.type.name??field.type.ofType?.name)!=='String')throw Error('Patient name schema changed');}
    if(nameFields?.some(f=>f.type.kind==='NON_NULL'&&!['first','last'].includes(f.name)))throw Error('New required patient name input');
    if(args?.some(a=>a.type.kind==='NON_NULL'&&!(a.name in expected)))throw Error('New required patient input');
  }
  async list(after:string|undefined,first:number):Promise<PatientLink[]>{
    const result=await this.request<{patients:PatientLink[]}>(`query HelixPatientLinks($after:ID,$first:Int){patients(after:$after,first:$first){id externalId}}`,{after,first});
    if(!Array.isArray(result.patients)||result.patients.some(p=>!p||typeof p.id!=='string'||!p.id))throw Error('Invalid patient page');return result.patients;
  }
  async read(id:string):Promise<PhotonPatient>{
    const result=await this.request<{patient:PhotonPatient|null}>(`query HelixPatient($id:ID!){patient(id:$id){id externalId name{first middle last} dateOfBirth sex phone}}`,{id});
    if(!result.patient||result.patient.id!==id)throw Error('Photon patient identity mismatch');return result.patient;
  }
  async create(input:PhotonPatientInput):Promise<PatientLink>{
    const result=await this.request<{createPatient:PatientLink}>(`mutation HelixCreatePatient($externalId:ID!,$name:NameInput!,$dateOfBirth:AWSDate!,$sex:SexType!,$phone:AWSPhone!){createPatient(externalId:$externalId,name:$name,dateOfBirth:$dateOfBirth,sex:$sex,phone:$phone){id externalId}}`,input);
    if(!result.createPatient?.id||result.createPatient.externalId!==input.externalId)throw Error('Create outcome requires reconciliation');return result.createPatient;
  }
}
