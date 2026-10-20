import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ageOn,ageBand,relationshipDraft,proxyAssessment} from '../src/enrollment.js';

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
