import type { Bundle, Location, PractitionerRole } from '@medplum/fhirtypes';
import foundation from '../config/foundation.json' with { type: 'json' };
import proposal from '../config/proposals/care-delivery.resources.json' with { type: 'json' };
import operations from '../config/proposals/care-delivery.operations.json' with { type: 'json' };
import coverage from '../config/proposals/care-delivery.coverage.json' with { type: 'json' };

export interface DeliveryRequest {
  role: string;
  market: string;
  visitJurisdiction: string;
  location: string;
  mode: 'virtual' | 'in-clinic';
}

// Narrow FHIR projections: these intentionally exclude generated API IDs and credentials.
const locations: Pick<Location, 'name' | 'partOf' | 'address'>[] = proposal.entry
  .filter(e => e.resource.resourceType === 'Location').map(e => ({name: typeof e.resource.name === 'string' ? e.resource.name : undefined, partOf: e.resource.partOf, address: e.resource.address}));
const roleLinks: Pick<PractitionerRole, 'practitioner' | 'organization' | 'healthcareService' | 'location'>[] = proposal.entry
  .filter(e => e.resource.resourceType === 'PractitionerRole').map(e => e.resource);
void locations; void roleLinks;

/** Checks declarative delivery scope only; not authorization, verified credentials or availability. */
export function isDeliveryEligible(request: DeliveryRequest): boolean {
  const provider = operations.providers.find(p => p.roles.some(r => r.role === request.role));
  const role = provider?.roles.find(r => r.role === request.role);
  const market = operations.markets.find(m => m.market === request.market);
  if (!provider || !role || !market || !provider.markets.includes(request.market)) return false;
  // The visit jurisdiction may differ from the home/operational market during travel.
  if (!role.eligibleJurisdictions.includes(request.visitJurisdiction) || !role.modes.includes(request.mode)) return false;
  const service = coverage.offerings.find(s => s.service === role.service);
  const delivery = service?.delivery.find(d => d.mode === request.mode && d.location === request.location && d.markets.includes(request.market));
  if (!delivery) return false;
  if (request.mode === 'in-clinic') {
    return market.jurisdiction === request.visitJurisdiction;
  }
  const location = proposal.entry.find(e => e.fullUrl === request.location)?.resource;
  // State virtual delivery location must correspond to the actual visit jurisdiction.
  return location?.identifier[0].value === `virtual-${request.visitJurisdiction.toLowerCase()}`;
}

/** Local view for design review. It has no deployment requests and never contacts Medplum. */
export function previewCareDelivery(): { resources: Bundle; operations: typeof operations; coverage: typeof coverage } {
  const resources: Bundle = {
    resourceType: 'Bundle', type: 'collection',
    entry: [...foundation.entry, ...proposal.entry] as Bundle['entry'],
  };
  return { resources, operations, coverage };
}
