import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-library.js';
import {sampleShow} from '../src/drone-show.js';
import {pyroSchedule} from '../src/pyro.js';

const demo=compileDemo(assets,{count:1024}),stage=name=>demo.stages.find(s=>s.name===name);
const ships=[[-267,4.7,-270],[288,4.7,-249],[-206,5.4,-409]],shells=pyroSchedule(demo,ships),burstsIn=(a,b)=>shells.filter(s=>s.t0+s.delay>=a&&s.t0+s.delay<b);
const clusters=(xs,gap)=>{const v=[...xs].sort((a,b)=>a-b);let n=1;for(let i=1;i<v.length;i++)if(v[i]-v[i-1]>gap)n++;return n;};

test('five hot air balloons, each swaying on its own; the big ship sails with two smaller ships and a firework salute',()=>{
  const balloons=assets['Hot air balloon'].body.positions;assert.equal(clusters(balloons.map(p=>p[0]),1.2),5,'five separate balloons');
  const b=stage('Hot air balloon'),t=b.start+4,f=sampleShow(demo,t),sway=[-1,-.4,0,.4,1].map(u=>{const xs=b.to.positions.map(p=>p[0]),cx=(Math.min(...xs)+Math.max(...xs))/2,L=Math.max(...xs)-Math.min(...xs);
    const ids=b.to.positions.map((p,i)=>Math.abs(p[0]-cx-u*L*.44)<L*.04&&!b.to.extra?.[i]?i:-1).filter(i=>i>=0);return ids.reduce((n,i)=>n+f.positions[i*3+1]-b.from.positions[i][1]-(b.to.positions[i][1]-b.from.positions[i][1])*0,0)/ids.length;});
  assert.equal(new Set(sway.map(v=>v.toFixed(2))).size,5,'each balloon moves on its own');
  const ship=assets['Big ship'].body.positions,xs=ship.map(p=>p[0]);assert.ok(Math.max(...xs)-Math.min(...xs)>45,'the liner and its two escorts');assert.ok(xs.filter(x=>x<-15).length>200&&xs.filter(x=>x>15).length>200,'a smaller ship on each side');
  const big=stage('Big ship');assert.ok(big.salute);assert.ok(burstsIn(big.start,big.end+2).length>=8,'the ships salute with fireworks');
});

test('the Eiffel Tower grows from its foot, bottom first, sparkling as it rises, then turns; fireworks as it grows',()=>{
  const s=stage('Eiffel Tower'),g=s.grows,P=s.to.positions,ys=P.map(p=>p[1]),y0=Math.min(...ys),H=Math.max(...ys)-y0;
  assert.ok(s.from.positions.every(p=>p[1]-y0<H*.12),'it starts as a small patch at its foot');
  const low=g.heights.findIndex(h=>h<.1),high=g.heights.findIndex(h=>h>.9),at=t=>sampleShow(demo,s.start+t),done=(f,i)=>Math.abs(f.positions[i*3+1]-P[i][1])<H*.02;
  const mid=at(g.time*.45);assert.ok(done(mid,low)&&!done(mid,high),'the bottom is built before the top');
  const grown=at(g.time+.01);assert.ok(P.every((p,i)=>Math.abs(grown.positions[i*3+1]-p[1])<H*.01),'complete after the growth');
  const turning=at(g.time+(s.end-s.start-g.time)/4);assert.ok(P.filter((p,i)=>Math.hypot(turning.positions[i*3]-p[0],turning.positions[i*3+2]-p[2])>H*.05).length>P.length*.4,'then it turns');
  const end=sampleShow(demo,s.end-1e-6);assert.ok(P.every((p,i)=>Math.abs(end.positions[i*3]-p[0])<.05),'and comes back to rest for the next flight');
  const sparkle=at(g.time*.5),front=g.heights.map((h,i)=>i).filter(i=>{const u=(g.time*.5-g.heights[i]*g.time*.6)/(g.time*.4);return u>.6&&u<.75;});
  const sum=(c,i)=>c[i*3]+c[i*3+1]+c[i*3+2],target=i=>s.to.colors[i][0]+s.to.colors[i][1]+s.to.colors[i][2];
  assert.ok(front.length&&front.reduce((n,i)=>n+sum(sparkle.colors,i),0)>front.reduce((n,i)=>n+target(i),0),'the growing edge sparkles brighter than the finished tower');
  assert.ok(burstsIn(s.start-1,s.start+g.time+3).length>=9,'palms and crowns as it grows, a wall when it stands');
});

test('the row of fire waves while a winged princess flies around it, spraying sparkles from her wand',()=>{
  const s=stage('Row of fire'),kind=k=>s.to.extra.map((d,i)=>d?.kind===k?i:-1).filter(i=>i>=0),princess=kind('fairy'),trail=kind('trail'),wings=princess.filter(i=>s.to.extra[i].wing);
  assert.equal(s.motion,'fairy');assert.ok(princess.length>demo.count*.25&&wings.length>demo.count*.08&&trail.length>demo.count*.08,'princess, wings and a sparkle trail');
  const at=t=>sampleShow(demo,s.start+t),mean=(f,ids,k)=>ids.reduce((n,i)=>n+f.positions[i*3+k],0)/ids.length,rest=ids=>ids.reduce((n,i)=>n+s.to.positions[i][0],0)/ids.length;
  const a=at(2),b=at(8);assert.ok(Math.abs(mean(a,princess,0)-mean(b,princess,0))>demo.stages[0].to.positions.length*0+20,'she flies around');
  const body=princess.filter(i=>!s.to.extra[i].wing),spread=(f,ids)=>Math.max(...ids.map(i=>f.positions[i*3+2]))-Math.min(...ids.map(i=>f.positions[i*3+2]));
  assert.ok(Math.abs(spread(at(3.1),wings)-spread(at(3.35),wings))>1,'her wings flap');
  const src=at(4);assert.ok(Math.max(...trail.map(i=>Math.hypot(src.positions[i*3]-mean(src,body,0),src.positions[i*3+1]-mean(src,body,1))))>30,'her sparkles spray out behind her');
  const row=s.to.positions.map((p,i)=>!s.to.extra[i]&&!s.to.fire[i]?i:-1).filter(i=>i>=0),top=Math.max(...row.map(i=>s.to.positions[i][1])),flames=row.filter(i=>s.to.positions[i][1]>top-25),lift=i=>src.positions[i*3+1]-s.to.positions[i][1];
  assert.ok(Math.max(...flames.map(lift))-Math.min(...flames.map(lift))>8,'the flames rise and fall along the row');
  const end=sampleShow(demo,s.end-1e-6);assert.ok(princess.every(i=>Math.hypot(...[0,1,2].map(k=>end.positions[i*3+k]-s.to.positions[i][k]))<.1),'she comes back to rest before the next flight');
  assert.ok(burstsIn(s.start,s.end+2).length>=7,'fireworks for the princess');
});

test('fireworks all through the show: every formation gets ship fireworks',()=>{
  assert.ok(shells.length>=130,'a lot of fireworks: '+shells.length);
  for(const s of demo.stages.filter(s=>(s.kind==='hold'&&s.reveal)||s.kind==='rise'||s.climax))assert.ok(burstsIn(s.start-1.5,s.end+2).length>=2,s.name+' gets fireworks');
});
