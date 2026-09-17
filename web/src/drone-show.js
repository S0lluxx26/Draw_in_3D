// Pure, deterministic choreography. Distances/timing are for a visual preview,
// not a validated aircraft trajectory or a flight-file format.
import {worldPoint,surfaceWorld,strokeUV,subdivideSurface} from './paper.js';
export const DRONE_COUNT=256;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const ease=t=>{t=clamp(t);return t*t*t*(10+t*(-15+6*t));};
const rgb=hex=>[16,8,0].map(s=>((hex>>s)&255)/255);
const cyan=rgb(0x52e5ff),blue=rgb(0x628dff),gold=rgb(0xffbe60),pink=rgb(0xff6db3),white=rgb(0xd7f6ff);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const line=(points,color=cyan)=>({points:points.map(p=>[p[0],p[1]+18,p[2]||0]),color});
const box=(x,y,w,h,color=cyan)=>line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],color);
const ellipse=(x,y,rx,ry,color)=>line(Array.from({length:65},(_,i)=>[x+rx*Math.cos(i*Math.PI/32),y+ry*Math.sin(i*Math.PI/32)]),color);

export function samplePaths(paths,count=DRONE_COUNT){
  const prepared=paths.map(path=>{
    const lengths=[0];for(let i=1;i<path.points.length;i++)lengths.push(lengths.at(-1)+distance(path.points[i-1],path.points[i]));
    return {...path,lengths,length:lengths.at(-1)};
  }).filter(p=>Number.isFinite(p.length)&&p.length>1e-8);
  if(!prepared.length)throw new Error('Draw a line or shape with some length, then replay your drawing.');
  // Proportional arc-length sampling, with at least one drone per path when possible.
  const total=prepared.reduce((n,p)=>n+p.length,0),minimum=prepared.length<=count?1:0,remaining=count-minimum*prepared.length;
  const allocations=prepared.map((p,i)=>({i,n:minimum+Math.floor(remaining*p.length/total),fraction:remaining*p.length/total%1}));
  let spare=count-allocations.reduce((n,a)=>n+a.n,0);
  for(const a of [...allocations].sort((a,b)=>b.fraction-a.fraction||a.i-b.i))if(spare-->0)a.n++;
  const positions=[],colors=[];
  for(const {i,n} of allocations){const path=prepared[i];let segment=1;
    for(let j=0;j<n;j++){
      const at=(j+.5)/n*path.length;while(segment<path.lengths.length-1&&path.lengths[segment]<at)segment++;
      const a=path.points[segment-1],b=path.points[segment],t=(at-path.lengths[segment-1])/(path.lengths[segment]-path.lengths[segment-1]||1);
      positions.push(a.map((v,k)=>v+(b[k]-v)*t));colors.push([...path.color]);
    }
  }
  return {positions,colors};
}

