import {sha256} from "./contract.mjs";
export class CoordinateDirectory{
 constructor(){this.records=new Map();this.version=0}
 upsert(record,{expectedVersion}={}){
  if(!record?.node_id)throw new Error("NODE_ID_REQUIRED");
  const prior=this.records.get(record.node_id);
  if(expectedVersion!==undefined&&(prior?.version??0)!==expectedVersion)throw new Error("COORDINATE_VERSION_CONFLICT");
  const version=(prior?.version??0)+1; const canonical={node_id:record.node_id,logical:record.logical||null,runtime:record.runtime||null,network:record.network||null,capabilities:[...(record.capabilities||[])].sort(),health:record.health||"UNKNOWN",version};
  const next={...canonical,record_hash:sha256(canonical)};this.records.set(record.node_id,next);this.version++;return next;
 }
 get(id){return this.records.get(id)||null}
 snapshot(){const records=[...this.records.values()].sort((a,b)=>a.node_id.localeCompare(b.node_id));return {directory_version:this.version,records,snapshot_hash:sha256(records)}}
 merge(remote){
  for(const r of remote.records||[]){const local=this.records.get(r.node_id);if(!local||r.version>local.version)this.records.set(r.node_id,r);else if(r.version===local.version&&r.record_hash!==local.record_hash)throw new Error("COORDINATE_EQUIVOCATION");}
  this.version=Math.max(this.version,remote.directory_version||0);return this.snapshot();
 }
}
