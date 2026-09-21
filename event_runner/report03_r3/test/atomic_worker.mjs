import {AtomicJsonStore} from '../src/durable_state.mjs';
const [file,countRaw]=process.argv.slice(2); const count=Number(countRaw);
const store=new AtomicJsonStore(file,()=>({count:0}));
for(let i=0;i<count;i++) store.transaction(s=>(s.count++,s));
