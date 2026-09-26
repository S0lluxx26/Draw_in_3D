import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-library.js';
import {demoShowDoc,compileShow,showDuration,drawingCue} from '../src/show-project.js';
import {sampleShow,HAPPY_PHRASES,PHRASE_TIMING,STAR_SPIN} from '../src/drone-show.js';
import {pyroSchedule,pyroParticles,PARTICLE_FLOATS,FINE} from '../src/pyro.js';

const demo=compileDemo(assets,{count:512}),ships=[[-267,4.7,-270],[288,4.7,-249],[-206,5.4,-409]];

test('Happy day grows out of a sentence: each 3D phrase morphs into the next with its lights on, then into HAPPY DAY',()=>{
  const holds=demo.stages.filter(s=>s.phrase),final=demo.stages.find(s=>s.name==='Happy day');
  assert.deepEqual(holds.map(s=>s.name),[...HAPPY_PHRASES],'yesterday, tomorrow, today, that is why, the present');
  for(const name of HAPPY_PHRASES)assert.equal(assets[name].body.positions.length,4096,name+' is a Blender 3D phrase');
  assert.ok(holds.every(s=>s.end-s.start===PHRASE_TIMING.hold),'each phrase can be read');
  assert.ok(final.climax&&final.pyro&&demo.stages[demo.stages.indexOf(final)-1].morph,'the present becomes HAPPY DAY');
  const labels=demo.cues.map(c=>c.label);assert.deepEqual(labels.slice(labels.indexOf(HAPPY_PHRASES[0]),labels.indexOf('Happy day')+1),[...HAPPY_PHRASES,'Happy day']);
  // The morphs are gradual: every drone stays lit, flies smoothly, and its colour blends from one phrase to the next.
  for(const s of demo.stages.filter(s=>s.morph)){
    const mid=sampleShow(demo,(s.start+s.end)/2),lit=Array.from({length:demo.count},(_,i)=>Math.max(...mid.colors.subarray(i*3,i*3+3))>.05).filter(Boolean).length;
    assert.ok(lit>demo.count*.95,s.name+' keeps the lights on');
    const i=7,expected=s.from.colors[i].map((v,k)=>(v+s.to.colors[i][k])/2);assert.ok(expected.every((v,k)=>Math.abs(mid.colors[i*3+k]-v)<.02),'colours halfway between');
  }
  // An edited Demo keeps the sentence, and the editor's clock still matches Run.
  const doc=demoShowDoc({count:512}),edited=compileShow(doc,assets);
  assert.equal(edited.stages.filter(s=>s.phrase).length,5);assert.equal(edited.duration,showDuration(doc));assert.equal(edited.duration,demo.duration);
});

test('showpiece fireworks bloom around the heart and the sentence: colour-changing chrysanthemums, glittering crowns, crossed rings',()=>{
  const shells=pyroSchedule(demo,ships),at=(a,b)=>shells.filter(s=>s.t0+s.delay>=a&&s.t0+s.delay<b);
  const heart=demo.stages.find(s=>s.name==='Growing heart'),beat=demo.stages.find(s=>s.kind==='beat');
  const around=at(heart.start,beat.end+2).map(s=>s.pattern);
  for(const p of ['heart','chrysanthemum','crown','rings'])assert.ok(around.includes(p),'the heart gets '+p+' shells');
  for(const s of demo.stages.filter(s=>s.phrase))assert.ok(at(s.start-1,s.end+1.5).some(sh=>FINE.includes(sh.pattern)),s.name+' gets a showpiece');
  const data=pyroParticles(shells),star=(sh,pick)=>{const out=[];for(let o=0;o<data.length;o+=PARTICLE_FLOATS)if(data[o]===Math.fround(sh.t0)&&data[o+1]===Math.fround(sh.delay)&&data[o+11]===1&&pick(o))out.push(o);return out;};
  const kiku=shells.find(s=>s.pattern==='chrysanthemum'),crown=shells.find(s=>s.pattern==='crown'),rings=shells.find(s=>s.pattern==='rings');
  assert.ok(star(kiku,o=>data[o+24]>0).length>=400,'chrysanthemum stars change colour part-way');
  assert.ok(star(kiku,o=>data[o+24]===0&&data[o+15]>4).length>=50,'around a white pistil');
  assert.ok(star(crown,o=>data[o+20]===-2).length>=400,'the crown glitters');
  const ringColours=new Set(star(rings,()=>true).map(o=>[data[o+15],data[o+16],data[o+17]].map(v=>v.toFixed(2)).join()));assert.equal(ringColours.size,2,'two crossed rings, two colours');
  assert.ok(data.length/PARTICLE_FLOATS<80000,'still within the particle budget');
  for(const s of demo.stages.filter(s=>s.phrase))assert.ok(at(s.start-1,s.end+2).length>=3,s.name+' gets three shells');
});

test('the five-point star is a faceted 3D star that makes one smooth turn while it grows and spins, then falls from where it grew',()=>{
  const grow=demo.stages.find(s=>s.name==='Five-point star'),spin=demo.stages[demo.stages.indexOf(grow)+1],local=grow.to.positions.map(p=>[p[0]/6,p[1]/6-24,p[2]/6]);
  assert.equal(spin.kind,'spin');assert.equal(spin.end-spin.start,STAR_SPIN);assert.ok(grow.to.turn.every(Boolean),'the whole star turns');
  const zs=local.map(p=>p[2]);assert.ok(Math.max(...zs)-Math.min(...zs)>6,'it has depth: front and back peaks');
  const bright=grow.to.colors.filter(c=>c[1]>.9).length,dark=grow.to.colors.filter(c=>c[0]<.6).length;assert.ok(bright>demo.count*.05&&dark>demo.count*.05,'bright ridges and shaded facets');
  const mid=sampleShow(demo,spin.start+1),moved=grow.to.positions.filter((p,i)=>Math.hypot(mid.positions[i*3]-p[0],mid.positions[i*3+2]-p[2])>6).length;assert.ok(moved>demo.count*.5,'it is turning');
  const end=sampleShow(demo,spin.end-1e-6);assert.ok(grow.to.positions.every((p,i)=>Math.abs(end.positions[i*3]-p[0])<.05&&Math.abs(end.positions[i*3+2]-p[2])<.05),'a whole turn: back where it grew');
});

test('Show editor: converting Happy day keeps only its own display; a short Happy day plays without the sentence',()=>{
  const doc=demoShowDoc({count:512}),happy=doc.cues.find(c=>c.library==='Happy day');assert.equal(happy.hold,16+HAPPY_PHRASES.length*(PHRASE_TIMING.hold+PHRASE_TIMING.morph));
  assert.equal(drawingCue('Happy day',happy).hold,16,'the line-art HAPPY DAY does not inherit the sentence time');assert.equal(drawingCue('Robot',{hold:22}).hold,22);
  const short=compileShow({...doc,cues:[{...happy,hold:12}]},assets);assert.equal(short.stages.filter(s=>s.phrase).length,0,'too short for the sentence');assert.equal(short.stages.find(s=>s.name==='Happy day').end-short.stages.find(s=>s.name==='Happy day').start,12);
  const shorter=compileShow({...doc,cues:[{...happy,hold:30}]},assets);assert.equal(shorter.stages.filter(s=>s.phrase).length,5,'a shorter sentence still plays');assert.equal(shorter.duration,showDuration({...doc,cues:[{...happy,hold:30}]}));
});
