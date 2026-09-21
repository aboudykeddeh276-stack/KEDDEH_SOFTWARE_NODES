import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {classifyTelemetry,sha256,signSafetyEvent} from '../src/contract.mjs';
import {withFileLockSync,AtomicJsonStore} from '../src/durable_state.mjs';
import {ToTSafetyKernel} from '../src/tot_safety_kernel.mjs';
import {CoordinateDirectory,vectorCompare} from '../src/coordinate_directory.mjs';
import {Layer2Reconciler} from '../src/layer2_reconciler.mjs';
import {EvidenceLedger} from '../src/evidence_receipt.mjs';
import {Report03ControlPlane} from '../src/report03_control_plane.mjs';

const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'kex-r03-r3-'));
const now='2026-09-21T00:00:00Z', nowMs=Date.parse(now), policy={id:'policy:report03:r3',hash:sha256({v:3,capabilities:['telemetry.apply']})};
const authority='sheet-ingress', keyId='k1', secret='secret-k1';
function signedEvent(overrides={}){
  const raw={source:'sheet',sheet_id:'S1',event_id:'E1',sequence:1,observed_at:now,expires_at:'2026-09-21T00:05:00Z',delta:{x:1},node_id:'N1',capability:'telemetry.apply',authority_id:authority,key_id:keyId,policy_id:policy.id,policy_hash:policy.hash,...overrides};
  return signSafetyEvent(classifyTelemetry(raw),overrides.secret||secret);
}
function ctx(extra={}){return {nowMs,policyId:policy.id,policyHash:policy.hash,authorizedCapabilities:['telemetry.apply'],nodeState:'READY',authorityKeys:{[authority]:{[keyId]:secret}},...extra}}
async function runWorkers(file,workers=4,count=40){
  const script=new URL('./atomic_worker.mjs',import.meta.url).pathname;
  await Promise.all(Array.from({length:workers},()=>new Promise((resolve,reject)=>{const cp=spawn(process.execPath,[script,file,String(count)],{stdio:'ignore'});cp.on('exit',code=>code===0?resolve():reject(new Error('worker '+code)));cp.on('error',reject)})));
}

test('atomic store serializes multi-process increments without lost updates',async()=>{
  const file=path.join(tmp(),'counter.json'); await runWorkers(file,5,50); const s=new AtomicJsonStore(file,()=>({count:0})); assert.equal(s.read().count,250);
});
test('live stale lock is not stolen',()=>{
  const file=path.join(tmp(),'state.json'); fs.writeFileSync(file,JSON.stringify({ok:true})); const lock=file+'.lock';
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid,token:'live',created_at_ms:Date.now()-60000})); const old=new Date(Date.now()-60000); fs.utimesSync(lock,old,old);
  assert.throws(()=>withFileLockSync(file,()=>42,{timeoutMs:40,staleMs:1}),/STATE_LOCK_TIMEOUT/); fs.unlinkSync(lock);
});
test('dead stale lock can be recovered',()=>{
  const file=path.join(tmp(),'state.json'); fs.writeFileSync(file,JSON.stringify({ok:true})); const lock=file+'.lock';
  fs.writeFileSync(lock,JSON.stringify({pid:99999999,token:'dead',created_at_ms:1})); const old=new Date(Date.now()-60000); fs.utimesSync(lock,old,old);
  assert.equal(withFileLockSync(file,()=>42,{timeoutMs:100,staleMs:1}),42);
});
test('ToT admits only event bound to current policy and signing key',()=>{
  const k=new ToTSafetyKernel(); const ev=signedEvent(); const d=k.evaluate(ev,ctx({expectedInputHash:ev.input_hash})); assert.equal(d.decision,'ALLOW'); assert.equal(d.policy_hash,policy.hash); assert.ok(d.authorization_hash);
});
test('ToT rejects policy downgrade and unknown rotated key',()=>{
  const k1=new ToTSafetyKernel(); const ev=signedEvent(); assert.ok(k1.evaluate(ev,ctx({policyHash:'bad'})).reasons.includes('POLICY_HASH_MISMATCH'));
  const k2=new ToTSafetyKernel(); assert.ok(k2.evaluate(ev,ctx({authorityKeys:{[authority]:{k2:'other'}}})).reasons.includes('SIGNATURE_INVALID'));
});
test('ToT replay and sequence rollback survive restart',()=>{
  const dir=tmp(),journal=path.join(dir,'tot.json'), ev=signedEvent({event_id:'E10',sequence:10});
  assert.equal(new ToTSafetyKernel({journalPath:journal}).evaluate(ev,ctx()).decision,'ALLOW');
  const k2=new ToTSafetyKernel({journalPath:journal}); assert.ok(k2.evaluate(ev,ctx()).reasons.includes('REPLAY_REJECTED'));
  assert.ok(k2.evaluate(signedEvent({event_id:'E9',sequence:9}),ctx()).reasons.includes('SEQUENCE_ROLLBACK_REJECTED'));
});
test('ToT rejects forged signature, stale time, expiry, capability and node state',()=>{
  const checks=[
    new ToTSafetyKernel().evaluate({...signedEvent(),signature:'bad'},ctx()).reasons,
    new ToTSafetyKernel({maxClockSkewMs:1}).evaluate(signedEvent(),ctx({nowMs:nowMs+2})).reasons,
    new ToTSafetyKernel().evaluate(signedEvent({expires_at:'2026-09-20T23:59:59Z'}),ctx()).reasons,
    new ToTSafetyKernel().evaluate(signedEvent(),ctx({authorizedCapabilities:[]})).reasons,
    new ToTSafetyKernel().evaluate(signedEvent(),ctx({nodeState:'STALE'})).reasons
  ];
  assert.ok(checks[0].includes('SIGNATURE_INVALID'));assert.ok(checks[1].includes('CLOCK_WINDOW_REJECTED'));assert.ok(checks[2].includes('EVENT_EXPIRED'));assert.ok(checks[3].includes('CAPABILITY_NOT_AUTHORIZED'));assert.ok(checks[4].includes('NODE_NOT_READY'));
});

