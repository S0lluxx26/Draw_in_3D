import test from 'node:test';
import assert from 'node:assert/strict';
import {entity,encode,decode,documentOf,validate} from '../src/model.js';
import {transformSelection,duplicateSelection} from '../src/editing.js';
import {PAPER_TYPES,basis,worldPoint,paperCoordinates,paperPixels,insidePaper,attachedIds,strokeUV} from '../src/paper.js';
import {geometry} from '../src/geometry.js';
const scene=()=>{const p=entity('paper');p.position=[0,1,0];p.panelWidth=2;const e=entity();e.paperId=p.id;e.position=[.2,1,0];e.points=[[0,0,0,1],[.6,.2,0,1]];e.wet=true;e.brush='Water';return [p,e];};
test('v3 attaches strokes to a valid paper and rejects dangling or non-stroke links',()=>{
  const [p,e]=scene(),text=encode([p,e]);assert.equal(JSON.parse(text).version,3);assert.equal(decode(text)[1].paperId,p.id);
  assert.throws(()=>validate(documentOf([e])),/paper/);assert.throws(()=>validate({...documentOf([p,e]),version:2}),/version 3/);
  assert.throws(()=>validate(documentOf([{...p,paperKind:'unknown'},e])),/paper type/);
  assert.throws(()=>validate(documentOf([p,{...entity('block'),paperId:p.id}])),/paper/);
});
test('parent transforms and duplicates preserve painted coordinates without double-moving children',()=>{
  const [p,e]=scene(),before=paperCoordinates(p,worldPoint(e,e.points[1]));
  const moved=transformSelection([p,e],new Set([p.id,e.id]),{move:[.1,.2,.1],yaw:47,scale:.8});
  const after=strokeUV(moved[1],moved[1].points[1],moved[0]);after.forEach((v,i)=>assert.ok(Math.abs(v-before[i])<1e-8));
  const copies=duplicateSelection([p,e],new Set([p.id])).entities;assert.equal(copies.length,4);assert.equal(copies[3].paperId,copies[2].id);assert.notEqual(copies[3].paperId,p.id);
  assert.equal(attachedIds([p,e],new Set([p.id])).size,2);
});
test('paper bases, edge clipping, shared texture bounds and every preset mesh stay finite',()=>{
  for(const normal of [[0,0,1],[1,0,0],[0,1,0],[0,-1,0]]){const [p,e]=scene();p.normal=normal;p.yaw=35;const axes=basis(normal);assert.ok(Math.abs(Math.hypot(...axes.u)-1)<1e-8);assert.ok(insidePaper(p,p.position));assert.ok(!insidePaper(p,worldPoint(p,axes.u.map(v=>v*2))));
    for(const kind of Object.keys(PAPER_TYPES)){p.paperKind=kind;const {pixels,size}=paperPixels(kind,true);assert.equal(pixels.length,size*size*4);const mesh=geometry(e,p);assert.ok(mesh.attributes.position.count>0&&mesh.attributes.position.count<500);assert.ok([...mesh.attributes.position.array].every(Number.isFinite));mesh.dispose();}}
});
