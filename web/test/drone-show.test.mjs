import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShow,createFrame,sampleShow,matchFormation,drawingFormation,ShowClock,DRONE_COUNT} from '../src/drone-show.js';
import {entity} from '../src/model.js';
import {landingPads,byPad} from './pads.mjs';
const show=buildShow();
test('show maintains its fleet, finite continuous trajectories, exact home landing and independent LEDs',()=>{
  assert.equal(show.count,4096);assert.deepEqual(show.cues.map(c=>c.label),['Takeoff','Robot','Fish','Butterfly','Hot air balloon','Eiffel Tower','Big ship','Whale','Firework star','Row of fire','Birthday cake','Starship launch','Happy day','Fireworks','Landing']);
  for(let t=0;t<=show.duration;t+=.5){const f=sampleShow(show,t);assert.equal(f.positions.length,DRONE_COUNT*3);assert.ok(f.positions.every(Number.isFinite));assert.ok(f.colors.every(c=>c>=0&&c<=1));for(let i=1;i<f.positions.length;i+=3)assert.ok(f.positions[i]>=.119);}
  for(const stage of show.stages.slice(1)){
    const a=sampleShow(show,stage.start-1e-5),b=sampleShow(show,stage.start+1e-5);
    assert.ok(a.positions.every((v,i)=>Math.abs(v-b.positions[i])<.001),stage.name+' position jump');
    assert.ok(a.colors.every((v,i)=>Math.abs(v-b.colors[i])<.001),stage.name+' light jump');
  }
  for(const s of show.stages.filter(s=>s.kind==='move'))assert.ok(sampleShow(show,(s.start+s.end)/2).colors.every(c=>c===0));
  assert.equal(new Set(landingPads(show)).size,show.count);assert.deepEqual(byPad(show,sampleShow(show,show.duration).positions),sampleShow(show,0).positions);
  assert.ok(sampleShow(show,show.duration).colors.every(c=>c===0));
  const f=createFrame(show);assert.equal(sampleShow(show,10,f),f);assert.deepEqual(sampleShow(show,46),sampleShow(show,46));
});
test('assignment is a permutation, minimizes the small reference case and is deterministic',()=>{
  const a=[[0,0,0],[5,0,0],[10,0,0]],b={positions:[[11,0,0],[1,0,0],[6,0,0]],colors:[[1,0,0],[0,1,0],[0,0,1]]};
  const result=matchFormation(a,b);assert.deepEqual(result.positions,[[1,0,0],[6,0,0],[11,0,0]]);assert.deepEqual(result.colors,[[0,1,0],[0,0,1],[1,0,0]]);assert.deepEqual(result,matchFormation(a,b));assert.throws(()=>matchFormation(a,{positions:[],colors:[]}));
});
test('drawing sampling preserves curved-sheet depth and colour without changing source data',()=>{
  const p=entity('paper');p.bend=180;p.paperVisible=false;
  const e=entity();e.paperId=p.id;e.pointSpace='surface';e.color=0xffff0000|0;e.points=[[-1,0,0,1],[1,0,0,1]];
  const source=[p,e],before=structuredClone(source),formation=drawingFormation(source);
  assert.equal(formation.positions.length,4096);assert.ok(formation.positions.every(p=>p.every(Number.isFinite)));assert.ok(new Set(formation.positions.map(p=>p[2].toFixed(2))).size>20);assert.ok(formation.colors.every(c=>c[0]===1&&c[1]===0&&c[2]===0));assert.deepEqual(source,before);
  const custom=buildShow(formation);assert.ok(custom.custom);assert.ok(custom.cues.some(c=>c.label==='Your drawing'));assert.deepEqual(byPad(custom,sampleShow(custom,custom.duration).positions),sampleShow(custom,0).positions);
  assert.throws(()=>drawingFormation([]),/Draw/);assert.throws(()=>drawingFormation([{...e,points:[[4,4,0,1],[5,5,0,1]]},p]),/Draw/);
});
test('clock pause, resume, rate change, seek and completion never depend on render frame count',()=>{
  const c=new ShowClock(87);c.play(100);assert.equal(c.read(2100),2);c.pause(3100);assert.equal(c.read(15000),3);c.play(20000);c.speed(2,21000);assert.equal(c.read(22000),6);c.seek(50,23000);assert.equal(c.read(24000),52);c.pause(24000);c.seek(999,25000);assert.equal(c.time,87);c.play(26000);assert.equal(c.time,0);c.read(100000);assert.equal(c.time,87);assert.equal(c.playing,false);c.seek(NaN,110000);assert.equal(c.time,0);
});
