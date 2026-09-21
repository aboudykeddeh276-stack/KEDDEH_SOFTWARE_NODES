import crypto from "node:crypto";
export const canonical=v=>JSON.stringify(sort(v));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>(o[k]=sort(v[k]),o),{});return v}
export const sha256=v=>crypto.createHash("sha256").update(typeof v==="string"?v:canonical(v)).digest("hex");
export function classifyTelemetry(input){
 if(!input||typeof input!=="object")throw new Error("TELEMETRY_REQUIRED");
 for(const k of ["source","sheet_id","event_id","observed_at","delta"])if(!input[k])throw new Error("TELEMETRY_MISSING:"+k);
 const data_class=input.data_class||"EVENT";
 const payload={schema:"kex.telemetry.dispatch.v1",data_class,source:input.source,sheet_id:input.sheet_id,event_id:input.event_id,observed_at:input.observed_at,delta:input.delta,node_id:input.node_id||null,capability:input.capability||"telemetry.apply"};
 return {...payload,input_hash:sha256(payload)};
}
export function buildDispatch(event,{repository,eventType="kex_telemetry_delta"}){
 if(!repository)throw new Error("TARGET_REPOSITORY_REQUIRED");
 return {repository,event_type:eventType,client_payload:{...event,command_ref:"capability://kex/telemetry/apply"}};
}
