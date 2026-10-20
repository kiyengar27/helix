import { test } from 'node:test';
import assert from 'node:assert/strict';
import foundation from '../config/foundation.json' with { type: 'json' };
import proposal from '../config/proposals/care-delivery.resources.json' with { type: 'json' };
import coverage from '../config/proposals/care-delivery.coverage.json' with { type: 'json' };

const resources = new Map<string, {resourceType: string; identifier: {system: string; value: string}[]}>(
  [...foundation.entry, ...proposal.entry].map(e => [e.fullUrl, e.resource])
);

test('proposal references resolve without duplicate identities or deploy requests', () => {
  const entries = [...foundation.entry, ...proposal.entry];
  assert.equal(resources.size, entries.length);
  assert.equal(new Set(entries.map(e => `${e.resource.resourceType}|${e.resource.identifier[0].system}|${e.resource.identifier[0].value}`)).size, entries.length);
  assert.equal(proposal.type, 'collection');
  function walk(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if ('reference' in object) assert.ok(typeof object.reference === 'string' && resources.has(object.reference), 'Unresolved proposal reference');
    assert.ok(!('request' in object), 'Proposal must not carry executable transaction requests');
    Object.values(object).forEach(walk);
  }
  walk(proposal);
});

test('coverage separates sites from markets and keeps infusion in clinic', () => {
  assert.equal(coverage.status, 'proposed');
  for (const offering of coverage.offerings) {
    assert.equal(resources.get(offering.service)?.resourceType, 'HealthcareService');
    for (const delivery of offering.delivery) {
      assert.equal(resources.get(delivery.location)?.resourceType, 'Location');
      assert.ok(['virtual', 'in-clinic'].includes(delivery.mode));
      assert.ok(delivery.markets.length > 0);
      for (const market of delivery.markets) assert.ok(resources.get(market)?.identifier[0].value.startsWith('market-'));
      if (offering.name === 'Infusion Therapy') assert.equal(delivery.mode, 'in-clinic');
    }
  }
});

test('service-specific roles use jurisdiction areas rather than clinic sites', () => {
  for (const {resource} of proposal.entry) {
    if (resource.resourceType !== 'PractitionerRole') continue;
    assert.ok(resource.healthcareService && resource.location && resource.practitioner);
    assert.equal(resource.healthcareService.length, 1);
    assert.equal(resources.get(resource.practitioner.reference)?.resourceType, 'Practitioner');
    for (const location of resource.location) assert.ok(resources.get(location.reference)?.identifier[0].value.startsWith('jurisdiction-'));
  }
});
