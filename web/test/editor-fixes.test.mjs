import test from 'node:test';
import assert from 'node:assert/strict';
import {entity,validate,decode,documentOf,encode} from '../src/model.js';
import {eraseStroke} from '../src/editing.js';
import {createDraftStore} from '../src/drafts.js';
const doc=entities=>({version:1,units:'metres',coordinates:'right-handed-y-up',entities});
const stroke=points=>Object.assign(entity(),{points});
// Curved-sheet style hit-test samples: original points by reference plus interpolated extras.
const densify=(points,n)=>points.flatMap((b,i)=>i?Array.from({length:n},(_,j)=>j===n-1?b:points[i-1].map((v,k)=>v+(b[k]-v)*(j+1)/n)):[b]);
const flat=(_,p)=>[p[0]*100,p[1]*100];

test('Erasing with dense hit-test samples keeps original points plus cut ends only',()=>{
  const e=stroke([0,1,2,3,4].map(x=>[x,0,0,1])),samples=densify(e.points,10);
  const tip=eraseStroke(e,flat,[400,0],[400,0],50,samples);
  assert.equal(tip.length,1);assert.equal(tip[0].points.length,5);assert.ok(Math.abs(tip[0].points.at(-1)[0]-3.5)<1e-6);
  assert.ok(tip[0].points.slice(0,4).every((p,i)=>p===e.points[i]));
  const middle=eraseStroke(e,flat,[200,0],[200,0],25,samples);
  assert.deepEqual(middle.map(part=>part.points.map(p=>+p[0].toFixed(6))),[[0,1,1.75],[2.25,3,4]]);
  assert.equal(eraseStroke(e,flat,[200,300],[200,300],25,samples)[0],e);
});

test('Erasing a full 384-point stroke tip never leaves a stray one-point stroke',()=>{
  const e=stroke(Array.from({length:384},(_,i)=>[i*.005,0,0,1]));
  const parts=eraseStroke(e,(_,p)=>[p[0]*1000,p[1]*1000],[1914,-50],[1914,50],1.5);
  assert.deepEqual(parts.map(p=>p.points.length),[384]);validate(documentOf(parts));
});

test('Object IDs must be non-empty and a map has at most one Start and one Goal',()=>{
  const paper=Object.assign(entity('paper'),{id:''});
  assert.throws(()=>validate({...doc([paper]),version:3}),/object ID/);
  assert.throws(()=>decode(JSON.stringify(doc([Object.assign(entity('checkpoint'),{id:''})]))),/object ID/);
  const marker=(type,x)=>Object.assign(entity(type),{position:[x,1,0]});
  validate(doc([marker('start',0),marker('checkpoint',.5),marker('goal',1)]));
  for(const type of ['start','goal'])assert.throws(()=>decode(JSON.stringify(doc([marker(type,0),marker(type,1)]))),/one Start and one Goal/);
});

test('Cached image validation still rejects every invalid payload',()=>{
  const image=data=>Object.assign(entity('image'),{image:data});
  const good='iVBORw0KGgo'+'A'.repeat(64)+'==';
  validate(doc([image(good)]));validate(doc([image(good)]));
  for(const bad of ['','AAAA!','A'.repeat(2*1024*1024+1)])for(let i=0;i<2;i++)assert.throws(()=>validate(doc([image(bad)])),/image data/);
  // Cached payloads never excuse image data on other types, and eviction only costs a re-check.
  assert.throws(()=>validate(doc([Object.assign(entity(),{points:[[0,0,0,1]],image:good})])),/Unexpected image data/);
  for(let i=0;i<30;i++)validate(doc([image('\n'.repeat(i)+good)]));
  validate(doc([image(good)]));assert.equal(JSON.parse(encode([image(good)])).entities[0].image,good);
});

test('Draft store reopens after the browser closes its connection',async()=>{
  let opens=0;const stores={scenes:new Map(),summaries:new Map()},dbs=[];
  const indexedDB={open(){opens++;const request={},db={objectStoreNames:{contains:()=>true},closed:false,close(){},transaction(){
    if(db.closed)throw new DOMException('closed','InvalidStateError');
    const tx={abort(){},objectStore:name=>{const rows=stores[name];return {put:r=>rows.set(r.id,r),getAll:()=>({result:[...rows.values()]}),get:id=>({result:rows.get(id)}),delete:id=>rows.delete(id)};}};
    setTimeout(()=>tx.oncomplete());return tx;}};request.result=db;dbs.push(db);setTimeout(()=>request.onsuccess());return request;}};
  const store=createDraftStore(indexedDB);
  await store.put({id:'a',name:'Scene',text:'{}'});assert.equal(opens,1);
  dbs[0].closed=true;dbs[0].onclose();assert.equal((await store.list()).length,1);assert.equal(opens,2);
  dbs[1].closed=true;await assert.rejects(store.list(),/Local save failed/);assert.equal((await store.get('a')).text,'{}');assert.equal(opens,3);
});
