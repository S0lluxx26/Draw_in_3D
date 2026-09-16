export const PAPER_TYPES={
  watercolor:{name:'Watercolor · cold press',description:'Soft washes and fine pigment grain.',tint:0xfff1e6d1,spread:1.35,opacity:.72,grain:.55,runoff:0},
  rough:{name:'Watercolor · rough',description:'More tooth, broken colour and wider soft edges.',tint:0xffe9dcc3,spread:1.6,opacity:.64,grain:.85,runoff:0},
  sketch:{name:'Sketch paper',description:'Fine fibres and a crisp, dry mark.',tint:0xfff5eedf,spread:1,opacity:.95,grain:.22,runoff:0},
  canvas:{name:'Woven canvas',description:'A visible weave catches the paint.',tint:0xffe7d8b8,spread:1.08,opacity:.9,grain:.6,runoff:0},
  coated:{name:'Coated · water resistant',description:'Smooth surface, crisp pigment and optional running paint.',tint:0xffe4edf0,spread:.92,opacity:.94,grain:.08,runoff:1}
};
export const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>mul(a,1/Math.hypot(...a));
export function rotate(p,yaw){const a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];}
export function basis(normal){const n=norm(normal),u=norm(cross(Math.abs(n[1])>.95?[0,0,-1]:[0,1,0],n));return {u,v:cross(n,u),n};}
export function worldPoint(e,p){return add(e.position,rotate(mul(p.slice(0,3),e.scale),e.yaw));}
// Sheet coordinates are metres on the UNROLLED sheet. Bend never rewrites ink.
export function paperAxes(paper){
  const b=basis(paper.normal),p=(paper.pitch||0)*Math.PI/180,r=(paper.roll||0)*Math.PI/180;
  const combine=q=>add(add(mul(b.u,q[0]),mul(b.v,q[1])),mul(b.n,q[2]));
  return {u:combine([Math.cos(r),Math.sin(r),0]),v:combine([-Math.sin(r)*Math.cos(p),Math.cos(r)*Math.cos(p),Math.sin(p)]),n:combine([Math.sin(r)*Math.sin(p),-Math.cos(r)*Math.sin(p),Math.cos(p)])};
}
export function bendPoint(paper,p,offset=0){const k=(paper.bend||0)*Math.PI/180/paper.panelWidth,t=p[0]*k;if(Math.abs(k)<1e-6)return [p[0],p[1],offset];return [Math.sin(t)/k-Math.sin(t)*offset,p[1],2*Math.sin(t/2)**2/k+Math.cos(t)*offset];}
export function surfaceWorld(paper,p,offset=0){const q=bendPoint(paper,p,offset),b=paperAxes(paper);return worldPoint(paper,add(add(mul(b.u,q[0]),mul(b.v,q[1])),mul(b.n,q[2])));}
export function paperLocal(paper,world){const q=mul(rotate(world.map((v,i)=>v-paper.position[i]),-paper.yaw),1/paper.scale),b=paperAxes(paper);return [dot(q,b.u),dot(q,b.v),dot(q,b.n)];}
export function paperCoordinates(paper,world){const q=paperLocal(paper,world),k=(paper.bend||0)*Math.PI/180/paper.panelWidth;return Math.abs(k)<1e-6?q:[Math.atan2(q[0]*k,1-q[2]*k)/k,q[1],0];}
export function strokeUV(e,p,paper){if(e.pointSpace!=='surface')return paperCoordinates(paper,worldPoint(e,p));const a=e.yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [e.position[0]+e.scale*(p[0]*c-p[1]*s),e.position[1]+e.scale*(p[0]*s+p[1]*c),0];}
export function localizeStroke(e,paper){if(e.pointSpace==='surface')return e;return {...e,pointSpace:'surface',position:[0,0,0],normal:[0,0,1],yaw:0,width:e.width/paper.scale,points:e.points.map(p=>{const uv=strokeUV(e,p,paper);return [uv[0]/e.scale,uv[1]/e.scale,0,p[3]];})};}
export function localizePapers(entities,ids){return entities.map(e=>e.paperId&&ids.has(e.paperId)?localizeStroke(e,entities.find(p=>p.id===e.paperId)):e);}
// Analytic intersections avoid drawing on the invisible flat chord of a bent sheet.
export function hitPaper(paper,origin,direction){
  const o=paperLocal(paper,origin),end=paperLocal(paper,add(origin,direction)),d=end.map((v,i)=>v-o[i]),k=(paper.bend||0)*Math.PI/180/paper.panelWidth;
  let roots=[];
  if(Math.abs(k)<1e-6){if(Math.abs(d[2])>1e-10)roots=[-o[2]/d[2]];}
  else{const a=k*(d[0]*d[0]+d[2]*d[2]),b=2*(k*(o[0]*d[0]+o[2]*d[2])-d[2]),c=k*(o[0]*o[0]+o[2]*o[2])-2*o[2],disc=b*b-4*a*c;if(Math.abs(a)>1e-14&&disc>=0){const q=-.5*(b+Math.sign(b||1)*Math.sqrt(disc));roots=Math.abs(q)>1e-14?[q/a,c/q]:[-b/(2*a)];}}
  for(const t of roots.sort((a,b)=>a-b)){if(t<0)continue;const q=add(o,mul(d,t)),u=Math.abs(k)<1e-6?q[0]:Math.atan2(q[0]*k,1-q[2]*k)/k;if(Math.abs(u)<=paper.panelWidth/2+1e-6&&Math.abs(q[1])<=paper.panelWidth/paper.aspect/2+1e-6){const angle=u*k;if(-Math.sin(angle)*d[0]+Math.cos(angle)*d[2]>=-1e-9)return null;return {uv:[u,q[1],0],world:add(origin,mul(direction,t)),distance:t};}}
  return null;
}
// Render-only subdivision: sparse lines also follow curvature, with a fixed budget.
export function subdivideSurface(paths,paper,budget=1536){
  if(Math.abs(paper.bend||0)<1e-4)return paths;
  const total=paths.reduce((n,p)=>n+p.length,0),length=paths.reduce((n,p)=>n+p.slice(1).reduce((s,q,i)=>s+Math.abs(q[0]-p[i][0]),0),0),step=Math.max(paper.panelWidth*3/Math.max(1,Math.abs(paper.bend||0)),length/Math.max(1,budget-total));
  return paths.map(path=>path.flatMap((b,i)=>{if(!i)return [b];const a=path[i-1],n=Math.max(1,Math.ceil(Math.abs(b[0]-a[0])/step));return Array.from({length:n},(_,j)=>a.map((v,k)=>v+(b[k]-v)*(j+1)/n));}));
}
export function insidePaper(paper,world,margin=0){const [x,y]=paperCoordinates(paper,world);return Math.abs(x)<=paper.panelWidth/2-margin&&Math.abs(y)<=paper.panelWidth/paper.aspect/2-margin;}
export function attachedIds(entities,ids){const expanded=new Set(ids);for(const e of entities)if(e.paperId&&ids.has(e.paperId))expanded.add(e.id);return expanded;}
// Integer hash is identical in Java; textures are generated locally once per preset.
export function grainAt(kind,x,y){let h=Math.imul(x,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;const n=(h>>>0)/4294967295;
  if(kind==='canvas')return Math.min(1,n*.3+(x%8<2||y%8<2?.1:.7));
  if(kind==='sketch')return .55+n*.35+(y%17===0?-.25:0);
  if(kind==='coated')return .88+n*.12;
  return n;
}
export function paperPixels(kind,ink=false){const profile=PAPER_TYPES[kind],size=256,pixels=new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,n=grainAt(kind,x,y),shade=ink?1:1-profile.grain*(1-n)*.2;
    for(let k=0;k<3;k++)pixels[i+k]=Math.round((ink?255:(profile.tint>>((2-k)*8))&255)*shade);
    pixels[i+3]=ink?Math.round(255*(1-profile.grain*(1-n)*.85)):255;
  }return {pixels,size};
}
