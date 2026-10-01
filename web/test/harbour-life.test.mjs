import test from 'node:test';
import assert from 'node:assert/strict';
import {lifePlan,boatPose,excitement,HarbourLife,HARBOUR} from '../src/harbour-life.js';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-library.js';
import {pyroSchedule} from '../src/pyro.js';

const plan=lifePlan(1),near=(x,z,[sx,sz],r)=>Math.hypot(x-sx,z-sz)<r;
const onDeck=(x,z,m=0)=>Math.abs(x)<HARBOUR.deck.x+m&&Math.abs(z)<HARBOUR.deck.z+m;

test('the harbour plan is seeded and its counts follow the device budget',()=>{
  assert.deepEqual(lifePlan(1),plan,'the same harbour every visit');
  const low=lifePlan(.5);
  for(const key of ['traffic','lanterns','sky','boats','gulls','flashes'])assert.ok(low[key].length<plan[key].length&&low[key].length>0,key+' scales with the budget');
});

test('floating lanterns drift on rings that never cross the launch deck, its buoys or the anchored ships',()=>{
  const {cx,cz,rx,rz}=plan.ring;
  for(const l of plan.lanterns)for(let a=0;a<Math.PI*2;a+=.05){const x=cx+Math.cos(a)*rx*l.radius,z=cz+Math.sin(a)*rz*l.radius;
    assert.ok(!(Math.abs(x)<151&&Math.abs(z)<151),'clear of the buoys');assert.ok(!HARBOUR.ships.some(s=>near(x,z,s,40)),'clear of the ships');}
});

test('spectator boats loop without sailing through the deck, the buoys, the anchored ships or the shore',()=>{
  assert.ok(plan.boats.length>=8);
  for(const b of plan.boats){const loop=Math.PI*2/b.w;
    for(let t=0;t<loop;t+=loop/400){const p=boatPose(b,t);
      assert.ok(!(Math.abs(p.x)<170&&Math.abs(p.z)<170),'clear of the deck and buoys');assert.ok(!HARBOUR.ships.some(s=>near(p.x,p.z,s,50)),'clear of the ships');
      assert.ok(p.z>-1000&&p.z<330,'between the shore and the audience');}}
  // heading follows the path
  const b=plan.boats[0],a=boatPose(b,10),c=boatPose(b,10.5);assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(c.x-a.x,c.z-a.z)-a.heading),Math.cos(Math.atan2(c.x-a.x,c.z-a.z)-a.heading)))<.1,'bows point where they go');
});

test('traffic keeps to the bridge deck and the shore road; sky lanterns start on the far shore; glints stay off the deck',()=>{
  for(const c of plan.traffic){assert.ok(c.speed>=8&&c.speed<=16);if(c.route===0)assert.ok(Math.abs(c.lane)<=6);else assert.ok(HARBOUR.road.lanes.includes(c.lane));}
  assert.ok(plan.traffic.some(c=>c.dir>0)&&plan.traffic.some(c=>c.dir<0),'both directions');
  for(const l of plan.sky)assert.ok(l.z<=-1012&&l.z>=-1060);
  for(const g of plan.glints)if(g.kind===0)assert.ok(!onDeck(g.x,g.z));
});

test('the crowd photographs the fireworks: flashes follow how busy the sky is',()=>{
  const demo=compileDemo(assets,{count:256}),shells=pyroSchedule(demo,[[-267,4.7,-270],[288,4.7,-249],[-206,5.4,-409]]),bursts=shells.map(s=>s.t0+s.delay).sort((a,b)=>a-b);
  const finale=demo.stages.find(s=>s.kind==='landing')?.start??demo.duration-30,quiet=demo.stages.find(s=>s.name==='Robot');
  const busiest=Math.max(...Array.from({length:60},(_,i)=>excitement(bursts,finale-30+i)));
  assert.ok(busiest>=.66,'a salvo excites the crowd: '+busiest);assert.ok(excitement(bursts,quiet.start+8)<busiest);assert.equal(excitement([],10),0);
});

test('one draw per family; afternoon brings the gulls; reduced motion freezes everything and drops flashes and meteors',()=>{
  const life=new HarbourLife({scale:1,budget:1});assert.equal(life.drawCalls,8,'night: 8 draws');
  life.setSky(0);assert.equal(life.drawCalls,9,'afternoon adds the gulls');
  life.update(12.5,.4);assert.equal(life.byName.traffic.material.uniforms.uTime.value,12.5);
  const quiet=new HarbourLife({scale:1,budget:.5,quiet:true});quiet.update(99);quiet.setSky(1);
  assert.equal(quiet.byName.traffic.material.uniforms.uTime.value,quiet.frozen,'motion holds still');
  assert.equal(quiet.byName.flashes.visible,false);assert.equal(quiet.byName.skyEvents.material.uniforms.uMeteors.value,0);
  let triangles=0;for(const mesh of [life.boats,life.gulls])triangles+=mesh.geometry.getAttribute('position').count/3*mesh.count;assert.ok(triangles<700,'hulls and gulls stay tiny: '+triangles);
});
