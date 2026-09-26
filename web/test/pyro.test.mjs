import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-settings.js';
import {pyroSchedule,pyroParticles,evaluateParticle,PARTICLE_FLOATS} from '../src/pyro.js';

const demo=compileDemo(assets,{count:512}),ships=[[-267,4.7,-270],[288,4.7,-249],[-206,5.4,-409]];

test('ship fireworks are deterministic, launch from the ships and burst during HAPPY DAY, drone fireworks and the finale',()=>{
  const shells=pyroSchedule(demo,ships);
  assert.deepEqual(pyroSchedule(demo,ships),shells,'same show, same shells');
  assert.ok(shells.length>=20);
  for(const s of shells)assert.ok(ships.some(p=>p.every((v,k)=>v===s.origin[k])),'launched from a ship');
  const happy=demo.stages.find(s=>s.pyro),bursts=shells.map(s=>s.t0+s.delay);
  assert.ok(bursts.filter(t=>t>happy.start&&t<happy.end+3).length>=10,'celebration salvo over HAPPY DAY');
  for(const grow of demo.stages.filter(s=>s.kind==='grow'))assert.ok(bursts.some(t=>t>grow.start&&t<grow.end+3),grow.name+' gets ship fireworks');
  assert.ok(shells.every(s=>s.t0+s.delay+4.5<=demo.duration),'every shell finishes before the show ends');
  assert.deepEqual(pyroSchedule({...demo,pyro:false},ships),[],'Demo settings can turn them off');
});
test('particles follow finite ballistic paths: comets rise to the burst, stars spread and fall away',()=>{
  const shells=pyroSchedule(demo,ships),data=pyroParticles(shells),n=data.length/PARTICLE_FLOATS;
  assert.equal(n%1,0);assert.ok(n>5000&&n<80000,'bounded particle budget: '+n);// fireworks all through the show
  const shell=shells[0],burstTime=shell.t0+shell.delay;
  // Find this shell's comet head and one star.
  let comet=-1,star=-1;for(let i=0;i<n;i++){if(data[i*PARTICLE_FLOATS]!==Math.fround(shell.t0))continue;/* the buffer is float32 */const type=data[i*PARTICLE_FLOATS+11],lag=data[i*PARTICLE_FLOATS+12];if(type===0&&lag===0&&comet<0)comet=i;if(type===1&&lag===0&&star<0)star=i;}
  const rising=evaluateParticle(data,comet,shell.t0+shell.delay*.5),apex=evaluateParticle(data,comet,burstTime-1e-3);
  assert.ok(rising.position[1]>shell.origin[1]&&apex.position[1]>rising.position[1],'comet climbs');
  assert.equal(evaluateParticle(data,comet,burstTime+.01),null,'comet ends at the burst');
  const early=evaluateParticle(data,star,burstTime+.2),late=evaluateParticle(data,star,burstTime+1.2);
  const d=p=>Math.hypot(...p.position.map((v,k)=>v-apex.position[k]));
  assert.ok(d(late)>d(early),'stars spread from the burst');assert.ok(late.brightness<early.brightness,'and fade');
  for(let t=0;t<demo.duration;t+=1.5)for(let i=0;i<n;i+=37){const e=evaluateParticle(data,i,t);if(e){assert.ok(e.position.every(Number.isFinite));assert.ok(e.brightness>=0);}}
});
