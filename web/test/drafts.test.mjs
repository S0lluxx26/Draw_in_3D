import test from 'node:test';
import assert from 'node:assert/strict';
import {DraftWriter} from '../src/drafts.js';
import {entity,encode,decode,documentOf,validate} from '../src/model.js';

test('draft writes coalesce, serialize and keep separate documents during a slow save', async()=>{
  const writes=[],events=[];let release;
  const writer=new DraftWriter({put:async record=>{writes.push(record);if(writes.length===1)await new Promise(r=>release=r);}},(...e)=>events.push(e),60000);
  writer.enqueue('a',()=>({id:'a',text:'older'}));writer.enqueue('a',()=>({id:'a',text:'first committed'}));
  const pending=writer.flush();assert.equal(writes.length,1);
  writer.enqueue('a',()=>({id:'a',text:'latest committed'}));writer.enqueue('b',()=>({id:'b',text:'different scene'}));
  const also=writer.flush();release();await Promise.all([pending,also]);
  assert.deepEqual(writes.map(r=>[r.id,r.text]),[['a','first committed'],['a','latest committed'],['b','different scene']]);
  assert.equal(events.filter(e=>e[0]==='a'&&e[1]==='saved').length,1);
  assert.equal(writer.pending.size,0);
});

test('failed storage and serialization keep retryable snapshots without stopping later saves',async()=>{
  let fail=true;const saved=[],events=[];
  const writer=new DraftWriter({put:async record=>{if(fail)throw Error('quota');saved.push(record);}},(...e)=>events.push(e),60000);
  writer.enqueue('a',()=>({id:'a',text:'precious ink'}));await writer.flush();
  assert.equal(writer.failed.size,1);assert.equal(events.at(-1)[1],'error');assert.equal(saved.length,0);
  fail=false;await writer.retry();assert.equal(saved[0].text,'precious ink');assert.equal(writer.failed.size,0);
  writer.enqueue('a',()=>{throw Error('invalid scene');});await writer.flush();assert.equal(writer.failed.size,1);
  writer.enqueue('a',()=>({id:'a',text:'repaired'}));await writer.flush();assert.equal(writer.failed.size,0);assert.equal(saved.at(-1).text,'repaired');
});

test('names round-trip in v6 only and reject malformed or downgraded metadata',()=>{
  const p=entity('paper');p.panelWidth=1;assert.equal(documentOf([p]).version,3);
  p.paperName='Front wall · 벽';const restored=decode(encode([p]));assert.equal(restored[0].paperName,p.paperName);assert.equal(documentOf(restored).version,6);
  assert.throws(()=>validate({...documentOf([p]),version:5}),/version 6/);
  for(const name of ['x'.repeat(65),'bad\nname',7,null])assert.throws(()=>encode([{...p,paperName:name}]),/names/);
  const block=entity('block');block.paperName='wrong type';assert.throws(()=>encode([block]),/paper entity/);
  p.paperName='';const legacy=decode(encode([p]));assert.equal(legacy[0].paperName,'');assert.equal(JSON.parse(encode([p])).version,3);
});
