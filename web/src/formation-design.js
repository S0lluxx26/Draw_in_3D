// Pure geometry for the 2D formation designer (no DOM): the full-stage drawing sheet and its exact stage <-> sheet
// mapping, shape outlines, filled shapes, a single-stroke font, pen smoothing, hit tests and transforms.
// Everything the designer draws is ordinary sheet ink, so show files, Run and the 3D workspace all read it unchanged.
import {entity,LIMITS} from './model.js';
import {drawingPaths,placePaths} from './drone-show.js';

// The playable sky stage in stage units (Run multiplies by the show's scale: 6 m per unit in the Demo look).
export const STAGE=Object.freeze({minX:-34,maxX:34,minY:2,maxY:46});
// One hidden 3.4 m sheet covers the whole stage; with this placement a sheet point (u,v) is stage point (20u, 20v+24).
export const designPlacement=()=>({origin:[0,1.4,0],scale:20,position:[0,24,0],yaw:0});
const SHEET={panelWidth:3.4,aspect:3.4/2.2,position:[0,1.4,0]};
export const toSheet=([x,y])=>[x/20,(y-24)/20,0,1];
export const toStage=p=>[p[0]*20,p[1]*20+24];
export function designPaper(){return {...entity('paper'),paperName:'Sky stage',panelWidth:SHEET.panelWidth,aspect:SHEET.aspect,position:[...SHEET.position],paperVisible:false};}
// Show files store sheet sizes in single precision, so compare with a tolerance.
const near=(a,b)=>Math.abs(a-b)<1e-5,same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>near(v,b[i]));

// Whether the designer can edit this formation exactly: one flat full-stage sheet, ink on that sheet, fixed placement.
export function isDesign(cue){
  if(!cue||cue.library)return false;
  const p=cue.placement,d=designPlacement();
  if(!p||!same(p.origin,d.origin)||!same(p.position,d.position)||p.scale!==d.scale||p.yaw)return false;
  const papers=cue.artwork.filter(e=>e.type==='paper');if(papers.length!==1)return false;
  const s=papers[0];
  if(!near(s.panelWidth,SHEET.panelWidth)||!near(s.aspect,SHEET.aspect)||s.bend||s.pitch||s.roll||s.yaw||!near(s.scale,1)||!same(s.position,SHEET.position)||!same(s.normal,[0,0,1]))return false;
  return cue.artwork.every(e=>e.type==='paper'||e.type==='stroke'&&e.paperId===s.id&&e.pointSpace==='surface'&&!e.yaw&&near(e.scale,1)&&same(e.position,[0,0,0]));
}
// The formation's ink as stage polylines: [{id, color (ARGB int), points: [[x,y],…]}].
export const designStrokes=cue=>cue.artwork.filter(e=>e.type==='stroke').map(e=>({id:e.id,color:e.color,...(e.designGroup?{group:e.designGroup}:{}),points:e.points.map(toStage)}));
export function designArtwork(paper,strokes){
  return [paper,...strokes.filter(s=>s.points.length>1).map(s=>({...entity('stroke'),id:s.id||crypto.randomUUID(),...(s.group?{designGroup:s.group}:{}),paperId:paper.id,pointSpace:'surface',color:s.color,points:s.points.map(toSheet)}))];
}
export const argb=([r,g,b])=>(0xff000000|Math.round(r*255)<<16|Math.round(g*255)<<8|Math.round(b*255))|0;
export const cssColor=c=>'#'+(c&0xffffff).toString(16).padStart(6,'0');
export const colorOf=hex=>(0xff000000|parseInt(hex.slice(1),16))|0;
// Any other drawing (3D workspace ink, curved sheets), flattened onto the stage exactly as Run places it.
export function flattenArtwork(cue){
  const paths=placePaths(drawingPaths(cue.artwork),cue.placement);
  return designArtwork(designPaper(),paths.map(p=>({color:argb(p.color),points:limitPoints(p.points.map(q=>[q[0],q[1]]))})));
}
export const blankDesign=()=>({artwork:[designPaper()],placement:designPlacement()});

