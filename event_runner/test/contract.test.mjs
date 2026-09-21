import test from "node:test";
import assert from "node:assert/strict";
import {classifyTelemetry,buildDispatch,signSafetyEvent,verifySafetyEventSignature} from "../src/contract.mjs";

const raw={
  source:"sheet",sheet_id:"S1",event_id:"E1",sequence:1,
  observed_at:"2026-09-21T00:00:00Z",expires_at:"2026-09-21T00:05:00Z",
  delta:{cell:"A1",value:"READY"},node_id:"N1"
};

test("deterministic classification",()=>{
  assert.equal(classifyTelemetry(raw).input_hash,classifyTelemetry(raw).input_hash);
});
test("canonical capability dispatch",()=>{
  assert.equal(buildDispatch(classifyTelemetry(raw),{repository:"o/r"}).client_payload.command_ref,"capability://kex/telemetry/apply");
});
test("missing identity fails",()=>assert.throws(()=>classifyTelemetry({}),/TELEMETRY_MISSING/));
test("sequence is mandatory and positive",()=>{
  assert.throws(()=>classifyTelemetry({...raw,sequence:0}),/SEQUENCE_INVALID/);
});
test("signed safety envelope verifies and tamper fails",()=>{
  const ev=classifyTelemetry({...raw,authority_id:"sheet-ingress"});
  const signed=signSafetyEvent(ev,"secret");
  assert.equal(verifySafetyEventSignature(signed,"secret"),true);
  assert.equal(verifySafetyEventSignature({...signed,node_id:"N2"},"secret"),false);
});
