// Scene accents: one small, light detail that belongs to the formation on show, drawn only while it is up, fading in
// during the flight into it and out after its hold. Bubbles round the fish, fireflies for the butterfly, the Eiffel
// Tower's sweeping searchlights, embers over the row of fire, confetti for the cake… Every kind is ONE point cloud whose
// vertex shader places each particle from time and the formation's box, so the CPU only picks the active window and
// sets a few uniforms. All kinds share one shader program; at most two kinds draw at any moment.
import * as THREE from 'three';
import {mulberry32} from './harbour-life.js';

// kind: [particles at full budget, shape] — shape 0 dot, 1 ring, 2 star, 3 heart, 4 confetti, 5 ring lying on the water
export const ACCENTS={radio:[50,1],bubbles:[70,1],fireflies:[60,0],lanterns:[40,0],beacons:[240,0],spray:[300,0],ripples:[12,5],
  glitter:[80,2],embers:[140,0],confetti:[130,4],launch:[140,0],hearts:[44,3],shower:[180,0]};
const KINDS=Object.keys(ACCENTS);
const BY_NAME={'Robot':'radio','Fish':'bubbles','Butterfly':'fireflies','Hot air balloon':'lanterns','Eiffel Tower':'beacons','Big ship':'spray',
  'Whale':'ripples','Firework star':'glitter','Row of fire':'embers','Birthday cake':'confetti','Starship launch':'launch','Happy day':'confetti',
  'Growing heart':'hearts','Beating heart':'hearts','Five-point star':'shower','Spinning star':'shower'};
const BY_MOTION={fish:'bubbles',swim:'ripples',flap:'fireflies',balloons:'lanterns',candles:'confetti'},BY_EFFECT={fire:'embers',sparkle:'glitter',starship:'launch'};

/** Which accent a show stage gets: the Demo's formations by name, your own formations by their motion or effect. */
export function accentFor(stage){
  if(!stage||stage.kind==='move'||stage.kind==='takeoff'||stage.kind==='landing'||stage.phrase)return null;
  const base=(stage.name||'').replace(/ · falling sparks$/,'');
  return BY_NAME[base]??BY_MOTION[stage.motion]??BY_EFFECT[stage.effect]??null;
}
function box(positions){
  if(!positions?.length)return null;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of positions)for(let k=0;k<3;k++){if(p[k]<lo[k])lo[k]=p[k];if(p[k]>hi[k])hi[k]=p[k];}
  return {center:lo.map((v,k)=>(v+hi[k])/2),half:lo.map((v,k)=>Math.max(1,(hi[k]-v)/2))};
}
/** When each accent shows: from 55% into the flight to 1.2 s after the formation (consecutive stages of one scene merge). */
export function accentWindows(show){
  const windows=[];
  show.stages.forEach((s,i)=>{
    const kind=accentFor(s);if(!kind)return;const prev=show.stages[i-1],last=windows.at(-1);
    const from=box(s.from?.positions)||box(s.to?.positions),to=box(s.to?.positions)||from;if(!to)return;
    if(last&&last.kind===kind&&s.start<=last.stageEnd+.5){last.stageEnd=s.end;last.end=s.end+1.2;return;}
    const start=prev?.kind==='move'?prev.start+(prev.end-prev.start)*.55:s.start;
    windows.push({kind,start,end:s.end+1.2,stageStart:s.start,stageEnd:s.end,from,to,name:s.name});
  });
  return windows;
}

