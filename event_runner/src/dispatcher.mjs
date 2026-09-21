import http from "node:http";
import path from "node:path";
import {classifyTelemetry,buildDispatch,sha256,signSafetyEvent} from "./contract.mjs";
import {ToTSafetyKernel} from "./tot_safety_kernel.mjs";

const token=process.env.GITHUB_TOKEN||"";
const target=process.env.KEX_TARGET_REPOSITORY||"";
const ingressSecret=process.env.KEX_INGRESS_SECRET||"";
const signingSecret=process.env.KEX_EVENT_SIGNING_SECRET||ingressSecret;
const authorityId=process.env.KEX_INGRESS_AUTHORITY_ID||"sheet-ingress";
const nodeState=process.env.KEX_NODE_STATE||"UNOBSERVED";
const safetyStatePath=process.env.KEX_SAFETY_STATE_PATH||path.resolve("state/tot-safety.json");

const kernel=new ToTSafetyKernel({journalPath:safetyStatePath,requireSignature:true,requireSequence:true});

export async function dispatch(raw,headers={}){
  if(!ingressSecret)throw new Error("INGRESS_SECRET_REQUIRED");
  if(headers["x-kex-secret"]!==ingressSecret)throw new Error("AUTHORITY_REJECTED");
  if(nodeState!=="READY")throw new Error("NODE_NOT_READY");

  const classified=classifyTelemetry({...raw,authority_id:authorityId});
  const event=signSafetyEvent(classified,signingSecret);
  const decision=kernel.evaluate(event,{
    expectedInputHash:event.input_hash,
    authorizedCapabilities:["telemetry.apply"],
    nodeState,
    authoritySecrets:{[authorityId]:signingSecret}
  });
  if(decision.decision!=="ALLOW")throw new Error("TOT_SAFETY_DENIED:"+decision.reasons.join(","));

  const d=buildDispatch(event,{repository:target});
  const [owner,repo]=d.repository.split("/");
  if(!owner||!repo)throw new Error("TARGET_REPOSITORY_INVALID");
  if(!token)throw new Error("GITHUB_TOKEN_REQUIRED");
  const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`,{
    method:"POST",
    headers:{
      "accept":"application/vnd.github+json",
      "authorization":`Bearer ${token}`,
      "x-github-api-version":"2022-11-28",
      "content-type":"application/json"
    },
    body:JSON.stringify({event_type:d.event_type,client_payload:d.client_payload})
  });
  if(!res.ok)throw new Error(`GITHUB_DISPATCH_FAILED:${res.status}:${await res.text()}`);
  return {
    status:"DISPATCHED",
    event_id:event.event_id,
    sequence:event.sequence,
    authority_id:event.authority_id,
    input_hash:event.input_hash,
    safety_decision_hash:decision.decision_hash,
    receipt_hash:sha256({event_id:event.event_id,input_hash:event.input_hash,target:d.repository,safety_decision_hash:decision.decision_hash})
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const port=Number(process.env.PORT||8788);
  http.createServer(async(req,res)=>{
    if(req.method!=="POST"||req.url!=="/telemetry"){res.writeHead(404).end();return}
    let b="";
    for await(const c of req)b+=c;
    try{
      const out=await dispatch(JSON.parse(b),req.headers);
      res.writeHead(202,{"content-type":"application/json"}).end(JSON.stringify(out));
    }catch(e){
      res.writeHead(400,{"content-type":"application/json"}).end(JSON.stringify({status:"BLOCKED",reason:String(e.message||e)}));
    }
  }).listen(port,"127.0.0.1",()=>console.log(JSON.stringify({status:"READY",port,node_state:nodeState,authority_id:authorityId,safety_state_path:safetyStatePath})));
}
