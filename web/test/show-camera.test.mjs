import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {compileDemo} from '../src/demo-settings.js';
import {buildShow,samplePaths,sampleShow} from '../src/drone-show.js';
import {directorView,framingAt,showKeyframes} from '../src/show-camera.js';
import {detectTier,resolveTier,FrameGovernor,TIERS} from '../src/quality.js';

const demo=compileDemo(assets,{count:512});
const project=(pose,point,aspect,fov=46)=>{
  // Camera basis looking at the target; returns normalised screen coordinates (-1..1).
  const f=pose.target.map((v,k)=>v-pose.position[k]),n=Math.hypot(...f),fw=f.map(v=>v/n);
  const right=[fw[2]*0-fw[1]*0,0,0];right[0]=-fw[2];right[2]=fw[0];const rn=Math.hypot(...right);right.forEach((v,k)=>right[k]=v/rn);
  const up=[right[1]*fw[2]-right[2]*fw[1],right[2]*fw[0]-right[0]*fw[2],right[0]*fw[1]-right[1]*fw[0]];
  const d=point.map((v,k)=>v-pose.position[k]),z=d.reduce((s,v,k)=>s+v*fw[k],0),tan=Math.tan(fov*Math.PI/360);
  return [d.reduce((s,v,k)=>s+v*right[k],0)/(z*tan*aspect),d.reduce((s,v,k)=>s+v*up[k],0)/(z*tan),z];
};

test('director camera is continuous across every stage boundary and never dips below the water',()=>{
  for(const aspect of [16/9,.46]){
    for(const s of demo.stages.slice(1)){
      const a=directorView(demo,s.start-1e-4,aspect),b=directorView(demo,s.start+1e-4,aspect);
      const jump=Math.hypot(...a.position.map((v,k)=>v-b.position[k])),aim=Math.hypot(...a.target.map((v,k)=>v-b.target[k]));
      assert.ok(jump<.05&&aim<.05,`${s.name}: camera jumped ${jump.toFixed(3)} m`);
    }
    for(let t=0;t<=demo.duration;t+=.5){const pose=directorView(demo,t,aspect);assert.ok(pose.position.every(Number.isFinite));assert.ok(pose.position[1]>=1.5,'camera above the water at '+t);}
  }
});
test('each held formation is framed large and entirely on screen, desktop and portrait',()=>{
  for(const aspect of [16/9,.46]){
    for(const s of demo.stages.filter(s=>s.kind==='hold'&&s.reveal)){
      const t=(s.start+s.end)/2,pose=directorView(demo,t,aspect),frame=sampleShow(demo,t);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let i=0;i<demo.count;i++){const [x,y,z]=project(pose,[frame.positions[i*3],frame.positions[i*3+1],frame.positions[i*3+2]],aspect);assert.ok(z>0);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      assert.ok(minX>-1&&maxX<1&&minY>-1&&maxY<1,`${s.name} fits the view (${aspect.toFixed(2)})`);
      assert.ok(Math.max(maxX-minX,maxY-minY)>1,`${s.name} fills at least half the view`);
    }
  }
});
test('launch field is viewed from above, formations from below like an audience',()=>{
  const takeoff=demo.stages.find(s=>s.kind==='takeoff'),robot=demo.stages.find(s=>s.name==='Robot');
  const ground=directorView(demo,takeoff.start,16/9),sky=directorView(demo,(robot.start+robot.end)/2,16/9);
  assert.ok(ground.position[1]>ground.target[1]);assert.ok(sky.position[1]<sky.target[1]);
  assert.equal(showKeyframes(demo).length,demo.stages.length+1);
  // Opens and ends on a close-up of the front row: small framing, near the pads, low camera.
  for(const t of [0,demo.duration]){const f=framingAt(demo,t),pose=directorView(demo,t,16/9);assert.ok(f.half[0]<demo.stages.find(s=>s.kind==='takeoff').to.positions.reduce((m,p)=>Math.max(m,Math.abs(p[0])),0)*.5,'front-row framing');assert.ok(pose.distance<40&&pose.position[1]<12,'close to the drones at '+t);}
});
test('authored drawing shows get the same director at their own scale',()=>{
  const formation=samplePaths([{points:[[-4,20,0],[4,20,0],[0,26,1]],color:[1,.5,.2]}],256),show=buildShow(formation,{count:256});
  const mid=show.stages.find(s=>s.name==='Your drawing'),pose=directorView(show,(mid.start+mid.end)/2,16/9);
  assert.ok(pose.distance>5&&pose.distance<120);assert.ok(pose.position.every(Number.isFinite));
});
test('graphics tiers follow device capability and the governor adapts render scale',()=>{
  assert.equal(detectTier({mobile:false,cores:12,memory:16}),'high');
  assert.equal(detectTier({mobile:true,cores:8,memory:8}),'balanced');
  assert.equal(detectTier({mobile:true,cores:8,memory:4}),'battery');
  assert.equal(detectTier({saveData:true,cores:16,memory:16}),'battery');assert.equal(detectTier({software:true,cores:16,memory:16}),'battery');
  assert.equal(resolveTier('battery',{cores:16}),'battery');assert.equal(resolveTier('nonsense',{mobile:true,cores:4}),'battery');
  assert.ok(Object.values(TIERS).every(t=>t.pixelRatio>=1));
  const g=new FrameGovernor(1,.6);let now=0;for(let i=0;i<200;i++){now+=60;g.sample(now);}assert.ok(g.scale<1&&g.scale>=.6,'slow frames lower the scale');
  for(let i=0;i<600;i++){now+=16;g.sample(now);}assert.equal(g.scale,1,'fast frames restore full scale');
});
