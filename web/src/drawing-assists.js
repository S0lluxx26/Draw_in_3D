import {clone,counts,LIMITS,validate,documentOf} from './model.js';
import {localizeStroke,strokeUV} from './paper.js';

// Mirrors use the unrolled sheet, so bending/tilting later remains fully editable.
export function mirrorSheetStroke(stroke,paper,axis,id){
  if(!paper||stroke.type!=='stroke'||stroke.paperId!==paper.id||!['u','v'].includes(axis))return null;
  const k=axis==='u'?0:1,local=localizeStroke(stroke,paper);
  if(local.points.every(p=>Math.abs(strokeUV(local,p,paper)[k])<1e-6))return null;
  const copy=clone(local);copy.id=id;copy.position[k]*=-1;copy.yaw*=-1;
  copy.points=copy.points.map(p=>p.map((v,i)=>i===k?-v:v));
  // A centred line/closed outline can coincide with its own reflection. Avoid
  // overpainting it twice. Compare pressure too; asymmetric pressure is real ink.
  const path=e=>e.points.map(p=>[...strokeUV(e,p,paper).slice(0,2),p[3]]),a=path(local),b=path(copy);
  const same=(x,y)=>x.every((v,i)=>Math.abs(v-y[i])<1e-6);
  if(a.every((p,i)=>same(p,b[i]))||a.every((p,i)=>same(p,b.at(-1-i))))return null;
  if(a.length>2&&same(a[0],a.at(-1))){const n=a.length-1,start=b.slice(0,n).findIndex(p=>same(p,a[0]));if(start>=0&&[1,-1].some(direction=>a.slice(0,n).every((p,i)=>same(p,b[(start+direction*i+n)%n]))))return null;}
  return copy;
}
export function strokeCapacity(entities,mirror=false){
  const copies=mirror?2:1,c=counts(entities);
  return c.objects+copies>LIMITS.objects?0:Math.max(0,Math.min(LIMITS.stroke,Math.floor((LIMITS.points-c.points)/copies)));
}
export function assistedStrokeScene(before,stroke,paper,axis,mirrorId){
  const mirrored=mirrorSheetStroke(stroke,paper,axis,mirrorId),next=[...before,stroke,...(mirrored?[mirrored]:[])];
  validate(documentOf(next));return next;
}
export function sheetEndpoints(entities,paper){
  if(!paper)return [];
  const candidates=[],w=paper.panelWidth/2,h=paper.panelWidth/paper.aspect/2;
  for(const e of entities){
    if(e.type!=='stroke'||e.paperId!==paper.id||!e.points.length)continue;
    const ends=e.points.length===1?[e.points[0]]:[e.points[0],e.points.at(-1)];
    for(const point of ends){const uv=strokeUV(e,point,paper);if(Math.abs(uv[0])<=w&&Math.abs(uv[1])<=h)candidates.push({uv,id:e.id});}
  }
  return candidates;
}
// Screen-space tolerance keeps mouse/touch behavior independent of zoom.
// project returns null for clipped, behind-camera or back-facing candidates.
export function closestEndpoint(candidates,pointer,project,radius=14){
  let closest=null,distance=radius;
  for(const candidate of candidates){const screen=project(candidate.uv);if(!screen)continue;const d=Math.hypot(screen[0]-pointer[0],screen[1]-pointer[1]);if(d<=distance){closest={...candidate,screen};distance=d;}}
  return closest;
}
