import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-settings.js';
import {buildShow,sampleShow,matchFormation} from '../src/drone-show.js';
import {byPad,landingPads} from './pads.mjs';

// Exhaustive pair check for a synchronized straight transfer: returns the smallest start/end gap and the closest approach.
function separation(from,to){
  const n=from.length,a=Float64Array.from(from.flat()),b=Float64Array.from(to.flat());let ends=Infinity,transit=Infinity;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const x0=a[i*3]-a[j*3],y0=a[i*3+1]-a[j*3+1],z0=a[i*3+2]-a[j*3+2],x1=b[i*3]-b[j*3],y1=b[i*3+1]-b[j*3+1],z1=b[i*3+2]-b[j*3+2];
    const s0=x0*x0+y0*y0+z0*z0,s1=x1*x1+y1*y1+z1*z1,dot=x0*x1+y0*y1+z0*z1,u=Math.min(1,Math.max(0,(s0-dot)/(s0+s1-2*dot||1)));
    ends=Math.min(ends,s0,s1);transit=Math.min(transit,(x0+(x1-x0)*u)**2+(y0+(y1-y0)*u)**2+(z0+(z1-z0)*u)**2);
  }
  return {ends:Math.sqrt(ends),transit:Math.sqrt(transit)};
}
const assertSeparated=(stage,label)=>{const {ends,transit}=separation(stage.from.positions,stage.to.positions);assert.ok(transit>=ends/Math.SQRT2-1e-9,`${label} ${stage.name}: pair passes ${transit.toFixed(4)} apart; bound ${(ends/Math.SQRT2).toFixed(4)}`);};

test('every uncrossed transfer keeps each pair ≥ min(start gap, end gap)/√2 apart (1,024-drone Blender demo, all pairs)',()=>{
  const show=compileDemo(assets,{count:1024});
  for(const s of show.stages.filter(s=>s.kind==='move'))assertSeparated(s,'1024');
});
test('4,096-drone transfers that used to collide are separated: Blender robot, return home, drawn formations',()=>{
  const demo=compileDemo(assets,{count:4096}),drawn=buildShow();
  for(const name of ['Forming Robot','Returning home'])assertSeparated(demo.stages.find(s=>s.name===name),'demo');
  for(const name of ['Forming Fish','Returning home'])assertSeparated(drawn.stages.find(s=>s.name===name),'drawn');
});
test('uncrossing is deterministic, bijective and carries colour, order, fire and pad attributes',()=>{
  const n=1024,previous=Array.from({length:n},(_,i)=>[(i%32)-16,6,Math.floor(i/32)-16]);
  const target={positions:Array.from({length:n},(_,i)=>[16-(i%32),20+Math.floor(i/32),(i*7)%5]),colors:Array.from({length:n},(_,i)=>[i/n,0,0]),fire:Array.from({length:n},(_,i)=>i%3===0),pad:Array.from({length:n},(_,i)=>i)};
  const a=matchFormation(previous,target),b=matchFormation(previous,target);assert.deepEqual(a,b);
  assert.equal(new Set(a.pad).size,n);
  for(let i=0;i<n;i++){const j=a.pad[i];assert.equal(a.positions[i],target.positions[j]);assert.equal(a.colors[i],target.colors[j]);assert.equal(a.fire[i],target.fire[j]);assert.equal(a.order[i],j/(n-1));}
  assertSeparated({name:'synthetic',from:{positions:previous},to:{positions:a.positions}},'mirror');
});
test('drones return to the nearest free pads, and each pad replays its own takeoff in reverse (Hungarian and partition fleets)',()=>{
  for(const count of [256,2048]){
    const show=compileDemo(assets,{count}),up=show.stages.find(s=>s.kind==='takeoff'),back=show.stages.find(s=>s.name==='Returning home'),down=show.stages.find(s=>s.kind==='landing'),pad=landingPads(show);
    assert.equal(new Set(pad).size,count);assert.deepEqual(back.to.pad,pad);assert.deepEqual(down.to.positions,pad.map(k=>show.home[k]));
    const own=back.from.positions.reduce((n,p,i)=>n+Math.hypot(...p.map((v,k)=>v-up.to.positions[i][k])),0),nearest=back.from.positions.reduce((n,p,i)=>n+Math.hypot(...p.map((v,k)=>v-back.to.positions[i][k])),0);
    assert.ok(nearest<own,`${count}: nearest free pads ${nearest.toFixed(0)} < own pads ${own.toFixed(0)}`);
    for(const f of [0,.2,.5,.8,1]){
      const a=sampleShow(show,up.end-(up.end-up.start)*f),b=sampleShow(show,down.start+(down.end-down.start)*f);
      assert.deepEqual(byPad(show,b.positions),a.positions,`${count}: pad poses at ${f}`);
      assert.ok(byPad(show,b.colors).every((v,i)=>Math.abs(v-a.colors[i])<1e-6),`${count}: pad LEDs at ${f}`);
    }
    assert.deepEqual(byPad(show,sampleShow(show,show.duration).positions),sampleShow(show,0).positions);
  }
});
test('falling sparks accelerate, then brake to rest so the next transfer starts without a speed jump',()=>{
  const show=compileDemo(assets,{count:512}),h=1e-3;
  const speed=t=>{const a=sampleShow(show,t-h),b=sampleShow(show,t+h);let v=0;for(let i=1;i<a.positions.length;i+=3)v=Math.max(v,Math.abs(b.positions[i]-a.positions[i])/(2*h));return v;};
  for(const s of show.stages.filter(s=>s.kind==='fall')){
    const at=u=>s.start+(s.end-s.start)*u,early=speed(at(.1)),mid=speed(at(.5)),peak=speed(at(.8)),late=speed(at(.97));
    assert.ok(early<mid&&mid<peak,`${s.name}: accelerates ${early.toFixed(2)} → ${mid.toFixed(2)} → ${peak.toFixed(2)}`);
    assert.ok(late<peak*.25,`${s.name}: brakes to ${late.toFixed(2)}`);
    const before=sampleShow(show,s.end-h),end=sampleShow(show,s.end),after=sampleShow(show,s.end+h);
    for(let i=1;i<end.positions.length;i+=3){const vin=(end.positions[i]-before.positions[i])/h,vout=(after.positions[i]-end.positions[i])/h;assert.ok(Math.abs(vin)<peak*.02&&Math.abs(vout)<peak*.02,`${s.name}: speed ${vin.toFixed(3)} → ${vout.toFixed(3)} at the boundary`);}
  }
});
