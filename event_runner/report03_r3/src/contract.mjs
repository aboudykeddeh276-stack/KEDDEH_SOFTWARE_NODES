import crypto from 'node:crypto';

function sort(v){
  if(Array.isArray(v)) return v.map(sort);
  if(v && typeof v === 'object') return Object.keys(v).sort().reduce((o,k)=>(o[k]=sort(v[k]),o),{});
  if(typeof v === 'number' && !Number.isFinite(v)) throw new Error('NON_FINITE_JSON_NUMBER');
  return v;
}
export const canonical=v=>JSON.stringify(sort(v));
export const sha256=v=>crypto.createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
export const hmac256=(secret,v)=>crypto.createHmac('sha256',secret).update(typeof v==='string'?v:canonical(v)).digest('hex');
export function constantTimeEqual(a,b){
  const aa=Buffer.from(String(a||''),'utf8'), bb=Buffer.from(String(b||''),'utf8');
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
export function classifyTelemetry(input){
  if(!input || typeof input !== 'object') throw new Error('TELEMETRY_REQUIRED');
  for(const k of ['source','sheet_id','event_id','observed_at','delta','node_id','sequence','authority_id','key_id','policy_id','policy_hash']){
    if(input[k]===undefined || input[k]===null || input[k]==='') throw new Error('TELEMETRY_MISSING:'+k);
  }
  if(!Number.isSafeInteger(Number(input.sequence)) || Number(input.sequence)<1) throw new Error('TELEMETRY_SEQUENCE_INVALID');
  const payload={
    schema:'kex.telemetry.dispatch.v3',
    data_class:input.data_class||'EVENT',
    source:input.source,
    sheet_id:input.sheet_id,
    event_id:input.event_id,
    sequence:Number(input.sequence),
    observed_at:input.observed_at,
    expires_at:input.expires_at||null,
    delta:input.delta,
    node_id:input.node_id,
    authority_id:input.authority_id,
    key_id:input.key_id,
    policy_id:input.policy_id,
    policy_hash:input.policy_hash,
    capability:input.capability||'telemetry.apply'
  };
  return {...payload,input_hash:sha256(payload)};
}
export function safetySignaturePayload(event){
  return {
    event_id:event.event_id,input_hash:event.input_hash,authority_id:event.authority_id,key_id:event.key_id,
    policy_id:event.policy_id,policy_hash:event.policy_hash,sequence:event.sequence,observed_at:event.observed_at,
    expires_at:event.expires_at||null,node_id:event.node_id,capability:event.capability
  };
}
export function signSafetyEvent(event,secret){
  if(!secret) throw new Error('EVENT_SIGNING_SECRET_REQUIRED');
  return {...event,signature:hmac256(secret,safetySignaturePayload(event))};
}
export function verifySafetyEventSignature(event,secret){
  if(!secret || !event?.signature) return false;
  return constantTimeEqual(event.signature,hmac256(secret,safetySignaturePayload(event)));
}
