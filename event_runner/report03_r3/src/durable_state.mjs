import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sleepArray=new Int32Array(new SharedArrayBuffer(4));
const sleep=ms=>Atomics.wait(sleepArray,0,0,ms);
const ensureParent=p=>fs.mkdirSync(path.dirname(p),{recursive:true});
function fsyncDir(filePath){try{const fd=fs.openSync(path.dirname(filePath),'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}catch{}}
function pidAlive(pid){
  if(!Number.isInteger(pid)||pid<=0) return false;
  try{process.kill(pid,0);return true}catch(err){return err?.code==='EPERM'}
}
function readLock(lockPath){
  try{return JSON.parse(fs.readFileSync(lockPath,'utf8'))}catch{return null}
}

export function withFileLockSync(filePath,fn,{timeoutMs=3000,staleMs=15000}={}){
  const lockPath=`${filePath}.lock`; ensureParent(lockPath); const deadline=Date.now()+timeoutMs;
  const token=crypto.randomBytes(16).toString('hex'); let fd;
  while(true){
    try{
      fd=fs.openSync(lockPath,'wx',0o600);
      fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token,created_at_ms:Date.now()})+'\n'); fs.fsyncSync(fd); break;
    }catch(err){
      if(err?.code!=='EEXIST') throw err;
      const meta=readLock(lockPath); let stale=false;
      try{const st=fs.statSync(lockPath); stale=(Date.now()-st.mtimeMs)>staleMs}catch{}
      if(stale && (!meta?.pid || !pidAlive(Number(meta.pid)))){try{fs.unlinkSync(lockPath)}catch{};continue}
      if(Date.now()>=deadline) throw new Error('STATE_LOCK_TIMEOUT');
      sleep(10);
    }
  }
  try{return fn()} finally {
    try{fs.closeSync(fd)}catch{}
    const meta=readLock(lockPath);
    if(meta?.token===token){try{fs.unlinkSync(lockPath)}catch{}}
  }
}

export class AtomicJsonStore{
  constructor(filePath,seedFactory=()=>({})){
    this.filePath=filePath; this.seedFactory=seedFactory; ensureParent(filePath);
    withFileLockSync(filePath,()=>{ if(!fs.existsSync(filePath)) this._writeUnlocked(seedFactory()); });
  }
  read(){try{return JSON.parse(fs.readFileSync(this.filePath,'utf8'))}catch(err){throw new Error(`STATE_READ_FAILED:${err.message}`)}}
  _writeUnlocked(value){
    ensureParent(this.filePath); const temp=`${this.filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    const fd=fs.openSync(temp,'w',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    fs.renameSync(temp,this.filePath); fsyncDir(this.filePath); return value;
  }
  write(value){return withFileLockSync(this.filePath,()=>this._writeUnlocked(value))}
  transaction(mutator){
    return withFileLockSync(this.filePath,()=>{
      const current=this.read(); const next=mutator(structuredClone(current));
      if(next===undefined) throw new Error('STATE_TRANSACTION_RETURN_REQUIRED');
      this._writeUnlocked(next); return next;
    });
  }
}
export function appendJsonLineSync(filePath,value){
  ensureParent(filePath); return withFileLockSync(filePath,()=>{
    const fd=fs.openSync(filePath,'a',0o600); try{fs.writeSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}; return value;
  });
}
export function readJsonLines(filePath){
  if(!fs.existsSync(filePath)) return [];
  const raw=fs.readFileSync(filePath,'utf8').trim(); if(!raw) return [];
  return raw.split('\n').filter(Boolean).map((line,i)=>{try{return JSON.parse(line)}catch(err){throw new Error(`JSONL_PARSE_FAILED:${i+1}:${err.message}`)}});
}
export {pidAlive};
