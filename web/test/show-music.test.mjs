import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-settings.js';
import {buildShow,ShowClock} from '../src/drone-show.js';
import {pyroSchedule} from '../src/pyro.js';
import {musicPlan,musicEvents,sustainedAt,ShowMusic,BEAT} from '../src/show-music.js';

const demo=compileDemo(assets,{count:256}),plan=musicPlan(demo);

// Minimal Web Audio stand-in: checks that every scheduled time and value is usable.
function fakeAudio(){
  const started=[],param=()=>{const p={value:1};for(const k of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime'])p[k]=(v,t)=>{assert.ok(Number.isFinite(v)&&Number.isFinite(t)&&t>=0,k);if(k==='exponentialRampToValueAtTime')assert.ok(v>0,'exponential ramps need a positive target');return p;};p.cancelScheduledValues=()=>p;return p;};
  const node=()=>{const n={connect:t=>t,disconnect(){},start(t){assert.ok(Number.isFinite(t)&&t>=0);n.started=t;started.push(n);},stop(t){assert.ok(Number.isFinite(t));n.stopped=t;}};
    for(const k of ['gain','frequency','detune','Q','delayTime','threshold','knee','ratio','attack','release','playbackRate'])n[k]=param();return n;};
  return {state:'running',currentTime:0,sampleRate:8000,destination:node(),started,createGain:node,createOscillator:node,createBiquadFilter:node,createBufferSource:node,createDynamicsCompressor:node,createConvolver:node,createDelay:node,createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)})};
}

test('Demo music follows every stage on the beat: build-ups into each formation, drops on arrival, a lifted key for the finale',()=>{
  const s=plan.sections;
  assert.equal(s[0].mood,'intro');assert.equal(s[0].start,0);assert.equal(s.at(-1).mood,'end');assert.equal(s.at(-1).end,demo.duration);
  for(let i=1;i<s.length;i++)assert.equal(s[i].start,s[i-1].end,'sections are contiguous');
  // Whole-second stages at 120 BPM: every section boundary is a real stage boundary and sits on a beat.
  const bounds=new Set(demo.stages.map(st=>st.start));for(const sec of s){assert.ok(bounds.has(sec.start),sec.name);assert.equal(Math.abs(sec.start/BEAT-Math.round(sec.start/BEAT))<1e-9,true);}
  const drops=s.filter(x=>x.mood==='drop');assert.equal(drops.length,12);assert.deepEqual(drops.map(d=>d.name),demo.stages.filter(st=>st.reveal||st.kind==='rise').map(st=>st.name));
  for(const d of drops){assert.equal(s[s.indexOf(d)-1].mood,'build','a build-up leads into '+d.name);
    assert.ok(musicEvents(plan,d.start,d.start+.01).some(e=>e.voice==='impact'&&e.t===d.start),'impact exactly on arrival of '+d.name);}
  assert.deepEqual(drops.map(d=>d.shift),[0,0,0,0,0,0,2,2,2,2,2,2]);
  assert.deepEqual(s.filter(x=>x.mood==='peak').map(x=>x.name),['Growing heart','Five-point star','Three firework balls']);
  assert.equal(s.filter(x=>x.mood==='outro').length,1,'returning home and landing share one outro phrase');
  // A small custom drawing show still gets a complete score.
  const custom=musicPlan(buildShow({positions:Array.from({length:64},(_,i)=>[i%8,Math.floor(i/8),0]),colors:Array.from({length:64},()=>[1,.5,.2])},{count:64}));
  assert.deepEqual(custom.sections.map(x=>x.mood),['intro','lift','build','drop','build','peak','outro','end']);
});

