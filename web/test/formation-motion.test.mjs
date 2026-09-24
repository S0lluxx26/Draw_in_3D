import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-settings.js';
import {sampleShow,spoutPoint,blowGlow,WHALE_SPOUT} from '../src/drone-show.js';
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
  const spray=s.to.spray.map((d,i)=>d?i:-1).filter(i=>i>=0),bodyIds=s.to.spray.map((d,i)=>d?-1:i).filter(i=>i>=0);
  assert.equal(spray.length,Math.floor(demo.count/10));assert.ok(spray.every(i=>!s.to.fire[i]),'spout droplets are not fire');
  assert.ok(largest(offsets(demo,s,s.start))<1e-4&&largest(offsets(demo,s,s.end-1e-6))<1e-4,'continuous with the transfers');
  // Every droplet rests on its own jet and, mid-hold, flows exactly along it.
  for(const i of spray)assert.ok(spoutPoint(s.spout,s.to.spray[i]).every((v,k)=>Math.abs(v-s.to.positions[i][k])<1e-9));
  const t=s.start+6,f=sampleShow(demo,t);
  for(const i of spray.slice(0,40)){const d=s.to.spray[i],u=(d.u+(t-s.start)*.55)%1,p=spoutPoint(s.spout,d,u);assert.ok(p.every((v,k)=>Math.abs(v-f.positions[i*3+k])<1e-3));}
  const xs=bodyIds.map(i=>s.to.positions[i][0]),head=Math.max(...xs),tail=Math.min(...xs),L=head-tail;
  const swing=ids=>Math.max(...[2,3.5,5,6.5].map(dt=>Math.max(...ids.map(i=>Math.abs(sampleShow(demo,s.start+dt).positions[i*3+1]-s.to.positions[i][1]))))),near=f=>bodyIds.filter(i=>Math.abs(s.to.positions[i][0]-f)<L*.06);
  assert.ok(swing(near(tail))>swing(near(head))*2.5,'the flukes beat far more than the head');
  // Blows: the spout rises, sprays, fades and rests.
  assert.equal(blowGlow(.5,.2),0);assert.ok(blowGlow(2,.2)>.5);assert.equal(blowGlow(.8+4.3,.2),0);assert.ok(blowGlow(.8+.35,.2)>0&&blowGlow(.8+.35,.9)===0,'the jet front climbs');
  assert.deepEqual(WHALE_SPOUT.hole,[7.4,1.538,0],'matches the Blender whale_blowhole()');
  assert.equal(compileDemo(assets,{count:256,fire:{Whale:true}}).stages.find(x=>x.name==='Whale').to.fire.filter(Boolean).length,32);
});

test('the Show editor keeps wing-flap and swim effects through a file round trip',()=>{
  const doc=decodeShow(encodeShow(editableDemo()));
  assert.deepEqual(doc.cues.filter(c=>c.effect==='flap'||c.effect==='swim').map(c=>[c.name,c.effect]),[['Butterfly','flap'],['Whale','swim']]);
  const show=compileShow(doc);assert.equal(show.stages.find(s=>s.name==='Butterfly').motion,'flap');assert.equal(show.stages.find(s=>s.name==='Whale').motion,'swim');
  assert.throws(()=>decodeShow(encodeShow({...doc,cues:[{...doc.cues[0],effect:'teleport'}]})),/Unknown formation effect/);
});

test('lasers follow the music: dark for close-ups and landing, blanked at every cue, pulsing on drop beats, always pointing up',()=>{
  const sections=musicPlan(demo).sections;
  for(let t=0;t<demo.duration;t+=.25)for(let e=0;e<LASER_COUNT;e++){
    const b=laserBeam(sections,t,e,LASER_COUNT);assert.ok([b.tilt,b.lean,b.power,...b.color].every(Number.isFinite));
    assert.ok(Math.abs(b.tilt)<Math.PI/2&&b.power>=0&&b.power<=1,'beams never aim below the horizon');
  }
  for(const sec of sections){
    const power=t=>Math.max(...Array.from({length:LASER_COUNT},(_,e)=>laserBeam(sections,t,e,LASER_COUNT).power));
    assert.equal(power(sec.start),0,'blank at the cue change');
    if(['intro','outro','end'].includes(sec.mood))assert.equal(power((sec.start+sec.end)/2),0,sec.mood+' is dark');
    if(sec.mood==='drop')assert.ok(power(sec.start+2)>power(sec.start+2.4),'beat pulse');
  }
  assert.deepEqual(laserBeam(sections,100,3,LASER_COUNT),laserBeam(sections,100,3,LASER_COUNT));
});
