import test from 'node:test';
import assert from 'node:assert/strict';
import {entity,encode,decode,LIMITS} from '../src/model.js';
import {mirrorSheetStroke,strokeCapacity,assistedStrokeScene,sheetEndpoints,closestEndpoint} from '../src/drawing-assists.js';
import {strokeUV,surfaceWorld} from '../src/paper.js';
import {shapeEntity} from '../src/editing.js';
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6));
test('sheet mirroring preserves metric coordinates, pressure and transforms on curved/tilted guides',()=>{
  const p={...entity('paper'),bend:180,pitch:25,roll:33,yaw:40,position:[0,1,0]},e={...entity(),paperId:p.id,pointSpace:'surface',position:[.2,.1,0],yaw:18,scale:.7,points:[[0,0,0,.7],[.5,.3,0,1.2]]},before=structuredClone(e);
  for(const axis of ['u','v']){const copy=mirrorSheetStroke(e,p,axis,'mirror');assert.equal(copy.id,'mirror');assert.equal(copy.width,e.width);assert.equal(copy.paperId,p.id);for(let i=0;i<e.points.length;i++){const uv=strokeUV(e,e.points[i],p);uv[axis==='u'?0:1]*=-1;near(strokeUV(copy,copy.points[i],p),uv);near(surfaceWorld(p,strokeUV(copy,copy.points[i],p)),surfaceWorld(p,uv));assert.equal(copy.points[i][3],e.points[i][3]);}assert.equal(decode(encode([p,e,copy])).length,3);}
  assert.deepEqual(e,before);
});
test('mirrors avoid coincident centre lines and closed shapes without discarding asymmetric pressure',()=>{
  const p=entity('paper'),make=points=>({...entity(),paperId:p.id,pointSpace:'surface',points});
  assert.equal(mirrorSheetStroke(make([[0,-.5,0,1],[0,.5,0,1]]),p,'u','mirror'),null);
  assert.equal(mirrorSheetStroke(make([[-.5,0,0,1],[.5,0,0,1]]),p,'u','mirror'),null);
  assert.ok(mirrorSheetStroke(make([[-.5,0,0,.3],[.5,0,0,1]]),p,'u','mirror'));
  const shape=shapeEntity('rectangle',[-.5,-.2,0],[.5,.2,0],{u:[1,0,0],v:[0,1,0],normal:[0,0,1]},{paperId:p.id,pointSpace:'surface'});
  assert.equal(mirrorSheetStroke(shape,p,'u','mirror'),null);
});
test('snap candidates exclude other sheets and cropped ends; nearest visible candidate wins at any zoom',()=>{
  const p=entity('paper'),e={...entity(),paperId:p.id,pointSpace:'surface',points:[[.3,0,0,1],[2,0,0,1]]},other={...e,id:'other',paperId:'elsewhere'};
  const candidates=sheetEndpoints([p,e,other],p);assert.equal(candidates.length,1);near(candidates[0].uv,[.3,0,0]);
  assert.equal(closestEndpoint(candidates,[35,5],uv=>uv.map(v=>v*100)).id,e.id);
  assert.equal(closestEndpoint(candidates,[60,5],uv=>uv.map(v=>v*100)),null);
  assert.equal(closestEndpoint(candidates,[30,0],()=>null),null);
  assert.equal(closestEndpoint(candidates,[65,5],uv=>uv.map(v=>v*200)).id,e.id);
});
test('mirror reserves point/object capacity and failed paired edits are atomic',()=>{
  const p=entity('paper'),e={...entity(),paperId:p.id,pointSpace:'surface',points:[[.2,0,0,1],[.5,0,0,1]]};
  const objects=Array.from({length:79},()=>entity('block'));assert.equal(strokeCapacity(objects,true),0);assert.equal(strokeCapacity(objects),LIMITS.stroke);
  const before=JSON.stringify(objects);assert.throws(()=>assistedStrokeScene(objects,e,p,'u','mirror'),/80 objects/);assert.equal(JSON.stringify(objects),before);
  const heavy=Array.from({length:10},()=>({...entity(),points:Array.from({length:384},()=>[0,0,0,1])}));assert.equal(strokeCapacity(heavy,true),80);assert.equal(strokeCapacity(heavy),160);
});
