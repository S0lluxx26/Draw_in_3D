// Stage lasers: beams from the back of the launch deck, cued by the show's music sections. Build-ups sweep and
// brighten, formation drops fan / crisscross / wave on the beat, drone fireworks crisscross in rainbow colours,
// and the beams rest for the launch-pad close-ups and the landing. Timing is pure (laserBeam), so seeking and
// recording agree; LaserRig billboards each beam toward the camera as an additive HDR ribbon for the bloom pass.
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
    case 'lift':tilt=across*.55*p;lean=.12;power=.3*p;color=PALETTE[4];break;// a rising light tunnel as the drones take off
    case 'build':tilt=across*1.1+.28*Math.sin(lt*1.6+e*.6);lean=.25+.2*p;power=.15+.6*p;color=pick(Math.round(sec.start));break;
    case 'drop':case 'peak':{
      const peak=sec.mood==='peak',speed=Math.PI*2*(peak?2:1)/BAR,pattern=(bar+(sec.index||0))%3;
      tilt=pattern===0?across*1.5+.22*Math.sin(lt*speed)// fan, swaying
        :pattern===1?(e%2?1:-1)*(.35+.4*Math.sin(lt*speed))+across*.4// crisscross
        :.75*Math.sin(lt*speed+e*.8);// wave
      lean=.28+.12*Math.sin(lt*.9+e);power=.55+.45*Math.exp(-beat*5);color=peak?pick(e+bar):pick(bar+(sec.index||0));break;
    }
    case 'spark':tilt=across*1.6;lean=.2+.5*p;power=.35*(1-p);color=PALETTE[3];break;// beams sink with the falling sparks
  }
  return {tilt,lean,power:power*edge,color};// blanked around each cue change, like a real laser show
}

const VERTEX='attribute vec2 beam;attribute vec3 color;varying vec2 vBeam;varying vec3 vColor;void main(){vBeam=beam;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const FRAGMENT=`varying vec2 vBeam;varying vec3 vColor;void main(){float a=1.-abs(vBeam.y),core=pow(a,5.)+.3*pow(a,1.5),along=pow(1.-vBeam.x,1.4)*smoothstep(0.,.015,vBeam.x+.004);
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
      this.side.crossVectors(this.dir,this.view.subVectors(camera.position,o)).normalize();// the ribbon faces the camera
      const s=this.side,w0=Math.max(this.near,o.distanceTo(camera.position)*pixel),w1=Math.max(this.far,this.end.distanceTo(camera.position)*pixel),k=e*12;
      P.set([o.x-s.x*w0,o.y-s.y*w0,o.z-s.z*w0,o.x+s.x*w0,o.y+s.y*w0,o.z+s.z*w0,this.end.x+s.x*w1,this.end.y+s.y*w1,this.end.z+s.z*w1,this.end.x-s.x*w1,this.end.y-s.y*w1,this.end.z-s.z*w1],k);
      for(let v=0;v<4;v++){const g=b.power*this.gain*(v<2?this.near/w0:this.far/w1);C.set([b.color[0]*g,b.color[1]*g,b.color[2]*g],k+v*3);}
    }
    this.mesh.geometry.attributes.position.needsUpdate=true;this.mesh.geometry.attributes.color.needsUpdate=true;
  }
}
