import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-settings.js';
import {sampleShow,spoutPoint,blowGlow,wavePoint,waveGlow,WHALE_SPOUT} from '../src/drone-show.js';
import {withWebmDuration} from '../src/show-recorder.js';
import {editableDemo,compileShow,encodeShow,decodeShow} from '../src/show-project.js';
import {laserBeam,LASER_COUNT} from '../src/lasers.js';
import {musicPlan} from '../src/show-music.js';

const demo=compileDemo(assets,{count:1024}),stage=name=>demo.stages.find(s=>s.name===name);
const offsets=(show,s,t)=>{const f=sampleShow(show,t),to=s.to.positions;return to.map((p,i)=>p.map((v,k)=>f.positions[i*3+k]-v));};
const largest=list=>Math.max(...list.flat().map(Math.abs));

test('the butterfly flaps its wings about the body, easing in and out so the transfers stay continuous',()=>{
  const s=stage('Butterfly');assert.equal(s.motion,'flap');
  assert.ok(largest(offsets(demo,s,s.start))<1e-4&&largest(offsets(demo,s,s.end-1e-6))<1e-4,'no jump at the hold boundaries');
  const xs=s.to.positions.map(p=>p[0]),cx=(Math.max(...xs)+Math.min(...xs))/2,width=Math.max(...xs)-Math.min(...xs);
  const flapped=[3.2,3.9,4.6].map(dt=>offsets(demo,s,s.start+dt));
  const tips=s.to.positions.map((p,i)=>[Math.abs(p[0]-cx),i]).filter(([d])=>d>width*.4).map(([,i])=>i),body=s.to.positions.map((p,i)=>[Math.abs(p[0]-cx),i]).filter(([d])=>d<width*.02).map(([,i])=>i);
  assert.ok(tips.length>20&&body.length>10);
  assert.ok(Math.max(...flapped.map(o=>Math.max(...tips.map(i=>Math.abs(o[i][2])))))>width*.08,'wing tips swing toward and away from the audience');
  // Frames are Float32Array, so compare to within a millimetre.
  for(const o of flapped)for(const i of body)assert.ok(Math.hypot(...o[i])<1e-3,'the body stays still');
  assert.deepEqual(sampleShow(demo,s.start+4).positions,sampleShow(demo,s.start+4).positions,'deterministic');
});

test('the whale swims with a travelling wave strongest at the flukes and blows a split spout from its blowhole',()=>{
  const s=stage('Whale');assert.equal(s.motion,'swim');assert.ok(s.spout);
  const spray=s.to.extra.map((d,i)=>d?i:-1).filter(i=>i>=0),bodyIds=s.to.extra.map((d,i)=>d?-1:i).filter(i=>i>=0);
  assert.equal(spray.length,Math.floor(demo.count/10));assert.ok(spray.every(i=>!s.to.fire[i]),'spout droplets are not fire');
  assert.ok(largest(offsets(demo,s,s.start))<1e-4&&largest(offsets(demo,s,s.end-1e-6))<1e-4,'continuous with the transfers');
  // Every droplet rests on its own jet and, mid-hold, flows exactly along it.
  for(const i of spray)assert.ok(spoutPoint(s.spout,s.to.extra[i]).every((v,k)=>Math.abs(v-s.to.positions[i][k])<1e-9));
  const t=s.start+6,f=sampleShow(demo,t);
  for(const i of spray.slice(0,40)){const d=s.to.extra[i],u=(d.u+(t-s.start)*.55)%1,p=spoutPoint(s.spout,d,u);assert.ok(p.every((v,k)=>Math.abs(v-f.positions[i*3+k])<1e-3));}
  const xs=bodyIds.map(i=>s.to.positions[i][0]),head=Math.max(...xs),tail=Math.min(...xs),L=head-tail;
  const swing=ids=>Math.max(...[2,3.5,5,6.5].map(dt=>Math.max(...ids.map(i=>Math.abs(sampleShow(demo,s.start+dt).positions[i*3+1]-s.to.positions[i][1]))))),near=f=>bodyIds.filter(i=>Math.abs(s.to.positions[i][0]-f)<L*.06);
  assert.ok(swing(near(tail))>swing(near(head))*2.5,'the flukes beat far more than the head');
  // Blows: the spout rises, sprays, fades and rests.
  assert.equal(blowGlow(.5,.2),0);assert.ok(blowGlow(2,.2)>.5);assert.equal(blowGlow(.8+4.3,.2),0);assert.ok(blowGlow(.8+.35,.2)>0&&blowGlow(.8+.35,.9)===0,'the jet front climbs');
  assert.deepEqual(WHALE_SPOUT.hole,[7.4,1.538,0],'matches the Blender whale_blowhole()');
  assert.equal(compileDemo(assets,{count:256,fire:{Whale:true}}).stages.find(x=>x.name==='Whale').to.fire.filter(Boolean).length,32);
});

