import test from "node:test";import assert from "node:assert/strict";import {classifyTelemetry,buildDispatch} from "../src/contract.mjs";
const x={source:"sheet",sheet_id:"S1",event_id:"E1",observed_at:"2026-09-21T00:00:00Z",delta:{cell:"A1",value:"READY"},node_id:"N1"};
test("deterministic classification",()=>assert.equal(classifyTelemetry(x).input_hash,classifyTelemetry(x).input_hash));
test("canonical capability dispatch",()=>assert.equal(buildDispatch(classifyTelemetry(x),{repository:"o/r"}).client_payload.command_ref,"capability://kex/telemetry/apply"));
test("missing identity fails",()=>assert.throws(()=>classifyTelemetry({}),/TELEMETRY_MISSING/));