// ---- shapes ----
function normalize(points){// fit to the box [-1,1]²
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  return points.map(([x,y])=>[(x-x0)/((x1-x0)/2||1)-1,(y-y0)/((y1-y0)/2||1)-1]);
}
const UNIT={
  rect:()=>[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]],
  ellipse:()=>Array.from({length:73},(_,i)=>{const a=i/72*2*Math.PI;return [Math.cos(a),Math.sin(a)];}),
  heart:()=>normalize(Array.from({length:97},(_,i)=>{const t=i/96*2*Math.PI;return [16*Math.sin(t)**3,13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)];})),
  star:()=>normalize(Array.from({length:11},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?.42:1;return [r*Math.cos(a),r*Math.sin(a)];})),
};
export const SHAPES=Object.keys(UNIT);
// A closed outline filling the box dragged from a to b (square: equal width and height).
export function shapeOutline(kind,a,b,{square=false}={}){
  let [x0,y0]=a,[x1,y1]=b;
  if(square){const d=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));x1=x0+(x1<x0?-d:d);y1=y0+(y1<y0?-d:d);}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.abs(x1-x0)/2,ry=Math.abs(y1-y0)/2;
  return UNIT[kind]().map(([u,v])=>[cx+u*rx,cy+v*ry]);
}
// A filled shape: the outline plus concentric rings toward its centre, evenly spaced, so the drones spread over the area.
export function filledShape(outline,gap=1.6){
  const b=bounds([{points:outline}]),c=[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2];
  const r=Math.max(...outline.map(p=>Math.hypot(p[0]-c[0],p[1]-c[1]))),n=Math.max(1,Math.min(12,Math.round(r/gap)));
  const rings=[outline];
  for(let k=1;k<n;k++){const f=1-k/n,step=Math.max(1,Math.round(1/Math.max(f,.25)));
    rings.push(outline.filter((_,i)=>i%step===0||i===outline.length-1).map(([x,y])=>[c[0]+(x-c[0])*f,c[1]+(y-c[1])*f]));}
  return rings;
}

