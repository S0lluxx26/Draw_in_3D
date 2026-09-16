import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothPoints,curvePoints} from '../src/stroke-processing.js';
import {entity,encode,decode} from '../src/model.js';
test('arc and S-curve capture endpoints, bend direction, plane, pressure and a small sample budget',()=>{
  const arc=curvePoints([2,0,0],[0,0,1],.5),s=curvePoints([2,0,0],[0,0,1],.5,'s',65,.2,1.4);
  assert.equal(arc.length,65);assert.deepEqual(arc[0],[0,0,0,1]);assert.deepEqual(arc.at(-1),[2,0,0,1]);assert.equal(arc[32][1],.5);
  assert.ok(s[16][1]>0&&s[48][1]<0);assert.equal(s[32][1],0);assert.equal(s[0][3],.2);assert.ok(Math.abs(s.at(-1)[3]-1.4)<1e-12);
  assert.equal(curvePoints([0,0,2],[0,1,0],-.8,'arc',11).length,11);assert.ok(curvePoints([0,0,2],[0,1,0],-.8).every(p=>p[1]===0));
  assert.equal(curvePoints([0,0,0],[0,0,1]).length,1);
});
test('smoothing reduces a noisy trace and preserves open endpoints, pressure bounds, plane and source',()=>{
  const input=Array.from({length:41},(_,i)=>[i*.025,i===0||i===40?0:(i%2?.05:-.05),.3,.1+i/40*1.9]),copy=structuredClone(input),soft=smoothPoints(input,1);
  assert.deepEqual(input,copy);assert.deepEqual(soft[0],input[0]);assert.deepEqual(soft.at(-1),input.at(-1));
  assert.ok(Math.sqrt(soft.reduce((sum,p)=>sum+p[1]**2,0)/soft.length)<.025);
  assert.ok(soft.every(p=>Math.abs(p[2]-.3)<1e-9&&p[3]>=.1&&p[3]<=2));assert.ok(soft.length<=128);
  assert.deepEqual(smoothPoints(input,0),input);assert.deepEqual(smoothPoints(input.slice(0,2),1),input.slice(0,2));
});
test('closed loops, duplicate points, scene capacity and baked file compatibility stay valid',()=>{
  const square=[[0,0,0,1],[1,0,0,1],[1,1,0,1],[0,1,0,1],[0,0,0,1]],closed=smoothPoints(square,.8,24);
  assert.equal(closed.length,24);assert.deepEqual(closed[0],closed.at(-1));assert.ok(closed.every(p=>p.slice(0,2).every(v=>v>=0&&v<=1)));
  const dense=Array.from({length:384},(_,i)=>[i/400,Math.sin(i)*.1,0,1]);assert.equal(smoothPoints(dense,1,384).length,384);
  const duplicate=[[0,0,0,1],[0,0,0,1],[1,0,0,1]];assert.ok(smoothPoints(duplicate,1,3).flat().every(Number.isFinite));
  const e=entity();e.points=closed;assert.equal(JSON.parse(encode([e])).version,1);assert.equal(decode(encode([e]))[0].points.length,24);
});
