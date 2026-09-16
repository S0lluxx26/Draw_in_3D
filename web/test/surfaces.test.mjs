import test from 'node:test';
import assert from 'node:assert/strict';
import {entity,encode,decode,validate,documentOf} from '../src/model.js';
import {surfaceWorld,paperCoordinates,hitPaper,localizeStroke,strokeUV,bendPoint,subdivideSurface} from '../src/paper.js';
import {transformSelection,duplicateSelection,eraseStroke} from '../src/editing.js';
import {geometry} from '../src/geometry.js';
const near=(a,b,eps=1e-6)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<eps,`${a} != ${b}`));
test('bent sheets retain metric UV, including signed bends and all orientation axes; nearest bounded ray hit',()=>{
  assert.equal(hitPaper(entity('paper'),[0,0,-1],[0,0,1]),null);
  for(const bend of [0,.01,-.01,180,-180,300,-300]){
    const p={...entity('paper'),bend,pitch:33,roll:-28,yaw:71,scale:.7,position:[.2,1,-.4]};
    for(const uv of [[0,0,0],[-.7,.25,0],[.8,-.3,0]]){
      const w=surfaceWorld(p,uv);near(paperCoordinates(p,w),uv);
      const front=surfaceWorld(p,uv,.1),direction=w.map((v,i)=>(v-front[i])/.1),hit=hitPaper(p,front,direction);
      assert.ok(hit);near(hit.uv,uv);near(hit.world,w);
    }
    assert.equal(hitPaper(p,surfaceWorld(p,[0,3,0],.1),surfaceWorld(p,[0,0,0]).map((v,i)=>(v-surfaceWorld(p,[0,0,0],.1)[i])/.1)),null);
  }
});
test('v4 migration preserves legacy ink size/UV and parent transforms never rewrite stored points',()=>{
  const p={...entity('paper'),position:[0,1,0],scale:.8},old={...entity(),paperId:p.id,position:[.2,1,0],scale:1.4,points:[[0,0,0,1],[.5,.2,0,.6]]};
  const e=localizeStroke(old,p);near(strokeUV(e,e.points[1],p),strokeUV(old,old.points[1],p));assert.ok(Math.abs(e.width*e.scale*p.scale-old.width*old.scale)<1e-8);
  const points=JSON.stringify(e.points),moved=transformSelection([p,e],new Set([p.id,e.id]),{move:[.1,.2,-.1],yaw:41,scale:.8});assert.equal(JSON.stringify(moved[1].points),points);assert.deepEqual(moved[1].position,e.position);
  const copies=duplicateSelection([p,e],new Set([p.id])).entities;assert.deepEqual(copies[3].position,e.position);assert.equal(copies[3].paperId,copies[2].id);
  const doc=JSON.parse(encode([{...p,bend:180,pitch:20,roll:15},e]));assert.equal(doc.version,4);assert.equal(decode(JSON.stringify(doc))[1].pointSpace,'surface');
  assert.throws(()=>validate({...doc,version:3}),/version 4/);assert.throws(()=>validate(documentOf([p,{...e,position:[0,0,.1]}])),/zero depth/);
});
test('a sparse line renders along the sheet without increasing storage and surface subdivision is bounded',()=>{
  const p={...entity('paper'),bend:180},e={...entity(),paperId:p.id,pointSpace:'surface',points:[[-.8,0,0,1],[.8,0,0,1]]},g=geometry(e,p);
  assert.equal(e.points.length,2);assert.ok(g.attributes.position.count>100);for(const v of g.attributes.position.array)assert.ok(Number.isFinite(v));
  // Every vertex lies on the offset cylinder, including the stroke edges.
  const k=Math.PI/p.panelWidth,r=1/k-.003/p.scale,xyz=g.attributes.position.array;
  for(let i=0;i<xyz.length;i+=3)assert.ok(Math.abs(Math.hypot(xyz[i],xyz[i+2]-1/k)-r)<1e-5);
  const path=Array.from({length:384},(_,i)=>[i%2?100:-100,0,1]);assert.ok(subdivideSurface([path],{...p,bend:300}).flat().length<2000);g.dispose();
});