test('the Show editor keeps every motion effect through a file round trip',()=>{
  const doc=decodeShow(encodeShow(editableDemo()));
  assert.deepEqual(doc.cues.filter(c=>c.effect!=='none').map(c=>[c.name,c.effect]),[['Fish','fish'],['Butterfly','flap'],['Hot air balloon','balloons'],['Whale','swim'],['Firework star','sparkle'],['Row of fire','fire'],['Birthday cake','candles'],['Starship launch','starship'],['Happy day','sparkle']]);
  const show=compileShow(doc);assert.equal(show.stages.find(s=>s.name==='Butterfly').motion,'flap');assert.equal(show.stages.find(s=>s.name==='Fish').motion,'fish');assert.equal(show.stages.find(s=>s.name==='Hot air balloon').kind,'rise');assert.equal(show.stages.find(s=>s.name==='Whale').motion,'swim');assert.equal(show.stages.find(s=>s.name==='Birthday cake').motion,'candles');
  assert.throws(()=>decodeShow(encodeShow({...doc,cues:[{...doc.cues[0],effect:'teleport'}]})),/Unknown formation effect/);
});

test('lasers light only takeoff and landing, blank at every cue, pulse with the takeoff beat and always point up',()=>{
  const sections=musicPlan(demo).sections;
  for(let t=0;t<demo.duration;t+=.25)for(let e=0;e<LASER_COUNT;e++){
    const b=laserBeam(sections,t,e,LASER_COUNT);assert.ok([b.tilt,b.lean,b.power,...b.color].every(Number.isFinite));
    assert.ok(Math.abs(b.tilt)<Math.PI/2&&b.power>=0&&b.power<=1,'beams never aim below the horizon');
  }
  for(const sec of sections){
    const power=t=>Math.max(...Array.from({length:LASER_COUNT},(_,e)=>laserBeam(sections,t,e,LASER_COUNT).power));
    assert.equal(power(sec.start),0,'blank at the cue change');
    const mid=power((sec.start+sec.end)/2);
    if(['lift','outro','homebound','finale'].includes(sec.mood))assert.ok(mid>.2,sec.name+' is lit');else assert.equal(mid,0,sec.name+' keeps the sky for the drones');
    if(sec.mood==='lift')assert.ok(power(sec.start+4)>power(sec.start+4.4),'takeoff beat pulse');
  }
  assert.deepEqual(laserBeam(sections,100,3,LASER_COUNT),laserBeam(sections,100,3,LASER_COUNT));
});

test('the fish swims side to side in travelling waves whose crests glow like foam',()=>{
  const s=stage('Fish');assert.equal(s.motion,'fish');assert.ok(s.waves);
  const waves=s.to.extra.map((d,i)=>d?i:-1).filter(i=>i>=0),bodyIds=s.to.extra.map((d,i)=>d?-1:i).filter(i=>i>=0);
  assert.equal(waves.length,Math.floor(demo.count/8));assert.ok(waves.every(i=>s.to.extra[i].kind==='wave'&&!s.to.fire[i]));
  assert.ok(largest(offsets(demo,s,s.start))<1e-4&&largest(offsets(demo,s,s.end-1e-6))<1e-4,'continuous with the transfers');
  for(const i of waves)assert.ok(wavePoint(s.waves,s.to.extra[i]).every((v,k)=>Math.abs(v-s.to.positions[i][k])<1e-9),'waves rest on their swells');
  const t=s.start+5,f=sampleShow(demo,t);
  for(const i of waves.slice(0,40)){const p=wavePoint(s.waves,s.to.extra[i],t-s.start);assert.ok(p.every((v,k)=>Math.abs(v-f.positions[i*3+k])<1e-3),'waves travel');}
  const glow=waves.map(i=>waveGlow(s.waves,s.to.extra[i],3));assert.ok(Math.max(...glow)>.95&&Math.min(...glow)<.35,'foam on the crests, deep blue in the troughs');
  const xs=bodyIds.map(i=>s.to.positions[i][0]),head=Math.max(...xs),tail=Math.min(...xs),L=head-tail,near=x=>bodyIds.filter(i=>Math.abs(s.to.positions[i][0]-x)<L*.06);
  const sway=ids=>Math.max(...[2,2.6,3.2,3.8].map(dt=>{const g=sampleShow(demo,s.start+dt).positions;return Math.max(...ids.map(i=>Math.abs(g[i*3+2]-s.to.positions[i][2])));}));
  assert.ok(sway(near(tail+L*.08))>sway(near(head-L*.08))*3,'the tail swings far more than the head');
});

