import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-library.js';
import {demoShowDoc,drawingCue,newCue,editableDemo,compileShow,cueSequence,cueProblem,cueTimes,DEMO_TIMING} from '../src/show-project.js';
import {sampleShow,CINEMATIC_LANDING,stageUnit} from '../src/drone-show.js';
import {pyroSchedule,pyroParticles,PARTICLE_FLOATS,SHAPES,PATTERNS} from '../src/pyro.js';
import {framingAt} from '../src/show-camera.js';

const mine=(extra={})=>({...newCue(editableDemo().cues[0].artwork,'My robot',DEMO_TIMING),...extra});
const points=ps=>ps.map(p=>p.map(v=>v.toFixed(3)).join(',')).sort();

test('what the editor shows is what Run plays: card times, the previewed formation, and problems before Run',()=>{
  const doc=demoShowDoc({count:1024}),edited={...doc,cues:[doc.cues[0],drawingCue('Whale',doc.cues[6]),mine({effect:'fish'}),doc.cues[3]]};
  const show=compileShow(edited,assets);
  for(const [i,t] of cueTimes(edited).entries()){
    const c=edited.cues[i],form=show.stages.find(s=>s.name==='Forming '+c.name),display=show.stages[show.stages.indexOf(form)+1];
    assert.equal(form.start,t.start,c.name+' forms when its card says');assert.equal(display.end,t.end);
    // The editor previews the selected formation with the same function Run compiles it with: same lights, water and fire.
    const preview=cueSequence(edited,c,assets).formation;
    assert.deepEqual(points(form.to.positions),points(preview.positions),c.name);
    assert.equal(form.to.extra?.filter(Boolean).length??0,preview.extra?.filter(Boolean).length??0);
  }
  assert.match(cueProblem(newCue()),/Nothing drawn yet/);
  const huge=mine({placement:{...mine().placement,scale:60}});assert.match(cueProblem(huge),/outside the sky stage/);assert.ok(!cueProblem(huge).includes('My robot:'));
  assert.equal(cueProblem(mine()),null);assert.equal(cueProblem(doc.cues[0]),null);
});

test('Bottom to top reveals from the bottom up in Demo-style shows too, starting from dark',()=>{
  const doc=demoShowDoc({count:1024}),show=compileShow({...doc,cues:[doc.cues[0],mine({light:'bottom-up'})]},assets),s=show.stages.find(x=>x.name==='My robot');
  const revealed=t=>{const f=sampleShow(show,s.start+t),up=[],down=[];
    for(let i=0;i<show.count;i++){const k=s.to.colors[i].indexOf(Math.max(...s.to.colors[i]));if(s.to.colors[i][k]<.2)continue;
      (f.colors[i*3+k]>=s.to.colors[i][k]*.97?up:down).push(s.to.positions[i][1]);}
    return {share:up.length/(up.length+down.length),up,down};};
  const early=revealed(.05),mid=revealed(.9),late=revealed(3);
  assert.ok(early.share<.05&&late.share>.95,'from nothing to everything');assert.ok(mid.share>.1&&mid.share<.9,'a sweep, not a single flash: '+mid.share);
  const mean=a=>a.reduce((n,v)=>n+v,0)/a.length;assert.ok(mean(mid.up)<mean(mid.down),'the lower lights come first');
  const start=sampleShow(show,s.start+1e-4);assert.ok(start.colors.every(v=>v<.02),'the shape lights up from dark after the red and blue flight');
});

test('the landing is a firework finale: shaped shells, a wall of every kind, framed over the harbour, done before the end',()=>{
  const show=compileDemo(assets,{count:512}),land=show.stages.find(s=>s.kind==='landing'),shells=pyroSchedule(show,[[0,0,0],[100,0,0],[-100,0,0]]);
  assert.equal(land.end-land.start,CINEMATIC_LANDING[1]);
  const finale=shells.filter(s=>s.t0>=land.start-1e-9);
  assert.ok(finale.length>=30);assert.deepEqual([...new Set(finale.map(s=>s.pattern))].sort(),[...PATTERNS,...SHAPES].sort(),'every kind of shell');
  const together=Math.max(...finale.map(a=>finale.filter(b=>b.t0>=a.t0&&b.t0<a.t0+.6).length));assert.ok(together>=12,'a wall fired together: '+together);
  assert.ok(finale.every(s=>s.t0+s.delay+4.5<=show.duration),'every shell has burnt out before the show ends');
  const unit=stageUnit(show),mid=(land.start+land.end)/2,f=framingAt(show,mid);
  assert.ok(f.center[1]+f.half[1]>=240*unit&&f.center[1]-f.half[1]<=0,'the camera frames the bursts and the launch field together');
  const quiet=compileDemo(assets,{count:512,pyro:false}),g=framingAt(quiet,mid);assert.ok(g.center[1]+g.half[1]<120*unit,'without ship fireworks the landing stays on the field');
  // Shaped shells keep their outline in a plane facing the audience.
  for(const pattern of SHAPES){
    const data=pyroParticles([finale.find(s=>s.pattern===pattern)]),stars=[];
    for(let o=0;o<data.length;o+=PARTICLE_FLOATS)if(data[o+11]===1&&data[o+12]===0)stars.push([data[o+8],data[o+9],data[o+10]]);
    const speed=stars.map(v=>Math.hypot(...v)),spread=k=>Math.max(...stars.map(v=>v[k]))-Math.min(...stars.map(v=>v[k]));
    assert.ok(Math.min(...speed)<Math.max(...speed)*.6,pattern+' is an outline, not a sphere');
    if(pattern!=='saturn')assert.ok(spread(2)<spread(0)*.55,pattern+' faces the audience');
  }
});
