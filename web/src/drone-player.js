import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {EffectComposer} from './vendor/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/addons/postprocessing/OutputPass.js';
import {createFrame,sampleShow,ShowClock} from './drone-show.js';
import {directorView,framingAt} from './show-camera.js';
import {SkyStage,loadStageAsset,stageScale} from './sky-stage.js';
import {TIERS,QUALITY_LEVELS,resolveTier,browserEnvironment,FrameGovernor} from './quality.js';
import {ShowRecorder} from './show-recorder.js';
import {ShowMusic} from './show-music.js';
import {hardenOrbit} from './editor-look.js';
// The show waits at 00:00 for its scenery, but never longer than this on a stalled connection.
const STAGE_WAIT_MS=15000;
const $=id=>document.getElementById(id),stamp=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},QUALITY_KEY='draw3d-graphics-v1',CAMERA_KEY='draw3d-camera-v1';
export const CAMERA_MODES=['follow','free'];
// LEDs: HDR point sprites sized in world metres (so previews and 720p recordings match),
// with an energy-preserving minimum size so distant lights shimmer less.
const LED_VERTEX=`attribute vec3 color;uniform float ledSize,ledNear,viewport,minSize;varying vec3 vColor;varying float vEnergy;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
  float px=ledSize*clamp(-mv.z/ledNear,.16,1.)*projectionMatrix[1][1]*viewport*.5/max(-mv.z,.001),size=clamp(px,minSize,110.);// glow tightens up close so the drone shows
  vEnergy=px<minSize?px*px/(minSize*minSize):1.;vColor=pow(max(color,vec3(0.)),vec3(2.2));vColor*=min(1.,.55/max(dot(vColor,vec3(.2126,.7152,.0722)),1e-4));
  if(max(vColor.r,max(vColor.g,vColor.b))<1e-6)gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=size;}`;
