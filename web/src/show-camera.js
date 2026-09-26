// Automatic "director" camera for the sky show. Pure and deterministic: the same
// show and time always give the same pose, so seeking, recording and replays agree.
// Each stage ends on a framing keyframe; the camera eases between keyframes over
// the stage, which keeps position and target continuous at every boundary.
import {stageUnit} from './drone-show.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*t*(10+t*(-15+6*t));};
const cache=new WeakMap();

function box(...lists){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const list of lists)for(const p of list)for(let k=0;k<3;k++){if(p[k]<min[k])min[k]=p[k];if(p[k]>max[k])max[k]=p[k];}
  return {center:min.map((v,k)=>(v+max[k])/2),half:min.map((v,k)=>(max[k]-v)/2),top:max[1]};
}
// One keyframe per stage end, plus the opening frame. ground=1 means the elevated launch-field view.
export function showKeyframes(show){
  if(cache.has(show))return cache.get(show);
  const stages=show.stages,takeoff=stages.find(s=>s.kind==='takeoff'),hoverTop=takeoff?box(takeoff.to.positions).top:0;
  const frame=(b,ground)=>({center:b.center,half:b.half,ground});
  // Opening and closing close-ups on the front row of drones sitting on their pads.
  const xs=show.home.map(p=>p[0]),zs=show.home.map(p=>p[2]),side=Math.ceil(Math.sqrt(show.count)),gap=(Math.max(...xs)-Math.min(...xs))/Math.max(1,side-1)||1,front=Math.max(...zs);
  const close={center:[(Math.max(...xs)+Math.min(...xs))/2,gap*.25,front],half:[gap*1.5,gap*.5,gap*.9],ground:.42,close:true};
  const grounded=s=>s?.kind==='hold'&&s.to.positions.every(p=>p[1]<=.2);
  // Ship fireworks close a cinematic show: while the fleet returns and lands, the camera frames the harbour sky
  // where the shells burst, with the launch field at the bottom of the picture.
  const unit=stageUnit(show),finale=show.pyro!==false&&stages.some(s=>s.kind==='landing'&&s.reverse);
  const harbour={center:[0,128*unit,-160*unit],half:[250*unit,148*unit,40*unit],ground:.1,wide:true};
  // A sentence (Happy day's phrases) shares one steady frame around all its phrases, with headroom, so the words change in place.
  const sentence=new Map();stages.forEach((s,c)=>{if(!s.climax)return;const points=[];for(let j=c-1;j>=0&&(stages[j].phrase||stages[j].morph);j--)if(stages[j].phrase)points.push(...stages[j].to.positions);
    if(points.length){const b=box(points);sentence.set(s,{center:[b.center[0],b.center[1]-b.half[1]*.32,b.center[2]],half:[b.half[0]*1.04,b.half[1]*1.4,b.half[2]],ground:0});}});// room below: the words sit clear of the skyline
  const keyframes=[grounded(stages[0])?{...close}:frame(box(stages[0].from.positions),1)];
  stages.forEach((s,i)=>{
    const next=stages[i+1];let b;
    if(s.kind==='move'&&(next?.kind==='grow'||next?.kind==='burst'))b=box(next.to.positions);// frame where the firework will open
    else if(['fall','rise','burst'].includes(s.kind))b=box(s.from.positions,s.to.positions);
    else b=box(s.to.positions);
    if(grounded(s)&&(i===0||i===stages.length-1)){keyframes.push({...close});return;}
    if(finale&&(s.kind==='landing'||next?.kind==='landing')){keyframes.push({...harbour});return;}
    // A sentence holds one steady frame, the one its closing formation needs, so the words change in place.
    if(s.phrase||s.morph&&!next?.climax||s.kind==='move'&&next?.phrase){const f=sentence.get(stages.slice(i).find(x=>x.climax));if(f){keyframes.push({...f});return;}}
    keyframes.push(frame(b,b.top<=hoverTop*1.05+1e-6?1:0));
  });
  // Never zoom in on tiny intermediate shapes more than the show's typical formation allows.
  const reference=Math.max(...keyframes.filter(k=>!k.ground).map(k=>Math.max(k.half[0],k.half[1])),...keyframes.filter(k=>!k.close&&!k.wide).map(k=>k.half[0]*.5),1e-3);
  for(const k of keyframes){if(k.close||k.wide)continue;const size=Math.max(k.half[0],k.half[1]);if(size<reference*.45){const f=reference*.45/Math.max(size,1e-6);k.half=k.half.map((v,j)=>j<2?v*f:v);}}
  cache.set(show,keyframes);return keyframes;
}
export function framingAt(show,time){
  const keyframes=showKeyframes(show),t=clamp(Number.isFinite(time)?time:0,0,show.duration);
  let i=show.stages.findIndex(s=>t<s.end);if(i<0)i=show.stages.length-1;
  const s=show.stages[i],a=keyframes[i],b=keyframes[i+1],f=smooth((t-s.start)/Math.max(1e-6,s.end-s.start));
  const mix=(x,y)=>x+(y-x)*f;
  return {center:a.center.map((v,k)=>mix(v,b.center[k])),half:a.half.map((v,k)=>mix(v,b.half[k])),ground:mix(a.ground,b.ground)};
}
// Returns {position,target,distance}. verticalOffset matches frontView: the fraction of the
// view shifted up to clear the bottom controls.
export function directorView(show,time,aspect,fov=46,verticalOffset=0,{drift=1}={}){
  const f=framingAt(show,time),tan=Math.tan(fov*Math.PI/360),usable=Math.max(.3,1-2*Math.abs(verticalOffset));
  const distance=f.half[2]+Math.max(f.half[1]/(tan*usable*.74),f.half[0]/(tan*Math.max(.1,aspect)*.84));
  // The audience looks up at formations (skyline stays below them); the launch field is seen from above.
  const pitch=-.21+.63*f.ground+.012*Math.sin(time*.21)*drift,yaw=drift*(.15*(1-.6*f.ground))*Math.sin(time*2*Math.PI/52);
  const target=f.center.slice();
  const position=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
  // Stay above the water, whatever the framing.
  const floor=Math.max(1.5,f.half[0]*.04);if(position[1]<floor)position[1]=floor;
  return {position,target,distance};
}
