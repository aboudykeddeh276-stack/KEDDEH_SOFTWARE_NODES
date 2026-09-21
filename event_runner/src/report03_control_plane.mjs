import path from "node:path";
import {ToTSafetyKernel} from "./tot_safety_kernel.mjs";
import {CoordinateDirectory} from "./coordinate_directory.mjs";
import {Layer2Reconciler} from "./layer2_reconciler.mjs";
import {EvidenceLedger,evidenceReceipt} from "./evidence_receipt.mjs";
import {sha256} from "./contract.mjs";

export class Report03ControlPlane{
  constructor({
    stateDir="state/report03",
    writerId="local",
    maxAttempts=3,
    safety={}
  }={}){
    this.stateDir=stateDir;
    this.safety=new ToTSafetyKernel({...safety,journalPath:safety.journalPath||path.join(stateDir,"tot-safety.json")});
    this.directory=new CoordinateDirectory({writerId,statePath:path.join(stateDir,"coordinate-directory.json")});
    this.reconciler=new Layer2Reconciler({maxAttempts});
    this.ledger=new EvidenceLedger(path.join(stateDir,"evidence-ledger.jsonl"));
  }
  admitEvent(event,context){
    const decision=this.safety.evaluate(event,context);
    this.ledger.append({type:"TOT_DECISION",decision});
    return decision;
  }
  upsertCoordinate(record,precondition={}){
    const next=this.directory.upsert(record,precondition);
    this.ledger.append({type:"COORDINATE_UPSERT",record:next});
    return next;
  }
  removeCoordinate(node_id,precondition={}){
    const next=this.directory.remove(node_id,precondition);
    this.ledger.append({type:"COORDINATE_TOMBSTONE",record:next});
    return next;
  }
  mergeCoordinates(snapshot){
    try{
      const merged=this.directory.merge(snapshot);
      this.ledger.append({type:"COORDINATE_MERGE",snapshot_hash:merged.snapshot_hash,status:"MERGED"});
      return merged;
    }catch(err){
      this.ledger.append({type:"COORDINATE_MERGE",remote_snapshot_hash:snapshot?.snapshot_hash||null,status:"CONFLICT",reason:String(err.message||err),conflicts:this.directory.conflicts()});
      throw err;
    }
  }
  async reconcile(desired,observed,adapter,options={}){
    const plan=this.reconciler.plan(desired,observed,{generation:options.generation||1});
    this.ledger.append({type:"L2_PLAN",plan_hash:plan.plan_hash,generation:plan.generation,ops:plan.ops.map(x=>({op:x.op,node_id:x.node.node_id,idempotency_key:x.idempotency_key}))});
    const result=await this.reconciler.apply(plan,adapter,{safetyGate:options.safetyGate||null});
    this.ledger.append({type:"L2_RESULT",receipt_root:result.receipt_root,summary:result.summary});
    return {plan,result};
  }
  recordQualification({run_id,tests,faults,boundaries=[],standards=[]}){
    const receipt=evidenceReceipt({
      run_id,
      tests,
      faults,
      directory:this.directory.snapshot(),
      reconcile:null,
      boundaries,
      standards
    });
    const ledgerEntry=this.ledger.append({type:"REPORT03_QUALIFICATION",receipt});
    return {receipt,ledger_entry:ledgerEntry,ledger_verification:this.ledger.verify()};
  }
  status(){
    const body={
      safety:this.safety.snapshot(),
      directory:this.directory.snapshot(),
      evidence:this.ledger.verify()
    };
    return {...body,status_hash:sha256(body)};
  }
}
