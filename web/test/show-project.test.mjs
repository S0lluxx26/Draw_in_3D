import test from 'node:test';
import assert from 'node:assert/strict';
import {editableDemo,newCue,newShow,captureArtwork,validateShow,decodeShow,encodeShow,cueFormation,compileShow,showDuration,ShowHistory} from '../src/show-project.js';
import {buildShow,sampleShow,samplePaths,demoPaths,drawingPaths} from '../src/drone-show.js';
import {entity,encode} from '../src/model.js';
import {byPad} from './pads.mjs';

test('editable demo reproduces source paths, timing, fleet, and exact landing after a show round trip',()=>{
  const doc=decodeShow(encodeShow(editableDemo())),compiled=compileShow(doc),original=buildShow();
  assert.equal(compiled.duration,314);/* the line-art Demo: formations hold 15 s, HAPPY DAY 16 s */assert.equal(compiled.duration,showDuration(doc));assert.deepEqual(compiled.cues,original.cues);
  const raw=demoPaths();for(const [i,c]of doc.cues.entries()){
    const actual=cueFormation(c),expected=samplePaths(raw[i].paths);
    assert.ok(actual.positions.every((p,j)=>p.every((v,k)=>Math.abs(v-expected.positions[j][k])<1e-5)));
    assert.deepEqual(actual.colors,expected.colors);assert.doesNotThrow(()=>encode(c.artwork));
  }
  assert.deepEqual(byPad(compiled,sampleShow(compiled,compiled.duration).positions),sampleShow(compiled,0).positions);
  assert.ok(sampleShow(compiled,compiled.duration).colors.every(v=>v===0));
});
test('capturing selected ink retains hidden curved parents, excludes unrelated objects and preserves source',()=>{
  const paper={...entity('paper'),paperVisible:false,bend:120},stroke={...entity(),paperId:paper.id,pointSpace:'surface',points:[[-.5,0,0,1],[.5,0,0,1]]};
  const other={...entity(),points:[[0,0,0,1],[1,1,0,1]]},input=[paper,stroke,other,entity('block')],before=structuredClone(input);
  const art=captureArtwork(input,new Set([stroke.id]));assert.equal(art.length,2);assert.equal(art[0].paperVisible,false);assert.deepEqual(input,before);
  assert.deepEqual(captureArtwork(input,new Set([paper.id])),art);assert.deepEqual(captureArtwork(input,new Set()),[]);
  const formation=cueFormation(newCue(art));assert.ok(new Set(formation.positions.map(p=>p[2].toFixed(2))).size>10);
});
test('placement is independent of artwork bounds, and empty or off-stage formations fail before playback',()=>{
  const c=editableDemo().cues[0],before=structuredClone(c.placement),paths=drawingPaths(c.artwork);
  c.artwork=c.artwork.slice(0,-1);cueFormation(c);assert.deepEqual(c.placement,before);
  assert.equal(drawingPaths(c.artwork)[0].points[0][0],paths[0].points[0][0]);
  assert.throws(()=>cueFormation(newCue()),/Draw/);c.placement.position[1]=34;c.placement.scale=100;assert.throws(()=>cueFormation(c),/stage/);
});
test('show schema rejects malformed and incompatible input; history restores complete shows',()=>{
  const doc=editableDemo();assert.throws(()=>decodeShow(encode(doc.cues[0].artwork)),/show file/);
  for(const change of [d=>d.cues.push(d.cues[0]),d=>d.cues[0].transfer=0,d=>d.cues[0].hold=Infinity,d=>d.cues[0].light='script',d=>d.count=1024,d=>d.fireworks.radius=100,d=>d.cues[0].placement.origin=[0],d=>d.cues[0].artwork[1].paperId='missing']){
    const copy=structuredClone(doc);change(copy);assert.throws(()=>validateShow(copy));
  }
  const h=new ShowHistory(doc);h.set({...doc,cues:[...doc.cues].reverse()});assert.equal(h.doc.cues[0].name,'Happy day');h.travel(true);assert.equal(h.doc,doc);h.travel(false);assert.equal(h.doc.cues[0].name,'Happy day');h.set(newShow());assert.equal(h.future.length,0);
});
test('minimum timing, draw-order lighting, no-fireworks and reordered formations preserve boundaries',()=>{
  const doc=editableDemo();doc.cues.reverse();doc.fireworks.enabled=false;
  doc.cues=doc.cues.map((c,i)=>({...c,hold:2,transfer:2,brightness:.4,effect:'none',light:i%2?'bottom-up':'draw-on'}));
  const show=compileShow(doc);assert.equal(show.duration,showDuration(doc));assert.equal(show.stages.filter(s=>s.kind==='burst').length,0);
  for(const s of show.stages.slice(1)){
    const a=sampleShow(show,s.start-1e-6),b=sampleShow(show,s.start+1e-6);
    assert.ok(a.positions.every((v,i)=>Math.abs(v-b.positions[i])<.001),s.name+' position');
    assert.ok(a.colors.every((v,i)=>Math.abs(v-b.colors[i])<.001),s.name+' colour');
  }
  const hold=show.stages.find(s=>s.reveal),partial=sampleShow(show,hold.start+.5),full=sampleShow(show,hold.end-.01);
  assert.ok(partial.colors.some(v=>v===0));assert.ok(full.colors.some(v=>v>0));assert.ok(full.colors.every(v=>v<=.40001));
});
test('null formations and non-list artwork fail with readable messages, not TypeErrors',()=>{
  const doc=editableDemo();
  for(const [change,message] of [[d=>d.cues=[null],/Each formation/],[d=>d.cues[0]=[],/Each formation/],[d=>d.cues[0]='Robot',/Each formation/],[d=>d.cues[1].artwork={},/artwork must be a list/],[d=>d.cues[1].artwork=[null],/artwork must be a list/],[d=>d.cues[1].artwork=undefined,/artwork must be a list/]]){
    const copy=structuredClone(doc);change(copy);
    assert.throws(()=>validateShow(copy),error=>!(error instanceof TypeError)&&message.test(error.message));
    assert.throws(()=>decodeShow(JSON.stringify(copy)),error=>!(error instanceof TypeError)&&message.test(error.message));
  }
});
