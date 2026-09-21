import fs from "node:fs";
import {sha256} from "./contract.mjs";
import {appendJsonLineSync,readJsonLines,withFileLockSync} from "./durable_state.mjs";

export function evidenceReceipt({run_id,tests,faults,directory,reconcile,boundaries=[],standards=[]}){
  const body={schema:"kex.report03.evidence.v2",run_id,tests,faults,directory,reconcile,boundaries,standards};
  return {...body,receipt_hash:sha256(body)};
}

export class EvidenceLedger{
  constructor(filePath){this.filePath=filePath}
  entries(){return readJsonLines(this.filePath)}
  append(event){
    return withFileLockSync(this.filePath,()=>{
      const entries=readJsonLines(this.filePath);
      const previous=entries.length?entries[entries.length-1].receipt_hash:"0".repeat(64);
      const seq=entries.length+1;
      const body={
        schema:"kex.evidence-ledger.v1",
        seq,
        previous_receipt_hash:previous,
        recorded_at:new Date().toISOString(),
        event
      };
      const entry={...body,receipt_hash:sha256(body)};
      appendJsonLineSync(this.filePath,entry);
      return entry;
    });
  }
  verify(){
    const entries=this.entries();
    let previous="0".repeat(64);
    for(let i=0;i<entries.length;i++){
      const e=entries[i];
      if(e.seq!==i+1)return {status:"FAIL",reason:"SEQUENCE_BREAK",index:i};
      if(e.previous_receipt_hash!==previous)return {status:"FAIL",reason:"CHAIN_BREAK",index:i};
      const {receipt_hash,...body}=e;
      if(sha256(body)!==receipt_hash)return {status:"FAIL",reason:"HASH_MISMATCH",index:i};
      previous=receipt_hash;
    }
    return {status:"PASS",entries:entries.length,head:previous};
  }
  static tamperForTest(filePath,index,mutator){
    const lines=readJsonLines(filePath);
    lines[index]=mutator(structuredClone(lines[index]));
    fs.writeFileSync(filePath,lines.map(x=>JSON.stringify(x)).join("\n")+"\n");
  }
}
