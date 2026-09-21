import {sha256} from './contract.mjs';
import {AtomicJsonStore} from './durable_state.mjs';
const EPHEMERAL_KEYS=new Set(['observed_at','readback_at','updated_at','created_at','last_seen','proof_root','record_hash','version','writer_id','vector']);
export function semantic(value){if(Array.isArray(value))return value.map(semantic);if(value&&typeof value==='object')return Object.keys(value).sort().reduce((o,k)=>{if(!EPHEMERAL_KEYS.has(k)&&value[k]!==undefined)o[k]=semantic(value[k]);return o},{});return value}
export function contains(actual,expected){if(expected===null||typeof expected!=='object')return Object.is(actual,expected);if(Array.isArray(expected))return Array.isArray(actual)&&expected.length===actual.length&&expected.every((v,i)=>contains(actual[i],v));if(actual===null||typeof actual!=='object')return false;return Object.entries(expected).every(([k,v])=>Object.prototype.hasOwnProperty.call(actual,k)&&contains(actual[k],v))}
function defaultVerify(op,after){if(op.op==='QUARANTINE_ORPHAN')return Boolean(after&&(after.quarantined===true||after.health==='QUARANTINED'));return contains(semantic(after),semantic(op.node))}
const seedJournal=()=>({schema:'kex.l2-reconciler-journal.v1',max_generation:0,generation_plan_hash:{},applied:{}});

