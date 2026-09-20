import test from 'node:test';
import assert from 'node:assert/strict';
import {buildShow,sampleShow,matchFormation} from '../src/drone-show.js';
import {editableDemo,compileShow,encodeShow,decodeShow} from '../src/show-project.js';
test('4096-drone spatial assignment remains deterministic, bijective and carries colour/order',()=>{
  const n=4096,previous=Array.from({length:n},(_,i)=>[i%64,Math.floor(i/64),0]),target={positions:[...previous].reverse(),colors:previous.map((_,i)=>[i/n,0,0])};
  const a=matchFormation(previous,target),b=matchFormation(previous,target);assert.deepEqual(a,b);assert.equal(new Set(a.positions).size,n);
  for(let i=0;i<n;i++){const j=target.positions.indexOf(a.positions[i]);assert.equal(a.colors[i],target.colors[j]);assert.equal(a.order[i],j/(n-1));}
});
test('takeoff and landing alternate red and blue and end dark at exact home positions',()=>{
  const show=buildShow();assert.equal(show.count,4096);
  for(const stage of show.stages.filter(s=>['takeoff','landing'].includes(s.kind))){
    const a=sampleShow(show,stage.start+1),b=sampleShow(show,stage.start+1.4);
    assert.ok(a.colors[0]>a.colors[2]&&b.colors[0]<b.colors[2]||a.colors[0]<a.colors[2]&&b.colors[0]>b.colors[2]);
    assert.ok(a.colors[0]>a.colors[2]!==a.colors[3]>a.colors[5]);
  }
  assert.deepEqual(sampleShow(show,show.duration).positions,sampleShow(show,0).positions);assert.ok(sampleShow(show,show.duration).colors.every(v=>v===0));
});
test('editable effects survive save/open, Starship rises with a yellow exhaust subset, legacy fleets load',()=>{
  const doc=decodeShow(encodeShow(editableDemo())),show=compileShow(doc),rise=show.stages.find(s=>s.kind==='rise');
  assert.ok(rise);assert.ok(show.cues.some(c=>c.label==='Big ship'));assert.ok(show.cues.some(c=>c.label==='Firework star'));assert.ok(show.cues.some(c=>c.label==='Row of fire'));
  const flames=rise.to.colors.map((c,i)=>c[0]>.9&&c[1]>.7&&c[2]<.2?i:-1).filter(i=>i>=0);assert.ok(flames.length>0&&flames.length<4096);
  const mid=sampleShow(show,(rise.start+rise.end)/2);assert.ok(flames.some(i=>mid.positions[i*3+1]<(rise.from.positions[i][1]+rise.to.positions[i][1])/2-.1));
  assert.ok(rise.to.positions.every((p,i)=>Math.abs(p[1]-rise.from.positions[i][1]-10)<1e-9));
  doc.version=1;doc.count=256;doc.cues=doc.cues.slice(0,1).map(({effect,...c})=>c);const legacy=decodeShow(JSON.stringify(doc));assert.equal(compileShow(legacy).count,256);assert.equal(legacy.cues[0].effect,'none');
});
