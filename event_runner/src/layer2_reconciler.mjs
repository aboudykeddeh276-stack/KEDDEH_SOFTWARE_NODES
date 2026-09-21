import {sha256} from "./contract.mjs";
export class Layer2Reconciler{
 constructor({maxAttempts=3}={}){this.maxAttempts=maxAttempts}
 plan(desired,observed){
  const ops=[];const byId=new Map((observed||[]).map(x=>[x.node_id,x]));
  for(const d of [...desired].sort((a,b)=>a.node_id.localeCompare(b.node_id))){const o=byId.get(d.node_id);if(!o)ops.push({op:"REGISTER",node:d});else if(sha256(d)!==sha256({...o,observed_at:undefined}))ops.push({op:"RECONCILE",node:d,observed:o});byId.delete(d.node_id)}
  for(const o of [...byId.values()].sort((a,b)=>a.node_id.localeCompare(b.node_id)))ops.push({op:"QUARANTINE_ORPHAN",node:o});
  return {ops,plan_hash:sha256(ops)};
 }
 async apply(plan,adapter){
  const receipts=[];for(const op of plan.ops){let last;for(let n=1;n<=this.maxAttempts;n++){try{const readBefore=await adapter.read(op.node.node_id);const result=await adapter.apply(op);const readAfter=await adapter.read(op.node.node_id);receipts.push({op:op.op,node_id:op.node.node_id,attempt:n,before_hash:sha256(readBefore),result_hash:sha256(result),after_hash:sha256(readAfter),status:"APPLIED"});last=null;break}catch(e){last=e}}if(last)receipts.push({op:op.op,node_id:op.node.node_id,status:"FAILED",reason:String(last.message||last)})}
  return {plan_hash:plan.plan_hash,receipts,receipt_root:sha256(receipts)};
 }
}