export class Layer2Reconciler{
  constructor({maxAttempts=3,statePath=null}={}){if(!Number.isInteger(maxAttempts)||maxAttempts<1)throw new Error('MAX_ATTEMPTS_INVALID');this.maxAttempts=maxAttempts;this.store=statePath?new AtomicJsonStore(statePath,seedJournal):null;this.state=this.store?this.store.read():seedJournal()}
  plan(desired,observed,{generation=1}={}){
    if(!Number.isSafeInteger(generation)||generation<1)throw new Error('GENERATION_INVALID');const ops=[];const byId=new Map((observed||[]).map(x=>[x.node_id,x]));
    for(const d of [...(desired||[])].sort((a,b)=>a.node_id.localeCompare(b.node_id))){if(!d?.node_id)throw new Error('DESIRED_NODE_ID_REQUIRED');const o=byId.get(d.node_id),desiredHash=sha256(semantic(d));if(!o){const base={op:'REGISTER',node:d,desired_hash:desiredHash,generation};ops.push({...base,idempotency_key:sha256(base)})}else if(desiredHash!==sha256(semantic(o))){const base={op:'RECONCILE',node:d,observed:o,desired_hash:desiredHash,observed_hash:sha256(semantic(o)),generation};ops.push({...base,idempotency_key:sha256(base)})}byId.delete(d.node_id)}
    for(const o of [...byId.values()].sort((a,b)=>a.node_id.localeCompare(b.node_id))){const base={op:'QUARANTINE_ORPHAN',node:o,observed_hash:sha256(semantic(o)),generation};ops.push({...base,idempotency_key:sha256(base)})}
    const body={generation,ops};return {...body,plan_hash:sha256(body)};
  }
  _admitPlan(plan){
    const mutate=state=>{const max=Number(state.max_generation||0),known=state.generation_plan_hash?.[plan.generation];if(plan.generation<max)throw new Error('STALE_GENERATION');if(known&&known!==plan.plan_hash)throw new Error('GENERATION_EQUIVOCATION');state.generation_plan_hash=state.generation_plan_hash||{};state.generation_plan_hash[plan.generation]=plan.plan_hash;state.max_generation=Math.max(max,plan.generation);return state};
    this.state=this.store?this.store.transaction(mutate):mutate(structuredClone(this.state));
  }
  _recordApplied(key,receipt){const mutate=state=>{state.applied=state.applied||{};state.applied[key]=receipt;return state};this.state=this.store?this.store.transaction(mutate):mutate(structuredClone(this.state))}
  async apply(plan,adapter,{safetyGate=null}={}){
    if(!plan?.plan_hash||sha256({generation:plan.generation,ops:plan.ops})!==plan.plan_hash)throw new Error('PLAN_HASH_INVALID');this._admitPlan(plan);const receipts=[];
    for(const op of plan.ops){
      let before=null,lastError=null;try{before=await adapter.read(op.node.node_id)}catch(e){lastError=e}
      if(lastError){receipts.push({op:op.op,node_id:op.node.node_id,status:'READ_BEFORE_FAILED',reason:String(lastError.message||lastError),idempotency_key:op.idempotency_key});continue}
      const prior=this.state.applied?.[op.idempotency_key];
      if(prior){const stillValid=defaultVerify(op,before);if(stillValid){receipts.push({...prior,status:'IDEMPOTENT_REPLAY_VERIFIED',replayed:true});continue}}
      if(safetyGate){const gate=await safetyGate(op,before);if(!gate||gate.decision!=='ALLOW'){receipts.push({op:op.op,node_id:op.node.node_id,status:'SAFETY_DENIED',gate:gate||null,idempotency_key:op.idempotency_key});continue}}
      const attempts=[];let applied=false,after=null,result=null;
      for(let n=1;n<=this.maxAttempts;n++){
        try{result=await adapter.apply({...op,idempotency_key:op.idempotency_key,attempt:n});after=await adapter.read(op.node.node_id);const verified=adapter.verify?Boolean(await adapter.verify(op,after,result)):defaultVerify(op,after);attempts.push({attempt:n,result_hash:sha256(result),after_hash:sha256(after),verified});if(!verified){lastError=new Error('READBACK_DIVERGED');continue}const receipt={op:op.op,node_id:op.node.node_id,attempt:n,before_hash:sha256(before),desired_hash:op.desired_hash||null,result_hash:sha256(result),after_hash:sha256(after),idempotency_key:op.idempotency_key,status:'APPLIED_VERIFIED',verification:'READBACK_MATCH',attempts,generation:plan.generation,plan_hash:plan.plan_hash};receipts.push(receipt);this._recordApplied(op.idempotency_key,receipt);applied=true;lastError=null;break}catch(e){lastError=e;attempts.push({attempt:n,error:String(e.message||e)})}
      }
      if(applied)continue;
      let rollback=null;if(typeof adapter.rollback==='function'){try{const rr=await adapter.rollback(op,before,{idempotency_key:op.idempotency_key});const readback=await adapter.read(op.node.node_id);const rollbackVerified=contains(semantic(readback),semantic(before));rollback={status:rollbackVerified?'ROLLED_BACK_VERIFIED':'ROLLBACK_DIVERGED',result_hash:sha256(rr),readback_hash:sha256(readback)}}catch(e){rollback={status:'ROLLBACK_FAILED',reason:String(e.message||e)}}}
      receipts.push({op:op.op,node_id:op.node.node_id,status:rollback?.status==='ROLLED_BACK_VERIFIED'?'ROLLED_BACK':'FAILED_QUARANTINE_REQUIRED',reason:String(lastError?.message||lastError||'UNKNOWN'),before_hash:sha256(before),desired_hash:op.desired_hash||null,idempotency_key:op.idempotency_key,attempts,rollback,generation:plan.generation,plan_hash:plan.plan_hash});
    }
    const summary={applied_verified:receipts.filter(x=>x.status==='APPLIED_VERIFIED').length,idempotent_replay_verified:receipts.filter(x=>x.status==='IDEMPOTENT_REPLAY_VERIFIED').length,rolled_back:receipts.filter(x=>x.status==='ROLLED_BACK').length,failed_or_quarantined:receipts.filter(x=>['FAILED_QUARANTINE_REQUIRED','SAFETY_DENIED','READ_BEFORE_FAILED'].includes(x.status)).length};
    const body={plan_hash:plan.plan_hash,generation:plan.generation,receipts,summary};return {...body,receipt_root:sha256(body)};
  }
}
