#!/usr/bin/env node
import path from "node:path";
import {classifyTelemetry,verifySafetyEventSignature} from "../src/contract.mjs";
import {ToTSafetyKernel} from "../src/tot_safety_kernel.mjs";

function fail(reason,details={}){
  console.error(JSON.stringify({status:"BLOCKED",reason,...details}));
  process.exit(2);
}

const raw=process.env.KEX_EVENT_JSON||"";
if(!raw)fail("KEX_EVENT_JSON_REQUIRED");
let event;
try{event=JSON.parse(raw)}catch(err){fail("KEX_EVENT_JSON_INVALID",{error:String(err.message||err)})}

const secret=process.env.KEX_EVENT_SIGNING_SECRET||"";
const authorityId=process.env.KEX_INGRESS_AUTHORITY_ID||"sheet-ingress";
const nodeState=process.env.KEX_NODE_STATE||"UNOBSERVED";
const statePath=process.env.KEX_RUNNER_SAFETY_STATE_PATH||path.resolve("event_runner/state/runner-tot-safety.json");

if(!secret)fail("KEX_EVENT_SIGNING_SECRET_REQUIRED");
if(nodeState!=="READY")fail("NODE_NOT_READY",{node_state:nodeState});
if(event.command_ref!=="capability://kex/telemetry/apply")fail("COMMAND_REF_REJECTED");
if(event.authority_id!==authorityId)fail("AUTHORITY_ID_MISMATCH");
if(!verifySafetyEventSignature(event,secret))fail("SIGNATURE_INVALID");

let classified;
try{
  classified=classifyTelemetry(event);
}catch(err){
  fail("EVENT_CONTRACT_INVALID",{error:String(err.message||err)});
}
if(classified.input_hash!==event.input_hash)fail("INPUT_HASH_MISMATCH");

const kernel=new ToTSafetyKernel({journalPath:statePath,requireSignature:true,requireSequence:true});
const decision=kernel.evaluate(event,{
  expectedInputHash:event.input_hash,
  authorizedCapabilities:["telemetry.apply"],
  nodeState,
  authoritySecrets:{[authorityId]:secret}
});
if(decision.decision!=="ALLOW")fail("TOT_SAFETY_DENIED",{decision});

console.log(JSON.stringify({
  status:"VALIDATED",
  event_id:event.event_id,
  sequence:event.sequence,
  node_id:event.node_id,
  input_hash:event.input_hash,
  safety_decision_hash:decision.decision_hash
}));
