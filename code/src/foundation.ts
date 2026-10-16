import type { Bundle, HealthcareService, Location, Organization } from '@medplum/fhirtypes';
import foundation from '../config/foundation.json' with { type: 'json' };
import staging from '../config/staging.json' with { type: 'json' };

// Compile-time checking of JSON fields/discriminants. Runtime enum values are checked below.
type FoundationResource = Organization | Location | HealthcareService;
type JsonResource = Omit<Organization, 'resourceType'> | Omit<Location, 'resourceType' | 'mode' | 'status'> | Omit<HealthcareService, 'resourceType'>;
const resourceShapes: JsonResource[] = foundation.entry.map((entry) => entry.resource);
void resourceShapes;
export const expectedProjectId = staging.projectId;
export const expectedBaseUrl = staging.baseUrl;

export function buildFoundation(): Bundle {
  if (foundation.resourceType !== 'Bundle' || foundation.type !== 'transaction') throw new Error('Expected transaction Bundle');
  const fullUrls = new Set<string>();
  const identifiers = new Set<string>();
  const resources = foundation.entry.map((entry) => {
    if (!/^urn:uuid:[0-9a-f-]{36}$/.test(entry.fullUrl) || fullUrls.has(entry.fullUrl)) throw new Error('Invalid or duplicate fullUrl');
    fullUrls.add(entry.fullUrl);
    const resource = entry.resource;
    if (!['Organization', 'Location', 'HealthcareService'].includes(resource.resourceType)) throw new Error('Unsupported resource type');
    if (resource.resourceType === 'Location' && (resource.mode !== 'instance' || resource.status !== 'active')) throw new Error('Invalid market status/mode');
    if (resource.identifier.length !== 1) throw new Error('One managed identifier required');
    const id = resource.identifier[0];
    const key = `${id.system}|${id.value}`;
    if (!id.system || !id.value || identifiers.has(key)) throw new Error('Invalid or duplicate identifier');
    identifiers.add(key);
    return resource as FoundationResource;
  });
  for (const resource of resources) {
    const reference = resource.resourceType === 'Location' ? resource.managingOrganization?.reference : resource.resourceType === 'HealthcareService' ? resource.providedBy?.reference : undefined;
    if (reference && !fullUrls.has(reference)) throw new Error('Unresolved organization reference');
  }
  return { resourceType: 'Bundle', type: 'transaction', entry: resources.map((resource, i) => ({
    fullUrl: foundation.entry[i].fullUrl, resource,
    request: { method: 'POST', url: resource.resourceType, ifNoneExist: new URLSearchParams({identifier: `${resource.identifier![0].system}|${resource.identifier![0].value}`}).toString() },
  })) };
}
