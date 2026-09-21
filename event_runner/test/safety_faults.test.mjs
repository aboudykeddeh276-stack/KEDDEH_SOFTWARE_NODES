import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {classifyTelemetry,sha256,signSafetyEvent} from "../src/contract.mjs";
import {ToTSafetyKernel} from "../src/tot_safety_kernel.mjs";
import {CoordinateDirectory} from "../src/coordinate_directory.mjs";
import {Layer2Reconciler} from "../src/layer2_reconciler.mjs";
import {EvidenceLedger} from "../src/evidence_receipt.mjs";
import {Report03ControlPlane} from "../src/report03_control_plane.mjs";

const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),"kex-r03-"));
const observedAt="2026-09-21T00:00:00Z";
const nowMs=Date.parse(observedAt);
const secret="unit-secret";
const authority="sheet-ingress";

function signedEvent(overrides={}){
  const raw={
    source:"sheet",sheet_id:"S1",event_id:"E1",sequence:1,observed_at:observedAt,
    expires_at:"2026-09-21T00:05:00Z",delta:{x:1},node_id:"N1",
    capability:"telemetry.apply",authority_id:authority,...overrides
  };
  return signSafetyEvent(classifyTelemetry(raw),secret);
}
function safetyCtx(extra={}){
  return {
    nowMs,expectedInputHash:extra.expectedInputHash,
    authorizedCapabilities:["telemetry.apply"],nodeState:"READY",
    authoritySecrets:{[authority]:secret},...extra
  };
}

test("ToT allows bounded signed authorized event",()=>{
  const k=new ToTSafetyKernel();
  const ev=signedEvent();
  assert.equal(k.evaluate(ev,safetyCtx({expectedInputHash:ev.input_hash})).decision,"ALLOW");
});

test("ToT durable replay rejection survives restart",()=>{
  const dir=tmp(),journal=path.join(dir,"safety.json"),ev=signedEvent();
  const k1=new ToTSafetyKernel({journalPath:journal});
  assert.equal(k1.evaluate(ev,safetyCtx()).decision,"ALLOW");
  const k2=new ToTSafetyKernel({journalPath:journal});
  const denied=k2.evaluate(ev,safetyCtx());
  assert.equal(denied.decision,"DENY");
  assert.ok(denied.reasons.includes("REPLAY_REJECTED"));
});

test("ToT rejects monotonic sequence rollback even with new event id",()=>{
  const k=new ToTSafetyKernel();
  const first=signedEvent({event_id:"E10",sequence:10});
  assert.equal(k.evaluate(first,safetyCtx()).decision,"ALLOW");
  const old=signedEvent({event_id:"E9",sequence:9});
  const denied=k.evaluate(old,safetyCtx());
  assert.ok(denied.reasons.includes("SEQUENCE_ROLLBACK_REJECTED"));
});

test("ToT rejects signature forgery",()=>{
  const k=new ToTSafetyKernel(),ev={...signedEvent(),signature:"deadbeef"};
  assert.ok(k.evaluate(ev,safetyCtx()).reasons.includes("SIGNATURE_INVALID"));
});

test("ToT rejects hash mismatch",()=>{
  const k=new ToTSafetyKernel(),ev=signedEvent();
  assert.ok(k.evaluate(ev,safetyCtx({expectedInputHash:"bad"})).reasons.includes("HASH_MISMATCH"));
});

test("ToT rejects expired event",()=>{
  const k=new ToTSafetyKernel(),ev=signedEvent({expires_at:"2026-09-20T23:59:59Z"});
  assert.ok(k.evaluate(ev,safetyCtx()).reasons.includes("EVENT_EXPIRED"));
});

test("ToT rejects clock-window violation",()=>{
  const k=new ToTSafetyKernel({maxClockSkewMs:1}),ev=signedEvent();
  assert.ok(k.evaluate(ev,safetyCtx({nowMs:nowMs+2})).reasons.includes("CLOCK_WINDOW_REJECTED"));
});

test("ToT rejects non-ready node",()=>{
  const k=new ToTSafetyKernel(),ev=signedEvent();
  assert.ok(k.evaluate(ev,safetyCtx({nodeState:"STALE"})).reasons.includes("NODE_NOT_READY"));
});

test("directory persists record across restart",()=>{
  const dir=tmp(),state=path.join(dir,"coord.json");
  const a=new CoordinateDirectory({writerId:"A",statePath:state});
  const rec=a.upsert({node_id:"N1",logical:"X2/Y2",health:"READY"});
  const b=new CoordinateDirectory({writerId:"A",statePath:state});
  assert.equal(b.get("N1").record_hash,rec.record_hash);
});

test("directory rejects stale compare-and-set write",()=>{
  const d=new CoordinateDirectory({writerId:"A"});
  const first=d.upsert({node_id:"N1"},{expectedVersion:0});
  assert.throws(()=>d.upsert({node_id:"N1"},{expectedHash:"bad"}),/HASH_CONFLICT/);
  assert.equal(d.get("N1").record_hash,first.record_hash);
});

test("directory quarantines concurrent writer conflict",()=>{
  const a=new CoordinateDirectory({writerId:"A"}),b=new CoordinateDirectory({writerId:"B"});
  a.upsert({node_id:"N1",health:"READY"});
  b.upsert({node_id:"N1",health:"FAILED"});
  assert.throws(()=>a.merge(b.snapshot()),/CONCURRENT_CONFLICT/);
  assert.ok(a.conflicts().N1);
});

