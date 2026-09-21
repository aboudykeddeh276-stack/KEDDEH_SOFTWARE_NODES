import {sha256} from "./contract.mjs";
import {AtomicJsonStore} from "./durable_state.mjs";

const seedState=()=>({schema:"kex.coordinate-directory.v2",directory_version:0,records:{},conflicts:{}});
const vectorCompare=(a={},b={})=>{
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  let ag=false,bg=false;
  for(const k of keys){
    const av=Number(a[k]||0),bv=Number(b[k]||0);
    if(av>bv)ag=true;
    if(bv>av)bg=true;
  }
  if(ag&&bg)return "CONCURRENT";
  if(ag)return "DOMINATES";
  if(bg)return "DOMINATED";
  return "EQUAL";
};
const stripHash=r=>{const {record_hash,...body}=r;return body};
function validateRecord(r){
  if(!r?.node_id||!r.writer_id||!r.vector||!Number.isSafeInteger(Number(r.version)))throw new Error("COORDINATE_RECORD_INVALID");
  if(sha256(stripHash(r))!==r.record_hash)throw new Error("COORDINATE_HASH_INVALID");
  return true;
}

export class CoordinateDirectory{
  constructor({writerId="local",statePath=null}={}){
    if(!writerId)throw new Error("WRITER_ID_REQUIRED");
    this.writerId=writerId;
    this.store=statePath?new AtomicJsonStore(statePath,seedState):null;
    this.state=this.store?this.store.read():seedState();
  }
  _persist(){if(this.store)this.store.write(this.state)}
  _make(record,prior,{tombstone=false}={}){
    const vector={...(prior?.vector||{})};
    vector[this.writerId]=Number(vector[this.writerId]||0)+1;
    const version=Number(prior?.version||0)+1;
    const canonical={
      node_id:record.node_id,
      writer_id:this.writerId,
      logical:tombstone?null:(record.logical??prior?.logical??null),
      runtime:tombstone?null:(record.runtime??prior?.runtime??null),
      network:tombstone?null:(record.network??prior?.network??null),
      capabilities:tombstone?[]:[...(record.capabilities??prior?.capabilities??[])].sort(),
      health:tombstone?"TOMBSTONED":(record.health??prior?.health??"UNKNOWN"),
      tombstone,
      vector,
      version
    };
    return {...canonical,record_hash:sha256(canonical)};
  }
  upsert(record,{expectedVersion,expectedHash}={}){
    if(!record?.node_id)throw new Error("NODE_ID_REQUIRED");
    const mutate=state=>{
      const prior=state.records[record.node_id]||null;
      if(expectedVersion!==undefined&&Number(prior?.version||0)!==Number(expectedVersion))throw new Error("COORDINATE_VERSION_CONFLICT");
      if(expectedHash!==undefined&&(prior?.record_hash||null)!==expectedHash)throw new Error("COORDINATE_HASH_CONFLICT");
      const next=this._make(record,prior);
      state.records[record.node_id]=next;
      delete state.conflicts[record.node_id];
      state.directory_version=Number(state.directory_version||0)+1;
      return state;
    };
    this.state=this.store?this.store.transaction(mutate):mutate(structuredClone(this.state));
    return this.state.records[record.node_id];
  }
  remove(node_id,{expectedHash}={}){
    if(!node_id)throw new Error("NODE_ID_REQUIRED");
    const mutate=state=>{
      const prior=state.records[node_id];
      if(!prior)throw new Error("COORDINATE_NOT_FOUND");
      if(expectedHash!==undefined&&prior.record_hash!==expectedHash)throw new Error("COORDINATE_HASH_CONFLICT");
      const next=this._make({node_id},prior,{tombstone:true});
      state.records[node_id]=next;
      delete state.conflicts[node_id];
      state.directory_version=Number(state.directory_version||0)+1;
      return state;
    };
    this.state=this.store?this.store.transaction(mutate):mutate(structuredClone(this.state));
    return this.state.records[node_id];
  }
  get(id,{includeTombstone=false}={}){
    const r=this.state.records[id]||null;
    if(r?.tombstone&&!includeTombstone)return null;
    return r;
  }
  conflicts(){return structuredClone(this.state.conflicts||{})}
  snapshot(){
    const records=Object.values(this.state.records).sort((a,b)=>a.node_id.localeCompare(b.node_id));
    const conflicts=Object.fromEntries(Object.entries(this.state.conflicts||{}).sort(([a],[b])=>a.localeCompare(b)));
    const body={directory_version:Number(this.state.directory_version||0),records,conflicts};
    return {...body,snapshot_hash:sha256(body)};
  }
  merge(remote){
    if(!remote||!Array.isArray(remote.records))throw new Error("REMOTE_SNAPSHOT_INVALID");
    if(remote.snapshot_hash){
      const body={directory_version:Number(remote.directory_version||0),records:remote.records,conflicts:remote.conflicts||{}};
      if(sha256(body)!==remote.snapshot_hash)throw new Error("REMOTE_SNAPSHOT_HASH_INVALID");
    }
    const mutate=state=>{
      for(const r of remote.records){
        validateRecord(r);
        const local=state.records[r.node_id];
        if(!local){state.records[r.node_id]=r;continue}
        const cmp=vectorCompare(r.vector,local.vector);
        if(cmp==="DOMINATES"){state.records[r.node_id]=r;delete state.conflicts[r.node_id];continue}
        if(cmp==="DOMINATED")continue;
        if(cmp==="EQUAL"){
          if(r.record_hash!==local.record_hash)throw new Error("COORDINATE_EQUIVOCATION");
          continue;
        }
        state.conflicts[r.node_id]={
          node_id:r.node_id,
          local_hash:local.record_hash,
          remote_hash:r.record_hash,
          local_vector:local.vector,
          remote_vector:r.vector,
          local_record:structuredClone(local),
          remote_record:structuredClone(r),
          detected_at:new Date().toISOString()
        };
      }
      state.directory_version=Math.max(Number(state.directory_version||0),Number(remote.directory_version||0));
      return state;
    };
    this.state=this.store?this.store.transaction(mutate):mutate(structuredClone(this.state));
    if(Object.keys(this.state.conflicts||{}).length)throw new Error("COORDINATE_CONCURRENT_CONFLICT");
    return this.snapshot();
  }
  resolveConflict(node_id,chosenHash){
    const mutate=state=>{
      const conflict=state.conflicts?.[node_id];
      if(!conflict)throw new Error("COORDINATE_CONFLICT_NOT_FOUND");
      if(![conflict.local_hash,conflict.remote_hash].includes(chosenHash))throw new Error("COORDINATE_RESOLUTION_HASH_INVALID");
      const chosen=chosenHash===conflict.local_hash?conflict.local_record:conflict.remote_record;
      if(!chosen)throw new Error("COORDINATE_CONFLICT_CANDIDATE_MISSING");
      const mergedVector={};
      for(const key of new Set([...Object.keys(conflict.local_vector||{}),...Object.keys(conflict.remote_vector||{})])){
        mergedVector[key]=Math.max(Number(conflict.local_vector?.[key]||0),Number(conflict.remote_vector?.[key]||0));
      }
      mergedVector[this.writerId]=Number(mergedVector[this.writerId]||0)+1;
      const canonical={
        node_id,
        writer_id:this.writerId,
        logical:chosen.logical??null,
        runtime:chosen.runtime??null,
        network:chosen.network??null,
        capabilities:[...(chosen.capabilities||[])].sort(),
        health:chosen.health||"UNKNOWN",
        tombstone:Boolean(chosen.tombstone),
        vector:mergedVector,
        version:Math.max(Number(conflict.local_record?.version||0),Number(conflict.remote_record?.version||0))+1,
        resolution_of:[conflict.local_hash,conflict.remote_hash].sort()
      };
      const resolved={...canonical,record_hash:sha256(canonical)};
      state.records[node_id]=resolved;
      delete state.conflicts[node_id];
      state.directory_version=Number(state.directory_version||0)+1;
      return state;
    };
    this.state=this.store?this.store.transaction(mutate):mutate(structuredClone(this.state));
    return this.state.records[node_id];
  }
}
export {vectorCompare};