// ---- single-stroke font (4 × 6 cells, y up) ----
const O=(cx,cy,rx,ry,n=24)=>Array.from({length:n+1},(_,i)=>{const a=i/n*2*Math.PI;return [cx+rx*Math.cos(a),cy+ry*Math.sin(a)];});
const DOT=y=>[[1.75,y],[2.25,y]];
const GLYPHS={
  A:[[[0,0],[2,6],[4,0]],[[.7,2.1],[3.3,2.1]]],B:[[[0,3.1],[2.8,3.1],[3.6,3.8],[3.6,5.2],[2.8,6],[0,6],[0,0],[3,0],[3.9,.8],[3.9,2.3],[2.8,3.1]]],
  C:[[[4,5],[3.2,5.9],[1.2,5.9],[.2,4.8],[0,3],[.2,1.2],[1.2,.1],[3.2,.1],[4,1]]],D:[[[0,0],[0,6],[2.2,6],[3.6,4.8],[4,3],[3.6,1.2],[2.2,0],[0,0]]],
  E:[[[4,6],[0,6],[0,0],[4,0]],[[0,3],[3,3]]],F:[[[4,6],[0,6],[0,0]],[[0,3],[3,3]]],
  G:[[[4,5],[3.2,5.9],[1.2,5.9],[.2,4.8],[0,3],[.2,1.2],[1.2,.1],[3.2,.1],[4,1],[4,2.8],[2.4,2.8]]],H:[[[0,0],[0,6]],[[4,0],[4,6]],[[0,3],[4,3]]],
  I:[[[1,6],[3,6]],[[2,6],[2,0]],[[1,0],[3,0]]],J:[[[1.6,6],[4,6],[4,1.4],[3,0],[1,0],[0,1.4]]],K:[[[0,0],[0,6]],[[4,6],[0,2.4]],[[1.3,3.5],[4,0]]],
  L:[[[0,6],[0,0],[4,0]]],M:[[[0,0],[0,6],[2,2.5],[4,6],[4,0]]],N:[[[0,0],[0,6],[4,0],[4,6]]],O:[O(2,3,2,3)],
  P:[[[0,0],[0,6],[3,6],[4,5.1],[4,3.9],[3,3],[0,3]]],Q:[O(2,3,2,3),[[2.6,1.2],[4.2,-.4]]],R:[[[0,0],[0,6],[3,6],[4,5.1],[4,3.9],[3,3],[0,3]],[[2,3],[4,0]]],
  S:[[[4,5],[3.2,5.9],[.9,5.9],[.1,5],[.2,3.9],[1,3.2],[3,2.8],[3.9,2.1],[4,1],[3.2,.1],[.8,.1],[0,1]]],T:[[[0,6],[4,6]],[[2,6],[2,0]]],
  U:[[[0,6],[0,1.4],[1,.1],[3,.1],[4,1.4],[4,6]]],V:[[[0,6],[2,0],[4,6]]],W:[[[0,6],[1,0],[2,4],[3,0],[4,6]]],X:[[[0,6],[4,0]],[[4,6],[0,0]]],
  Y:[[[0,6],[2,3],[4,6]],[[2,3],[2,0]]],Z:[[[0,6],[4,6],[0,0],[4,0]]],
  0:[O(2,3,1.8,3),[[.6,1],[3.4,5]]],1:[[[.8,4.8],[2,6],[2,0]],[[.8,0],[3.2,0]]],2:[[[.1,4.9],[1,5.9],[3,5.9],[3.9,4.9],[3.9,3.9],[0,0],[4,0]]],
  3:[[[.2,5.3],[1,5.95],[3,5.95],[3.8,5.1],[3.8,4],[3,3.2],[1.4,3.2]],[[3,3.2],[3.9,2.3],[3.9,1],[3,.05],[1,.05],[.1,.8]]],4:[[[3,0],[3,6],[0,1.8],[4,1.8]]],
  5:[[[3.8,6],[.4,6],[.2,3.3],[1,3.7],[2.8,3.7],[3.9,2.7],[3.9,1.1],[3,.05],[1,.05],[.1,.8]]],
  6:[[[3.6,5.5],[2.6,6],[1.2,5.9],[.2,4.6],[0,2.8],[.1,1.1],[1,.05],[3,.05],[3.9,1],[3.9,2.4],[3,3.4],[1.1,3.4],[.1,2.4]]],7:[[[0,6],[4,6],[1.4,0]]],
  8:[O(2,4.55,1.6,1.45,20),O(2,1.55,1.9,1.55,20)],9:[[[3.9,3.6],[3,2.6],[1,2.6],[.1,3.6],[.1,5],[1,5.95],[3,5.95],[3.9,5],[3.9,3.2],[3.7,1.3],[2.8,.05],[1.2,.05],[.4,.5]]],
  '!':[[[2,6],[2,1.8]],DOT(.1)],'?':[[[.2,4.8],[1,5.9],[3,5.9],[3.9,4.9],[3.9,3.9],[2,2.6],[2,1.6]],DOT(.1)],'.':[DOT(.1)],',':[[[2.2,.4],[1.6,-.8]]],
  '-':[[[.6,3],[3.4,3]]],'+':[[[.4,3],[3.6,3]],[[2,1.4],[2,4.6]]],"'":[[[2,6],[2,4.8]]],':':[DOT(4),DOT(1)],'♥':[shapeOutline('heart',[0,.5],[4,5.5])],
};
// Letters the font can draw: accents fold away (Hà → HA, Đ → D); anything else becomes a space.
export function foldText(text){return text.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[đĐ]/g,'D').toUpperCase().split('').map(ch=>GLYPHS[ch]||ch==='♥'?ch:' ').join('');}
// Polylines for `text`, centred on (x,y), `height` stage units tall.
export function textStrokes(text,[x,y],height=6){
  const chars=[...foldText(text)],k=height/6,advance=5.4*k,bottom=y-height/2;
  const lines=chars.flatMap((ch,i)=>(GLYPHS[ch]||[]).map(line=>line.map(([gx,gy])=>[i*advance+gx*k,bottom+gy*k])));
  if(!lines.length)return lines;const b=bounds(lines.map(points=>({points})));// centre the ink itself on x
  return lines.map(line=>line.map(([px,py])=>[px-b.cx+x,py]));
}