const VERTEX=`attribute vec4 aSeed;attribute float aIndex;
uniform int uKind;uniform vec3 uCenter,uHalf;uniform float uAlpha,uLocal,uTime,uWaterY,uViewport,uMinPx,uMaxPx,uNight;
varying vec3 vColor;varying float vShape,vSpin,vFlat;
float hash1(float n){return fract(sin(n*12.9898)*43758.5453);}
float fadeLife(float a){return smoothstep(0.,.12,a)*(1.-smoothstep(.75,1.,a));}
void main(){
  vec4 s=aSeed;vec3 c=uCenter;float w=uHalf.x,h=uHalf.y,d=max(uHalf.z,w*.3),R=max(w,h),size=R*.02,glow=1.;vec3 p=c,col=vec3(1.);vShape=0.;vSpin=0.;
  if(uKind==0){// radio: rings from the antenna, and sparks orbiting the robot
    if(aIndex<.1){float age=fract(uLocal/2.4+aIndex*10.*.2);p=c+vec3(0.,h*.95,0.);size=R*(.08+age*.7);col=vec3(.4,.85,1.)*.5*pow(1.-age,1.5);vShape=1.;}
    else{float a=uTime*(.6+s.x*.8)+s.y*6.283;p=c+vec3(cos(a)*w*1.15,(s.z*2.-1.)*h,sin(a)*d*1.2);float tw=pow(max(0.,sin(uTime*(3.+s.w*4.)+s.x*30.)),6.);col=vec3(.45,.8,1.)*(.25+2.2*tw);size=R*.018;}}
  else if(uKind==1){float age=fract(uLocal/(5.+3.*s.x)+s.y);// bubbles rise and wobble round the fish
    p=c+vec3((s.z*2.-1.)*w*1.1+sin(age*6.+s.w*6.)*R*.03,-h*1.1+age*h*2.6,(s.w*2.-1.)*d);col=vec3(.6,.9,1.)*1.5*fadeLife(age);size=R*(.025+.03*s.x);vShape=1.;}
  else if(uKind==2){// fireflies wander low round the butterfly and down to the water, blinking
    p=vec3(c.x+w*1.3*sin(uLocal*.17*(1.+s.x)+s.y*6.283),mix(uWaterY+3.,c.y,s.z*.8)+sin(uLocal*.6+s.w*6.)*h*.08,c.z+d*1.2*cos(uLocal*.13*(1.+s.w)+s.x*6.283));
    float pulse=pow(max(0.,sin(uTime*(1.5+s.x*2.)+s.y*20.)),4.);col=vec3(.75,1.,.35)*(.1+3.*pulse);size=R*.04;}
  else if(uKind==3){float age=fract(uLocal/(14.+6.*s.x)+s.y);// lanterns rise from the water with the balloons
    p=vec3(c.x+(s.z*2.-1.)*w*1.4+sin(age*5.+s.w*6.)*R*.04,uWaterY+1.+age*(c.y+h*1.4-uWaterY),c.z+(s.w*2.-1.)*d*1.3);
    col=vec3(1.,.55,.18)*2.2*fadeLife(age)*(.85+.15*sin(uTime*7.+s.x*30.));size=R*.04;}
  else if(uKind==4){// two searchlights sweep from the top of the tower; overlapping soft dots make each beam
    float b=floor(aIndex*2.),k=fract(aIndex*2.),a=uTime*.9+b*3.1416;vec3 dir=normalize(vec3(cos(a),-.04,sin(a)));
    p=c+vec3(0.,h*1.02,0.)+dir*k*R*4.;/* passes well above the audience camera */col=vec3(1.,.92,.75)*(.55*pow(1.-k,1.5)+.03);size=R*(.04+.14*k);}
  else if(uKind==5){// fireboats salute the ship: three arcs of spray from the water in front of it
    float j=floor(aIndex*3.),u=fract(fract(aIndex*3.)+uLocal*.35);vec3 base=vec3(c.x+(j-1.)*w*.6,uWaterY,c.z+d*1.2+R*.2);/* the outer jets cross in an arch */
    p=base+vec3((1.-j)*u*w*.6+(s.x-.5)*R*.06,4.*u*(1.-u)*R*(j==1.?.55:.8),(s.y-.5)*R*.06);col=vec3(.75,.9,1.)*2.*(1.-u*.6);size=R*.016*(1.+u);}
  else if(uKind==6){float age=fract(uLocal/4.5+s.x);// ripples spread on the water under the whale
    p=vec3(c.x+(s.y*2.-1.)*w*.9,uWaterY+.05,c.z+(s.z*2.-1.)*d);size=R*(.05+age*.5);col=vec3(.5,.8,1.)*.8*pow(1.-age,1.5);vShape=5.;}
  else if(uKind==7){float age=fract(uLocal/(7.+4.*s.x)+s.y);// glitter stars drift down round the firework star
    p=c+vec3((s.z*2.-1.)*w*1.25,h*1.3-age*h*2.8,(s.w*2.-1.)*d);float tw=.6+.4*sin(uTime*(4.+s.x*5.)+s.y*20.);
    col=mix(vec3(1.,.82,.4),vec3(1.),s.w)*2.2*tw*fadeLife(age);size=R*(.04+.03*s.x);vShape=2.;}
  else if(uKind==8){float age=fract(uLocal/(3.+2.*s.x)+s.y);// embers rise and curl over the row of fire
    p=c+vec3((s.z*2.-1.)*w*1.05+sin(age*5.+s.w*9.)*R*.04,-h*.6+age*h*1.9,(s.w*2.-1.)*d*.6);
    col=mix(vec3(1.,.75,.3),vec3(1.,.2,.05),age)*3.*fadeLife(age)*(.7+.3*sin(uTime*13.+s.x*40.));size=R*.022*(1.-age*.5);}
  else if(uKind==9){float age=fract(uLocal/(8.+4.*s.x)+s.y);// confetti flutters down
    p=c+vec3((s.z*2.-1.)*w*1.4+sin(uTime*1.3+s.w*20.)*R*.05,h*1.5-age*h*3.,(s.w*2.-1.)*d*1.2);
    float q=floor(s.w*5.);col=q<1.?vec3(1.,.35,.6):q<2.?vec3(1.,.8,.25):q<3.?vec3(.35,1.,.7):q<4.?vec3(.4,.7,1.):vec3(.75,.45,1.);
    col*=1.6*fadeLife(age);size=R*.036;vShape=4.;vSpin=uTime*(3.+s.x*4.)+s.y*20.;}
  else if(uKind==10){float age=fract(uLocal/(1.6+s.x)+s.y);// sparks burst from the base of the starship
    vec3 v=normalize(vec3(s.z*2.-1.,.15+s.w*.5,s.x*2.-1.));p=c+vec3(0.,-h,0.)+v*age*R*.7-vec3(0.,age*age*R*.35,0.);
    col=mix(vec3(1.,.95,.75),vec3(1.,.45,.1),age)*3.*(1.-age);size=R*.022;}
  else if(uKind==11){float age=fract(uLocal/(6.+3.*s.x)+s.y);// little hearts float up beside the heart, never over the family inside it
    p=c+vec3((s.z<.5?-1.:1.)*w*(1.15+fract(s.z*2.)*.85)+sin(age*4.+s.w*7.)*R*.05,-h*1.2+age*h*2.8,d*(.2+s.w*.4));col=mix(vec3(1.,.25,.45),vec3(1.,.6,.8),s.x)*1.9*fadeLife(age);size=R*(.1+.05*s.x);vShape=3.;}
  else{// a shower of shooting stars radiating from behind the star
    float m=floor(aIndex*10.),k=fract(aIndex*10.),hm=hash1(m+1.),P=1.8+hm*1.6,age=fract(uLocal/P+hm),a=hm*6.283+m*.63;
    float dist=R*(1.1+age*3.)-k*R*.6;p=c+vec3(cos(a),sin(a),0.)*max(dist,0.)+vec3(0.,0.,-R*.2);col=mix(vec3(.85,.9,1.),vec3(1.,.85,.5),hm)*2.6*(1.-k)*(1.-k)*fadeLife(age);size=R*.02;}
  col*=uAlpha*mix(.7,1.,uNight);
  vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
  if(dot(col,col)<1e-6){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vColor=vec3(0.);return;}
  vColor=col;vFlat=clamp(abs(normalize(cameraPosition-(modelMatrix*vec4(p,1.)).xyz).y),.12,1.);
  gl_PointSize=clamp(size*projectionMatrix[1][1]*uViewport*.5/max(1.,-mv.z),uMinPx,uMaxPx);
}`;
const FRAGMENT=`varying vec3 vColor;varying float vShape,vSpin,vFlat;
void main(){vec2 q=gl_PointCoord-.5;float shape=vShape;
  if(shape>4.5){q.y/=vFlat;shape=1.;}// a ring lying on the water looks like an ellipse from the shore
  float r=length(q)*2.;if(r>1.)discard;float core=1.-smoothstep(0.,.45,r),a;
  if(shape<.5)a=core*.65+(1.-r)*(1.-r)*.6;
  else if(shape<1.5)a=exp(-pow((r-.72)/.12,2.))+core*.12;
  else if(shape<2.5)a=pow(max(0.,1.-abs(q.x)*abs(q.y)*80.),3.)*(1.-r)+core*.5;
  else if(shape<3.5){vec2 h=vec2(q.x*2.4,.25-q.y*2.4);float f=pow(dot(h,h)-.25,3.)-h.x*h.x*h.y*h.y*h.y*.7;a=1.-smoothstep(-.002,.002,f);}
  else{float cs=cos(vSpin),sn=sin(vSpin);vec2 k=vec2(cs*q.x-sn*q.y,sn*q.x+cs*q.y);k.x/=max(.15,abs(cos(vSpin*1.7)));a=step(abs(k.x),.42)*step(abs(k.y),.2);}
  gl_FragColor=vec4(vColor*a,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class SceneAccents{
  constructor(show,{waterY=-1.1,budget=1,quiet=false,seed=26}={}){
    this.windows=quiet?[]:accentWindows(show);this.group=new THREE.Group();this.group.name='SceneAccents';this.kinds={};this.night=1;
    const used=new Set(this.windows.map(w=>w.kind)),r=mulberry32(seed);
    for(const kind of KINDS){if(!used.has(kind))continue;
      const n=Math.max(8,Math.round(ACCENTS[kind][0]*(kind==='beacons'||kind==='shower'||kind==='ripples'||kind==='spray'?1:budget))),seeds=new Float32Array(n*4),index=new Float32Array(n);
      for(let i=0;i<n;i++){for(let k=0;k<4;k++)seeds[i*4+k]=r();index[i]=i/n;}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));g.setAttribute('aIndex',new THREE.BufferAttribute(index,1));
      const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
        uniforms:{uKind:{value:KINDS.indexOf(kind)},uCenter:{value:new THREE.Vector3()},uHalf:{value:new THREE.Vector3(1,1,1)},uAlpha:{value:0},uLocal:{value:0},uTime:{value:0},
          uWaterY:{value:waterY},uViewport:{value:720},uMinPx:{value:1},uMaxPx:{value:80},uNight:{value:1}}});
      const points=new THREE.Points(g,material);points.name='accent-'+kind;points.frustumCulled=false;points.visible=false;points.renderOrder=2;
      points.onBeforeRender=renderer=>{const target=renderer.getRenderTarget(),size=renderer.getDrawingBufferSize(TMP),u=material.uniforms;u.uViewport.value=target?target.height:size.y;
        u.uMinPx.value=Math.max(1,renderer.getPixelRatio()*(target?target.height/Math.max(1,size.y):1));material.uniformsNeedUpdate=true;};
      this.kinds[kind]=points;this.group.add(points);
    }
  }
  setNight(night){this.night=night;for(const p of Object.values(this.kinds))p.material.uniforms.uNight.value=night;}
  /** The accent (if any) of each kind at show time `time`; t is real time for twinkles. Returns the kinds drawn. */
  update(time,t){
    const best={};
    for(const w of this.windows){if(time<w.start-.01||time>w.end)continue;const alpha=Math.min(1,(time-w.start)/1.5,(w.end-time)/1.5);if(!best[w.kind]||alpha>best[w.kind].alpha)best[w.kind]={w,alpha};}
    for(const [kind,points] of Object.entries(this.kinds)){
      const hit=best[kind];points.visible=!!hit&&hit.alpha>0;if(!points.visible)continue;const {w,alpha}=hit,u=points.material.uniforms;
      const k=Math.min(1,Math.max(0,(time-w.stageStart)/Math.max(.001,w.stageEnd-w.stageStart)));// a rising formation carries its accent with it
      u.uCenter.value.set(...w.from.center.map((v,i)=>v+(w.to.center[i]-v)*k));u.uHalf.value.set(...w.from.half.map((v,i)=>v+(w.to.half[i]-v)*k));
      u.uAlpha.value=alpha;u.uLocal.value=time-w.start;u.uTime.value=t;
    }
    return Object.keys(best).filter(k=>best[k].alpha>0);
  }
}
const TMP=new THREE.Vector2();
