import {sha256} from "./contract.mjs";
export function evidenceReceipt({run_id,tests,faults,directory,reconcile,boundaries=[]}){const body={schema:"kex.report03.evidence.v1",run_id,tests,faults,directory,reconcile,boundaries};return {...body,receipt_hash:sha256(body)}}
