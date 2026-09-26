import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-library.js';
import {demoShowDoc,compileShow,showDuration} from '../src/show-project.js';
import {sampleShow,HAPPY_PHRASES,PHRASE_TIMING} from '../src/drone-show.js';
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
  assert.ok(data.length/PARTICLE_FLOATS<40000,'still within the particle budget');
});