function robot(){return [
  box(-3.8,2.8,7.6,5.8),line([[0,8.6],[0,10]],gold),ellipse(0,10.3,.4,.4,gold),
  box(-2.8,5,.95,1.2,white),box(1.85,5,.95,1.2,white),line([[-1.7,3.8],[1.7,3.8]],gold),
  box(-3,-3.5,6,5.6),line([[-3,1.3],[-5,1.3],[-5,-2.5],[-4,-2.5]],blue),line([[3,1.3],[5,1.3],[5,-2.5],[4,-2.5]],blue),
  box(-2.5,-7,1.7,3.5),box(.8,-7,1.7,3.5),line([[-3.1,-7],[-.5,-7]],gold),line([[.5,-7],[3.1,-7]],gold),
  line([[0,-1.6],[-1.25,-.4],[-1.25,.35],[-.6,.8],[0,.2],[.6,.8],[1.25,.35],[1.25,-.4],[0,-1.6]],pink)
];}
function fish(){return [
  ellipse(0,0,7.5,3.8,cyan),line([[-6.5,1.8],[-11,5.3],[-10,-5.3],[-6.5,-1.8]],gold),
  line([[-2,3.7],[.7,7],[3,3.5]],blue),line([[-2,-3.7],[1,-6],[3,-3.5]],blue),
  ellipse(4.8,1,.55,.6,white),line([[2.8,2.7],[2,1.5],[1.9,0],[2.3,-1.4],[3,-2.5]],gold),
  line([[7.2,.2],[6.1,-.4],[7.1,-1.1]],pink),line([[-2,1],[.7,0],[-2,-1]],blue),
  ellipse(9.4,4,.65,.65,white),ellipse(10.5,6.6,.4,.4,blue)
];}
function tower(){return [
  line([[-7,-8],[-4.7,-3],[-2.2,3],[-.55,9],[.55,9],[2.2,3],[4.7,-3],[7,-8]],gold),
  line([[-7,-8],[-4.5,-8],[-3.4,-5.8],[-1.9,-4.4],[0,-4],[1.9,-4.4],[3.4,-5.8],[4.5,-8],[7,-8]],gold),
  line([[-5,-3],[5,-3]],white),line([[-2.5,3],[2.5,3]],white),line([[-1,7],[1,7]],gold),line([[0,9],[0,11]],white),
  line([[-4.5,-3],[2.2,3],[-2.2,3],[1,7],[-1,7]],gold),line([[4.5,-3],[-2.2,3],[2.2,3],[-1,7],[1,7]],gold),
  line([[-6,-6],[-3,-3]],blue),line([[6,-6],[3,-3]],blue)
];}
export const demoPaths=()=>[{name:'Robot',paths:robot(),hold:8},{name:'Fish',paths:fish(),hold:8},{name:'Eiffel Tower',paths:tower(),hold:9}];

