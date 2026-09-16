import test from 'node:test';
import assert from 'node:assert/strict';
import {entity,encode,decode,documentOf,validate} from '../src/model.js';
import {History,eraseStroke,transformSelection,duplicateSelection,shapeEntity} from '../src/editing.js';
import {strokePaths} from '../src/paths.js';
const line=()=>Object.assign(entity(),{points:[[0,0,0,.5],[2,0,0,1]]});
test('Swept eraser splits a sparse line without reconnecting the gap or mutating its source',()=>{
  const e=line(),original=structuredClone(e),project=(_,p)=>[p[0]*100,p[1]*100];
  const parts=eraseStroke(e,project,[100,-20],[100,20],10);
  assert.equal(parts.length,2);assert.ok(Math.abs(parts[0].points.at(-1)[0]-.9)<1e-6);assert.ok(Math.abs(parts[1].points[0][0]-1.1)<1e-6);assert.notEqual(parts[0].id,parts[1].id);assert.deepEqual(e,original);
  assert.equal(eraseStroke(e,project,[0,-10],[200,-10],11).length,0);
  assert.equal(eraseStroke(e,project,[100,80],[100,100],5)[0],e);
  const depthLine=Object.assign(entity(),{points:[[0,0,1,1],[2,0,2,1]]});
  const perspective=eraseStroke(depthLine,(_,p)=>[p[0]/p[2]*100,0,p[2]],[50,0],[50,0],10);
  const endpoint=perspective[0].points.at(-1);assert.ok(Math.abs(endpoint[0]/endpoint[2]*100-40)<1e-6);
});
test('History restores group selection and a new edit invalidates redo',()=>{
  const h=new History(),e=line(),a={entities:[],selected:new Set()},b={entities:[e],selected:new Set([e.id])};h.push(a,b,'Draw');
  assert.equal(h.travel(true),a);assert.equal(h.peek(false),b);assert.equal(h.travel(false).selected.has(e.id),true);h.travel(true);h.push(a,{entities:[line()],selected:new Set()},'New stroke');assert.equal(h.future.length,0);
});
test('Group transformations and duplication are atomic and preserve relative spacing',()=>{
  const a=line(),b=line();a.position=[-1,0,0];b.position=[0,1,0];const scene=[a,b],ids=new Set(scene.map(e=>e.id));
  const next=transformSelection(scene,ids,{move:[.1,.2,0]});assert.ok(Math.abs(next[1].position[0]-next[0].position[0]-1)<1e-8);assert.equal(scene[0].position[0],-1);
  assert.throws(()=>transformSelection(scene,ids,{move:[10,0,0]}),/coordinate|radius/);const duplicated=duplicateSelection(scene,ids);assert.equal(duplicated.entities.length,4);assert.equal(new Set(duplicated.entities.map(e=>e.id)).size,4);
});
test('Blocks and patterns use v2; ordinary strokes retain v1 and block bounds are checked',()=>{
  const e=line();assert.equal(JSON.parse(encode([e])).version,1);e.pattern='dash';assert.equal(JSON.parse(encode([e])).version,2);assert.equal(decode(encode([e]))[0].pattern,'dash');
  const block=entity('block');block.size=[.02,.7,1];assert.deepEqual(decode(encode([block]))[0].size,block.size.map(Math.fround));assert.throws(()=>validate({...documentOf([block]),version:1}),/version 2/);block.size=[4,4,4];block.position=[2,0,0];assert.throws(()=>encode([block]),/radius/);
});
test('Pattern generation stays bounded on long zigzags; shape tools retain plane axes',()=>{
  const e=line();e.points=Array.from({length:384},(_,i)=>[i%2?3:-3,0,0,1]);e.pattern='dash';assert.ok(strokePaths(e).flat().length<1200);e.pattern='dot';assert.ok(strokePaths(e).length<=65);
  const basis={u:[1,0,0],v:[0,1,0],normal:[0,0,1]},block=shapeEntity('block',[-1,0,0],[0,1,0],basis,{}, {depth:.6});assert.deepEqual(block.size,[1,1,.6]);assert.deepEqual(block.position,[-.5,.5,.3]);
  const rectangle=shapeEntity('rectangle',[0,0,0],[.5,1,0],basis,{}, {constrain:true});assert.deepEqual(rectangle.points[2],[1,1,0,1]);
});
