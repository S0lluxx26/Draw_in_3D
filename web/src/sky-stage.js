// Night-harbour stage for the sky show: sky dome, water, Blender scenery, launch
// pads and instanced drone bodies. The scenery comes from assets/sky-stage.glb
// (tools/blender/build_environment.py) and is scaled with the show so authored
// shows and the demo share one composition. Everything degrades gracefully: if
// the asset cannot load, the show still plays over water under the sky.
import * as THREE from 'three';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from './vendor/addons/loaders/DRACOLoader.js';
import {Reflector} from './vendor/addons/objects/Reflector.js';

const DEMO_SCALE=6;// demo motionScale that the Blender scenery is modelled for (metres)
const MOON=new THREE.Vector3(.5,.3,-.81).normalize();
const linear=(r,g,b)=>new THREE.Color(r,g,b);
export const SKY={zenith:linear(.0012,.0024,.0078),horizon:linear(.016,.028,.058),glow:linear(.05,.028,.016),fog:linear(.014,.024,.05)};

let assetPromise=null;
// Cached lazy load. Resolves to the parsed glTF, or null (the show then plays without scenery).
export function loadStageAsset(){
  assetPromise??=new Promise(resolve=>{
    const draco=new DRACOLoader().setDecoderPath(new URL('./vendor/draco/',import.meta.url).href);
    new GLTFLoader().setDRACOLoader(draco).load(new URL('./assets/sky-stage.glb',import.meta.url).href,gltf=>{draco.dispose();prepareAsset(gltf);resolve(gltf);},undefined,()=>{draco.dispose();assetPromise=null;resolve(null);});
  });
  return assetPromise;
}
// Remap Blender materials by name: lights become unlit HDR emitters (bloom picks them up),
// distant land becomes fogged vertex-colour silhouettes.
const EMITTERS={DeckLights:[1,.62,.28,4],ShoreLights:[1,.78,.52,3.2],BridgeLights:[.75,.88,1,4.5],BridgeTowerLights:[1,.35,.12,6],BuoyLights:[1,.95,.85,4],BuoyRed:[1,.06,.04,6],BuoyGreen:[.1,1,.35,5],Beacons:[1,.05,.03,9]};
function prepareAsset(gltf){
  const root=gltf.scene,shared=new Map();
  const drone=root.getObjectByName('Drone');
  gltf.userData.drone={frame:drone?.getObjectByName('DroneFrame')?.geometry,led:drone?.getObjectByName('DroneLED')?.geometry};
  for(const g of Object.values(gltf.userData.drone))if(g)g.userData.shared=true;
  drone?.removeFromParent();
  root.traverse(o=>{
    if(!o.isMesh)return;
    const name=o.material.name;
    if(!shared.has(name)){
      const old=o.material;let m=old;
      if(EMITTERS[name]){const [r,g,b,k]=EMITTERS[name];m=new THREE.MeshBasicMaterial({color:new THREE.Color(r*k,g*k,b*k),fog:true});}
      else if(name==='Mountains'||name==='Hills'){m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});}
      else if(name==='Buildings'){old.emissive.setRGB(1,1,1);old.emissiveIntensity=.55;old.roughness=.55;old.metalness=.3;}
      else{old.roughness=Math.max(.45,old.roughness);}
      m.name=name;m.userData.shared=true;if(m!==old)old.dispose();shared.set(name,m);
    }
    o.material=shared.get(name);o.geometry.userData.shared=true;o.matrixAutoUpdate=false;o.updateMatrix();
  });
  root.traverse(o=>{if(o.material?.map)o.material.map.anisotropy=4;});
  gltf.userData.materials=shared;
}
export function stageScale(show){
  const xs=show.home.map(p=>p[0]),span=Math.max(...xs)-Math.min(...xs),side=Math.ceil(Math.sqrt(show.count));
  const motion=side>1&&span>0?span*side/(15*(side-1)):1;
  return motion/DEMO_SCALE;
}

