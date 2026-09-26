import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ShowEditor} from '../src/show-editor.js';
import {ShowRecorder,recordingBitrate} from '../src/show-recorder.js';
import {editableDemo,encodeShow,compileShow,ShowHistory,SHOW_LIMITS} from '../src/show-project.js';
import {frontView} from '../src/drone-show.js';

function dom(t){
  const previous=globalThis.document,elements=new Map();
  const element=()=>({textContent:'',children:[],style:{},classList:{toggle(){}},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});
  globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};
  t.after(()=>{globalThis.document=previous;});return id=>document.getElementById(id);
}

test('show recovery exposes memory-only failed saves even when database listing fails',async t=>{
  const $=dom(t),editor=Object.create(ShowEditor.prototype),record={id:'failed',name:'Only copy',updatedAt:1,text:encodeShow(editableDemo())};
  editor.writer={flush:async()=>{},failed:new Map([['failed',{create:()=>record}]])};editor.store={list:async()=>{throw new Error('Storage unavailable');}};
  await editor.recover();assert.equal($('author-drafts').children.length,1);const row=$('author-drafts').children[0];
  assert.match(row.children[0].textContent,/only in memory/);assert.equal(row.children[2].textContent,'Download');assert.match($('author-status').textContent,/Storage unavailable/);
});

test('a delayed draft restore cannot replace a newer show edit',async t=>{
  dom(t);const editor=Object.create(ShowEditor.prototype);editor.revision=3;editor.writer={failed:new Map()};let resolve,changed=false;
  editor.store={get:()=>new Promise(r=>resolve=r)};editor.replace=()=>changed=true;
  const pending=editor.loadDraft('old');editor.revision++;resolve({text:encodeShow(editableDemo())});await pending;
  assert.equal(changed,false);assert.match(document.getElementById('author-status').textContent,/show changed/);
});

test('late video size and encoder failures report errors after stop without downloading',t=>{
  const $=dom(t),previous=globalThis.MediaRecorder;let downloads=0;
  document.createElement=()=>({click:()=>downloads++});
  class Recorder{static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='video/webm';}start(){this.state='recording';}stop(){this.state='inactive';}}
  globalThis.MediaRecorder=Recorder;t.after(()=>{globalThis.MediaRecorder=previous;});
  const track={addEventListener(){},stop(){}},player={active:true,show:{duration:87},canvas:{clientWidth:800,clientHeight:600,style:{},captureStream:()=>({getTracks:()=>[track]})},camera:{clone:()=>({}),clearViewOffset(){},updateProjectionMatrix(){},copy(){}},orbit:{enabled:true,target:{clone:()=>({}),copy(){}}},renderer:{getPixelRatio:()=>1,setPixelRatio(){},setSize(){}},clock:{rate:1,time:0,pause(){},speed(){},seek(){},play(){}},front(){},render(){},refresh(){},resize(){}};
  const recorder=new ShowRecorder(player);
  recorder.start();const first=recorder.recorder;recorder.finish(false);assert.equal($('show-record-status').textContent,'Finishing video…');
  first.ondataavailable({data:{size:160*1024*1024+1}});first.onstop();assert.match($('show-record-status').textContent,/160 MiB/);assert.equal(downloads,0);
  recorder.start();const second=recorder.recorder;recorder.finish(false);second.onerror();second.onstop();assert.match($('show-record-status').textContent,/Recording failed/);assert.equal(downloads,0);
  recorder.start();const third=recorder.recorder;recorder.finish(false);third.onstop();assert.match($('show-record-status').textContent,/No video frames/);assert.equal(player.orbit.enabled,true);
});

test('front framing contains high, wide and deep authored formations and landing in portrait and video',()=>{
  const doc=editableDemo();doc.cues[0].placement.position=[20,34,10];doc.cues[1].placement.position=[-20,20,-10];
  const show=compileShow(doc);
  for(const [aspect,offset]of [[16/9,0],[4/3,0],[.45,.15]]){
    const pose=frontView(show,aspect,46,offset),camera=new THREE.PerspectiveCamera(46,aspect,.1,1000);camera.position.fromArray(pose.position);camera.lookAt(new THREE.Vector3(...pose.target));
    if(offset)camera.setViewOffset(1000*aspect,1000,0,offset*1000,1000*aspect,1000);camera.updateMatrixWorld();
    for(const s of show.stages)for(const p of [...s.from.positions,...s.to.positions]){const ndc=new THREE.Vector3(...p).project(camera);assert.ok(Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1&&Math.abs(ndc.z)<1,`clipped point ${p} at aspect ${aspect}`);}
  }
});

test('recording bitrate adapts so the whole show fits the 160 MiB budget; impossible lengths are refused before starting',t=>{
  const $=dom(t),previous=globalThis.MediaRecorder,options=[];
  class Recorder{static isTypeSupported(){return true;}constructor(stream,o){options.push(o);this.state='inactive';this.mimeType='video/webm';}start(){this.state='recording';}stop(){this.state='inactive';}}
  globalThis.MediaRecorder=Recorder;t.after(()=>{globalThis.MediaRecorder=previous;});
  const track={addEventListener(){},stop(){}},player={active:true,show:{duration:87},canvas:{clientWidth:800,clientHeight:600,style:{},captureStream:()=>({getTracks:()=>[track]})},camera:{clone:()=>({}),clearViewOffset(){},updateProjectionMatrix(){},copy(){}},orbit:{enabled:true,target:{clone:()=>({}),copy(){}}},renderer:{getPixelRatio:()=>1,setPixelRatio(){},setSize(){}},clock:{rate:1,time:0,pause(){},speed(){},seek(){},play(){}},front(){},render(){},refresh(){},resize(){}};
  const recorder=new ShowRecorder(player),budget=160*1024*1024*8;
  assert.equal(recordingBitrate(87),4e6);assert.ok(recordingBitrate(1132)*1132<=budget*.8+1,'the longest editable show fits');
  recorder.start();assert.equal(options.at(-1).videoBitsPerSecond,4e6);recorder.finish(true);recorder.recorder=null;
  player.show.duration=25+SHOW_LIMITS.cues*90+27;recorder.start();const bits=options.at(-1).videoBitsPerSecond;
  assert.ok(bits<4e6&&bits>=8e5&&bits*player.show.duration<=budget*.8+1,`long show records at ${bits} b/s`);recorder.finish(true);recorder.recorder=null;
  player.show.duration=3600;const before=options.length;recorder.start();
  assert.equal(options.length,before,'no recorder is created');assert.equal(recorder.active,false);assert.match($('show-record-status').textContent,/too long to record/);
  assert.equal(player.orbit.enabled,true);
});

test('Play stays disabled while a preview worker is preparing trajectories',t=>{
  const elements=new Map(),previous=globalThis.document;
  const element=()=>{const e={children:[],style:{},dataset:{},classList:{toggle(){}},setAttribute(){},append(...items){e.children.push(...items);},replaceChildren(){e.children=[];}};return e;};
  globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element};t.after(()=>{globalThis.document=previous;});
  const editor=Object.create(ShowEditor.prototype);editor.state=new ShowHistory(editableDemo());editor.active=editor.doc.cues[0].id;editor.paint=()=>{};editor.stage=()=>{};// no canvas here: skip the thumbnails and the designer
  editor.worker={};editor.render();assert.equal(document.getElementById('author-play').disabled,true);
  editor.worker=null;editor.render();assert.equal(document.getElementById('author-play').disabled,false);
});