test('three balloons drift up during their display, swaying on their own, with flickering burner flames',()=>{
  const s=stage('Hot air balloon'),next=demo.stages[demo.stages.indexOf(s)+1];
  assert.equal(s.kind,'rise');assert.equal(s.motion,'balloons');assert.equal(next.from,s.to,'the next transfer starts from the raised balloons');
  const lift=s.to.positions.map((p,i)=>p[1]-s.from.positions[i][1]);assert.ok(lift.every(v=>Math.abs(v-lift[0])<1e-9)&&lift[0]>0,'every light rises by the same small amount');
  assert.ok(largest(offsets(demo,s,s.end-1e-6))<1e-4,'lands exactly on the raised formation');
  const xs=s.to.positions.map(p=>p[0]),cx=(Math.max(...xs)+Math.min(...xs))/2,L=Math.max(...xs)-Math.min(...xs);
  assert.ok(xs.filter(x=>x<cx-.3*L).length>100&&xs.filter(x=>x>cx+.3*L).length>100,'two smaller balloons beside the big one');
  const flames=s.to.colors.map((c,i)=>c[0]>.3&&c[1]/c[0]>.75&&c[2]/c[0]<.25?i:-1).filter(i=>i>=0);assert.ok(flames.length>5,'burner flames are lit');
  const brightness=t=>{const f=sampleShow(demo,t).colors;return flames.map(i=>f[i*3]);},a=brightness(s.start+5),b=brightness(s.start+5.13);
  assert.ok(a.some((v,k)=>Math.abs(v-b[k])>.08*Math.max(v,b[k])),'the flames flicker');
});

test('the growing heart holds a family: man, boy, woman and waving girl, all inside the heart',()=>{
  // Heart-local coordinates (demo scale 6, heart centre 24 units up); the innermost contour is the r=.76 ring.
  const s=stage('Growing heart'),n=demo.count,family=Math.floor(n*.28),local=s.to.positions.map(p=>[p[0]/6,p[1]/6-24]);
  const ring=Array.from({length:720},(_,i)=>{const a=i*Math.PI/360;return [16*Math.sin(a)**3*.76*.7,(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*.76*.7];});
  const inside=([x,y])=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  const clear=p=>inside(p)&&Math.min(...ring.map(([x,y])=>Math.hypot(x-p[0],y-p[1])))>.25,people=local.map((p,i)=>clear(p)?i:-1).filter(i=>i>=0);
  assert.equal(people.length,family,'every family light sits clearly inside the heart, and nothing else does');
  const colours=new Set(people.map(i=>s.to.colors[i].map(v=>v.toFixed(2)).join()));assert.ok(colours.size>=4,'four people, four colours');
  const ys=people.map(i=>local[i][1]),xs=people.map(i=>local[i][0]);assert.ok(Math.max(...xs)-Math.min(...xs)>7&&Math.max(...ys)-Math.min(...ys)>5,'a row of standing figures');
});

test('recorded WebM videos get their length, so players can show it and seek',async()=>{
  const ebml=[0x1A,0x45,0xDF,0xA3,0x84,0x42,0x86,0x81,0x01];// EBML header with one child
  const info=[0x15,0x49,0xA9,0x66,0x87,0x2A,0xD7,0xB1,0x83,0x0F,0x42,0x40];// Info: TimecodeScale 1,000,000
  const cluster=[0x1F,0x43,0xB6,0x75,0x01,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xE7,0x81,0x00];
  const file=new Blob([new Uint8Array([...ebml,0x18,0x53,0x80,0x67,0x01,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,...info,...cluster])],{type:'video/webm'});
  const fixed=new Uint8Array(await (await withWebmDuration(file,365800)).arrayBuffer()),at=fixed.findIndex((v,i)=>v===0x44&&fixed[i+1]===0x89);
  assert.ok(at>0,'duration written');assert.equal(new DataView(fixed.buffer).getFloat64(at+3),365800);assert.equal(fixed.length,file.size+11);
  assert.equal(fixed[25],0x87+11,'Info grew by the new element');assert.deepEqual([...fixed.slice(-15)],cluster,'video data untouched');
  const again=await withWebmDuration(new Blob([fixed],{type:'video/webm'}),1);assert.equal(again.size,fixed.length,'an existing duration is kept');
  assert.equal(await withWebmDuration(new Blob([new Uint8Array([1,2,3])]),5).then(b=>b.size),3,'non-WebM data is left alone');
});
