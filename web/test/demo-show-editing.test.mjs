import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo,FORMATIONS} from '../src/demo-library.js';
import {demoShowDoc,demoCue,drawingCue,withDemoLook,editableDemo,newCue,blankArtwork,encodeShow,decodeShow,compileShow,showDuration,ShowHistory} from '../src/show-project.js';

const signature=show=>show.stages.map(s=>[s.name,s.kind,s.end-s.start,s.motion||'',!!s.spout,!!s.waves,s.to.fire?.filter(Boolean).length??0].join('|'));
const roundTrip=doc=>decodeShow(encodeShow(doc));

test('Edit demo opens the Demo itself: saved, reopened and played, it is the same show as the Demo',()=>{
  const settings={count:1024,shape:'star',scale:2,pyro:false,lasers:false,fire:{Fish:true,'Row of fire':false}};
  const doc=roundTrip(demoShowDoc(settings)),show=compileShow(doc,assets),demo=compileDemo(assets,settings);
  assert.equal(doc.version,3);assert.deepEqual(doc.cues.map(c=>c.library),FORMATIONS);assert.ok(doc.cues.every(c=>c.artwork.length===0),'no drawings to store');
  assert.deepEqual(signature(show),signature(demo));assert.equal(show.duration,demo.duration);assert.equal(showDuration(doc),demo.duration);
  for(const i of [3,9,20])assert.deepEqual(show.stages[i].to.positions,demo.stages[i].to.positions);
  assert.deepEqual([show.lightShape,show.pyro,show.lasers,show.count],['star',false,false,1024]);assert.ok(show.cinematic,'launch-pad close-ups and landing camera');
  assert.ok(!show.demo,'an edited show keeps its own settings; the player offers no Demo settings for it');
  assert.ok(encodeShow(doc).length<8*1024,'the file stores choices, not drone positions');
});

test('edits to the Demo play as edited: order, removal, timing, fire, look and finale',()=>{
  const doc=demoShowDoc({count:512}),whale=doc.cues.find(c=>c.library==='Whale');
  const edited={...doc,look:{...doc.look,shape:'diamond'},fireworks:{...doc.fireworks,style:'classic',duration:12},
    cues:[{...whale,hold:20,name:'Blue whale'},...doc.cues.filter(c=>!['Whale','Robot'].includes(c.library)).map(c=>c.library==='Fish'?{...c,fire:true}:c)]};
  const show=compileShow(roundTrip(edited),assets),hold=n=>show.stages.find(s=>s.name===n);
  assert.equal(show.cues[1].label,'Blue whale','the whale opens the show');assert.equal(hold('Blue whale').end-hold('Blue whale').start,20);assert.ok(hold('Blue whale').spout,'with its spout');
  assert.ok(!show.stages.some(s=>s.name==='Robot'));assert.equal(hold('Fish').to.fire.filter(Boolean).length,64,'falling fire switched on');assert.ok(hold('Fish').waves);
  assert.equal(show.lightShape,'diamond');assert.ok(show.stages.some(s=>s.kind==='burst'&&s.end-s.start===12)&&!show.stages.some(s=>s.kind==='grow'),'classic finale');
  assert.equal(show.duration,showDuration(edited));
});

test('Convert to drawing turns a Demo formation into its editable line art, keeping its timing; undo restores it',()=>{
  const doc=demoShowDoc(),cue={...doc.cues[2],hold:15,transfer:6,name:'My butterfly'},history=new ShowHistory({...doc,cues:[cue]});
  const drawing=drawingCue(cue.library,cue);assert.equal(drawing.library,undefined);assert.ok(drawing.artwork.some(e=>e.type==='stroke'));
  assert.deepEqual([drawing.id,drawing.name,drawing.hold,drawing.transfer,drawing.effect],[cue.id,'My butterfly',15,6,'flap']);
  history.set({...history.doc,cues:[drawing]});const show=compileShow(roundTrip(history.doc),assets);assert.equal(show.stages.find(s=>s.name==='My butterfly').motion,'flap','the drawing keeps its motion');
  history.travel(true);assert.equal(history.doc.cues[0].library,'Butterfly');
});

test('your drawings and Demo formations share one show on the Demo stage',()=>{
  const doc=demoShowDoc({count:256}),mine=editableDemo().cues[0];
  const show=compileShow(roundTrip({...doc,cues:[mine,demoCue('Whale')]}),assets),drawn=show.stages.find(s=>s.name===mine.name),whale=show.stages.find(s=>s.name==='Whale');
  const height=s=>Math.max(...s.to.positions.map(p=>p[1]))-Math.min(...s.to.positions.map(p=>p[1]));
  assert.ok(height(drawn)>height(whale)*.4&&height(drawn)<height(whale)*4,'drawings are scaled to the Demo stage, not tiny beside Demo formations');
  assert.ok(whale.spout);assert.equal(show.duration,showDuration({...doc,cues:[mine,demoCue('Whale')]}));
});

test('older shows keep playing as before, and can take on the Demo look',()=>{
  const old=editableDemo(),before=compileShow(roundTrip(old));assert.equal(roundTrip(old).version,2);assert.ok(!before.cinematic);
  const upgraded=roundTrip(withDemoLook(old,{count:512}));assert.equal(upgraded.version,3);assert.equal(upgraded.count,4096,'the fleet is kept');assert.equal(upgraded.fireworks.style,'classic');
  const after=compileShow(upgraded,assets);assert.ok(after.cinematic);assert.deepEqual(after.stages.filter(s=>s.kind==='hold').map(s=>s.name),before.stages.filter(s=>s.kind==='hold').map(s=>s.name));
  assert.ok(Math.max(...after.home.map(p=>p[0]))>Math.max(...before.home.map(p=>p[0]))*5,'the Demo-sized launch field');
});

test('Demo show files are validated like any other show',()=>{
  const doc=demoShowDoc();
  assert.throws(()=>decodeShow(encodeShow({...doc,cues:[{...doc.cues[0],library:'Dragon'}]})),/unknown Demo formation/);
  assert.throws(()=>decodeShow(encodeShow({...doc,cues:[{...doc.cues[0],artwork:blankArtwork()}]})),/no drawing/);
  assert.throws(()=>decodeShow(encodeShow({...doc,version:2})),/unknown Demo formation/,'Demo formations need version 3');
  assert.throws(()=>decodeShow(encodeShow({...doc,look:{...doc.look,shape:'laser'}})),/show look/);
  assert.throws(()=>decodeShow(encodeShow({...doc,fireworks:{...doc.fireworks,style:'confetti'}})),/finale/);
  assert.throws(()=>compileShow(doc,null),/not available/,'playing needs the Demo library');
  assert.equal(roundTrip({...doc,cues:[newCue(),...doc.cues.slice(0,2)]}).cues.length,3);
});
