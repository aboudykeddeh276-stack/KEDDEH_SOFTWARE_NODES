import fs from "node:fs";import path from "node:path";import {sha256} from "./contract.mjs";
export class ReconcileJournal {
 constructor(file){this.file=file;fs.mkdirSync(path.dirname(file),{recursive:true})}
 append(event){const prior=this.read();const prev=prior.at(-1)?.entry_hash||null;const body={seq:prior.length+1,previous_hash:prev,event};const row={...body,entry_hash:sha256(body)};fs.appendFileSync(this.file,JSON.stringify(row)+"\n",{encoding:"utf8",mode:0o600});const fd=fs.openSync(this.file,"r");fs.fsyncSync(fd);fs.closeSync(fd);return row}
 read(){if(!fs.existsSync(this.file))return[];return fs.readFileSync(this.file,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse)}
 verify(){let prev=null,seq=1;for(const row of this.read()){if(row.seq!==seq++||row.previous_hash!==prev||sha256({seq:row.seq,previous_hash:row.previous_hash,event:row.event})!==row.entry_hash)throw new Error("JOURNAL_INTEGRITY_FAILURE");prev=row.entry_hash}return {status:"VERIFIED",head:prev,count:seq-1}}
}
