import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {demoSettings,compileDemo,FORMATIONS} from '../src/demo-settings.js';
import {sampleShow,groundFocus} from '../src/drone-show.js';

test('Demo settings bound untrusted saved values and preserve explicit fire choices',()=>{
  assert.deepEqual(demoSettings(null),demoSettings());
  assert.equal(demoSettings({count:1e9,scale:0,shape:'script'}).count,4096);
  assert.equal(demoSettings({fire:{'Starship launch':false}}).fire['Starship launch'],false);
});
test('Landing reverses takeoff poses and navigation lights at a slower pace, with a ground camera',()=>{
  const show=compileDemo(assets,{count:512}),up=show.stages.find(s=>s.kind==='takeoff'),down=show.stages.find(s=>s.kind==='landing');
  assert.equal(down.end-down.start,14);
  for(const f of [.13,.37,.71,.91]){
    const a=sampleShow(show,up.start+(up.end-up.start)*(1-f)),b=sampleShow(show,down.start+(down.end-down.start)*f);
    assert.ok(a.positions.every((v,i)=>Math.abs(v-b.positions[i])<.0001));
    assert.ok(a.colors.every((v,i)=>Math.abs(v-b.colors[i])<.0001));
  }
  assert.equal(groundFocus(show,down.start),1);assert.equal(groundFocus(show,up.start),1);
  assert.equal(groundFocus(show,show.cues.find(c=>c.label==='Fish').time),0);
  assert.ok(show.stages.filter(s=>s.kind==='move').every(s=>s.end-s.start===9));
});
test('Three firework types expand, then blink and fall to darkness with no teleporting or lost drones',()=>{
  const show=compileDemo(assets,{count:512}),bursts=show.stages.filter(s=>s.kind==='grow');
  assert.deepEqual(bursts.map(s=>s.name),['Growing heart','Five-point star','Three firework balls']);
  for(const s of bursts){
    const width=positions=>Math.max(...positions.map(p=>p[0]))-Math.min(...positions.map(p=>p[0]));
    assert.ok(width(s.to.positions)>width(s.from.positions));
    const fall=show.stages[show.stages.indexOf(s)+1],a=sampleShow(show,fall.start+.1),b=sampleShow(show,fall.end-.1);
    assert.ok(fall.to.positions.every((p,i)=>p[1]<fall.from.positions[i][1]));
    assert.ok(b.colors.reduce((n,v)=>n+v,0)<a.colors.reduce((n,v)=>n+v,0)*.01);
    for(let t=s.start;t<=fall.end;t+=.5){const frame=sampleShow(show,t);assert.equal(frame.positions.length,1536);assert.ok(frame.positions.every(Number.isFinite));assert.ok(frame.colors.every(v=>v>=0&&v<=1));}
  }
});
test('Blender formations have depth, distinct well-spaced samples and exact fleet counts',()=>{
  for(const name of FORMATIONS){const {positions}=assets[name].body;assert.equal(positions.length,4096);assert.equal(new Set(positions.map(p=>p.join(','))).size,4096);assert.ok(positions.every(p=>p.every(Number.isFinite)));assert.ok(Math.max(...positions.map(p=>p[2]))-Math.min(...positions.map(p=>p[2]))>1);}
  const show=compileDemo(assets,{count:512,scale:4,shape:'star'});
  assert.equal(show.count,512);assert.equal(show.lightShape,'star');assert.equal(show.duration,229);
  for(const s of show.stages){assert.equal(s.to.positions.length,512);assert.equal(s.to.colors.length,512);}
  assert.deepEqual(sampleShow(show,0).positions,sampleShow(show,show.duration).positions);
});
test('Demo fire selection is explicit; Starship still rises when its fire is disabled',()=>{
  const fire=Object.fromEntries(FORMATIONS.map(n=>[n,n==='Fish']));
  const show=compileDemo(assets,{count:256,scale:2,fire}),fish=show.stages.find(s=>s.name==='Fish'),rise=show.stages.find(s=>s.kind==='rise');
  assert.equal(fish.to.fire.filter(Boolean).length,32);assert.equal(rise.to.fire.filter(Boolean).length,0);
  assert.ok(rise.to.positions.every((p,i)=>Math.abs(p[1]-rise.from.positions[i][1]-20)<1e-8));
  assert.equal(fish.effect,'fire');assert.equal(rise.fireEnabled,false);
});
test('Dim transition LEDs alternate, remain bounded, and fade continuously at every boundary',()=>{
  const show=compileDemo(assets,{count:512});
  for(const s of show.stages.filter(s=>s.kind==='move')){
    const a=sampleShow(show,s.start+3),b=sampleShow(show,s.start+3.4);
    assert.ok(a.colors.some(v=>v>.01));assert.ok(a.colors.every(v=>v<=.121));
    assert.notEqual(a.colors[0]>a.colors[2],b.colors[0]>b.colors[2]);
  }
  for(const s of show.stages.slice(1)){
    const a=sampleShow(show,s.start-1e-6),b=sampleShow(show,s.start+1e-6);
    assert.ok(a.positions.every((v,i)=>Math.abs(v-b.positions[i])<.001),s.name);
    assert.ok(a.colors.every((v,i)=>Math.abs(v-b.colors[i])<.001),s.name);
  }
});
