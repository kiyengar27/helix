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

// Ground-rule scenarios: market participation, licensure, preferences and schedules stay distinct.
import operations from '../config/proposals/care-delivery.operations.json' with { type: 'json' };
import { isDeliveryEligible, previewCareDelivery } from '../src/care-delivery.js';
const reference = (key: string): string => {
  const entry = [...foundation.entry, ...proposal.entry].find(e => e.resource.identifier[0].value === key);
  assert.ok(entry, key);
  return entry.fullUrl;
};
const casey = reference('role-casey-patel-cardiology');

test('one specialist can rotate between both California markets and serve non-preferred clinics', () => {
  for (const market of ['north-bay-ca', 'south-bay-ca', 'dallas-north']) {
    assert.equal(isDeliveryEligible({role: casey, market: reference(`market-${market}`), visitJurisdiction: market.includes('bay') ? 'CA' : 'TX', location: reference(`clinic-${market}`), mode: 'in-clinic'}), true);
  }
  const clinics = operations.providers.find(p => p.roles.some(r => r.role === casey))!.preferredClinics;
  assert.ok(!clinics.includes(reference('clinic-dallas-north')), 'Scenario must exercise a non-preferred clinic');
});

test('nationwide target is not permission; single-state and wrong-visit-state requests fail', () => {
  assert.equal(isDeliveryEligible({role: casey, market: reference('market-north-bay-ca'), visitJurisdiction:'NY', location:reference('virtual-ca'), mode:'virtual'}), false);
  assert.equal(isDeliveryEligible({role:reference('role-jordan-lee-primary-care'), market:reference('market-north-bay-ca'), visitJurisdiction:'CA',location:reference('virtual-ca'),mode:'virtual'}), false);
  assert.equal(isDeliveryEligible({role:casey,market:reference('market-north-bay-ca'),visitJurisdiction:'TX',location:reference('clinic-north-bay-ca'),mode:'in-clinic'}), false);
});

test('infusion is physical and program responsibility is explicit for each market', () => {
  assert.equal(isDeliveryEligible({role:reference('role-quinn-rivera-infusion-therapy'),market:reference('market-north-bay-ca'),visitJurisdiction:'CA',location:reference('virtual-ca'),mode:'virtual'}), false);
  assert.equal(operations.marketPrograms.length, 10);
  for (const program of operations.marketPrograms) {
    assert.ok(resources.get(program.market)?.identifier[0].value.startsWith('market-'));
    assert.equal(program.scope, 'market');
    for (const role of program.staffRoles) assert.equal(resources.get(role)?.resourceType, 'PractitionerRole');
  }
  assert.ok(operations.futureSharedServices.every(s => !s.enabled));
  assert.ok(operations.futurePartners.every(s => !s.enabled && s.sharing === 'no-access-granted'));
});

test('rotation templates are eligible and span both Bay markets without conflating clinic preference', () => {
  for (const session of operations.rotationTemplates) {
    assert.equal(isDeliveryEligible({role:session.role,market:session.market,visitJurisdiction:operations.markets.find(m=>m.market===session.market)!.jurisdiction,location:session.location,mode:session.mode as 'virtual'|'in-clinic'}), true);
    assert.ok(session.start < session.end);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', {timeZone:session.timezone}));
  }
  assert.ok(operations.rotationTemplates.some(s=>s.market===reference('market-north-bay-ca')));
  assert.ok(operations.rotationTemplates.some(s=>s.market===reference('market-south-bay-ca')));
  assert.equal(previewCareDelivery().resources.type, 'collection');
});
