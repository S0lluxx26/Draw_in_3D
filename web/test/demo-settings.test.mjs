import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {demoSettings,compileDemo,FORMATIONS} from '../src/demo-settings.js';
import {sampleShow,groundFocus,buildShow,demoPaths,samplePaths,CINEMATIC_LANDING,TRAVEL_LEVEL,PHRASE_TIMING,HAPPY_PHRASES} from '../src/drone-show.js';
import {DEMO_TRANSFER} from '../src/demo-library.js';
import {byPad} from './pads.mjs';

test('Demo settings bound untrusted saved values and preserve explicit fire choices',()=>{
  assert.deepEqual(demoSettings(null),demoSettings());
  assert.equal(demoSettings({count:1e9,scale:0,shape:'script'}).count,4096);
  assert.equal(demoSettings({fire:{'Starship launch':false}}).fire['Starship launch'],false);
});
test('Landing reverses takeoff poses and navigation lights at a slower pace, with a ground camera',()=>{
  const show=compileDemo(assets,{count:512}),up=show.stages.find(s=>s.kind==='takeoff'),down=show.stages.find(s=>s.kind==='landing');
  assert.equal(down.end-down.start,CINEMATIC_LANDING[1]);
  for(const f of [.13,.37,.71,.91]){
    const a=sampleShow(show,up.start+(up.end-up.start)*(1-f)),b=sampleShow(show,down.start+(down.end-down.start)*f);
    // Pad by pad: the drone landing on pad k retraces pad k's takeoff, lights included.
    const pos=byPad(show,b.positions),col=byPad(show,b.colors);
    assert.ok(a.positions.every((v,i)=>Math.abs(v-pos[i])<.0001));
    assert.ok(a.colors.every((v,i)=>Math.abs(v-col[i])<.0001));
  }
  assert.equal(groundFocus(show,down.start),1);assert.equal(groundFocus(show,up.start),1);
  assert.equal(groundFocus(show,show.cues.find(c=>c.label==='Fish').time),0);
  // Shape changes are quicker (DEMO_TRANSFER); firework launches and the flight home keep 9 s.
  // A sentence's phrases morph in PHRASE_TIMING.morph; other shape changes take DEMO_TRANSFER; launches and the flight home 9 s.
  for(const s of show.stages.filter(s=>s.kind==='move')){const next=show.stages[show.stages.indexOf(s)+1];assert.equal(s.end-s.start,s.morph?PHRASE_TIMING.morph:['hold','rise'].includes(next.kind)?DEMO_TRANSFER:9,s.name);}
});
test('Three firework types expand, then blink and fall to darkness with no teleporting or lost drones',()=>{
  const show=compileDemo(assets,{count:512}),bursts=show.stages.filter(s=>s.kind==='grow');
  assert.deepEqual(bursts.map(s=>s.name),['Growing heart','Five-point star','Three firework balls']);
  for(const s of bursts){
    const width=positions=>Math.max(...positions.map(p=>p[0]))-Math.min(...positions.map(p=>p[0]));
    assert.ok(width(s.to.positions)>width(s.from.positions));
    const fall=show.stages.slice(show.stages.indexOf(s)+1).find(x=>x.kind==='fall'),a=sampleShow(show,fall.start+.1),b=sampleShow(show,fall.end-.1);// the heart beats first
    assert.ok(fall.to.positions.every((p,i)=>p[1]<fall.from.positions[i][1]));
    assert.ok(b.colors.reduce((n,v)=>n+v,0)<a.colors.reduce((n,v)=>n+v,0)*.01);
    for(let t=s.start;t<=fall.end;t+=.5){const frame=sampleShow(show,t);assert.equal(frame.positions.length,1536);assert.ok(frame.positions.every(Number.isFinite));assert.ok(frame.colors.every(v=>v>=0&&v<=1));}
  }
});
test('Blender formations have depth, distinct well-spaced samples and exact fleet counts',()=>{
  for(const name of FORMATIONS){const {positions}=assets[name].body;assert.equal(positions.length,4096);assert.equal(new Set(positions.map(p=>p.join(','))).size,4096);assert.ok(positions.every(p=>p.every(Number.isFinite)));assert.ok(Math.max(...positions.map(p=>p[2]))-Math.min(...positions.map(p=>p[2]))>1);}
  const show=compileDemo(assets,{count:512,scale:4,shape:'star'});
  assert.equal(show.count,512);assert.equal(show.lightShape,'star');assert.equal(show.duration,423);
  for(const s of show.stages){assert.equal(s.to.positions.length,512);assert.equal(s.to.colors.length,512);}
  assert.deepEqual(byPad(show,sampleShow(show,show.duration).positions),sampleShow(show,0).positions);
});
test('Demo fire selection is explicit; Starship still rises when its fire is disabled',()=>{
  const fire=Object.fromEntries(FORMATIONS.map(n=>[n,n==='Fish']));
  const show=compileDemo(assets,{count:256,scale:2,fire}),fish=show.stages.find(s=>s.name==='Fish'),rise=show.stages.find(s=>s.name==='Starship launch');
  assert.equal(fish.to.fire.filter(Boolean).length,32);assert.equal(rise.to.fire.filter(Boolean).length,0);
  assert.ok(rise.to.positions.every((p,i)=>Math.abs(p[1]-rise.from.positions[i][1]-40)<1e-8));
  assert.equal(fish.effect,'fire');assert.equal(rise.fireEnabled,false);
});
test('Between shapes every drone blinks red or blue at a quarter of full light, continuous at every boundary',()=>{
  const show=compileDemo(assets,{count:512});
  for(const s of show.stages.filter(s=>s.kind==='move'&&!s.morph)){
    const length=s.end-s.start;
    for(const f of [.002,.02,.06,.15,.5,.85,.99]){
      const frame=sampleShow(show,s.start+length*f);
      for(let i=0;i<frame.colors.length;i+=3){const [r,g,b]=frame.colors.subarray(i,i+3);assert.ok(r>10*b||b>10*r||Math.max(r,g,b)<1e-8,s.name+': only red or blue LEDs in flight');}
      assert.ok(frame.colors.every(v=>v>=0&&v<=TRAVEL_LEVEL+1e-9),'never above a quarter of full light');
    }
    const a=sampleShow(show,s.start+length/2),b=sampleShow(show,s.start+length/2+.4);
    assert.ok(a.colors.some(v=>v>TRAVEL_LEVEL*.9),s.name+' blinks at a quarter light, bright enough to follow');
    assert.ok(Math.abs(TRAVEL_LEVEL**2.2-.25)<1e-12,'a quarter of the light an LED gives at full value');
    assert.notEqual(a.colors[0]>a.colors[2],b.colors[0]>b.colors[2],'the colours alternate');
  }
  for(const s of show.stages.slice(1)){
    const a=sampleShow(show,s.start-1e-6),b=sampleShow(show,s.start+1e-6);
    assert.ok(a.positions.every((v,i)=>Math.abs(v-b.positions[i])<.001),s.name);
    assert.ok(a.colors.every((v,i)=>Math.abs(v-b.colors[i])<.001),s.name);
  }
});
test('Demo formations are twice the previous dimensions for existing saved scale choices',()=>{
  const show=compileDemo(assets,{count:512,scale:3,fire:{Robot:false}}),fish=show.stages.find(s=>s.name==='Robot');
  const extent=(points,k)=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k]));
  for(let k=0;k<3;k++)assert.ok(Math.abs(extent(fish.to.positions,k)-extent(assets.Robot.body.positions.slice(0,512),k)*6)<1e-8);
});
test('New stroke formations sample to full fleets; only Happy day carries the ship-fireworks flag, in both demos',()=>{
  const drawn=demoPaths();assert.deepEqual(drawn.map(f=>f.name),FORMATIONS);
  for(const name of ['Butterfly','Hot air balloon','Birthday cake','Happy day'])for(const count of [256,4096]){
    const {positions,colors}=samplePaths(drawn.find(f=>f.name===name).paths,count);
    assert.equal(positions.length,count);assert.equal(colors.length,count);assert.equal(new Set(positions.map(p=>p.join(','))).size,count,name+' samples are distinct');
    assert.ok(positions.every(p=>p.length===3&&p.every(Number.isFinite)&&Math.abs(p[0])<=12&&p[1]>=9&&p[1]<=29),name+' stays in the drawing frame');
    assert.ok(colors.every(c=>c.length===3&&c.every(v=>v>=0&&v<=1)));
  }
  assert.deepEqual(drawn.filter(f=>f.pyro).map(f=>[f.name,f.hold,f.effect]),[['Happy day',16,'sparkle']]);
  for(const show of [buildShow(null,{count:256}),compileDemo(assets,{count:256})]){
    const pyro=show.stages.filter(s=>s.pyro);assert.deepEqual(pyro.map(s=>[s.name,s.kind,s.effect,s.pyro,s.end-s.start]),[['Happy day','hold','sparkle',true,16]]);
    assert.ok(show.cues.some(c=>c.label==='Happy day'&&c.time>=pyro[0].start&&c.time<pyro[0].end));
  }
});
