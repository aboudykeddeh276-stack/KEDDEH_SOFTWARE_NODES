import {sha256} from "./contract.mjs";
export class ToTSafetyKernel{
 constructor({maxClockSkewMs=300000,maxReplay=2048}={}){this.maxClockSkewMs=maxClockSkewMs;this.maxReplay=maxReplay;this.seen=new Map()}
 evaluate(event,ctx={}){
  const reasons=[]; const now=ctx.nowMs??Date.now(); const ts=Date.parse(event.observed_at);
  if(!Number.isFinite(ts)||Math.abs(now-ts)>this.maxClockSkewMs)reasons.push("CLOCK_WINDOW_REJECTED");
  if(!event.event_id||!event.input_hash)reasons.push("IDENTITY_REQUIRED");
  if(this.seen.has(event.event_id))reasons.push("REPLAY_REJECTED");
  if(ctx.expectedInputHash&&ctx.expectedInputHash!==event.input_hash)reasons.push("HASH_MISMATCH");
  if(!ctx.authorizedCapabilities?.includes(event.capability||"telemetry.apply"))reasons.push("CAPABILITY_NOT_AUTHORIZED");
  if(ctx.nodeState&&ctx.nodeState!=="READY")reasons.push("NODE_NOT_READY");
  if(reasons.length)return {decision:"DENY",reasons};
  this.seen.set(event.event_id,event.input_hash);while(this.seen.size>this.maxReplay)this.seen.delete(this.seen.keys().next().value);
  const decision={decision:"ALLOW",event_id:event.event_id,node_id:event.node_id,capability:event.capability||"telemetry.apply"};
  return {...decision,decision_hash:sha256(decision)};
 }
}
