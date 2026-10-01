import test from 'node:test';
import assert from 'node:assert/strict';
import {accentFor,accentWindows,SceneAccents,ACCENTS} from '../src/scene-accents.js';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-library.js';

const demo=compileDemo(assets,{count:256}),windows=accentWindows(demo),by=name=>windows.find(w=>w.name===name);

test('every Demo scene gets the small detail that belongs to it',()=>{
  const expected={'Robot':'radio','Fish':'bubbles','Butterfly':'fireflies','Hot air balloon':'lanterns','Eiffel Tower':'beacons','Big ship':'spray','Whale':'ripples',
    'Firework star':'glitter','Row of fire':'embers','Birthday cake':'confetti','Starship launch':'launch','Happy day':'confetti','Growing heart':'hearts','Five-point star':'shower'};
  for(const [name,kind] of Object.entries(expected))assert.equal(by(name)?.kind,kind,name);
  assert.ok(!windows.some(w=>/history|mystery|gift|called|present|Landing|Landed|Takeoff|Three firework balls/.test(w.name)),'the sentence, the finale balls, takeoff and landing keep the sky to themselves');
  assert.ok(Object.keys(ACCENTS).every(k=>windows.some(w=>w.kind===k)),'every kind is used by the Demo');
});

test('an accent fades in during the flight, lasts through its scene and leaves straight after; never more than two at once',()=>{
  for(const w of windows){assert.ok(w.start<=w.stageStart&&w.end>w.stageEnd&&w.end<=w.stageEnd+1.5);assert.ok(w.start>=0&&w.end<=demo.duration+2);}
  const heart=by('Growing heart');assert.ok(heart.stageEnd>=demo.stages.find(s=>s.name==='Growing heart · falling sparks').end-.01,'the heart keeps its hearts through the beat and the falling sparks');
  const accents=new SceneAccents(demo);let most=0;
  for(let t=0;t<demo.duration;t+=.25)most=Math.max(most,accents.update(t,t).length);
  assert.ok(most<=2,'at most two accents draw at a time: '+most);
  assert.deepEqual(accents.update(by('Fish').stageStart+5,40),['bubbles']);
  assert.equal(accents.update(by('Fish').stageStart+5,40).length,Object.values(accents.kinds).filter(p=>p.visible).length,'hidden kinds cost no draw');
});

test('the accent sits on its formation, and a rising formation carries it upward',()=>{
  const fish=by('Fish'),stage=demo.stages.find(s=>s.name==='Fish'),ys=stage.to.positions.map(p=>p[1]);
  assert.ok(fish.to.center[1]>Math.min(...ys)&&fish.to.center[1]<Math.max(...ys));
  const accents=new SceneAccents(demo),ship=by('Starship launch'),u=accents.kinds.launch.material.uniforms;
  accents.update(ship.stageStart+.5,0);const low=u.uCenter.value.y;accents.update(ship.stageEnd-.5,0);assert.ok(u.uCenter.value.y>low+5,'the launch sparks follow the rising starship');
});

test('your own formations get accents from their motion or effect; reduced motion shows none',()=>{
  assert.equal(accentFor({kind:'hold',name:'My koi',motion:'fish'}),'bubbles');
  assert.equal(accentFor({kind:'hold',name:'Campfire',effect:'fire'}),'embers');
  assert.equal(accentFor({kind:'hold',name:'Stars',effect:'sparkle'}),'glitter');
  assert.equal(accentFor({kind:'hold',name:'Still life',effect:'none'}),null);
  assert.equal(accentFor({kind:'move',name:'Fish',motion:'fish'}),null,'flights carry no accent of their own');
  const quiet=new SceneAccents(demo,{quiet:true});assert.equal(quiet.windows.length,0);assert.equal(quiet.group.children.length,0);
});
