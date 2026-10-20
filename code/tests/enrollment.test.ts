import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Patient} from '@medplum/fhirtypes';
import {assignHomeMarket,homeMarketAt,readMarketHistory,validateMarketHistory,ageOn,ageBand,relationshipDraft,proxyAssessment} from '../src/enrollment.js';
const markets=['Location/north-bay','Location/dallas-north'];
const baseline:Patient={resourceType:'Patient',id:'contract-test-only',identifier:[{system:'urn:test',value:'stable'}],managingOrganization:{reference:'Organization/helix'},generalPractitioner:[{reference:'PractitionerRole/pcp'}],extension:[{url:'urn:test:unrelated',valueString:'retained'}]};

test('intake can be unassigned; enrollment and a move preserve identity, custodian, PCP and unrelated extensions',()=>{
  assert.equal(homeMarketAt([], '2026-10-20T00:00:00Z',markets),undefined);
  const enrolled=assignHomeMarket(baseline,markets[0],'2026-10-20T00:00:00Z',markets);
  const moved=assignHomeMarket(enrolled,markets[1],'2026-11-01T00:00:00Z',markets);
  const h=readMarketHistory(moved,markets);
  assert.equal(homeMarketAt(h,'2026-10-31T23:59:59.999Z',markets),markets[0]);
  assert.equal(homeMarketAt(h,'2026-11-01T00:00:00Z',markets),markets[1]);
  assert.equal(moved.id,baseline.id);assert.deepEqual(moved.identifier,baseline.identifier);
  assert.deepEqual(moved.managingOrganization,baseline.managingOrganization);assert.deepEqual(moved.generalPractitioner,baseline.generalPractitioner);
  assert.deepEqual(moved.extension![0],baseline.extension![0]);assert.equal(baseline.extension!.length,1);
});

test('duplicate assignment retry is idempotent; overlapping, unknown and retroactive changes fail',()=>{
  const enrolled=assignHomeMarket(baseline,markets[0],'2026-10-20T00:00:00Z',markets);
  assert.deepEqual(assignHomeMarket(enrolled,markets[0],'2026-10-20T00:00:00Z',markets),enrolled);
  assert.throws(()=>assignHomeMarket(enrolled,markets[1],'2026-10-19T00:00:00Z',markets));
  assert.throws(()=>assignHomeMarket(enrolled,'Location/unknown','2026-11-01T00:00:00Z',markets));
  assert.throws(()=>validateMarketHistory([{market:markets[0],effectiveFrom:'2026-10-20T00:00:00Z'},{market:markets[1],effectiveFrom:'2026-11-01T00:00:00Z'}],markets));
});

test('age categories have no gaps at 12/13/14/18 and require complete valid dates',()=>{
  for(const [birth,expected] of [['2015-10-20','under-12'],['2014-10-20','12-13'],['2013-10-20','12-13'],['2012-10-20','14-17'],['2009-10-20','14-17'],['2008-10-20','adult']] as const)assert.equal(ageBand(birth,'2026-10-20'),expected);
  assert.equal(ageOn('2012-10-21','2026-10-20'),13);
  assert.throws(()=>ageOn('2012-02-30','2026-10-20'));
  assert.throws(()=>ageOn('2027-01-01','2026-10-20'));
});

test('older adult caregiver relationship never implies incapacity or grants access',()=>{
  const relationship=relationshipDraft('Patient/test','caregiver-test','caregiver');
  const assessment=proxyAssessment('Patient/test','1940-01-01',relationship,'2026-10-20');
  assert.equal(assessment.accessGranted,false);assert.equal(assessment.capacityInferredFromAge,false);
  assert.equal(assessment.reviewRequired,'adult-authorization-or-representative-authority');
  assert.equal(assessment.policyEnforced,false);
});

test('parent/guardian records across child and adolescent bands never auto-enable proxy access',()=>{
  const parent=relationshipDraft('Patient/test','parent-test','parent');
  for(const birth of ['2018-01-01','2014-01-01','2013-01-01','2010-01-01','2008-01-01']){
    assert.equal(proxyAssessment('Patient/test',birth,parent,'2026-10-20').accessGranted,false);
  }
  assert.throws(()=>proxyAssessment('Patient/other','2010-01-01',parent,'2026-10-20'));
  assert.equal(relationshipDraft('Patient/test','guardian-test','guardian').relationship![0].text,'guardian');
});
