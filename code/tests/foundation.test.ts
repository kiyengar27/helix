import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFoundation } from '../src/foundation.js';

test('foundation preserves agreed inventory and stable deployment identities', () => {
  const bundle = buildFoundation();
  assert.equal(bundle.type, 'transaction');
  const entries = bundle.entry!;
  assert.equal(entries.length, 14);
  for (const [type, count] of [['Organization', 1], ['Location', 5], ['HealthcareService', 8]] as const) {
    assert.equal(entries.filter(e => e.resource?.resourceType === type).length, count);
  }
  assert.deepEqual(buildFoundation(), bundle);
  assert.equal(new Set(entries.map(e => e.request?.ifNoneExist)).size, 14);
  for (const entry of entries) {
    assert.equal(entry.request?.method, 'POST');
    assert.ok(entry.request?.ifNoneExist?.startsWith('identifier='));
  }
});

test('every market and service references the Helix organization', () => {
  const entries = buildFoundation().entry!;
  const org = entries.find(e => e.resource?.resourceType === 'Organization')!;
  for (const entry of entries) {
    const r = entry.resource!;
    if (r.resourceType === 'Location') assert.equal(r.managingOrganization?.reference, org.fullUrl);
    if (r.resourceType === 'HealthcareService') assert.equal(r.providedBy?.reference, org.fullUrl);
  }
});
