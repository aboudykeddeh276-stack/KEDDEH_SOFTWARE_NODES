import path from 'node:path';
import {ToTSafetyKernel} from './tot_safety_kernel.mjs';
import {CoordinateDirectory} from './coordinate_directory.mjs';
import {Layer2Reconciler} from './layer2_reconciler.mjs';
import {EvidenceLedger} from './evidence_receipt.mjs';
import {sha256} from './contract.mjs';

export class Report03ControlPlane{
  constructor({stateDir='state/report03-r3',writerId='local',writerSecret,writerSecrets={},maxAttempts=3,safety={}}={}){
    if(!writerSecret) throw new Error('WRITER_SECRET_REQUIRED');
    this.stateDir=stateDir;
    this.safety=new ToTSafetyKernel({...safety,journalPath:safety.journalPath||path.join(stateDir,'tot-safety.json')});
    this.directory=new CoordinateDirectory({writerId,writerSecret,writerSecrets,statePath:path.join(stateDir,'coordinate-directory.json')});
    this.reconciler=new Layer2Reconciler({maxAttempts,statePath:path.join(stateDir,'layer2-reconciler.json')});
    this.ledger=new EvidenceLedger(path.join(stateDir,'evidence-ledger.jsonl'));
  }
  admitEvent(event,context){const decision=this.safety.evaluate(event,context);this.ledger.append({type:'TOT_DECISION',decision});return decision}
  upsertCoordinate(record,precondition={}){const next=this.directory.upsert(record,precondition);this.ledger.append({type:'COORDINATE_UPSERT',record_hash:next.record_hash,node_id:next.node_id});return next}
  mergeCoordinates(snapshot){try{const merged=this.directory.merge(snapshot);this.ledger.append({type:'COORDINATE_MERGE',status:'MERGED',snapshot_hash:merged.snapshot_hash});return merged}catch(err){this.ledger.append({type:'COORDINATE_MERGE',status:'CONFLICT',reason:String(err.message||err),remote_snapshot_hash:snapshot?.snapshot_hash||null,conflicts:this.directory.conflicts()});throw err}}
  resolveCoordinateConflict(node_id,chosenHash){const r=this.directory.resolveConflict(node_id,chosenHash);this.ledger.append({type:'COORDINATE_CONFLICT_RESOLVED',node_id,record_hash:r.record_hash});return r}
  async reconcile(desired,observed,adapter,options={}){const plan=this.reconciler.plan(desired,observed,{generation:options.generation||1});this.ledger.append({type:'L2_PLAN',generation:plan.generation,plan_hash:plan.plan_hash,ops:plan.ops.map(x=>({op:x.op,node_id:x.node.node_id,idempotency_key:x.idempotency_key}))});const result=await this.reconciler.apply(plan,adapter,{safetyGate:options.safetyGate||null});this.ledger.append({type:'L2_RESULT',receipt_root:result.receipt_root,summary:result.summary});return{plan,result}}
  status(){const body={safety:this.safety.snapshot(),directory:this.directory.snapshot(),evidence:this.ledger.verify(),reconciler:{max_generation:Number(this.reconciler.state.max_generation||0),applied_keys:Object.keys(this.reconciler.state.applied||{}).length}};return{...body,status_hash:sha256(body)}}
  sealEvidence(secret,key_id='report03-anchor'){const seal=this.ledger.seal(secret,key_id);return{...seal,status_hash:this.status().status_hash}}
}
