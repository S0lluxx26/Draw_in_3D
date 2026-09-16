import * as THREE from 'three';
import { curve } from './model.js';
import { strokePaths } from './paths.js';
import { PAPER_TYPES, basis, worldPoint, paperCoordinates, rotate } from './paper.js';
const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
const sub = (a,b) => add(a,mul(b,-1));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => Math.hypot(...a) < .00001 ? [0,1,0] : mul(a,1/Math.hypot(...a));
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// Match java.util.Random and String.hashCode so spray/drips survive a round trip.
function randomFor(id) {
  let hash = 0; for (let i=0;i<id.length;i++) hash = (31*hash + id.charCodeAt(i)) | 0;
  let seed = (BigInt(hash) ^ 0x5deece66dn) & ((1n<<48n)-1n);
  return () => { seed = (seed*0x5deece66dn+11n) & ((1n<<48n)-1n); return Number(seed>>24n)/16777216; };
}
function rgba(argb, alpha) {
  const color = new THREE.Color(argb & 0xffffff);
  return [color.r,color.g,color.b,alpha];
}
class Builder {
  position=[]; color=[]; uv=[]; fall=[];
  vertex(p,c,u=0,v=0,fall=[0,0,0]) { this.position.push(...p.slice(0,3));this.color.push(...c);this.uv.push(u,v);this.fall.push(...fall); }
  tri(a,b,c,color) { for (const p of [a,b,c]) this.vertex(p,color); }
  tube(a,b,r,c,sides=6) {
    if (Math.hypot(...sub(b,a)) < .00001) return;
    const dir=norm(sub(b,a)), side=norm(cross(dir,Math.abs(dir[1])>.9?[1,0,0]:[0,1,0])), up=cross(dir,side);
    for (let j=0;j<sides;j++) {
      const t=j*Math.PI*2/sides,s=(j+1)*Math.PI*2/sides;
      const d1=add(mul(side,Math.cos(t)*r),mul(up,Math.sin(t)*r)),d2=add(mul(side,Math.cos(s)*r),mul(up,Math.sin(s)*r));
      this.tri(add(a,d1),add(b,d1),add(a,d2),c);this.tri(add(a,d2),add(b,d1),add(b,d2),c);
    }
  }
  dot(p,r,c) {
    const top=add(p,[0,r,0]),bottom=add(p,[0,-r,0]),ring=[[r,0,0],[0,0,r],[-r,0,0],[0,0,-r]];
    for(let j=0;j<4;j++){ this.tri(top,add(p,ring[j]),add(p,ring[(j+1)%4]),c);this.tri(bottom,add(p,ring[(j+1)%4]),add(p,ring[j]),c); }
  }
  finish() {
    const g=new THREE.BufferGeometry();
    for(const [key,array,size] of [['position',this.position,3],['color',this.color,4],['uv',this.uv,2],['fall',this.fall,3]]) g.setAttribute(key,new THREE.Float32BufferAttribute(array,size));
    g.computeBoundingSphere();if(g.boundingSphere)g.boundingSphere.radius+=.4;
    return g;
  }
}
function paperInk(m,e,paper){
  const profile=PAPER_TYPES[paper.paperKind],axes=basis(paper.normal),h=paper.panelWidth/paper.aspect;
  const wash=e.brush==='Water'||e.wet,spread=wash?profile.spread:1,alpha=e.alpha*(wash?profile.opacity:1)*(e.brush==='Marker'?.55:1),base=rgba(e.color,alpha),rand=randomFor(e.id);
  const vertex=(p,a=1,fall=[0,0])=>{
    const local=add(add(mul(axes.u,p[0]),mul(axes.v,p[1])),mul(axes.n,.003/paper.scale));
    const wp=worldPoint(paper,local),ep=mul(rotate(sub(wp,e.position),-e.yaw),1/e.scale);
    const fd=mul(rotate(rotate(add(mul(axes.u,fall[0]),mul(axes.v,fall[1])),paper.yaw),-e.yaw),paper.scale/e.scale);
    m.vertex(ep,[...base.slice(0,3),base[3]*a],.5+(p[0]+fall[0])/paper.panelWidth,.5-(p[1]+fall[1])/h,fd);
  };
  const ribbon=(a,b,r,fall=[0,0])=>{
    const dx=b[0]-a[0]+fall[0],dy=b[1]-a[1]+fall[1],len=Math.hypot(dx,dy);if(len<1e-8)return;
    const sx=-dy/len*r,sy=dx/len*r,stops=wash?[-1,-.65,.65,1]:[-1,-.9,.9,1],opacity=[0,1,1,0];
    for(let i=0;i<3;i++){const at=k=>[a[0]+sx*stops[k],a[1]+sy*stops[k]],bt=k=>[b[0]+sx*stops[k],b[1]+sy*stops[k]];
      vertex(at(i),opacity[i]);vertex(bt(i),opacity[i],fall);vertex(at(i+1),opacity[i+1]);vertex(at(i+1),opacity[i+1]);vertex(bt(i),opacity[i],fall);vertex(bt(i+1),opacity[i+1],fall);}
  };
  const stamp=(p,r)=>{for(let j=0;j<12;j++){const a=j*Math.PI/6,b=(j+1)*Math.PI/6;vertex(p);vertex([p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r],0);vertex([p[0]+Math.cos(b)*r,p[1]+Math.sin(b)*r],0);}};
  const paths=strokePaths(e).map(path=>path.map(p=>[...paperCoordinates(paper,worldPoint(e,p)).slice(0,2),p[3]]));
  for(const path of paths)for(let i=0;i<path.length;i++){const p=path[i],r=e.width*.5*p[2]*e.scale/paper.scale*spread*(e.brush==='Marker'?1.8:1);
    if(e.brush==='Spray')for(let j=0;j<3;j++)stamp([p[0]+(rand()-.5)*r*5,p[1]+(rand()-.5)*r*5],r*.4);
    else if(i)ribbon(path[i-1],p,r);else stamp(p,r);
    if(i===path.length-1&&path.length>1&&e.brush!=='Spray')stamp(p,r);
  }
  if(e.wet&&profile.runoff){const points=paths.flat(),gravity=rotate([0,-1,0],-paper.yaw),gx=dot(gravity,axes.u),gy=dot(gravity,axes.v),speed=Math.hypot(gx,gy),count=Math.min(8,Math.max(1,Math.floor(points.length/10)));
    if(speed>.05)for(let i=0;i<count;i++){const p=points[Math.floor(i*(points.length-1)/Math.max(1,count-1))],length=(.08+rand()*.22)/paper.scale;ribbon(p,p,e.width*(.12+rand()*.2)*e.scale/paper.scale,[gx*length,gy*length]);}
  }
}
export function geometry(e,paper) {
  const m=new Builder();
  if(e.type==='paper'){
    const axes=basis(e.normal),w=e.panelWidth/2,h=w/e.aspect,c=[1,1,1,1];
    for(const [x,y] of [[-1,1],[-1,-1],[1,1],[1,1],[-1,-1],[1,-1]])m.vertex(add(mul(axes.u,x*w),mul(axes.v,y*h)),c,(x+1)/2,(1-y)/2);
  }else if(e.type==='stroke'&&paper){paperInk(m,e,paper);
  }else if(e.type==='image'){
    const steps=Math.max(1,Math.floor(e.arc/5)),h=e.panelWidth/e.aspect,c=[1,1,1,e.alpha];
    for(let i=0;i<steps;i++){
      const u=i/steps,v=(i+1)/steps,a=curve(u,e.panelWidth,e.arc),b=curve(v,e.panelWidth,e.arc);
      const at=[a[0],h/2,a[2]],ab=[a[0],-h/2,a[2]],bt=[b[0],h/2,b[2]],bb=[b[0],-h/2,b[2]];
      m.vertex(at,c,u,0);m.vertex(ab,c,u,1);m.vertex(bt,c,v,0);m.vertex(bt,c,v,0);m.vertex(ab,c,u,1);m.vertex(bb,c,v,1);
    }
  }else if(e.type==='block'){
    const [x,y,z]=e.size.map(v=>v/2),corners=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
    const faces=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]],shades=[.7,1,.76,.87,1.1,.55];
    faces.forEach((face,i)=>{const c=rgba(e.color,e.alpha);for(let j=0;j<3;j++)c[j]*=shades[i];m.tri(corners[face[0]],corners[face[1]],corners[face[2]],c);m.tri(corners[face[0]],corners[face[2]],corners[face[3]],c);});
  }else if(e.type==='stroke'){
    let alpha=e.alpha;if(e.brush==='Marker')alpha*=.55;if(e.brush==='Water')alpha*=.6;
    const neon=e.brush==='Neon',spray=e.brush==='Spray',c=rgba(e.color,neon?alpha*.3:alpha),rand=randomFor(e.id);
    const paths=strokePaths(e),visible=paths.flat();
    for(const path of paths)for(let i=0;i<path.length;i++){
      const p=path[i],r=e.width*.5*p[3];
      if(spray)for(let j=0;j<3;j++)m.dot(add(p,[(rand()-.5)*e.width*3,(rand()-.5)*e.width*3,(rand()-.5)*e.width]),r*.18,c);
      else if(i>0){m.tube(path[i-1],p,r*(e.brush==='Marker'?1.8:1),c);if(neon)m.tube(path[i-1],p,r*.35,[.95,1,1,alpha],4);}
      else m.dot(p,r,c);
    }
    if(e.wet){
      const gravity=e.surface?sub([0,-1,0],mul(e.normal,dot([0,-1,0],e.normal))):[0,-1,0],speed=Math.hypot(...gravity);
      if(speed>.05){
        const dir=norm(gravity),side=norm(cross(dir,e.normal)),count=Math.min(8,Math.max(1,Math.floor(visible.length/10)));
        for(let j=0;j<count;j++){
          const p=visible[Math.floor(j*(visible.length-1)/Math.max(1,count-1))],w=e.width*(.12+rand()*.2);
          const l=add(p,mul(side,-w)),r=add(p,mul(side,w)),fall=mul(dir,Math.min(.3,.08+rand()*.22)*speed);
          m.vertex(l,c);m.vertex(r,c);m.vertex(l,c,0,0,fall);m.vertex(r,c);m.vertex(r,c,0,0,fall);m.vertex(l,c,0,0,fall);
        }
      }
    }
  }else{
    const c=rgba(e.color,1);
    for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;m.tube([.16*Math.cos(a),.16*Math.sin(a),0],[.16*Math.cos(b),.16*Math.sin(b),0],.018,c,4);}
    if(e.type==='start')m.tri([-.05,-.075,0],[.085,0,0],[-.05,.075,0],c);
    if(e.type==='goal'){m.tube([-.07,-.07,0],[.07,.07,0],.013,c,4);m.tube([-.07,.07,0],[.07,-.07,0],.013,c,4);}
  }
  return m.finish();
}
export function material(e,texture) {
  const transparent=!!e.paperId||e.type==='image'||e.alpha<1||['Marker','Water','Neon'].includes(e.brush);
  const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent,depthWrite:!transparent,map:texture||null,toneMapped:false});
  const growth={value:1};
  m.onBeforeCompile=shader=>{
    shader.uniforms.wetGrowth=growth;
    shader.vertexShader='attribute vec3 fall; uniform float wetGrowth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += fall * wetGrowth;');
    if(e.paperId)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) discard;');
  };
  m.customProgramCacheKey=()=>e.paperId?'paper-ink':'scene';
  m.userData.growth=growth;
  return m;
}