const secrets={A:'secret-A',B:'secret-B'};
function dir(writer,statePath=null){return new CoordinateDirectory({writerId:writer,writerSecret:secrets[writer],writerSecrets:secrets,statePath})}
test('coordinate directory persists signed records across restart',()=>{
  const state=path.join(tmp(),'coord.json'); const a=dir('A',state); const r=a.upsert({node_id:'N1',health:'READY',logical:'X2/Y2'}); const a2=dir('A',state); assert.equal(a2.get('N1').record_hash,r.record_hash);assert.ok(r.signature);
});
test('coordinate merge rejects tampered record signature',()=>{
  const a=dir('A'),b=dir('B'); const r=b.upsert({node_id:'N1',health:'READY'}); const bad={...r,health:'FAILED'}; bad.record_hash=sha256(Object.fromEntries(Object.entries(bad).filter(([k])=>!['record_hash','signature'].includes(k))));
  const remote={directory_version:1,records:[bad],conflicts:{}};remote.snapshot_hash=sha256({directory_version:1,records:remote.records,conflicts:{}});assert.throws(()=>a.merge(remote),/SIGNATURE_INVALID/);
});
test('coordinate conflict retains both branches and resolves to dominating descendant',()=>{
  const a=dir('A'),b=dir('B'); const ar=a.upsert({node_id:'N1',health:'READY'}), br=b.upsert({node_id:'N1',health:'FAILED'});
  assert.throws(()=>a.merge(b.snapshot()),/CONCURRENT_CONFLICT/); const c=a.conflicts().N1; assert.equal(c.local_record.record_hash,ar.record_hash);assert.equal(c.remote_record.record_hash,br.record_hash);
  const resolved=a.resolveConflict('N1',br.record_hash);assert.equal(resolved.health,'FAILED');assert.equal(vectorCompare(resolved.vector,ar.vector),'DOMINATES');assert.equal(vectorCompare(resolved.vector,br.vector),'DOMINATES');assert.equal(Object.keys(a.conflicts()).length,0);
});
test('coordinate tombstone dominates and stale compare-and-set is rejected',()=>{
  const a=dir('A'),b=dir('B');const first=a.upsert({node_id:'N1',health:'READY'});b.merge(a.snapshot());a.remove('N1',{expectedHash:first.record_hash});b.merge(a.snapshot());assert.equal(b.get('N1'),null);assert.throws(()=>a.upsert({node_id:'N1'},{expectedHash:'bad'}),/HASH_CONFLICT/);
});
test('L2 deterministic plan is fenced by generation and rejects equivocation',async()=>{
  const state=path.join(tmp(),'l2.json'),r=new Layer2Reconciler({statePath:state}); const p=r.plan([{node_id:'N1',health:'READY'}],[],{generation:3}); let v=null;const a={read:async()=>v,apply:async op=>(v={...op.node})};assert.equal((await r.apply(p,a)).summary.applied_verified,1);
  const r2=new Layer2Reconciler({statePath:state}); const old=r2.plan([{node_id:'N2'}],[],{generation:2});await assert.rejects(()=>r2.apply(old,a),/STALE_GENERATION/);
  const eq=r2.plan([{node_id:'N1',health:'DIFFERENT'}],[v],{generation:3});await assert.rejects(()=>r2.apply(eq,a),/GENERATION_EQUIVOCATION/);
});
test('L2 idempotency survives restart and revalidates readback',async()=>{
  const state=path.join(tmp(),'l2.json');let current=null,applies=0;const adapter={read:async()=>current,apply:async op=>{applies++;current={...op.node};return current}};
  const r1=new Layer2Reconciler({statePath:state});const plan=r1.plan([{node_id:'N1',health:'READY'}],[],{generation:1});assert.equal((await r1.apply(plan,adapter)).summary.applied_verified,1);
  const r2=new Layer2Reconciler({statePath:state});const again=await r2.apply(plan,adapter);assert.equal(again.summary.idempotent_replay_verified,1);assert.equal(applies,1);
  current={node_id:'N1',health:'DRIFTED'};const repaired=await r2.apply(plan,adapter);assert.equal(repaired.summary.applied_verified,1);assert.equal(applies,2);
});
test('L2 readback divergence falsifies accepted mutation and rollback is verified',async()=>{
  let state={node_id:'N1',health:'OLD'};const a={read:async()=>structuredClone(state),apply:async()=>{state={node_id:'N1',health:'WRONG'};return{accepted:true}},rollback:async(_op,before)=>{state=structuredClone(before);return{rolled_back:true}}};
  const r=new Layer2Reconciler({maxAttempts:2});const out=await r.apply(r.plan([{node_id:'N1',health:'READY'}],[state]),a);assert.equal(out.receipts[0].status,'ROLLED_BACK');assert.equal(state.health,'OLD');
});
test('L2 permanent failure and safety denial do not manufacture success',async()=>{
  const bad={read:async()=>null,apply:async()=>{throw new Error('PERMANENT')}};const r=new Layer2Reconciler({maxAttempts:2});assert.equal((await r.apply(r.plan([{node_id:'N1'}],[]),bad)).receipts[0].status,'FAILED_QUARANTINE_REQUIRED');
  let applied=0;const a={read:async()=>null,apply:async()=>{applied++}};const out=await new Layer2Reconciler().apply(new Layer2Reconciler().plan([{node_id:'N2'}],[]),a,{safetyGate:async()=>({decision:'DENY'})});assert.equal(out.receipts[0].status,'SAFETY_DENIED');assert.equal(applied,0);
});
test('evidence ledger detects tamper and signed head seal fails after head substitution',()=>{
  const file=path.join(tmp(),'ledger.jsonl'),ledger=new EvidenceLedger(file);ledger.append({type:'A',value:1});ledger.append({type:'B',value:2});assert.equal(ledger.verify().status,'PASS');const seal=ledger.seal('anchor-secret','anchor-k1');assert.equal(EvidenceLedger.verifySeal(seal,'anchor-secret'),true);
  EvidenceLedger.tamperForTest(file,0,e=>({...e,event:{type:'A',value:999}}));assert.equal(ledger.verify().status,'FAIL');assert.equal(EvidenceLedger.verifySeal({...seal,head:'bad'},'anchor-secret'),false);
});
test('integrated control plane persists safety directory reconciliation and evidence state',async()=>{
  const root=tmp();const cp=new Report03ControlPlane({stateDir:root,writerId:'A',writerSecret:'secret-A',writerSecrets:secrets});
  const ev=signedEvent({event_id:'ECP',sequence:20});assert.equal(cp.admitEvent(ev,ctx()).decision,'ALLOW');cp.upsertCoordinate({node_id:'NCP',health:'READY'});
  let world={};const adapter={read:async id=>world[id]||null,apply:async op=>(world[op.node.node_id]={...op.node})};const out=await cp.reconcile([{node_id:'NCP',health:'READY'}],[],adapter,{generation:1});assert.equal(out.result.summary.applied_verified,1);assert.equal(cp.status().evidence.status,'PASS');const seal=cp.sealEvidence('anchor');assert.equal(EvidenceLedger.verifySeal(seal,'anchor'),false);
  const {status_hash,...rawSeal}=seal;assert.equal(EvidenceLedger.verifySeal(rawSeal,'anchor'),true);
});
