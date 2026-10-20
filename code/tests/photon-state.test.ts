import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,statSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {withPhotonLock,writePrivate,readPrivate} from '../src/photon-state.js';
test('private receipt is persisted and concurrent execution cannot acquire the same lock',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'helix-photon-'));const lock=join(dir,'sync.lock'),receipt=join(dir,'receipt.json');
  try{await withPhotonLock(lock,async()=>{
    await assert.rejects(withPhotonLock(lock,async()=>{}));writePrivate(receipt,{status:'pending'});
    assert.deepEqual(readPrivate(receipt),{status:'pending'});assert.equal(statSync(receipt).mode&0o777,0o600);
    writePrivate(receipt,{status:'verified'});assert.deepEqual(readPrivate(receipt),{status:'verified'});
  });assert.equal(existsSync(lock),false);await assert.rejects(withPhotonLock(lock,async()=>{throw Error('failed');}));assert.equal(existsSync(lock),false);}
  finally{rmSync(dir,{recursive:true,force:true});}
});
