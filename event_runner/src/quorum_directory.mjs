import {sha256} from "./contract.mjs";
export class QuorumDirectory {
 constructor({replicaId,members,quorum}={}){if(!replicaId||!members?.length)throw new Error("REPLICA_CONFIG_REQUIRED");this.replicaId=replicaId;this.members=[...new Set(members)].sort();this.quorum=quorum||Math.floor(this.members.length/2)+1;this.log=[];this.commits=new Map()}
 propose(record){if(!record?.node_id)throw new Error("NODE_ID_REQUIRED");const proposal={term:1,index:this.log.length+1,record,proposer:this.replicaId};return {...proposal,proposal_hash:sha256(proposal)}}
 commit(proposal,acks){const valid=[...new Set(acks||[])].filter(x=>this.members.includes(x));if(valid.length<this.quorum)throw new Error("QUORUM_NOT_REACHED");const prior=this.commits.get(proposal.record.node_id);if(prior&&prior.index===proposal.index&&prior.proposal_hash!==proposal.proposal_hash)throw new Error("COMMIT_EQUIVOCATION");const entry={...proposal,acks:valid.sort(),commit_hash:sha256({proposal_hash:proposal.proposal_hash,acks:valid.sort()})};this.log.push(entry);this.commits.set(proposal.record.node_id,entry);return entry}
}
