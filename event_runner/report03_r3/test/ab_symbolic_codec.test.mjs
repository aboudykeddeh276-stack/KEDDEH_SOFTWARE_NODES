import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAB,decodeAB,conceptStream,htmlProjection,pack18,boundaryMode,representationMetrics} from '../src/ab_symbolic_codec.mjs';

test('A/B example is A4B3A2 and roundtrips',()=>{
  const bits='111100011';
  const blocks=encodeAB(bits);
  assert.deepEqual(blocks.map(x=>x.token),['A4','B3','A2']);
  assert.equal(decodeAB(blocks),bits);
});

test('runs over nine split deterministically and remain reversible',()=>{
  const bits='1'.repeat(20)+'0'.repeat(11);
  const blocks=encodeAB(bits);
  assert.deepEqual(blocks.map(x=>x.token),['A9','A9','A2','B9','B2']);
  assert.equal(decodeAB(blocks),bits);
});

test('HTML projection carries concepts not expanded binary',()=>{
  const html=htmlProjection('111100011');
  assert.match(html,/data-token="A4"/);
  assert.match(html,/data-token="B3"/);
  assert.doesNotMatch(html,/>1111</);
});

test('KEX keeps virtual targets symbolic and packs only binary boundaries',()=>{
  assert.equal(boundaryMode('HTML'),'SYMBOLIC_AB_CONCEPTS');
  assert.equal(boundaryMode('IL_LLM'),'SYMBOLIC_AB_CONCEPTS');
  assert.equal(boundaryMode('CPU'),'PACK_BINARY_AT_BOUNDARY');
  assert.equal(boundaryMode('NETWORK_WIRE'),'PACK_BINARY_AT_BOUNDARY');
});

test('18-symbol wire form roundtrip cost is explicit',()=>{
  const bits='111100011';
  const blocks=encodeAB(bits);
  const packed=pack18(blocks);
  assert.equal(packed.significant_bits,15);
});

test('long low-transition binary can compress in packed A/B form',()=>{
  const bits='1'.repeat(90)+'0'.repeat(90);
  const m=representationMetrics(bits);
  assert.ok(m.packed18_bits < m.raw_bits);
});

test('alternating binary falsifies universal compression claim',()=>{
  const bits='10'.repeat(90);
  const m=representationMetrics(bits);
  assert.ok(m.packed18_bits > m.raw_bits);
});

test('concept stream binds IL-LLM semantics to KEX translation',()=>{
  const s=conceptStream('111100011');
  assert.equal(s.semantic_layer,'IL-LLM');
  assert.equal(s.translation_layer,'KEX');
  assert.equal(s.canonical_tokens,'A4B3A2');
  assert.equal(s.stream_hash.length,64);
});