const skyShader={
  uniforms:{zenith:{value:SKY.zenith},horizon:{value:SKY.horizon},glow:{value:SKY.glow},moon:{value:MOON},time:{value:0}},
  vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
  fragmentShader:`uniform vec3 zenith,horizon,glow,moon;uniform float time;varying vec3 vDir;
    float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    void main(){vec3 d=normalize(vDir);float h=d.y;
      vec3 c=mix(horizon,zenith,pow(clamp(h,0.,1.),.42));
      c+=glow*exp(-max(h,0.)*7.)*(.45+.55*max(0.,-d.z));// city light pollution behind the show
      float band=exp(-pow(dot(d,normalize(vec3(.35,.55,-.76)))*3.2,2.));// faint Milky Way
      c+=vec3(.012,.013,.02)*band*(.4+.6*noise(d*9.))*smoothstep(0.,.35,h);
      float m=dot(d,moon),edge=fwidth(m)*1.5;
      c+=vec3(1.,.95,.86)*.62*smoothstep(.99994-edge,.99994+edge,m)*(.8+.2*noise(d*520.));
      c+=vec3(.45,.5,.65)*(pow(max(m,0.),3000.)*.12+pow(max(m,0.),90.)*.012);
      if(h<0.)c=mix(c,horizon*.35,clamp(-h*6.,0.,1.));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};
const starShader={
  vertexShader:`attribute float seed;uniform float time,pixelRatio;varying float vLight;varying vec3 vTint;
    void main(){vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;
      float big=step(.985,fract(seed*7.13));vLight=(.35+.65*fract(seed*3.7))*(.7+.3*sin(time*(1.2+fract(seed*11.)*2.4)+seed*40.))*(1.+big*2.);
      vTint=mix(vec3(.75,.85,1.),vec3(1.,.9,.75),fract(seed*5.3));gl_PointSize=(1.2+big*1.6+fract(seed*9.1))*pixelRatio;}`,
  fragmentShader:`varying float vLight;varying vec3 vTint;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vTint*vLight*.05*(1.-r*r),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
};
const waterShader={
  name:'NightWater',
  uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},time:{value:0},scale:{value:1},fogDensity:{value:0},fogColor:{value:SKY.fog},deep:{value:linear(.0015,.003,.007)},sky:{value:SKY.horizon}},
  vertexShader:'uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float time,scale,fogDensity;uniform vec3 fogColor,deep,sky;varying vec4 vUv;varying vec3 vWorld;
    float wave(vec2 p){return sin(p.x*.9+time*.6)*.5+sin(p.y*1.3-time*.8)*.35+sin((p.x+p.y)*2.1+time*1.2)*.2+sin((p.x-p.y*1.7)*3.7-time*1.7)*.12+sin((p.x*.6+p.y*5.1)+time*2.3)*.06;}
    void main(){vec2 p=vWorld.xz/(5.*scale);const float e=.06;
      vec2 g=vec2(wave(p+vec2(e,0.))-wave(p-vec2(e,0.)),wave(p+vec2(0.,e))-wave(p-vec2(0.,e)))/(2.*e);
      vec3 toEye=cameraPosition-vWorld;float dist=length(toEye);vec3 v=toEye/dist;
      float fres=.02+.98*pow(1.-clamp(v.y,0.,1.),5.);
      vec2 offset=g*.018/(1.+dist/(350.*scale));
      #ifdef REFLECT
      vec4 uv=vUv;uv.xy+=offset*uv.w*vec2(1.,2.5);vec3 refl=texture2DProj(tDiffuse,uv).rgb;
      #else
      vec3 refl=sky*(.8+.4*g.x);
      #endif
      vec3 c=mix(deep,refl,clamp(.3+.7*fres,0.,1.));
      c=mix(c,fogColor,1.-exp(-pow(fogDensity*dist,2.)));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

export class SkyStage{
  constructor(scene,show,{tier,renderer}){
    Object.assign(this,{scene,show,tier,renderer});
    this.scale=stageScale(show);this.group=new THREE.Group();scene.add(this.group);
    const s=this.scale;
    scene.background=SKY.zenith.clone();scene.fog=new THREE.FogExp2(SKY.fog,2.6e-4/s);
    // Sky dome and stars follow whichever camera renders (main or reflection).
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),new THREE.ShaderMaterial({...skyShader,uniforms:THREE.UniformsUtils.clone(skyShader.uniforms),side:THREE.BackSide,depthWrite:false,fog:false}));
    this.sky.scale.setScalar(9000*s);this.sky.renderOrder=-10;this.sky.frustumCulled=false;
    this.sky.onBeforeRender=(r,sc,camera)=>{this.sky.position.copy(camera.position);this.sky.updateMatrixWorld();};
    const count=Math.round(2600*tier.stars),seeds=new Float32Array(count),stars=new Float32Array(count*3);
    let seed=9127;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<count;i++){const y=.03+.97*Math.pow(rand(),.8),a=rand()*Math.PI*2,r=Math.sqrt(1-y*y);stars.set([Math.cos(a)*r,y,Math.sin(a)*r],i*3);seeds[i]=rand()*10;}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));starGeometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
    this.stars=new THREE.Points(starGeometry,new THREE.ShaderMaterial({...starShader,uniforms:{time:{value:0},pixelRatio:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    this.stars.scale.setScalar(8000*s);this.stars.renderOrder=-9;this.stars.frustumCulled=false;
    this.stars.onBeforeRender=(r,sc,camera)=>{this.stars.position.copy(camera.position);this.stars.updateMatrixWorld();this.stars.material.uniforms.pixelRatio.value=r.getPixelRatio();this.stars.material.uniformsNeedUpdate=true;};
    this.group.add(this.sky,this.stars);
    // Water: planar reflection on capable devices, a shaded calm surface otherwise.
    const waterGeometry=new THREE.PlaneGeometry(60000*s,60000*s);
    if(tier.reflection>0){
      this.water=new Reflector(waterGeometry,{textureWidth:512,textureHeight:512,clipBias:.002,multisample:0,shader:waterShader});
      this.water.material.defines.REFLECT='';
    }else{
      this.water=new THREE.Mesh(waterGeometry,new THREE.ShaderMaterial({...waterShader,uniforms:{...THREE.UniformsUtils.clone(waterShader.uniforms),textureMatrix:{value:new THREE.Matrix4()}}}));
    }
    this.water.rotation.x=-Math.PI/2;this.water.position.y=-1.1*s;
    const u=this.water.material.uniforms;u.scale.value=s;u.fogDensity.value=scene.fog.density;
    this.group.add(this.water);
    // Lighting for the physical scenery: moonlight, sky fill and the show's own glow.
    this.hemi=new THREE.HemisphereLight(0x5068a0,0x040608,.55);this.moon=new THREE.DirectionalLight(0xa9bcff,.55);this.moon.position.copy(MOON).multiplyScalar(100);
    this.glow=new THREE.PointLight(0xffffff,0,0,0);this.group.add(this.hemi,this.moon,this.glow);
    this.createPads();
  }
  createPads(){
    const s=this.scale,canvas=document.createElement('canvas');canvas.width=canvas.height=64;const g=canvas.getContext('2d');
    g.fillStyle='#0b1016';g.fillRect(0,0,64,64);g.strokeStyle='#2c8a9a';g.lineWidth=3;g.beginPath();g.arc(32,32,22,0,Math.PI*2);g.stroke();g.fillStyle='#1f5e6a';g.fillRect(29,8,6,10);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const side=Math.ceil(Math.sqrt(this.show.count)),spacing=Math.min(15,13)*this.scale*DEMO_SCALE/side;
    const pad=new THREE.PlaneGeometry(spacing*.78,spacing*.78);pad.rotateX(-Math.PI/2);
    this.pads=new THREE.InstancedMesh(pad,new THREE.MeshBasicMaterial({map:texture,color:0x9fb3c0,fog:true}),this.show.count);
    const m=new THREE.Matrix4();this.show.home.forEach((p,i)=>{m.makeTranslation(p[0],.02*s,p[2]);this.pads.setMatrixAt(i,m);});
    this.pads.frustumCulled=false;this.group.add(this.pads);
    // Fallback deck so the pads never float on water before (or without) the scenery.
    const xs=this.show.home.map(p=>p[0]),zs=this.show.home.map(p=>p[2]),w=Math.max(...xs)-Math.min(...xs)+spacing*2,d=Math.max(...zs)-Math.min(...zs)+spacing*2;
    this.deck=new THREE.Mesh(new THREE.BoxGeometry(w,1*s,d),new THREE.MeshStandardMaterial({color:0x0b0f14,roughness:.9}));this.deck.position.y=-.5*s;this.group.add(this.deck);
  }
  // Attach the Blender scenery (shared, never disposed) and the drone-body instances.
  attach(gltf){
    if(!gltf||this.scenery)return;
    this.scenery=gltf.scene;this.scenery.scale.setScalar(this.scale);this.scenery.updateMatrixWorld(true);this.group.add(this.scenery);this.deck.visible=false;
    this.materials=gltf.userData.materials;
    const {frame,led}=gltf.userData.drone||{};
    if(this.tier.bodies&&frame&&led){
      const n=this.show.count;
      this.bodies=new THREE.InstancedMesh(frame,new THREE.MeshStandardMaterial({color:0x1a1d22,roughness:.4,metalness:.6}),n);
      this.bulbs=new THREE.InstancedMesh(led,new THREE.MeshBasicMaterial({color:0xffffff}),n);
      this.bulbs.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage);
      for(const mesh of [this.bodies,this.bulbs]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.visible=false;this.group.add(mesh);}
      const m=new THREE.Matrix4().makeScale(this.scale*1.6,this.scale*1.6,this.scale*1.6);for(let i=0;i<n;i++){this.bodies.setMatrixAt(i,m);this.bulbs.setMatrixAt(i,m);}
    }
  }
  setSize(width,height){if(this.water.getRenderTarget){const k=this.tier.reflection;this.water.getRenderTarget().setSize(Math.max(64,Math.round(width*k)),Math.max(64,Math.round(height*k)));}}
  // Per-frame animation. frame = sampled show (positions/colors), camera = main camera.
  update(time,frame,camera,now){
    const t=now/1000;this.sky.material.uniforms.time.value=t;this.stars.material.uniforms.time.value=t;this.water.material.uniforms.time.value=t;
    const beacons=this.materials?.get('Beacons');if(beacons){const on=(t%1.7)<.22;beacons.color.setRGB(on?9:.25,on?.45:.01,on?.27:.01);}
    if(this.bodies){
      const near=camera.position.distanceTo(this.focus||camera.position)<260*this.scale;
      this.bodies.visible=this.bulbs.visible=near;
      if(near){
        const a=this.bodies.instanceMatrix.array,b=this.bulbs.instanceMatrix.array,c=this.bulbs.instanceColor.array,p=frame.positions,col=frame.colors;
        for(let i=0;i<this.show.count;i++){const o=i*16+12,j=i*3;a[o]=b[o]=p[j];a[o+1]=b[o+1]=p[j+1];a[o+2]=b[o+2]=p[j+2];c[j]=.03+col[j]*col[j]*4;c[j+1]=.03+col[j+1]*col[j+1]*4;c[j+2]=.03+col[j+2]*col[j+2]*4;}
        this.bodies.instanceMatrix.needsUpdate=this.bulbs.instanceMatrix.needsUpdate=this.bulbs.instanceColor.needsUpdate=true;
      }
    }
  }
  // The formation lights the scenery: average LED colour at the framing centre.
  setGlow(center,color,amount){this.focus=this.focus||new THREE.Vector3();this.focus.fromArray(center);this.glow.position.copy(this.focus);this.glow.color.copy(color);this.glow.intensity=amount;}
  dispose(){
    this.scenery?.removeFromParent();
    this.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();const m=o.material;if(m&&!m.userData.shared){m.map?.dispose();m.dispose();}});
    this.water.dispose?.();this.group.removeFromParent();
  }
}
