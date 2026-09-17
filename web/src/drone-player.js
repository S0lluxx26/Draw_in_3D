import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createFrame,sampleShow,ShowClock,frontView} from './drone-show.js';
import {ShowRecorder} from './show-recorder.js';
const $=id=>document.getElementById(id),stamp=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;

export class DronePlayer{
  active=false;
  constructor(renderer,canvas,requestFrame,onExit){
    Object.assign(this,{renderer,canvas,requestFrame,onExit});
    this.recorder=new ShowRecorder(this);
    $('show-pause').onclick=()=>this.toggle();$('show-restart').onclick=()=>{this.clock.seek(0,performance.now());this.clock.play(performance.now());this.refresh();};
    $('show-exit').onclick=()=>this.stop();$('show-speed').onchange=()=>{this.clock.speed(Number($('show-speed').value),performance.now());this.refresh();};
    $('show-scrub').oninput=()=>this.seek(Number($('show-scrub').value));
    $('show-trails').onchange=()=>this.refresh();$('show-front').onclick=()=>{this.front();this.refresh();};
    window.addEventListener('keydown',event=>{if(!this.active)return;if(event.key==='Escape'){event.preventDefault();this.stop();return;}if(['INPUT','SELECT','BUTTON'].includes(event.target.tagName))return;if(event.code==='Space'){event.preventDefault();this.toggle();}});
  }
  start(show){
    this.show=show;this.clock=new ShowClock(show.duration);this.frame=createFrame(show);this.trailFrames=Array.from({length:9},()=>createFrame(show));
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#030812');this.scene.fog=new THREE.FogExp2('#030812',.003);
    this.camera=new THREE.PerspectiveCamera(46,1,.1,1000);
    this.orbit=new OrbitControls(this.camera,this.canvas);this.orbit.target.set(0,15,0);this.orbit.minDistance=22;this.orbit.maxDistance=600;this.orbit.maxPolarAngle=Math.PI*.49;this.orbit.enablePan=false;this.orbit.enableDamping=false;
    this.orbit.addEventListener('change',()=>this.refresh());this.orbit.addEventListener('start',()=>this.frontMode=false);
    this.active=true;this.lastFrame=-Infinity;this.lastUI=-Infinity;
    this.resize(this.canvas.clientWidth/this.canvas.clientHeight);this.front();this.createStage();this.createDrones();
    $('drone-show').hidden=false;$('show-scrub').max=show.duration;$('show-speed').value='1';$('show-title').textContent=show.title||(show.custom?'YOUR INK, IN THE SKY':'SKY STORIES');this.recorder.reset();
    $('show-cues').replaceChildren();show.cues.forEach(cue=>{const b=document.createElement('button');b.textContent=cue.label;b.onclick=()=>this.seek(cue.time);b.dataset.time=cue.time;$('show-cues').append(b);});
    this.resize(this.canvas.clientWidth/this.canvas.clientHeight);$('show-pause').focus({preventScroll:true});this.clock.play(performance.now());this.refresh();
  }
  front(){if(!this.active)return;this.frontMode=true;const view=this.camera.view,offset=view?.enabled?view.offsetY/view.fullHeight:0,pose=frontView(this.show,this.camera.aspect,this.camera.fov,offset);this.camera.position.fromArray(pose.position);this.orbit.target.fromArray(pose.target);this.orbit.update();}
  resize(aspect){if(!this.active)return;const factor=Math.max(1,.65/aspect)/Math.max(1,.65/this.camera.aspect);this.camera.position.sub(this.orbit.target).multiplyScalar(factor).add(this.orbit.target);this.camera.aspect=aspect;const width=this.canvas.clientWidth,height=this.canvas.clientHeight,offset=Math.max(0,document.querySelector('.show-bottom').clientHeight-160)/2;this.camera.setViewOffset(width,height,0,offset,width,height);this.camera.updateProjectionMatrix();if(this.frontMode)this.front();this.force=true;}
  refresh(){this.force=true;this.requestFrame();}
  seek(time){if(this.recorder.active)return;this.clock.pause(performance.now());this.clock.seek(time,performance.now());this.refresh();}
  toggle(){if(!this.active||this.recorder.active)return;const now=performance.now();if(this.clock.playing)this.clock.pause(now);else this.clock.play(now);this.refresh();}
  suspend(){if(this.active){this.recorder.finish(true);this.clock.pause(performance.now());this.refresh();}}
  createStage(){
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshBasicMaterial({color:0x071019}));ground.rotation.x=-Math.PI/2;ground.position.y=-.05;this.scene.add(ground);
    const grid=new THREE.GridHelper(48,24,0x234153,0x112230);grid.material.transparent=true;grid.material.opacity=.5;this.scene.add(grid);
    const pads=new THREE.BufferGeometry();pads.setAttribute('position',new THREE.Float32BufferAttribute(this.show.home.flatMap(p=>[p[0],.025,p[2]]),3));
    this.scene.add(new THREE.Points(pads,new THREE.PointsMaterial({color:0x527284,size:.17,transparent:true,opacity:.7})));
    let seed=8127;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const stars=new THREE.BufferGeometry(),starPositions=[];for(let i=0;i<380;i++)starPositions.push((rand()-.5)*180,15+rand()*80,-45-rand()*40);stars.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    this.scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0x6689a1,size:.12,transparent:true,opacity:.48})));
    const skyline=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x0c1723}),45),matrix=new THREE.Matrix4();
    for(let i=0;i<45;i++){const height=1+rand()*3;matrix.makeScale(.8+rand()*1.6,height,1);matrix.setPosition((i-22)*2,height/2,-24-rand()*4);skyline.setMatrixAt(i,matrix);}this.scene.add(skyline);
  }
  createDrones(){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.frame.positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(this.frame.colors,3).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{pixelRatio:{value:this.renderer.getPixelRatio()}},
      vertexShader:'attribute vec3 color; varying vec3 lightColor; uniform float pixelRatio; void main(){lightColor=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(820./max(1.,-mv.z),5.,26.)*pixelRatio;}',
      fragmentShader:'varying vec3 lightColor; void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard; float glow=exp(-5.*r*r)*.38+exp(-48.*r*r)*1.4; gl_FragColor=vec4(lightColor*glow,1.);}'
    });
    this.lights=new THREE.Points(geo,material);this.lights.frustumCulled=false;this.scene.add(this.lights);
    const bodies=new THREE.Points(geo,new THREE.PointsMaterial({color:0x536b85,size:.13,transparent:true,opacity:.6,depthWrite:false}));bodies.frustumCulled=false;this.scene.add(bodies);
    const trailGeometry=new THREE.BufferGeometry();this.trailPositions=new Float32Array(this.show.count*8*6);this.trailColors=new Float32Array(this.trailPositions.length);
    trailGeometry.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));trailGeometry.setAttribute('color',new THREE.BufferAttribute(this.trailColors,3).setUsage(THREE.DynamicDrawUsage));
    this.trails=new THREE.LineSegments(trailGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending}));this.trails.frustumCulled=false;this.scene.add(this.trails);
  }
  render(now){
    if(!this.active)return false;
    if(!this.force&&this.clock.playing&&now-this.lastFrame<1000/30-.5)return true;
    this.force=false;this.lastFrame=now;const time=this.clock.read(now),frame=sampleShow(this.show,time,this.frame);
    this.lights.geometry.attributes.position.needsUpdate=true;this.lights.geometry.attributes.color.needsUpdate=true;
    this.trails.visible=$('show-trails').checked;
    if(this.trails.visible){
      for(let j=0;j<9;j++)sampleShow(this.show,time-(8-j)*.12,this.trailFrames[j]);
      for(let i=0;i<this.show.count;i++)for(let j=0;j<8;j++)for(let end=0;end<2;end++)for(let k=0;k<3;k++){
        const index=(i*8+j)*6+end*3+k;this.trailPositions[index]=this.trailFrames[j+end].positions[i*3+k];this.trailColors[index]=Math.max(.11,frame.colors[i*3+k])*(j+1)/8;
      }
      this.trails.geometry.attributes.position.needsUpdate=true;this.trails.geometry.attributes.color.needsUpdate=true;
    }
    this.renderer.render(this.scene,this.camera);
    this.recorder.frame();
    if(now-this.lastUI>100||!this.clock.playing||$('show-phase').textContent!==frame.phase){
      this.lastUI=now;$('show-phase').textContent=frame.phase;$('show-time').textContent=stamp(time)+' / '+stamp(this.show.duration);$('show-scrub').value=time;
      $('show-pause').textContent=this.clock.playing?'Ⅱ Pause':time>=this.show.duration?'↻ Replay':'▶ Play';$('show-pause').setAttribute('aria-label',this.clock.playing?'Pause drone show':time>=this.show.duration?'Replay drone show':'Play drone show');
      $('show-progress').style.width=(100*time/this.show.duration)+'%';
      const cue=[...this.show.cues].reverse().find(c=>time>=c.time-1);for(const button of $('show-cues').children){const active=Number(button.dataset.time)===cue?.time;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
      const lit=Array.from({length:this.show.count},(_,i)=>Math.max(...frame.colors.subarray(i*3,i*3+3))>.05).filter(Boolean).length;
      $('show-lit').textContent=lit+' / '+this.show.count;$('show-play-state').textContent=this.clock.playing?'LIVE PREVIEW':time>=this.show.duration?'SHOW COMPLETE':'PAUSED';
    }
    return this.clock.playing;
  }
  stop(){
    if(!this.active)return;this.recorder.finish(true);this.active=false;this.orbit.dispose();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
    $('drone-show').hidden=true;this.scene=null;this.lights=null;this.trails=null;this.show=null;this.frame=null;this.trailFrames=null;this.trailPositions=null;this.trailColors=null;this.onExit();
  }
}
