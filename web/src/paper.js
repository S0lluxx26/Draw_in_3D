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
export function paperCoordinates(paper,world){const q=mul(rotate(world.map((v,i)=>v-paper.position[i]),-paper.yaw),1/paper.scale),b=basis(paper.normal);return [dot(q,b.u),dot(q,b.v),dot(q,b.n)];}
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
