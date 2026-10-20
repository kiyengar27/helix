import type {Extension,Patient} from '@medplum/fhirtypes';
/** Published FHIR R4 US Core 6.1 extension; not an administrative-gender mapping. */
export const birthSexUrl='http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex';
export function birthSexExtension(code:unknown):Extension {
  if(typeof code!=='string'||!['M','F','UNK'].includes(code))throw Error('Unsupported explicit birth-sex fixture code');
  return {url:birthSexUrl,valueCode:code};
}
export function ownedBirthSex(extensions:Extension[]|undefined):Extension[]{
  const owned=(extensions??[]).filter(e=>e.url===birthSexUrl);
  if(owned.length>1)throw Error('Duplicate birth-sex extension');return owned;
}
export function mergeBirthSex(current:Extension[]|undefined,desired:Extension[]|undefined):Extension[]{
  ownedBirthSex(current);const owned=ownedBirthSex(desired);
  if(owned.length!==1||!owned[0].valueCode)throw Error('Explicit single birth-sex value required');
  birthSexExtension(owned[0].valueCode);
  return structuredClone([...(current??[]).filter(e=>e.url!==birthSexUrl),...owned]);
}

/** Required input for integration mapping; never substitute Patient.gender or a name-derived value. */
export function requiredBirthSex(patient:Patient):'M'|'F'|'UNK' {
  const owned=ownedBirthSex(patient.extension);
  if(owned.length!==1)throw Error('Patient requires one explicit birth-sex value');
  const code=owned[0].valueCode;birthSexExtension(code);return code as 'M'|'F'|'UNK';
}
