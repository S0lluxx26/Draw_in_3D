import {clone,entity,validate,documentOf} from './model.js';
import {interpolate} from './paths.js';
import {curvePoints} from './stroke-processing.js';
import {attachedIds,localizePapers} from './paper.js';
export class History {
  past=[];future=[];limit=30;
  push(before,after,label){if(before.entities===after.entities)return;this.past.push({before,after,label});if(this.past.length>this.limit)this.past.shift();this.future=[];}
  peek(back){const entry=(back?this.past:this.future).at(-1);return entry&&(back?entry.before:entry.after);}
  travel(back){const source=back?this.past:this.future,dest=back?this.future:this.past,entry=source.pop();if(!entry)return null;dest.push(entry);return back?entry.before:entry.after;}
  clear(){this.past=[];this.future=[];}
}
export function pivotOf(entities,ids){const chosen=entities.filter(e=>ids.has(e.id)&&!ids.has(e.paperId));return chosen.length?[0,1,2].map(i=>chosen.reduce((n,e)=>n+e.position[i],0)/chosen.length):[0,0,0];}
export function transformSelection(entities,ids,{move=[0,0,0],yaw=0,scale=1,pivot=pivotOf(entities,ids)}={}){
  entities=localizePapers(entities,new Set(entities.filter(e=>ids.has(e.id)&&e.type==='paper').map(e=>e.id)));
  const attached=entities.filter(e=>ids.has(e.id)&&e.paperId&&!ids.has(e.paperId));
  if(attached.length&&(attached.length!==entities.filter(e=>ids.has(e.id)).length||new Set(attached.map(e=>e.paperId)).size!==1))throw new Error('Transform one sheet or its own strokes at a time. Select the paper to carry its paint.');
  if(attached.length){entities=localizePapers(entities,new Set(attached.map(e=>e.paperId)));pivot=pivotOf(entities,ids);}
  const angle=yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const next=entities.map(e=>{
    if(!ids.has(e.id)||e.paperId&&ids.has(e.paperId))return e;const copy=clone(e),p=e.position.map((v,i)=>(v-pivot[i])*scale);
    copy.position=(e.pointSpace==='surface'?[p[0]*c-p[1]*s,p[0]*s+p[1]*c,0]:[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]).map((v,i)=>v+pivot[i]+move[i]);if(e.pointSpace==='surface')copy.position[2]=0;copy.yaw+=yaw;copy.scale*=scale;return copy;
  });validate(documentOf(next));return next;
}
export function duplicateSelection(entities,ids){
  entities=localizePapers(entities,new Set(entities.filter(e=>ids.has(e.id)&&e.type==='paper').map(e=>e.id)));
  ids=attachedIds(entities,ids);const mapping=new Map([...ids].map(id=>[id,crypto.randomUUID()]));
  const copies=entities.filter(e=>ids.has(e.id)).map(e=>({...clone(e),id:mapping.get(e.id),paperId:mapping.get(e.paperId)||e.paperId,position:e.position.map((v,i)=>v+(i<2&&!ids.has(e.paperId)?.15:0))}));
  if(copies.some(e=>['start','goal'].includes(e.type)))throw new Error('A map has one Start and one Goal. Exclude them before duplicating.');
  const next=[...entities,...copies];validate(documentOf(next));return {entities:next,selected:new Set(copies.map(e=>e.id))};
}
// Intervals along AB inside a circle; used with a rectangle to form a swept eraser.
function circleInterval(a,b,centre,r){
  const dx=b[0]-a[0],dy=b[1]-a[1],x=a[0]-centre[0],y=a[1]-centre[1],aa=dx*dx+dy*dy,cc=x*x+y*y-r*r;
  if(aa<1e-12)return cc<=0?[0,1]:null;
  const bb=2*(x*dx+y*dy),disc=bb*bb-4*aa*cc;if(disc<0)return null;
  const lo=Math.max(0,(-bb-Math.sqrt(disc))/(2*aa)),hi=Math.min(1,(-bb+Math.sqrt(disc))/(2*aa));return hi>=lo?[lo,hi]:null;
}
function rectangleInterval(a,b,width,r){
  let lo=0,hi=1;
  for(const [axis,min,max] of [[0,0,width],[1,-r,r]]){const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return null;}else{let p=(min-a[axis])/d,q=(max-a[axis])/d;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(hi<lo)return null;}}
  return [lo,hi];
}
function cutIntervals(a,b,from,to,r){
  const intervals=[circleInterval(a,b,from,r),circleInterval(a,b,to,r)].filter(Boolean);
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);
  if(length>1e-6){const local=p=>[((p[0]-from[0])*dx+(p[1]-from[1])*dy)/length,(-(p[0]-from[0])*dy+(p[1]-from[1])*dx)/length];const rect=rectangleInterval(local(a),local(b),length,r);if(rect)intervals.push(rect);}
  intervals.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1]+1e-7)last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}
  return merged;
}
export function eraseStroke(e,project,from,to,radius,samples=e.points){
  if(e.type!=='stroke')return [e];
  if(e.points.length===1){const p=project(e,e.points[0]);return p&&cutIntervals(p,p,from,to,radius).length?[]:[e];}
  const chunks=[];let chunk=[],changed=false;
  const finish=()=>{if(chunk.length)chunks.push(chunk);chunk=[];};
  for(let i=0;i<samples.length-1;i++){
    const a=samples[i],b=samples[i+1],pa=project(e,a),pb=project(e,b),cuts=pa&&pb?cutIntervals(pa,pb,from,to,radius):[];
    if(!cuts.length){if(!chunk.length)chunk.push(a);chunk.push(b);continue;}
    // Projected screen fractions are perspective-corrected back to local 3D.
    const at=t=>{const wa=pa[2]??1,wb=pb[2]??1;return interpolate(a,b,t*wa/((1-t)*wb+t*wa));};
    changed=true;let cursor=0;
    for(const [lo,hi] of cuts){
      if(lo>cursor+1e-7){if(!chunk.length)chunk.push(at(cursor));chunk.push(at(lo));}finish();cursor=hi;
    }
    if(cursor<1-1e-7){chunk.push(at(cursor));chunk.push(b);}
  }
  finish();if(!changed)return [e];
  const bounded=chunks.flatMap(points=>{const parts=[];for(let i=0;i<points.length;i+=383)parts.push(points.slice(i,i+384));return parts;});
  return bounded.map((points,i)=>({...clone(e),id:i?crypto.randomUUID():e.id,points}));
}
export function shapeEntity(kind,start,end,basis,style,{depth=.4,constrain=false,bend=.35,curveKind='arc',pointBudget=65}={}){
  const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0),delta=end.map((v,i)=>v-start[i]);
  let u=dot(delta,basis.u),v=dot(delta,basis.v);
  if(constrain){if(kind==='line'||kind==='curve'){const angle=Math.round(Math.atan2(v,u)/(Math.PI/12))*Math.PI/12,length=Math.hypot(u,v);u=length*Math.cos(angle);v=length*Math.sin(angle);}else{const extent=Math.max(Math.abs(u),Math.abs(v));u=Math.sign(u||1)*extent;v=Math.sign(v||1)*extent;}}
  const point=(x,y)=>[...basis.u.map((value,i)=>value*x+basis.v[i]*y),1];
  const e=Object.assign(entity(kind==='block'?'block':'stroke'),clone(style));e.position=[...start];e.normal=[...basis.normal];e.surface=true;
  if(kind==='curve')e.points=curvePoints(point(u,v).slice(0,3),basis.normal,bend,curveKind,pointBudget);
  else if(kind==='line')e.points=[point(0,0),point(u,v)];
  else if(kind==='rectangle')e.points=[point(0,0),point(u,0),point(u,v),point(0,v),point(0,0)];
  else if(kind==='ellipse')e.points=Array.from({length:65},(_,i)=>point(u/2+u/2*Math.cos(i*Math.PI/32),v/2+v/2*Math.sin(i*Math.PI/32)));
  else{
    e.position=e.position.map((p,i)=>p+basis.u[i]*u/2+basis.v[i]*v/2+basis.normal[i]*depth/2);
    e.size=[0,1,2].map(i=>Math.max(.02,Math.abs(basis.u[i]*u)+Math.abs(basis.v[i]*v)+Math.abs(basis.normal[i]*depth)));
    e.brush='Pen';e.pattern='solid';e.wet=false;
  }
  return e;
}
