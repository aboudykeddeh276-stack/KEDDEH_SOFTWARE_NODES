import crypto from 'node:crypto';

const MAX_RUN=9;

export function encodeAB(bits){
  if(!/^[01]*$/.test(bits)) throw new Error('AB_BINARY_INPUT_INVALID');
  if(!bits) return [];
  const out=[];
  let bit=bits[0], count=1;
  const emit=(b,n)=>{
    const symbol=b==='1'?'A':'B';
    while(n>MAX_RUN){out.push({symbol,count:MAX_RUN,token:`${symbol}${MAX_RUN}`});n-=MAX_RUN}
    if(n) out.push({symbol,count:n,token:`${symbol}${n}`});
  };
  for(const next of bits.slice(1)){
    if(next===bit) count++;
    else { emit(bit,count); bit=next; count=1; }
  }
  emit(bit,count);
  return out;
}

export function decodeAB(blocks){
  return (blocks||[]).map(({symbol,count})=>{
    if(!['A','B'].includes(symbol)||!Number.isInteger(count)||count<1||count>9) throw new Error('AB_BLOCK_INVALID');
    return (symbol==='A'?'1':'0').repeat(count);
  }).join('');
}

export function conceptStream(bits){
  const blocks=encodeAB(bits);
  const body={
    schema:'kex.ab-binary-concepts.v1',
    semantic_layer:'IL-LLM',
    translation_layer:'KEX',
    raw_bit_count:bits.length,
    blocks:blocks.map(b=>({...b,concept_id:`kex://concept/binary-run/${b.symbol}/${b.count}`})),
    canonical_tokens:blocks.map(b=>b.token).join('')
  };
  return {...body,stream_hash:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}

export function htmlProjection(bits,{id='ab-stream'}={}){
  const s=conceptStream(bits);
  const runs=s.blocks.map(b=>`<kex-run data-token="${b.token}" data-symbol="${b.symbol}" data-count="${b.count}" data-concept="${b.concept_id}"></kex-run>`).join('');
  return `<kex-ab-stream id="${id}" data-schema="${s.schema}" data-stream-hash="${s.stream_hash}" data-raw-bits="${s.raw_bit_count}" data-blocks="${s.blocks.length}">${runs}</kex-ab-stream>`;
}

export function pack18(blocks){
  const codes=(blocks||[]).map(({symbol,count})=>{
    if(!['A','B'].includes(symbol)||!Number.isInteger(count)||count<1||count>9) throw new Error('AB_BLOCK_INVALID');
    return (symbol==='A'?0:9)+(count-1);
  });
  const significantBits=codes.length*5;
  let bitString=codes.map(c=>c.toString(2).padStart(5,'0')).join('');
  bitString=bitString.padEnd(Math.ceil(bitString.length/8)*8,'0');
  const bytes=Buffer.alloc(bitString.length/8);
  for(let i=0;i<bytes.length;i++) bytes[i]=parseInt(bitString.slice(i*8,i*8+8),2);
  return {bytes,significant_bits:significantBits};
}

export function boundaryMode(target){
  const t=String(target||'').toUpperCase();
  if(['HTML','DOM','VIRTUAL_NODE','WORKBOOK','JSON','KEX_GRAPH','IL_LLM'].includes(t)) return 'SYMBOLIC_AB_CONCEPTS';
  if(['CPU','MEMORY_BYTES','NETWORK_WIRE','FILE_BYTES','DEVICE_IO','WASM','NATIVE_ABI'].includes(t)) return 'PACK_BINARY_AT_BOUNDARY';
  throw new Error('UNKNOWN_TARGET_SUBSTRATE');
}

export function representationMetrics(bits){
  const blocks=encodeAB(bits);
  return {
    raw_bits:bits.length,
    transitions:[...bits].slice(1).reduce((n,b,i)=>n+(b!==bits[i]?1:0),0),
    blocks:blocks.length,
    ascii_token_bits:blocks.length*16,
    packed18_bits:blocks.length*5,
    packed18_ratio:bits.length?Number(((blocks.length*5)/bits.length).toFixed(6)):0
  };
}
