import test from 'node:test';
import assert from 'node:assert/strict';
import {entity,encode,decode,validate,documentOf} from '../src/model.js';
import {geometry} from '../src/geometry.js';
import {hitPaper,surfaceWorld} from '../src/paper.js';
import {duplicateSelection,transformSelection} from '../src/editing.js';

test('hiding a curved paper preserves ink geometry, brush appearance, ray target and point data',()=>{
  const paper={...entity('paper'),bend:180,position:[0,1,0],roll:20},hidden={...paper,paperVisible:false};
  const ink={...entity(),paperId:paper.id,pointSpace:'surface',brush:'Water',wet:true,points:[[-.8,0,0,1],[.8,.2,0,.6]]};
  const a=geometry(ink,paper),b=geometry(ink,hidden);
  for(const name of Object.keys(a.attributes))assert.deepEqual(a.attributes[name].array,b.attributes[name].array);
  const origin=surfaceWorld(hidden,[.1,.1,0],.2),target=surfaceWorld(hidden,[.1,.1,0]);
  assert.ok(hitPaper(hidden,origin,target.map((v,i)=>v-origin[i])));
  const saved=JSON.parse(encode([hidden,ink]));assert.equal(saved.version,5);assert.equal(saved.entities[0].paperVisible,false);
  const reopened=decode(JSON.stringify(saved));assert.equal(reopened[0].paperVisible,false);assert.deepEqual(reopened[1].points,ink.points.map(p=>p.map(Math.fround)));
  const moved=transformSelection(reopened,new Set([paper.id]),{move:[.1,0,0]});assert.equal(moved[0].paperVisible,false);assert.deepEqual(moved[1].points,reopened[1].points);
  const copy=duplicateSelection(reopened,new Set([paper.id])).entities;assert.equal(copy[2].paperVisible,false);assert.equal(copy[3].paperId,copy[2].id);
  a.dispose();b.dispose();
});

test('legacy sheets remain visible and incompatible visibility data cannot silently change the scene',()=>{
  const p=entity('paper'),s={...entity(),points:[[0,0,0,1]]};
  const legacy=JSON.parse(encode([p]));assert.equal(legacy.version,3);assert.equal('paperVisible' in legacy.entities[0],false);assert.equal(decode(JSON.stringify(legacy))[0].paperVisible,true);
  for(const value of [null,'false',0])assert.throws(()=>validate(documentOf([{...p,paperVisible:value}])),/visibility/);
  assert.throws(()=>validate({...documentOf([{...p,paperVisible:false}]),version:4}),/version 5/);
  assert.throws(()=>validate({version:5,units:'metres',coordinates:'right-handed-y-up',entities:[{...s,paperVisible:false}]}),/Only paper/);
});