test('scores are deterministic and any split of the timeline schedules every note exactly once',()=>{
  const all=musicEvents(plan,0,plan.duration);assert.deepEqual(musicEvents(musicPlan(demo),0,plan.duration),all);
  assert.ok(all.length>5000);for(let i=1;i<all.length;i++)assert.ok(all[i].t>=all[i-1].t,'time order');
  for(const e of all){assert.ok(e.t>=0&&e.t<plan.duration&&Number.isFinite(e.g)&&e.g>0&&e.dur>0,e.voice);if('n' in e)assert.ok(e.n>=20&&e.n<=108);}
  let seed=7,from=0;const pieces=[];const random=()=>(seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296;
  while(from<plan.duration){const to=Math.min(plan.duration,from+.01+random()*.7);pieces.push(...musicEvents(plan,from,to));from=to;}
  assert.equal(pieces.length,all.length);assert.deepEqual(pieces.map(e=>e.t+e.voice),all.map(e=>e.t+e.voice));
  const pad=all.find(e=>e.voice==='pad'&&e.dur>=1),held=sustainedAt(plan,pad.t+.5);assert.ok(held.includes(pad)||held.some(e=>e.t===pad.t&&e.voice==='pad'),'a seek resumes held chords');
});

test('ship-firework bursts get booms at their exact burst times, and none when ship fireworks are off',()=>{
  const bursts=pyroSchedule(demo,[[0,0,0]]).map(sh=>sh.t0+sh.delay).sort((a,b)=>a-b);
  assert.ok(bursts.length>=20);assert.deepEqual(plan.booms.filter(b=>b.voice==='boom').map(b=>b.t),bursts);
  assert.equal(musicPlan(compileDemo(assets,{count:256,pyro:false})).booms.length,0);
});

test('music follows play, pause, seek and speed, resumes held chords after a seek and lets the final chord ring',()=>{
  const ctx=fakeAudio(),clock=new ShowClock(demo.duration),music=new ShowMusic(()=>clock,{context:ctx}),calls=[],fades=[];
  music.enabled=true;music.plan=plan;music.play=(e,when,rate,off=0)=>calls.push({e,when,rate,off});const flush=music.flush.bind(music);music.flush=f=>{fades.push(f);flush(f);};
  clock.play(0);music.tick(0);assert.ok(calls.length>0&&calls.every(c=>c.e.t<.35&&c.when===c.e.t));assert.ok(calls.some(c=>c.e.voice==='pad'&&c.e.t===0));
  const first=calls.length;ctx.currentTime=.3;music.tick(300);assert.ok(calls.slice(first).every(c=>c.e.t>=.35&&c.e.t<.65),'no repeats across ticks');
  clock.pause(400);ctx.currentTime=.4;music.tick(400);assert.equal(music.gen,null,'pausing silences what was scheduled ahead');
  let count=calls.length;music.tick(500);assert.equal(calls.length,count,'nothing plays while paused');
  const drop=plan.sections.find(s=>s.mood==='drop');clock.seek(drop.start+1,500);clock.play(500);ctx.currentTime=.5;calls.length=0;music.tick(500);
  assert.ok(calls.some(c=>c.e.voice==='pad'&&c.e.t===drop.start&&Math.abs(c.off-1)<1e-9),'the chord under the formation resumes mid-note');
  assert.ok(calls.filter(c=>c.off===0).every(c=>c.e.t>=drop.start+1&&c.e.t<drop.start+1.35));
  clock.speed(2,600);ctx.currentTime=.6;calls.length=0;music.tick(600);assert.ok(calls.length&&calls.every(c=>c.rate===2));
  assert.ok(calls.filter(c=>c.off===0).every(c=>Math.abs(c.when-(.6+(c.e.t-clock.time)/2))<1e-9),'double speed halves the gaps');
  music.enabled=false;fades.length=0;music.tick(700);assert.deepEqual(fades,[.04]);count=calls.length;music.tick(800);assert.equal(calls.length,count,'muted');music.enabled=true;
  clock.speed(1,900);clock.seek(demo.duration-.2,900);clock.play(900);ctx.currentTime=.9;music.tick(900);fades.length=0;ctx.currentTime=1.2;music.tick(1200);
  assert.equal(clock.playing,false);assert.deepEqual(fades,[1.6],'the final chord rings out');
});

test('with phone-like output latency the opening chord still plays, early by that latency where possible',()=>{
  const ctx=Object.assign(fakeAudio(),{outputLatency:.08,currentTime:5}),clock=new ShowClock(demo.duration),music=new ShowMusic(()=>clock,{context:ctx}),calls=[];
  music.enabled=true;music.plan=plan;music.play=(e,when)=>calls.push({e,when});clock.play(0);music.tick(0);
  assert.ok(calls.some(c=>c.e.voice==='pad'&&c.e.t===0&&c.when===5),'the first chord is not dropped');
  assert.ok(calls.filter(c=>c.e.t>=.2).every(c=>Math.abs(c.when-(5-.08+c.e.t))<1e-9),'later notes lead by the output latency');
});

test('every voice builds a valid Web Audio graph across the whole Demo, at both speeds and when resumed',()=>{
  const ctx=fakeAudio(),music=new ShowMusic(()=>null,{context:ctx});music.gen=music.generation();
  const all=musicEvents(plan,0,plan.duration);for(const e of all)music.play(e,e.t,1);
  for(const e of musicEvents(plan,60,90))music.play(e,e.t/2,2);
  for(const t of plan.sections.map(s=>s.start+1.3))for(const e of sustainedAt(plan,t))music.play(e,t,1,t-e.t);
  assert.deepEqual(new Set(all.map(e=>e.voice)),new Set(['pad','riser','pluck','crash','impact','kick','hat','bass','snare','sweep','clap','lead','bell','launch','boom']));
  for(const n of ctx.started)assert.ok(n.stopped>n.started,'every source stops after it starts');
  assert.ok(ctx.started.length/plan.duration<200,`${Math.round(ctx.started.length/plan.duration)} sources per second`);
  assert.equal(music.capture(),null,'no capture without MediaStream support');
});