// ---- pen, hit tests, transforms ----
function rdp(points,tolerance){
  if(points.length<3)return points;
  const [a,b]=[points[0],points.at(-1)];let index=0,worst=0;
  for(let i=1;i<points.length-1;i++){const d=segmentDistance(points[i],a,b);if(d>worst){worst=d;index=i;}}
  return worst<=tolerance?[a,b]:[...rdp(points.slice(0,index+1),tolerance).slice(0,-1),...rdp(points.slice(index),tolerance)];
}
// A freehand line kept smooth but light: near-duplicate points removed, then simplified within `tolerance`.
export function simplify(points,tolerance=.06){
  const kept=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>tolerance/3);
  return limitPoints(rdp(kept,tolerance));
}
export function limitPoints(points,max=LIMITS.stroke){if(points.length<=max)return points;const step=(points.length-1)/(max-1);return Array.from({length:max},(_,i)=>points[Math.round(i*step)]);}
export function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
export const strokeDistance=(p,points)=>points.length===1?Math.hypot(p[0]-points[0][0],p[1]-points[0][1]):Math.min(...points.slice(1).map((q,i)=>segmentDistance(p,points[i],q)));
// The top-most stroke within `tolerance` of p, or -1.
export function hitStroke(strokes,p,tolerance){let best=-1,d=tolerance;for(let i=strokes.length-1;i>=0;i--){const e=strokeDistance(p,strokes[i].points);if(e<d){d=e;best=i;}}return best;}
export function bounds(strokes){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const s of strokes)for(const [x,y] of s.points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return {minX,minY,maxX,maxY,cx:(minX+maxX)/2,cy:(minY+maxY)/2,width:maxX-minX,height:maxY-minY};
}
export const translate=(dx,dy)=>([x,y])=>[x+dx,y+dy];
export const scaleAbout=([cx,cy],kx,ky=kx)=>([x,y])=>[cx+(x-cx)*kx,cy+(y-cy)*ky];
export const rotateAbout=([cx,cy],a)=>{const c=Math.cos(a),s=Math.sin(a);return ([x,y])=>[cx+(x-cx)*c-(y-cy)*s,cy+(x-cx)*s+(y-cy)*c];};
export const mapStrokes=(strokes,fn)=>strokes.map(s=>({...s,points:s.points.map(fn)}));
export const mirrored=(strokes,axis=0)=>strokes.map(s=>({...s,id:undefined,points:s.points.map(([x,y])=>[2*axis-x,y])}));
export const snapPoint=([x,y],step=1)=>[Math.round(x/step)*step,Math.round(y/step)*step];
// Scale and centre the drawing into a comfortable part of the stage (keeps its proportions).
export function fitStrokes(strokes,box={width:44,height:30,cx:0,cy:24}){
  const b=bounds(strokes);if(!Number.isFinite(b.width))return strokes;
  const k=Math.min(box.width/Math.max(b.width,1e-6),box.height/Math.max(b.height,1e-6));
  return mapStrokes(strokes,([x,y])=>[box.cx+(x-b.cx)*k,box.cy+(y-b.cy)*k]);
}
// Whether the ink is inside the playable stage (ink outside is cut off by the stage edge).
export const insideStage=strokes=>strokes.every(s=>s.points.every(([x,y])=>x>=STAGE.minX-1e-9&&x<=STAGE.maxX+1e-9&&y>=STAGE.minY-1e-9&&y<=STAGE.maxY+1e-9));
// Budget per formation (the drawing limits of a project): objects and points.
export function budget(strokes){return {strokes:strokes.length,points:strokes.reduce((n,s)=>n+s.points.length,0),maxStrokes:LIMITS.objects-1,maxPoints:LIMITS.points};}