// Deterministic O(n³) minimum squared-distance assignment (Hungarian algorithm).
// Matching shortens paths; it DOES NOT establish minimum flight separation.
export function matchFormation(previous,target){
  const n=previous.length;if(target.positions.length!==n)throw new Error('Formation must match the fleet size.');
  const costs=previous.map(a=>Float64Array.from(target.positions,b=>a.reduce((s,v,k)=>s+(v-b[k])**2,0)));
  const u=new Float64Array(n+1),v=new Float64Array(n+1),p=new Int32Array(n+1),way=new Int32Array(n+1);
  for(let i=1;i<=n;i++){
    p[0]=i;let j0=0;const min=new Float64Array(n+1).fill(Infinity),used=new Uint8Array(n+1);
    do{
      used[j0]=1;const i0=p[j0];let delta=Infinity,j1=0;
      for(let j=1;j<=n;j++)if(!used[j]){const cur=costs[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
      for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;
      j0=j1;
    }while(p[j0]!==0);
    do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
  }
  const positions=new Array(n),colors=new Array(n),order=new Array(n);
  for(let j=1;j<=n;j++){positions[p[j]-1]=target.positions[j-1];colors[p[j]-1]=target.colors[j-1];order[p[j]-1]=(target.order?.[j-1]??(j-1)/Math.max(1,n-1));}
  return {positions,colors,order};
}

export function drawingPaths(entities){
  const papers=new Map(entities.filter(e=>e.type==='paper').map(p=>[p.id,p]));
  const paths=entities.filter(e=>e.type==='stroke').flatMap(e=>{
    const paper=papers.get(e.paperId);
    if(!paper)return [{points:e.points.map(p=>worldPoint(e,p)),color:rgb(e.color&0xffffff)}];
    // Match the visible sheet crop, including on hidden/curved drawing guides.
    const uv=e.points.map(p=>strokeUV(e,p,paper)),segments=[];
    for(let i=1;i<uv.length;i++){
      const a=uv[i-1],b=uv[i];let lo=0,hi=1;
      for(let k=0;k<2;k++){const limit=paper.panelWidth/(k?paper.aspect:1)/2,d=b[k]-a[k];if(Math.abs(d)<1e-10){if(Math.abs(a[k])>limit){hi=-1;break;}}else{const x=(-limit-a[k])/d,y=(limit-a[k])/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}}
      if(hi>lo){const start=a.map((v,k)=>v+(b[k]-v)*lo),end=a.map((v,k)=>v+(b[k]-v)*hi),last=segments.at(-1);if(last&&distance(last.at(-1),start)<1e-8)last.push(end);else segments.push([start,end]);}
    }
    return subdivideSurface(segments,paper).map(path=>({points:path.map(p=>surfaceWorld(paper,p)),color:rgb(e.color&0xffffff)}));
  });
  return paths;
}
export function fitPaths(paths){
  const points=paths.flatMap(p=>p.points);if(!points.length)throw new Error('Draw a line or shape first. Replay uses stroke lines and their colours.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  const scale=Math.min(22/Math.max(.001,max[0]-min[0]),18/Math.max(.001,max[1]-min[1]),12/Math.max(.001,max[2]-min[2]));
  return {origin:min.map((v,k)=>(v+max[k])/2),scale,position:[0,18,0],yaw:0};
}
export function placePaths(paths,placement){
  const {origin,scale,position,yaw}=placement,a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return paths.map(path=>({...path,points:path.points.map(p=>{const [x,y,z]=p.map((v,k)=>(v-origin[k])*scale);return [x*c+z*s+position[0],y+position[1],-x*s+z*c+position[2]];})}));
}
export function drawingFormation(entities){const paths=drawingPaths(entities);return samplePaths(placePaths(paths,fitPaths(paths)));}

function fireworksSeeds(){
  const positions=[],colors=[];
  for(let i=0;i<DRONE_COUNT;i++){
    const cluster=i<DRONE_COUNT/2?0:1,index=i%(DRONE_COUNT/2),theta=index*2.399963229728653,y=1-2*(index+.5)/(DRONE_COUNT/2),r=Math.sqrt(1-y*y),centre=cluster? [7,18,-1]:[-7,22,0];
    positions.push([centre[0]+r*Math.cos(theta)*1.4,centre[1]+y*1.4,centre[2]+r*Math.sin(theta)*.7]);
    colors.push([...(cluster?[pink,blue,white][index%3]:[gold,cyan,white][index%3])]);
  }
  return {positions,colors};
}
export function buildShow(custom,options={}){
  const home=Array.from({length:DRONE_COUNT},(_,i)=>[(i%16-7.5)*.95,.12,(Math.floor(i/16)-7.5)*.8]);
  const dark=()=>Array.from({length:DRONE_COUNT},()=>[0,0,0]);
  const ground={positions:home,colors:dark()},hover={positions:home.map(p=>[p[0],6,p[2]]),colors:dark()};
  const stages=[],cues=[];let cursor=0,previous=ground;
  const add=(name,kind,duration,target,details={})=>{const stage={name,kind,start:cursor,end:cursor+duration,from:previous,to:target,...details};stages.push(stage);cursor+=duration;previous=target;return stage;};
  add('Launch grid','hold',2,ground);cues.push({label:'Takeoff',time:2});add('Takeoff','takeoff',6,hover);
  const sequence=options.sequence??(custom?[{name:'Your drawing',formation:custom,hold:12}]:demoPaths().map(f=>({...f,formation:samplePaths(f.paths)})));
  for(const {name,formation,hold,transfer=7,light='fade'} of sequence){
    const target=matchFormation(previous.positions,formation);add('Forming '+name,'move',transfer,target);cues.push({label:name,time:cursor+Math.min(hold/2,2)});add(name,'hold',hold,target,{reveal:true,light});
  }
  if(options.fireworks?.enabled!==false){
  const seeds=matchFormation(previous.positions,fireworksSeeds());add('Firework launch','move',7,seeds);cues.push({label:'Fireworks',time:cursor+5});
  const centres=seeds.positions.map(p=>p[0]<0?[-7,22,0]:[7,18,-1]);
  const burst={positions:seeds.positions.map((p,i)=>p.map((v,k)=>centres[i][k]+(v-centres[i][k])*(options.fireworks?.radius??6.3)/1.4-(k===1?2.5:0))),colors:seeds.colors};
  const duration=options.fireworks?.duration??9;cues[cues.length-1].time=cursor+duration*.55;
  add('Fireworks','burst',duration,burst,{centres});
  }
  add('Returning home','move',7,hover);cues.push({label:'Landing',time:cursor+2});add('Landing','landing',8,ground);add('Landed','hold',2,ground);
  return {count:DRONE_COUNT,home,stages,cues,duration:cursor,custom:!!custom,title:options.title};
}

export function stageAt(show,time){const t=clamp(Number.isFinite(time)?time:0,0,show.duration);return show.stages.find(s=>t<s.end)||show.stages.at(-1);}
// All trajectories interpolate between endpoints, so their combined bounds also
// bound the complete performance. Include landing pads when framing the camera.
export function frontView(show,aspect,fov=46,verticalOffset=0){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const stage of show.stages)for(const p of [...stage.from.positions,...stage.to.positions])for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  const target=min.map((v,k)=>(v+max[k])/2),half=min.map((v,k)=>(max[k]-v)/2),tan=Math.tan(fov*Math.PI/360);
  const distance=half[2]+Math.max(38,half[0]/(tan*Math.max(.1,aspect)),half[1]/(tan*Math.max(.3,1-2*Math.abs(verticalOffset))))*1.25;
  return {target,position:[target[0],target[1]+distance*.04,target[2]+distance]};
}
export function createFrame(show){return {positions:new Float32Array(show.count*3),colors:new Float32Array(show.count*3),phase:'',time:0};}
export function sampleShow(show,time,out=createFrame(show)){
  const t=clamp(Number.isFinite(time)?time:0,0,show.duration),s=stageAt(show,t),elapsed=t-s.start,duration=s.end-s.start;
  out.time=t;out.phase=s.name;
  for(let i=0;i<show.count;i++){
    let q=0,light=0,color=s.to.colors[i];
    if(s.kind==='hold'){q=1;const reveal=Math.min(2,duration/2),rank=s.light==='draw-on'?(s.to.order?.[i]??0):s.light==='bottom-up'?clamp((s.to.positions[i][1]-2)/42):0;light=s.reveal?ease((elapsed-rank*reveal*.75)/(s.light==='fade'||!s.light?Math.min(1.1,reveal):reveal*.25)):1;}
    else if(s.kind==='move'){q=ease((elapsed-.65)/(duration-1.3));light=1-ease(elapsed/.6);color=s.from.colors[i];}
    else if(s.kind==='takeoff'||s.kind==='landing'){const row=Math.floor(i/16)/15;q=ease((elapsed-row*.65)/(duration-.65));}
    else if(s.kind==='burst'){q=ease(elapsed/duration);light=ease(elapsed/.65);}
    for(let k=0;k<3;k++){
      out.positions[i*3+k]=s.from.positions[i][k]+(s.to.positions[i][k]-s.from.positions[i][k])*q;
      const pulse=s.kind==='burst'?1-.14*Math.sin(Math.PI*elapsed/duration)**2*(1+Math.sin(elapsed*4+i*.2))/2:1;
      out.colors[i*3+k]=color[k]*light*pulse;
    }
  }
  return out;
}

export class ShowClock{
  constructor(duration){this.duration=duration;this.time=0;this.rate=1;this.playing=false;this.anchor=0;}
  read(now){if(this.playing){this.time=clamp(this.time+Math.max(0,now-this.anchor)*this.rate/1000,0,this.duration);this.anchor=now;if(this.time>=this.duration)this.playing=false;}return this.time;}
  play(now){if(this.time>=this.duration)this.time=0;this.anchor=now;this.playing=true;}
  pause(now){this.read(now);this.playing=false;}
  seek(time,now){this.time=clamp(Number.isFinite(time)?time:0,0,this.duration);this.anchor=now;}
  speed(rate,now){this.read(now);this.rate=clamp(Number.isFinite(rate)?rate:1,.25,2);}
}
