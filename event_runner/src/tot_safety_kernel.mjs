import {sha256,verifySafetyEventSignature} from "./contract.mjs";
import {AtomicJsonStore} from "./durable_state.mjs";

function seedState(){return {schema:"kex.tot-safety-journal.v2",seen:{},max_sequence:{},decisions:0}}
function trimSeen(state,maxReplay){
  const entries=Object.entries(state.seen||{}).sort((a,b)=>(a[1].accepted_at_ms||0)-(b[1].accepted_at_ms||0));
  while(entries.length>maxReplay){
    const [key]=entries.shift();
    delete state.seen[key];
  }
}
export class ToTSafetyKernel{
  constructor({
    maxClockSkewMs=300000,
    maxReplay=4096,
    journalPath=null,
    requireSignature=true,
    requireSequence=true,
    requireContiguousSequence=true
  }={}){
    this.maxClockSkewMs=maxClockSkewMs;
    this.maxReplay=maxReplay;
    this.requireSignature=requireSignature;
    this.requireSequence=requireSequence;
    this.requireContiguousSequence=requireContiguousSequence;
    this.seen=new Map();
    this.maxSequence=new Map();
    this.store=journalPath?new AtomicJsonStore(journalPath,seedState):null;
    if(this.store){
      const s=this.store.read();
      for(const [k,v] of Object.entries(s.seen||{}))this.seen.set(k,v);
      for(const [k,v] of Object.entries(s.max_sequence||{}))this.maxSequence.set(k,Number(v));
    }
  }
  evaluate(event,ctx={}){
    const reasons=[];
    const now=ctx.nowMs??Date.now();
    const ts=Date.parse(event?.observed_at);
    const expiry=event?.expires_at?Date.parse(event.expires_at):null;
    if(!Number.isFinite(ts)||Math.abs(now-ts)>this.maxClockSkewMs)reasons.push("CLOCK_WINDOW_REJECTED");
    if(expiry!==null&&(!Number.isFinite(expiry)||now>expiry))reasons.push("EVENT_EXPIRED");
    if(!event?.event_id||!event?.input_hash||!event?.node_id)reasons.push("IDENTITY_REQUIRED");
    const authority=event?.authority_id||ctx.authorityId||null;
    if(!authority)reasons.push("AUTHORITY_ID_REQUIRED");
    const seq=Number(event?.sequence);
    if(this.requireSequence&&(!Number.isSafeInteger(seq)||seq<1))reasons.push("SEQUENCE_REQUIRED");
    const replayKey=authority&&event?.event_id?`${authority}:${event.event_id}`:null;
    if(replayKey&&this.seen.has(replayKey))reasons.push("REPLAY_REJECTED");
    const previous=authority?Number(this.maxSequence.get(authority)||0):0;
    if(this.requireSequence&&Number.isSafeInteger(seq)&&seq<=previous)reasons.push("SEQUENCE_ROLLBACK_REJECTED");
    if(this.requireSequence&&this.requireContiguousSequence&&previous>0&&Number.isSafeInteger(seq)&&seq>previous+1)reasons.push("SEQUENCE_GAP_DETECTED");
    if(ctx.expectedInputHash&&ctx.expectedInputHash!==event?.input_hash)reasons.push("HASH_MISMATCH");
    const capability=event?.capability||"telemetry.apply";
    if(!ctx.authorizedCapabilities?.includes(capability))reasons.push("CAPABILITY_NOT_AUTHORIZED");
    if(ctx.nodeState&&ctx.nodeState!=="READY")reasons.push("NODE_NOT_READY");
    if(this.requireSignature){
      const secret=authority?ctx.authoritySecrets?.[authority]:null;
      if(!event?.signature)reasons.push("SIGNATURE_REQUIRED");
      else if(!verifySafetyEventSignature(event,secret))reasons.push("SIGNATURE_INVALID");
    }
    if(reasons.length){
      return {decision:"DENY",reasons,event_id:event?.event_id||null,authority_id:authority,sequence:Number.isFinite(seq)?seq:null};
    }

    const accepted={
      input_hash:event.input_hash,
      sequence:seq,
      accepted_at_ms:now,
      node_id:event.node_id,
      capability
    };
    if(this.store){
      try{
        this.store.transaction(state=>{
          const key=replayKey;
          if(state.seen?.[key])throw new Error("REPLAY_REJECTED_RACE");
          const max=Number(state.max_sequence?.[authority]||0);
          if(seq<=max)throw new Error("SEQUENCE_ROLLBACK_REJECTED_RACE");
          if(this.requireContiguousSequence&&max>0&&seq>max+1)throw new Error("SEQUENCE_GAP_DETECTED_RACE");
          state.seen=state.seen||{};
          state.max_sequence=state.max_sequence||{};
          state.seen[key]=accepted;
          state.max_sequence[authority]=seq;
          state.decisions=Number(state.decisions||0)+1;
          trimSeen(state,this.maxReplay);
          return state;
        });
      }catch(err){
        const token=String(err.message||err);
        if(token.includes("REPLAY_REJECTED_RACE"))return {decision:"DENY",reasons:["REPLAY_REJECTED"],event_id:event.event_id,authority_id:authority,sequence:seq,race_detected:true};
        if(token.includes("SEQUENCE_ROLLBACK_REJECTED_RACE"))return {decision:"DENY",reasons:["SEQUENCE_ROLLBACK_REJECTED"],event_id:event.event_id,authority_id:authority,sequence:seq,race_detected:true};
        if(token.includes("SEQUENCE_GAP_DETECTED_RACE"))return {decision:"DENY",reasons:["SEQUENCE_GAP_DETECTED"],event_id:event.event_id,authority_id:authority,sequence:seq,race_detected:true};
        throw err;
      }
    }
    this.seen.set(replayKey,accepted);
    this.maxSequence.set(authority,seq);
    while(this.seen.size>this.maxReplay)this.seen.delete(this.seen.keys().next().value);

    const decision={
      decision:"ALLOW",
      event_id:event.event_id,
      node_id:event.node_id,
      authority_id:authority,
      sequence:seq,
      capability
    };
    return {...decision,decision_hash:sha256(decision)};
  }
  snapshot(){
    return {
      seen_count:this.seen.size,
      authorities:Object.fromEntries([...this.maxSequence.entries()].sort()),
      state_hash:sha256({seen:[...this.seen.entries()].sort(),max_sequence:[...this.maxSequence.entries()].sort()})
    };
  }
}
