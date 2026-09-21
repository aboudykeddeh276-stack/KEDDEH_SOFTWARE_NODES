import {sha256,verifySafetyEventSignature} from './contract.mjs';
import {AtomicJsonStore} from './durable_state.mjs';
const seedState=()=>({schema:'kex.tot-safety-journal.v3',seen:{},max_sequence:{},decisions:0});
function trimSeen(state,maxReplay){
  const entries=Object.entries(state.seen||{}).sort((a,b)=>(a[1].accepted_at_ms||0)-(b[1].accepted_at_ms||0));
  while(entries.length>maxReplay){const [k]=entries.shift();delete state.seen[k]}
}
export class ToTSafetyKernel{
  constructor({maxClockSkewMs=300000,maxReplay=4096,journalPath=null,requireSignature=true,requireSequence=true}={}){
    this.maxClockSkewMs=maxClockSkewMs;this.maxReplay=maxReplay;this.requireSignature=requireSignature;this.requireSequence=requireSequence;
    this.store=journalPath?new AtomicJsonStore(journalPath,seedState):null;
    const s=this.store?this.store.read():seedState(); this.seen=new Map(Object.entries(s.seen||{})); this.maxSequence=new Map(Object.entries(s.max_sequence||{}).map(([k,v])=>[k,Number(v)]));
  }
  evaluate(event,ctx={}){
    const reasons=[]; const now=ctx.nowMs??Date.now(); const ts=Date.parse(event?.observed_at); const expiry=event?.expires_at?Date.parse(event.expires_at):null;
    if(!Number.isFinite(ts)||Math.abs(now-ts)>this.maxClockSkewMs) reasons.push('CLOCK_WINDOW_REJECTED');
    if(expiry!==null&&(!Number.isFinite(expiry)||now>expiry)) reasons.push('EVENT_EXPIRED');
    for(const k of ['event_id','input_hash','node_id','authority_id','key_id','policy_id','policy_hash']) if(!event?.[k]) reasons.push(`IDENTITY_REQUIRED:${k}`);
    const seq=Number(event?.sequence); if(this.requireSequence&&(!Number.isSafeInteger(seq)||seq<1)) reasons.push('SEQUENCE_REQUIRED');
    const replayKey=event?.authority_id&&event?.event_id?`${event.authority_id}:${event.event_id}`:null;
    if(replayKey&&this.seen.has(replayKey)) reasons.push('REPLAY_REJECTED');
    const previous=event?.authority_id?Number(this.maxSequence.get(event.authority_id)||0):0;
    if(this.requireSequence&&Number.isSafeInteger(seq)&&seq<=previous) reasons.push('SEQUENCE_ROLLBACK_REJECTED');
    if(ctx.expectedInputHash&&ctx.expectedInputHash!==event?.input_hash) reasons.push('HASH_MISMATCH');
    if(!ctx.policyId||ctx.policyId!==event?.policy_id) reasons.push('POLICY_ID_MISMATCH');
    if(!ctx.policyHash||ctx.policyHash!==event?.policy_hash) reasons.push('POLICY_HASH_MISMATCH');
    const capability=event?.capability||'telemetry.apply';
    if(!ctx.authorizedCapabilities?.includes(capability)) reasons.push('CAPABILITY_NOT_AUTHORIZED');
    if(ctx.nodeState!=='READY') reasons.push('NODE_NOT_READY');
    if(this.requireSignature){
      const secret=ctx.authorityKeys?.[event?.authority_id]?.[event?.key_id]||null;
      if(!event?.signature) reasons.push('SIGNATURE_REQUIRED'); else if(!verifySafetyEventSignature(event,secret)) reasons.push('SIGNATURE_INVALID');
    }
    if(reasons.length) return {decision:'DENY',reasons,event_id:event?.event_id||null,authority_id:event?.authority_id||null,key_id:event?.key_id||null,sequence:Number.isFinite(seq)?seq:null};
    const accepted={input_hash:event.input_hash,sequence:seq,accepted_at_ms:now,node_id:event.node_id,capability,key_id:event.key_id,policy_hash:event.policy_hash};
    if(this.store){
      this.store.transaction(state=>{
        if(state.seen?.[replayKey]) throw new Error('REPLAY_REJECTED_RACE');
        const max=Number(state.max_sequence?.[event.authority_id]||0); if(seq<=max) throw new Error('SEQUENCE_ROLLBACK_REJECTED_RACE');
        state.seen=state.seen||{};state.max_sequence=state.max_sequence||{};state.seen[replayKey]=accepted;state.max_sequence[event.authority_id]=seq;state.decisions=Number(state.decisions||0)+1;trimSeen(state,this.maxReplay);return state;
      });
    }
    this.seen.set(replayKey,accepted);this.maxSequence.set(event.authority_id,seq);while(this.seen.size>this.maxReplay)this.seen.delete(this.seen.keys().next().value);
    const decision={decision:'ALLOW',event_id:event.event_id,node_id:event.node_id,authority_id:event.authority_id,key_id:event.key_id,policy_id:event.policy_id,policy_hash:event.policy_hash,sequence:seq,capability,authorization_hash:sha256({authorizedCapabilities:[...ctx.authorizedCapabilities].sort(),nodeState:ctx.nodeState})};
    return {...decision,decision_hash:sha256(decision)};
  }
  snapshot(){return {seen_count:this.seen.size,authorities:Object.fromEntries([...this.maxSequence.entries()].sort()),state_hash:sha256({seen:[...this.seen.entries()].sort(),max_sequence:[...this.maxSequence.entries()].sort()})}}
}
