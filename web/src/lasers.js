// Stage lasers for takeoff and landing: beams from the back of the launch deck light the fleet's climb and its
// return, and stay dark while formations and fireworks are in the sky. Cued by the show's music sections; timing
// is pure (laserBeam), so seeking and recording agree. LaserRig billboards each beam toward the camera as an
// additive HDR ribbon for the bloom pass.
import * as THREE from 'three';
import {musicPlan,BEAT,BAR} from './show-music.js';

export const LASER_COUNT=10;
const PALETTE=[[0,1,.85],[1,.12,.75],[.25,1,.2],[1,.7,.08],[.3,.45,1]];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

// Beam e of n at show time t: tilt from vertical across the view, lean back away from the audience, power and colour.
export function laserBeam(sections,t,e,n){
  const sec=sections.find(s=>t<s.end)||sections.at(-1),lt=t-sec.start,p=clamp(lt/(sec.end-sec.start)),across=n>1?e/(n-1)-.5:0;
  const beat=(lt%BEAT)/BEAT,bar=Math.floor(lt/BAR),edge=clamp(Math.min(lt,sec.end-t)/.4),pick=k=>PALETTE[(k%PALETTE.length+PALETTE.length)%PALETTE.length];
  let tilt=across*1.2,lean=.3,power=0,color=PALETTE[0];
  switch(sec.mood){
    case 'lift':{// takeoff: a vertical tunnel that fans open and pulses on the beat as the fleet climbs
      const pattern=bar%2;tilt=pattern?(e%2?1:-1)*(.2+.3*p)+across*.3:across*(.2+1.1*p)+.08*Math.sin(lt*Math.PI*2/BAR);
      lean=.1+.15*p;power=(.35+.5*p)*(.7+.3*Math.exp(-beat*5));color=pick(bar+(e%2));break;}
    case 'outro':{// returning home and landing: slow sweeps that settle back to vertical and fade as the drones touch down
      const settle=clamp(1-p*1.15);tilt=across*1.3*settle+.3*settle*Math.sin(lt*.9+e*.7);lean=.12+.25*settle;
      power=.75*clamp(lt/2)*clamp((1-p)*3);color=[PALETTE[4],PALETTE[0]][e%2];break;}
  }// formations, fireworks and the close-ups keep the sky for the drones
  return {tilt,lean,power:power*edge,color};// blanked around each cue change, like a real laser show
}

const VERTEX='attribute vec2 beam;attribute vec3 color;varying vec2 vBeam;varying vec3 vColor;void main(){vBeam=beam;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
// Clamped: interpolation can push these a hair outside [0,1], and pow() of a negative is NaN on Direct3D,
// which the bloom blur would spread over the whole frame.
const FRAGMENT=`varying vec2 vBeam;varying vec3 vColor;void main(){float a=clamp(1.-abs(vBeam.y),0.,1.),core=pow(a,5.)+.3*pow(a,1.5),along=pow(clamp(1.-vBeam.x,0.,1.),1.4)*smoothstep(0.,.015,vBeam.x+.004);
  gl_FragColor=vec4(vColor*core*along,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export class LaserRig{
  constructor(show,scale,{bloom=true}={}){
    // Emitters line the back of the launch deck and lean away, so the beams are a backdrop behind every formation.
    const n=LASER_COUNT,xs=show.home.map(p=>p[0]),zs=show.home.map(p=>p[2]),span=Math.max(...xs)-Math.min(...xs),mid=(Math.max(...xs)+Math.min(...xs))/2,back=Math.min(...zs)-span*.06;
    Object.assign(this,{show,scale,n,sections:musicPlan(show).sections,gain:bloom?2:1,length:520*scale,near:.45*scale,far:7.5*scale});// wide enough never to break into sub-pixel dots
    this.origins=Array.from({length:n},(_,e)=>new THREE.Vector3(mid+(e/(n-1)-.5)*span*1.15,.6*scale,back));
    const geometry=new THREE.BufferGeometry(),beam=new Float32Array(n*8),index=[];
    for(let e=0;e<n;e++){beam.set([0,-1,0,1,1,1,1,-1],e*8);index.push(e*4,e*4+1,e*4+2,e*4,e*4+2,e*4+3);}
    this.positions=new Float32Array(n*12);this.colors=new Float32Array(n*12);
    geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('beam',new THREE.BufferAttribute(beam,2));geometry.setIndex(index);
    this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    this.mesh.frustumCulled=false;this.mesh.renderOrder=1;
    this.dir=new THREE.Vector3();this.side=new THREE.Vector3();this.view=new THREE.Vector3();this.end=new THREE.Vector3();
  }
  // height = drawing-buffer height in pixels. Each end is at least ~1.4 px wide, dimmed to match, so distant
  // beams stay continuous lines instead of breaking into dots (and never turn into thick bright bars).
  update(time,camera,height=720){
    const {n,positions:P,colors:C}=this,pixel=2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height)*1.4;
    for(let e=0;e<n;e++){
      const b=laserBeam(this.sections,time,e,n),o=this.origins[e];
      this.dir.set(Math.sin(b.tilt),Math.cos(b.tilt),-b.lean).normalize();this.end.copy(o).addScaledVector(this.dir,this.length);
      this.side.crossVectors(this.dir,this.view.subVectors(camera.position,o));if(this.side.lengthSq()<1e-12)this.side.set(1,0,0);this.side.normalize();// the ribbon faces the camera
      const s=this.side,w0=Math.max(this.near,o.distanceTo(camera.position)*pixel),w1=Math.max(this.far,this.end.distanceTo(camera.position)*pixel),k=e*12;
      P.set([o.x-s.x*w0,o.y-s.y*w0,o.z-s.z*w0,o.x+s.x*w0,o.y+s.y*w0,o.z+s.z*w0,this.end.x+s.x*w1,this.end.y+s.y*w1,this.end.z+s.z*w1,this.end.x-s.x*w1,this.end.y-s.y*w1,this.end.z-s.z*w1],k);
      for(let v=0;v<4;v++){const g=b.power*this.gain*(v<2?this.near/w0:this.far/w1);C.set([b.color[0]*g,b.color[1]*g,b.color[2]*g],k+v*3);}
    }
    this.mesh.geometry.attributes.position.needsUpdate=true;this.mesh.geometry.attributes.color.needsUpdate=true;
  }
}
