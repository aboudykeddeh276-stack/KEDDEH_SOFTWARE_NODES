from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, Mapping
import hashlib, json, time

def root(v:Any)->str:
    return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
@dataclass(frozen=True)
class SectorTask:
    task_id:str; sector:str; work_module:str; capability:str; operation:str; payload:Mapping[str,Any]; agent_id:str
    @property
    def task_root(self): return root(asdict(self))
@dataclass(frozen=True)
class SectorReceipt:
    task_id:str; sector:str; capability:str; agent_id:str; status:str; effect:Mapping[str,Any]; produced_at_ns:int
    @property
    def receipt_root(self): return root(asdict(self))
class SectorRuntime:
    def __init__(self,sector_id:str): self.sector_id=sector_id; self.handlers:Dict[str,Callable[[SectorTask],Mapping[str,Any]]]={}; self.receipts=[]
    def bind(self,capability:str,handler): self.handlers[capability]=handler
    def execute(self,task:SectorTask):
        if task.sector!=self.sector_id: raise RuntimeError("SECTOR_MISMATCH")
        fn=self.handlers.get(task.capability)
        if fn is None: status="DEFERRED_CAPABILITY_HOLE"; effect={"reason":"CAPABILITY_UNBOUND"}
        else:
            try: effect=dict(fn(task)); status=effect.pop("_status","EXECUTED")
            except Exception as exc: status="REJECTED"; effect={"reason":str(exc),"exception_type":type(exc).__name__}
        r=SectorReceipt(task.task_id,self.sector_id,task.capability,task.agent_id,status,effect,time.time_ns()); self.receipts.append(r); return r