const LED_FRAGMENT=`uniform int lightShape;uniform float gain;varying vec3 vColor;varying float vEnergy;
void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);if(lightShape==1)r=abs(p.x)+abs(p.y);if(lightShape==2)r/=.7+.3*cos(5.*atan(p.y,p.x)-1.5707963);if(r>1.)discard;
  float core=exp(-r*r*22.),halo=exp(-r*r*4.5)*(1.-r);gl_FragColor=vec4(vColor*(core*gain+halo*.5)*vEnergy,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const TRAIL_VERTEX='attribute vec3 color;attribute float fade;varying vec3 vColor;void main(){vColor=pow(max(color,vec3(0.)),vec3(2.2))*fade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const TRAIL_FRAGMENT='varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}';

export class DronePlayer{
  active=false;
  constructor(renderer,canvas,requestFrame,onExit){
    Object.assign(this,{renderer,canvas,requestFrame,onExit});
    this.recorder=new ShowRecorder(this);this.music=new ShowMusic(()=>this.active?this.clock:null);this.music.onchange=()=>{if(this.active)this.syncMusic();};this.size=new THREE.Vector2();this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    try{this.quality=QUALITY_LEVELS.includes(localStorage.getItem(QUALITY_KEY))?localStorage.getItem(QUALITY_KEY):'auto';}catch{this.quality='auto';}
    try{this.cameraMode=CAMERA_MODES.includes(localStorage.getItem(CAMERA_KEY))?localStorage.getItem(CAMERA_KEY):'follow';}catch{this.cameraMode='follow';}
    $('show-pause').onclick=()=>this.toggle();$('show-restart').onclick=()=>{const now=performance.now();this.clock.seek(0,now);if(this.waiting)this.autoplay=true;else this.clock.play(now);this.refresh();};
    // A locked button asks for the tap browsers require before sound; otherwise it mutes and unmutes.
    $('show-music').onclick=()=>{if(this.music.state==='locked')this.music.prime();else this.music.toggle();if(!this.recorder.active)this.recorder.reset();this.syncMusic();};
    $('show-exit').onclick=()=>this.stop();$('show-speed').onchange=()=>{this.clock.speed(Number($('show-speed').value),performance.now());this.refresh();};
    $('show-scrub').oninput=()=>this.seek(Number($('show-scrub').value));
    $('show-trails').onchange=()=>this.refresh();$('show-front').onclick=()=>{this.front(true);this.refresh();};
    window.addEventListener('keydown',event=>{if(!this.active||$('demo-settings')?.open)return;if(event.key==='Escape'){event.preventDefault();this.stop();return;}if(['INPUT','SELECT','BUTTON'].includes(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();this.toggle();}});
    // Fetch the harbour scenery as soon as the user shows interest in a show.
    for(const id of ['drone-demo','welcome-demo','show-editor','drone-drawing'])$(id)?.addEventListener('pointerenter',()=>loadStageAsset(),{once:true});
    // Unlock audio inside the gesture itself; Safari refuses once the Demo's assets have loaded.
    for(const id of ['drone-demo','welcome-demo','drone-drawing'])$(id)?.addEventListener('pointerdown',()=>this.music.prime());
  }
  setQuality(choice){
    if(!QUALITY_LEVELS.includes(choice)||choice===this.quality)return;this.quality=choice;try{localStorage.setItem(QUALITY_KEY,choice);}catch{}
    if(!this.active||this.recorder.active)return;const time=this.clock.time,playing=this.clock.playing||this.waiting&&this.autoplay,rate=this.clock.rate;this.start(this.show);this.clock.seek(time,performance.now());this.clock.speed(rate,performance.now());this.autoplay=playing;this.refresh();
  }
  setCameraMode(mode){if(!CAMERA_MODES.includes(mode))return;this.cameraMode=mode;try{localStorage.setItem(CAMERA_KEY,mode);}catch{}if(this.active){this.freeLimits();this.refresh();}}
  // Free orbit keeps the wide original limits; "Stay around the show" narrows them every frame (see follow()).
  freeLimits(){const o=this.orbit,s=this.scale;Object.assign(o,{minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,minPolarAngle:0,maxPolarAngle:Math.PI*.64,minDistance:8*s,maxDistance:3200*s});}
  // Stay around the show: dragging and zooming set an angle and distance relative to the automatic camera,
  // which keeps following each formation; the limits stop the view from drifting off the show by accident.
  follow(time){
    const view=this.camera.view,offset=view?.enabled?view.offsetY/view.fullHeight:0,pose=directorView(this.show,time,this.camera.aspect,this.camera.fov,offset,{drift:0});
    const t=this.followTarget||(this.followTarget=new THREE.Vector3()),d=this.followDelta||(this.followDelta=new THREE.Vector3());
    t.fromArray(pose.target);d.subVectors(t,this.orbit.target);this.orbit.target.add(d);this.camera.position.add(d);
    const [x,y,z]=pose.position.map((v,k)=>v-pose.target[k]),dist=Math.hypot(x,y,z),az=Math.atan2(x,z),polar=Math.acos(Math.max(-1,Math.min(1,y/dist)));
    Object.assign(this.orbit,{minAzimuthAngle:az-.95,maxAzimuthAngle:az+.95,minPolarAngle:Math.max(.2,polar-.8),maxPolarAngle:Math.min(Math.PI*.56,polar+.28),minDistance:dist*.4,maxDistance:dist*1.8});
  }
  syncMusic(){const b=$('show-music'),state=this.music.state,label={on:'Music on',off:'Music off',locked:'Tap for sound',unavailable:'No audio'}[state];if(b.dataset.state!==state){b.dataset.state=state;b.querySelector('.music-label').textContent=' '+label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(state==='on'));b.disabled=state==='unavailable';b.classList.toggle('locked',state==='locked');}}
  start(show){
    if(this.active)this.teardown();
    this.show=show;$('show-demo-settings').hidden=!show.demo;this.clock=new ShowClock(show.duration);this.frame=createFrame(show);this.trailFrames=Array.from({length:2},()=>createFrame(show));this.velocityFrame=createFrame(show);
    this.tierName=resolveTier(this.quality,browserEnvironment(this.renderer));this.tier=TIERS[this.tierName];
    const r=this.renderer;this.saved={toneMapping:r.toneMapping,exposure:r.toneMappingExposure,pixelRatio:r.getPixelRatio()};
    r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.05;this.basePixelRatio=Math.min(devicePixelRatio||1,this.tier.pixelRatio);r.setPixelRatio(this.basePixelRatio);
    this.governor=new FrameGovernor(1,.6);this.cw=0;
    const s=this.scale=stageScale(show);
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(46,1,.25*s,20000*s);
    this.orbit=hardenOrbit(new OrbitControls(this.camera,this.canvas));this.orbit.target.set(0,15,0);this.freeLimits();this.orbit.enablePan=false;this.orbit.enableDamping=true;this.orbit.dampingFactor=.09;
    this.orbit.addEventListener('change',()=>this.refresh());this.orbit.addEventListener('start',()=>{this.frontMode=false;this.blend=null;});
    this.active=true;this.lastFrame=-Infinity;this.lastUI=-Infinity;this.frontMode=true;this.blend=null;this.waiting=true;this.autoplay=true;
    this.stage=new SkyStage(this.scene,show,{tier:this.tier,renderer:r});this.createDrones();this.precrowd(show);
    if(this.tier.bloom){
      this.composer=new EffectComposer(r,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:this.tierName==='high'?4:0}));
      this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new THREE.Vector2(256,256),.78,.55,1.05);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    }
    const loading=$('show-loading');loading.hidden=false;
    // The clock holds at 00:00 until the scenery is ready, so a first visit over the network still
    // opens on the launch-pad close-up instead of joining the show part-way through.
    // A quality change restarts the same show, so callbacks check the run rather than the show.
    const run=this.run=(this.run||0)+1,current=()=>this.run===run&&this.active;
    const ready=()=>{if(!current()||!this.waiting)return;this.waiting=false;if(this.autoplay)this.clock.play(performance.now());if(!this.recorder.active)this.recorder.reset();this.refresh();};
    setTimeout(ready,STAGE_WAIT_MS);
    // Compile every stage shader off the main path before hiding the loader, so the first close-up
    // of detailed drones does not stall (D3D shader compiles can take seconds).
    loadStageAsset().then(async gltf=>{if(!current())return;this.stage.attach(gltf);try{await this.renderer.compileAsync?.(this.scene,this.camera);}catch{}if(!current())return;loading.hidden=true;if(!gltf)$('show-quality').textContent+=' · scenery unavailable';ready();this.refresh();});
    $('show-fleet').textContent=show.count.toLocaleString();$('show-tagline').textContent=show.count.toLocaleString()+' lights. One canvas. An open sky.';$('drone-show').hidden=false;$('show-scrub').max=show.duration;$('show-speed').value='1';$('show-title').textContent=show.title||(show.custom?'YOUR INK, IN THE SKY':'SKY STORIES');this.recorder.reset();
    $('show-quality').textContent={high:'CINEMATIC',balanced:'BALANCED',battery:'BATTERY SAVER'}[this.tierName];
    $('show-cues').replaceChildren();show.cues.forEach(cue=>{const b=document.createElement('button');b.textContent=cue.label;b.onclick=()=>this.seek(cue.time);b.dataset.time=cue.time;$('show-cues').append(b);});
    this.music.start(show);this.syncMusic();
    this.resize(this.canvas.clientWidth/this.canvas.clientHeight);$('show-pause').focus({preventScroll:true});this.refresh();
  }
  // Automatic director camera. smooth=true eases from a manual orbit back to it.
  front(smooth=false){if(!this.active)return;if(smooth&&!this.frontMode)this.blend={position:this.camera.position.toArray(),target:this.orbit.target.toArray(),start:performance.now()};this.frontMode=true;this.updateCamera(this.clock.time,performance.now());}
  updateCamera(time,now){
    if(!this.frontMode){if(this.cameraMode==='follow')this.follow(time);this.orbit.update();const floor=1.5*this.scale;if(this.camera.position.y<floor){this.camera.position.y=floor;this.camera.lookAt(this.orbit.target);}return;}
    const view=this.camera.view,offset=view?.enabled?view.offsetY/view.fullHeight:0;
    const pose=directorView(this.show,time,this.camera.aspect,this.camera.fov,offset,{drift:this.reducedMotion?0:1});let {position,target}=pose;
    if(this.blend){const k=smooth((now-this.blend.start)/1400),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*k);position=mix(this.blend.position,position);target=mix(this.blend.target,target);if(k>=1)this.blend=null;}
    this.camera.position.fromArray(position);this.orbit.target.fromArray(target);this.orbit.update();
  }
  resize(aspect){if(!this.active)return;const factor=Math.max(1,.65/aspect)/Math.max(1,.65/this.camera.aspect);this.camera.position.sub(this.orbit.target).multiplyScalar(factor).add(this.orbit.target);this.camera.aspect=aspect;const width=this.canvas.clientWidth,height=this.canvas.clientHeight,box=this.canvas.getBoundingClientRect(),top=Math.max(0,document.querySelector('.show-heading').getBoundingClientRect().bottom-box.top),bottom=Math.max(0,box.bottom-document.querySelector('.show-phase-row').getBoundingClientRect().top),offset=Math.max(0,bottom-top)/2;this.camera.setViewOffset(width,height,0,offset,width,height);this.camera.updateProjectionMatrix();if(this.frontMode)this.front();this.force=true;}
  refresh(){this.force=true;this.requestFrame();this.music.tick();}
  seek(time){if(this.recorder.active)return;this.autoplay=false;this.clock.pause(performance.now());this.clock.seek(time,performance.now());this.refresh();}
  toggle(){if(!this.active||this.recorder.active)return;if(this.waiting){this.autoplay=!this.autoplay;this.refresh();return;}const now=performance.now();if(this.clock.playing)this.clock.pause(now);else this.clock.play(now);this.refresh();}
  suspend(){if(this.active){this.recorder.finish(true);this.autoplay=false;this.clock.pause(performance.now());this.refresh();}}
  createDrones(){
    const show=this.show,n=show.count,geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(this.frame.positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(this.frame.colors,3).setUsage(THREE.DynamicDrawUsage));
    const ledSize=.24*this.scale*6*Math.sqrt(4096/n)**.5;
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:LED_VERTEX,fragmentShader:LED_FRAGMENT,
      uniforms:{lightShape:{value:Math.max(0,['round','diamond','star'].indexOf(show.lightShape))},ledSize:{value:ledSize},ledNear:{value:150*this.scale},viewport:{value:720},minSize:{value:2},gain:{value:this.tier.bloom?5:3}}});
    this.lights=new THREE.Points(geo,material);this.lights.frustumCulled=false;this.lights.renderOrder=2;this.scene.add(this.lights);
    // Sprite size follows the target being rendered: canvas, bloom buffer or water reflection.
    this.lights.onBeforeRender=renderer=>{const target=renderer.getRenderTarget(),h=target?target.height:this.drawHeight||720,u=material.uniforms;u.viewport.value=h;u.minSize.value=Math.max(1,1.8*renderer.getPixelRatio()*h/(this.drawHeight||h));material.uniformsNeedUpdate=true;};
    // Trails: two fading segments per drone (t-0.4 → t-0.2 → t), tinted by the current LED colour.
    const trail=new THREE.BufferGeometry();this.trailPositions=new Float32Array(n*12);this.trailColors=new Float32Array(n*12);const fade=new Float32Array(n*4);for(let i=0;i<n;i++)fade.set([0,.16,.16,.42],i*4);
    trail.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));trail.setAttribute('color',new THREE.BufferAttribute(this.trailColors,3).setUsage(THREE.DynamicDrawUsage));trail.setAttribute('fade',new THREE.BufferAttribute(fade,1));
    this.trails=new THREE.LineSegments(trail,new THREE.ShaderMaterial({vertexShader:TRAIL_VERTEX,fragmentShader:TRAIL_FRAGMENT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.trails.frustumCulled=false;this.trails.renderOrder=1;this.scene.add(this.trails);
  }
  // LEDs packed closer than their glow (dense strokes, contour fireworks) add up to white.
  // Dim each light by how many neighbours share its glow in the stage's target layout.
  // Numeric grid keys keep this ~4 ms per 4,096-light stage; it is precomputed while idle.
  crowding(stage){
    if(stage.crowd)return stage.crowd;
    const points=stage.to.positions,n=points.length,r=this.lights.material.uniforms.ledSize.value*1.2,r2=r*r,crowd=new Float32Array(n).fill(1);
    if(!['hold','grow','burst','rise','fall'].includes(stage.kind))return stage.crowd=crowd;// lights are off or dim
    const cell=new Int32Array(n*3),key=(x,y,z)=>((x+4096)*8192+(y+4096))*8192+(z+4096),cells=new Map();
    for(let i=0;i<n;i++){const p=points[i];for(let k=0;k<3;k++)cell[i*3+k]=Math.floor(p[k]/r);const id=key(cell[i*3],cell[i*3+1],cell[i*3+2]);const list=cells.get(id);if(list)list.push(i);else cells.set(id,[i]);}
    for(let i=0;i<n;i++){const p=points[i],cx=cell[i*3],cy=cell[i*3+1],cz=cell[i*3+2];let k=0;
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const list=cells.get(key(cx+x,cy+y,cz+z));if(!list)continue;for(const j of list){if(j===i)continue;const q=points[j],dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2];if(dx*dx+dy*dy+dz*dz<r2)k++;}}
      crowd[i]=Math.min(1,Math.sqrt(4/(1+k)));}// evenly spaced formations have about three neighbours in range
    return stage.crowd=crowd;
  }
  precrowd(show){const queue=[...show.stages],step=deadline=>{if(this.show!==show)return;do this.crowding(queue.shift());while(queue.length&&deadline?.timeRemaining?.()>4);if(queue.length)idle(step);},idle=globalThis.requestIdleCallback||(f=>setTimeout(f,30));idle(step);}
  decrowd(frame,time){
    const stage=this.show.stages.find(s=>time<s.end)||this.show.stages.at(-1),crowd=this.crowding(stage),c=frame.colors;
    for(let i=0;i<crowd.length;i++){const f=crowd[i];if(f<1){c[i*3]*=f;c[i*3+1]*=f;c[i*3+2]*=f;}}
  }
  syncSize(){
    const r=this.renderer,size=r.getSize(this.size),ratio=r.getPixelRatio();if(size.x===this.cw&&size.y===this.ch&&ratio===this.cratio)return;
    this.cw=size.x;this.ch=size.y;this.cratio=ratio;this.drawHeight=Math.max(1,Math.round(size.y*ratio));
    if(this.composer){this.composer.setPixelRatio(ratio);this.composer.setSize(size.x,size.y);}this.stage.setSize(size.x*ratio,size.y*ratio);
  }
  render(now){
    if(!this.active)return false;
    const playing=this.clock.playing,cap=this.tierName==='battery'?30:60;
    if(!this.force&&playing&&now-this.lastFrame<1000/cap-.5)return true;
    this.force=false;this.lastFrame=now;
    // Adaptive resolution while playing (never while recording a fixed 720p video).
    if(playing&&!this.recorder.active){const k=this.governor.sample(now),ratio=+(this.basePixelRatio*k).toFixed(3);if(Math.abs(ratio-this.renderer.getPixelRatio())>.01)this.renderer.setPixelRatio(ratio);}else this.governor.last=0;
    this.syncSize();
    const time=this.clock.read(now),frame=sampleShow(this.show,time,this.frame);this.updateCamera(time,now);this.decrowd(frame,time);
    this.lights.geometry.attributes.position.needsUpdate=true;this.lights.geometry.attributes.color.needsUpdate=true;
    this.trails.visible=$('show-trails').checked;
    if(this.trails.visible){
      sampleShow(this.show,time-.4,this.trailFrames[0]);sampleShow(this.show,time-.2,this.trailFrames[1]);
      const a=this.trailFrames[0].positions,b=this.trailFrames[1].positions,c=frame.positions,col=frame.colors,P=this.trailPositions,C=this.trailColors;
      for(let i=0,n=this.show.count;i<n;i++){const j=i*3,o=i*12;
        for(let k=0;k<3;k++){P[o+k]=a[j+k];P[o+3+k]=P[o+6+k]=b[j+k];P[o+9+k]=c[j+k];C[o+k]=C[o+3+k]=C[o+6+k]=C[o+9+k]=col[j+k];}}
      this.trails.geometry.attributes.position.needsUpdate=true;this.trails.geometry.attributes.color.needsUpdate=true;
    }
    this.stage.update(time,frame,this.camera,now,this.stage.wantsVelocity?sampleShow(this.show,time-.15,this.velocityFrame):null);
    if(this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
    this.recorder.frame();
    if(now-this.lastUI>100||!this.clock.playing||$('show-phase').textContent!==frame.phase){
      this.lastUI=now;$('show-phase').textContent=frame.phase;$('show-time').textContent=stamp(time)+' / '+stamp(this.show.duration);$('show-scrub').value=time;
      const running=this.clock.playing||this.waiting&&this.autoplay;
      const [icon,word]=running?['Ⅱ','Pause']:time>=this.show.duration?['↻','Replay']:['▶','Play'],pause=$('show-pause');if(pause.dataset.word!==word){pause.dataset.word=word;pause.firstElementChild.textContent=icon;pause.lastElementChild.textContent=' '+word;}$('show-pause').setAttribute('aria-label',running?'Pause drone show':time>=this.show.duration?'Replay drone show':'Play drone show');
      $('show-progress').style.width=(100*time/this.show.duration)+'%';
      const cue=[...this.show.cues].reverse().find(c=>time>=c.time-1);for(const button of $('show-cues').children){const active=Number(button.dataset.time)===cue?.time;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
      let lit=0,sum=[0,0,0];const colors=frame.colors;for(let i=0;i<colors.length;i+=3){const r=colors[i],g=colors[i+1],b=colors[i+2];if(Math.max(r,g,b)>.05){lit++;sum[0]+=r;sum[1]+=g;sum[2]+=b;}}
      const glow=new THREE.Color().setRGB(...sum.map(v=>lit?(v/lit)**2.2:0)),center=framingAt(this.show,time).center;this.stage.setGlow(center,glow,1.6*lit/this.show.count);
      $('show-lit').textContent=lit+' / '+this.show.count;$('show-play-state').textContent=this.waiting?'GETTING READY':this.clock.playing?'LIVE PREVIEW':time>=this.show.duration?'SHOW COMPLETE':'PAUSED';this.syncMusic();
    }
    return this.clock.playing||!!this.blend;
  }
  teardown(){
    this.orbit.dispose();this.stage.dispose();this.composer?.dispose();this.bloom?.dispose();this.composer?.passes.forEach(p=>p.dispose?.());
    for(const o of [this.lights,this.trails]){o.geometry.dispose();o.material.dispose();}
    const r=this.renderer;r.toneMapping=this.saved.toneMapping;r.toneMappingExposure=this.saved.exposure;r.setPixelRatio(this.saved.pixelRatio);
    this.scene=null;this.lights=null;this.trails=null;this.stage=null;this.composer=null;this.bloom=null;this.frame=null;this.trailFrames=null;this.velocityFrame=null;this.trailPositions=null;this.trailColors=null;
  }
  stop(){
    if(!this.active)return;this.recorder.finish(true);this.music.stop();this.active=false;this.teardown();
    $('drone-show').hidden=true;$('show-loading').hidden=true;this.show=null;this.onExit();
  }
}
