import type { Location } from '@medplum/fhirtypes';
import config from '../config/proposals/clinic-lifecycle.json' with { type: 'json' };
import proposal from '../config/proposals/care-delivery.resources.json' with { type: 'json' };
import coverage from '../config/proposals/care-delivery.coverage.json' with { type: 'json' };
import operations from '../config/proposals/care-delivery.operations.json' with { type: 'json' };

export type ClinicState = 'planned' | 'active' | 'suspended' | 'closed';
export interface ClinicEvent { state: ClinicState; effectiveAt: string; reason: string }
export interface ClinicLifecycle { schemaVersion: number; clinics: { location: string; events: ClinicEvent[] }[] }
const transitions: Record<ClinicState, readonly ClinicState[]> = {
  planned: ['active', 'closed'], active: ['suspended', 'closed'], suspended: ['active', 'closed'], closed: [],
};
const status: Record<ClinicState, NonNullable<Location['status']>> = {
  planned: 'inactive', active: 'active', suspended: 'suspended', closed: 'inactive',
};
export const clinicReferences = proposal.entry.filter(e => e.resource.identifier[0].value.startsWith('clinic-')).map(e => e.fullUrl);

function instant(value: string): number {
  // Require an explicit timezone and reject dates normalized by Date.parse (e.g. February 30).
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) throw new Error('Use a UTC ISO timestamp');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')) throw new Error('Invalid effective timestamp');
  return ms;
}

export function validateClinicLifecycle(value: unknown, expected: readonly string[] = clinicReferences): asserts value is ClinicLifecycle {
  if (!value || typeof value !== 'object') throw new Error('Lifecycle manifest required');
  const manifest = value as Partial<ClinicLifecycle>;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.clinics)) throw new Error('Unsupported clinic lifecycle manifest');
  const seen = new Set<string>();
  for (const clinic of manifest.clinics) {
    if (!clinic || !expected.includes(clinic.location) || seen.has(clinic.location)) throw new Error('Unknown or duplicate clinic');
    seen.add(clinic.location);
    if (!Array.isArray(clinic.events) || !clinic.events.length) throw new Error('Clinic history required');
    let previous: ClinicState | undefined;
    let previousTime = -Infinity;
    for (const event of clinic.events) {
      if (!event || !Object.hasOwn(transitions, event.state) || typeof event.reason !== 'string' || !event.reason.trim()) throw new Error('Invalid lifecycle state or missing reason');
      const time = instant(event.effectiveAt);
      if (time <= previousTime) throw new Error('Events must have strictly increasing timestamps');
      if (!previous && !['planned', 'active'].includes(event.state)) throw new Error('Initial state must be planned or active');
      if (previous && !transitions[previous].includes(event.state)) throw new Error('Invalid clinic transition');
      previous = event.state; previousTime = time;
    }
  }
  if (seen.size !== new Set(expected).size) throw new Error('Every clinic needs explicit lifecycle history; removal is not offboarding');
}

const raw: unknown = config;
validateClinicLifecycle(raw);
export const clinicLifecycle: ClinicLifecycle = raw;

export function clinicStateAt(location: string, at: string, manifest: ClinicLifecycle = clinicLifecycle): ClinicState {
  validateClinicLifecycle(manifest);
  const time = instant(at);
  const clinic = manifest.clinics.find(c => c.location === location);
  if (!clinic) throw new Error('Clinic lifecycle not found');
  // Before the first activation/planned event, this clinic is not open for new care.
  return clinic.events.filter(e => instant(e.effectiveAt) <= time).at(-1)?.state ?? 'planned';
}

export function clinicStatusAt(location: string, at: string, manifest: ClinicLifecycle = clinicLifecycle): NonNullable<Location['status']> {
  return status[clinicStateAt(location, at, manifest)];
}

/** Read-only configuration impact; it does not inspect remote appointments or mutate dependencies. */
export function clinicImpact(location: string, at: string, manifest: ClinicLifecycle = clinicLifecycle) {
  const state = clinicStateAt(location, at, manifest);
  return {
    location, at, state, fhirStatus: status[state], acceptsNewCare: state === 'active',
    affectedServices: coverage.offerings.filter(s => s.delivery.some(d => d.location === location)).map(s => s.service),
    preferredBy: operations.providers.filter(p => p.preferredClinics.includes(location)).map(p => p.practitioner),
    rotationTemplates: operations.rotationTemplates.filter(s => s.location === location).map(s => s.key),
    liveDependencyAudit: 'not-performed' as const,
    requiredBeforeLiveClosure: ['Inspect future bookings and open work', 'Review cancellation/transfer and communications', 'Approve resource and permission plan'],
    deletesResources: false,
  };
}