test("directory detects equal-vector equivocation",()=>{
  const a=new CoordinateDirectory({writerId:"A"});
  const r=a.upsert({node_id:"N1",health:"READY"});
  const altered={...r,health:"FAILED"};
  altered.record_hash=sha256(Object.fromEntries(Object.entries(altered).filter(([k])=>k!=="record_hash")));
  const remote={directory_version:1,records:[altered],conflicts:{}};
  remote.snapshot_hash=sha256({directory_version:1,records:remote.records,conflicts:{}});
  assert.throws(()=>a.merge(remote),/EQUIVOCATION/);
});

test("directory rejects tampered remote snapshot",()=>{
  const a=new CoordinateDirectory({writerId:"A"}),b=new CoordinateDirectory({writerId:"B"});
  b.upsert({node_id:"N1"});
  const snap=b.snapshot();
  snap.snapshot_hash="bad";
  assert.throws(()=>a.merge(snap),/SNAPSHOT_HASH_INVALID/);
});

test("directory propagates dominating tombstone",()=>{
  const a=new CoordinateDirectory({writerId:"A"}),b=new CoordinateDirectory({writerId:"B"});
  a.upsert({node_id:"N1",health:"READY"});
  b.merge(a.snapshot());
  a.remove("N1");
  b.merge(a.snapshot());
  assert.equal(b.get("N1"),null);
  assert.equal(b.get("N1",{includeTombstone:true}).tombstone,true);
});

test("L2 plan and idempotency are deterministic",()=>{
  const r=new Layer2Reconciler();
  const p1=r.plan([{node_id:"B"},{node_id:"A"}],[],{generation:7});
  const p2=r.plan([{node_id:"A"},{node_id:"B"}],[],{generation:7});
  assert.equal(p1.plan_hash,p2.plan_hash);
  assert.deepEqual(p1.ops.map(x=>x.idempotency_key),p2.ops.map(x=>x.idempotency_key));
});

test("L2 retries transient failure and requires matching readback",async()=>{
  let n=0,state=null;
  const a={
    read:async()=>state,
    apply:async op=>{if(++n===1)throw new Error("INJECTED");state={...op.node,observed_at:new Date().toISOString()};return state}
  };
  const r=new Layer2Reconciler({maxAttempts:2});
  const out=await r.apply(r.plan([{node_id:"N1",health:"READY"}],[]),a);
  assert.equal(out.receipts[0].status,"APPLIED_VERIFIED");
  assert.equal(out.receipts[0].attempt,2);
});

test("L2 falsifies successful apply when readback diverges and verifies rollback",async()=>{
  let state={node_id:"N1",health:"OLD"};
  const a={
    read:async()=>structuredClone(state),
    apply:async()=>{state={node_id:"N1",health:"WRONG"};return {accepted:true}},
    rollback:async(_op,before)=>{state=structuredClone(before);return {rolled_back:true}}
  };
  const r=new Layer2Reconciler({maxAttempts:2});
  const out=await r.apply(r.plan([{node_id:"N1",health:"READY"}],[state]),a);
  assert.equal(out.receipts[0].status,"ROLLED_BACK");
  assert.ok(out.receipts[0].attempts.every(x=>x.verified===false));
  assert.equal(state.health,"OLD");
});

test("L2 contains permanent failure when rollback unavailable",async()=>{
  const a={read:async()=>null,apply:async()=>{throw new Error("PERMANENT")}};
  const r=new Layer2Reconciler({maxAttempts:2});
  const out=await r.apply(r.plan([{node_id:"N1"}],[]),a);
  assert.equal(out.receipts[0].status,"FAILED_QUARANTINE_REQUIRED");
});

test("L2 quarantine orphan requires observed quarantine",async()=>{
  let state={node_id:"N1",health:"READY"};
  const a={
    read:async()=>structuredClone(state),
    apply:async op=>{if(op.op==="QUARANTINE_ORPHAN")state={...state,health:"QUARANTINED"};return state}
  };
  const r=new Layer2Reconciler();
  const out=await r.apply(r.plan([],[state]),a);
  assert.equal(out.receipts[0].status,"APPLIED_VERIFIED");
});

test("L2 safety gate can deny mutation before adapter apply",async()=>{
  let applied=0;
  const a={read:async()=>null,apply:async()=>{applied++;return null}};
  const r=new Layer2Reconciler();
  const out=await r.apply(r.plan([{node_id:"N1"}],[]),a,{safetyGate:async()=>({decision:"DENY",reasons:["TEST"]})});
  assert.equal(out.receipts[0].status,"SAFETY_DENIED");
  assert.equal(applied,0);
});

test("evidence ledger chain verifies and tamper is detected",()=>{
  const dir=tmp(),file=path.join(dir,"ledger.jsonl"),ledger=new EvidenceLedger(file);
  ledger.append({type:"A",value:1});
  ledger.append({type:"B",value:2});
  assert.equal(ledger.verify().status,"PASS");
  EvidenceLedger.tamperForTest(file,0,e=>({...e,event:{type:"A",value:999}}));
  assert.equal(ledger.verify().status,"FAIL");
});

test("integrated Report03 control plane emits chained evidence",()=>{
  const dir=tmp();
  const cp=new Report03ControlPlane({stateDir:dir,writerId:"A",safety:{maxClockSkewMs:300000}});
  cp.upsertCoordinate({node_id:"N1",health:"READY"});
  const q=cp.recordQualification({run_id:"TEST",tests:{passed:1},faults:{},boundaries:["LOCAL_ONLY"]});
  assert.equal(q.ledger_verification.status,"PASS");
  assert.equal(cp.status().evidence.status,"PASS");
});
