import fs from 'node:fs';
import path from 'node:path';
import {sha256,hmac256,constantTimeEqual} from './contract.mjs';
import {readJsonLines,withFileLockSync} from './durable_state.mjs';
export class EvidenceLedger{
  constructor(filePath){this.filePath=filePath}
  entries(){return readJsonLines(this.filePath)}
  append(event){return withFileLockSync(this.filePath,()=>{const entries=readJsonLines(this.filePath),previous=entries.length?entries.at(-1).receipt_hash:'0'.repeat(64),seq=entries.length+1;const body={schema:'kex.evidence-ledger.v2',seq,previous_receipt_hash:previous,recorded_at:new Date().toISOString(),event};const entry={...body,receipt_hash:sha256(body)};fs.mkdirSync(path.dirname(this.filePath),{recursive:true});fs.appendFileSync(this.filePath,JSON.stringify(entry)+'\n',{mode:0o600});const fd=fs.openSync(this.filePath,'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}return entry})}
  verify(){const entries=this.entries();let previous='0'.repeat(64);for(let i=0;i<entries.length;i++){const e=entries[i];if(e.seq!==i+1)return{status:'FAIL',reason:'SEQUENCE_BREAK',index:i};if(e.previous_receipt_hash!==previous)return{status:'FAIL',reason:'CHAIN_BREAK',index:i};const{receipt_hash,...body}=e;if(sha256(body)!==receipt_hash)return{status:'FAIL',reason:'HASH_MISMATCH',index:i};previous=receipt_hash}return{status:'PASS',entries:entries.length,head:previous}}
  seal(secret,key_id='local-anchor'){if(!secret)throw new Error('ANCHOR_SECRET_REQUIRED');const v=this.verify();if(v.status!=='PASS')throw new Error('LEDGER_INVALID');const body={schema:'kex.evidence-anchor.v1',key_id,entries:v.entries,head:v.head};return{...body,signature:hmac256(secret,body)}}
  static verifySeal(seal,secret){const{signature,...body}=seal||{};return Boolean(secret&&signature&&constantTimeEqual(signature,hmac256(secret,body)))}
  static tamperForTest(filePath,index,mutator){const lines=readJsonLines(filePath);lines[index]=mutator(structuredClone(lines[index]));fs.writeFileSync(filePath,lines.map(x=>JSON.stringify(x)).join('\n')+'\n')}
}
