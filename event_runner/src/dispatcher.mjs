import http from "node:http";import {classifyTelemetry,buildDispatch,sha256} from "./contract.mjs";
const token=process.env.GITHUB_TOKEN||"";const target=process.env.KEX_TARGET_REPOSITORY||"";const secret=process.env.KEX_INGRESS_SECRET||"";
export async function dispatch(raw,headers={}){
 if(!secret)throw new Error("INGRESS_SECRET_REQUIRED");
 if(headers["x-kex-secret"]!==secret)throw new Error("AUTHORITY_REJECTED");
 const event=classifyTelemetry(raw);const d=buildDispatch(event,{repository:target});const [owner,repo]=d.repository.split("/");
 if(!owner||!repo)throw new Error("TARGET_REPOSITORY_INVALID");if(!token)throw new Error("GITHUB_TOKEN_REQUIRED");
 const res=await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`,{method:"POST",headers:{"accept":"application/vnd.github+json","authorization":`Bearer ${token}`,"x-github-api-version":"2022-11-28","content-type":"application/json"},body:JSON.stringify({event_type:d.event_type,client_payload:d.client_payload})});
 if(!res.ok)throw new Error(`GITHUB_DISPATCH_FAILED:${res.status}:${await res.text()}`);
 return {status:"DISPATCHED",event_id:event.event_id,input_hash:event.input_hash,receipt_hash:sha256({event_id:event.event_id,input_hash:event.input_hash,target:d.repository})};
}
if(import.meta.url===`file://${process.argv[1]}`){const port=Number(process.env.PORT||8788);http.createServer(async(req,res)=>{if(req.method!=="POST"||req.url!=="/telemetry"){res.writeHead(404).end();return}let b="";for await(const c of req)b+=c;try{const out=await dispatch(JSON.parse(b),req.headers);res.writeHead(202,{"content-type":"application/json"}).end(JSON.stringify(out))}catch(e){res.writeHead(400,{"content-type":"application/json"}).end(JSON.stringify({status:"BLOCKED",reason:String(e.message||e)}))}}).listen(port,"127.0.0.1",()=>console.log(JSON.stringify({status:"READY",port})))}
