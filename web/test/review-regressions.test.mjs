import test from 'node:test';
import assert from 'node:assert/strict';
import {FormationDesigner} from '../src/formation-designer.js';
import {designPaper,designArtwork,designStrokes,textStrokes,mirrored} from '../src/formation-design.js';
import {newCue,newShow,encodeShow,decodeShow,ShowHistory} from '../src/show-project.js';
import {ShowEditor} from '../src/show-editor.js';

test('secondary pointers cannot replace, finish or cancel the active designer stroke',()=>{
  const d=Object.create(FormationDesigner.prototype),captures=new Set();
  Object.assign(d,{editable:true,tool:'pen',canvas:{setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture(id){captures.delete(id);},focus(){}},at:e=>e.p,tolerance:()=>.01,draw(){},liveDots(){},added(lines){this.saved=lines;}});
  const event=(pointerId,p)=>({pointerId,p,button:0,preventDefault(){}});
  d.down(event(1,[0,0]));d.move(event(1,[1,1]));d.down(event(2,[10,10]));d.move(event(2,[20,20]));d.up(event(2,[20,20]));d.cancelPointer(event(2));
  assert.equal(d.pointerId,1);assert.equal(d.saved,undefined);d.move(event(1,[2,2]));d.up(event(1,[2,2]));
  assert.deepEqual(d.saved,[[[0,0],[2,2]]]);assert.equal(captures.size,0);
  d.down(event(3,[0,0]));d.cancelPointer(event(3));assert.equal(d.gesture,null);assert.equal(d.pointerId,null);assert.equal(captures.size,0);
});

test('word and mirrored groups survive show save/open and independent duplicate history',()=>{
  const paper=designPaper(),word=textStrokes('HI',[0,24],6).map((points,i)=>({id:'word'+i,color:-1,group:'word',points}));
  const pair=[{id:'a',color:-1,group:'mirror',points:[[5,10],[10,15]]},{...mirrored([{color:-1,group:'mirror',points:[[5,10],[10,15]]}])[0],id:'b'}];
  const cue={...newCue(),artwork:designArtwork(paper,[...word,...pair])},history=new ShowHistory({...newShow(),cues:[cue]});
  const read=doc=>{const d=Object.create(FormationDesigner.prototype);d.strokes=designStrokes(decodeShow(encodeShow(doc)).cues[0]);d.groups=new Map(d.strokes.map(s=>[s.id,s.group]));return d;};
  let d=read(history.doc);assert.equal(d.group('word0').size,word.length);assert.equal(d.group('a').size,2);
  d.selection=d.group('word0');d.editable=true;d.syncBar=()=>{};d.commit=strokes=>history.set({...history.doc,cues:[{...cue,artwork:designArtwork(paper,strokes)}]});d.act('duplicate');
  d=read(history.doc);assert.equal(d.group('word0').size,word.length);assert.equal(d.group(d.strokes.at(-1).id).size,word.length);
  history.travel(true);assert.equal(read(history.doc).strokes.length,word.length+2);history.travel(false);assert.equal(read(history.doc).strokes.length,2*word.length+2);
  const bad=structuredClone(history.doc);bad.cues[0].artwork[1].designGroup={unsafe:true};assert.throws(()=>encodeShow(bad),/designer group/);
});

test('an explicitly configured Demo is preserved until saved Demo settings actually change',t=>{
  const previousDocument=globalThis.document,previousStorage=globalThis.localStorage;let saved=null;
  const dialog={open:false,showModal(){this.open=true;}};globalThis.document={getElementById:()=>dialog};globalThis.localStorage={getItem:()=>JSON.stringify(saved)};
  t.after(()=>{globalThis.document=previousDocument;globalThis.localStorage=previousStorage;});
  const e=Object.create(ShowEditor.prototype);e.state=new ShowHistory();e.replace=doc=>{e.state.doc=doc;e.active=doc.cues[0].id;};e.render=()=>{};e.report=()=>{};e.loadAssets=()=>{};
  e.openDemo({count:512,scale:4});assert.equal(e.doc.count,512);assert.equal(e.doc.look.scale,4);e.open();assert.equal(e.doc.count,512);
  saved={count:1024,scale:2};e.open();assert.equal(e.doc.count,1024);assert.equal(e.doc.look.scale,2);
  e.state.doc={...e.doc,name:'My edited show'};saved={count:4096,scale:3};e.open();assert.equal(e.doc.count,1024);
});
