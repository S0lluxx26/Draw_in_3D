// Harbour life: the small things that make the show's night (and late afternoon) feel alive. Built the
// lightweight-game-objects way: every family is ONE draw call, moved entirely by maths in its vertex shader from
// a time uniform (the CPU only sets a few uniforms per frame), sized by a per-tier budget and frozen under
// reduced motion. Positions are in the Blender scenery's metres (tools/blender/build_environment.py), × scale.
//
//   family            draw  what it is                                                     budget (high tier)
//   traffic           1     head/tail lights over the bridge deck and along the shore road  184 points
//   water lanterns    1     floating paper lanterns (đèn hoa đăng) drifting round the show  72 points
//   sky lanterns      1     lanterns rising from the far shore, swaying, fading high up     30 points
//   boats             2     spectator boats looping slowly; nav/cabin lights + glowing wake 10 hulls × 30 tris, 200 points
//   glints            1     water sparkles in the formation's colour, a moon (or sun) path  780 points
//   sky events        1     shooting stars at night, a distant plane's blinking lights     73 points
//   gulls             1     a few gulls gliding over the foreground water (afternoon)       14 × 8 tris
//   photo flashes     1     cameras flashing in the crowd on the far shore, busiest in fireworks  300 points
import * as THREE from 'three';

/** Small seeded random, so the scenery is the same every visit and never touches the show's own randomness. */
export function mulberry32(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

// Scenery landmarks (stage metres), measured from assets/sky-stage.blend.
export const HARBOUR={
  waterY:-1.1,
  deck:{x:110,z:95},// launch deck half-size, with a margin
  ships:[[-270,-270],[285,-250],[-174,-410],[-520,-220],[500,-480],[-300,-640],[200,-560]],// barges, yacht, sailboats, tug
  bridge:[[373,45.9,-531],[604,45.9,-656],[836,45.9,-781],[1077,45.9,-883],[1308,45.9,-1007],[1602,45.9,-1197],[1833,45.9,-1321],[2076,45.7,-1424],[2306,45.7,-1549]],
  road:{x0:-3500,x1:3500,y:3.8,lanes:[-1034,-1041]},
  shore:{z:-1027,y:4.6},
  camera:[0,380],moon:[.525,-.851],sun:[-.552,-.834]
};
const scaled=(n,budget,min=1)=>Math.max(min,Math.round(n*budget));

/** The whole harbour as plain numbers: pure and seeded, so tests can check where everything goes. */
export function lifePlan(budget=1,seed=20261001){
  const r=mulberry32(seed),between=(a,b)=>a+(b-a)*r(),H=HARBOUR;
  // Traffic: two lanes each way on the bridge, one each way on the shore road.
  const traffic=[];
  for(const [lane,dir] of [[-6,1],[-2.5,1],[2.5,-1],[6,-1]])for(let i=0,n=scaled(24,budget);i<n;i++)traffic.push({route:0,dir,lane,speed:between(11,16),phase:r(),size:between(2.8,3.6),tint:r()});
  for(const [lane,dir] of [[H.road.lanes[0],1],[H.road.lanes[1],-1]])for(let i=0,n=scaled(110,budget);i<n;i++)traffic.push({route:1,dir,lane,speed:between(8,14),phase:r(),size:between(2.6,3.4),tint:r()});
  // Floating lanterns drifting slowly round the launch area, a ring just beyond the buoys. A lantern keeps its ring as it
  // drifts; normalised radius 1.06–1.32 clears the buoys (≤ .91) and the anchored barges (≥ 1.55).
  const ring={cx:0,cz:0,rx:280,rz:205},palette=[[1,.5,.12],[1,.72,.25],[1,.32,.22],[1,.45,.6],[1,.82,.45]],lanterns=[];
  for(let i=0,n=scaled(96,budget);i<n;i++){const a=r()*Math.PI*2,f=between(1.06,1.32);
    const c=palette[Math.floor(r()*palette.length)];lanterns.push({angle:a,radius:f,phase:r(),drift:(r()<.5?-1:1)*between(.0012,.003),tint:c.map(v=>v*between(1.5,2.1))});}
  // Sky lanterns rising from the far shore.
  const sky=[];for(let i=0,n=scaled(44,budget);i<n;i++)sky.push({x:between(-1900,1900),z:between(-1060,-1012),phase:r(),rise:between(1.8,2.6),seeds:[r(),r()]});
  // Spectator boats on long thin loops: one band in front of the deck, one between the anchored ships and the shore.
  const boats=[];
  for(const band of [{cz:232,A:[520,1100],B:[22,48],cx:150,speed:[4,6.5],n:4},{cz:-810,A:[650,1350],B:[35,65],cx:280,speed:[5,8],n:6}])
    for(let i=0,n=scaled(band.n,budget);i<n;i++){const A=between(...band.A);boats.push({cx:between(-band.cx,band.cx),cz:band.cz+between(-25,25),A,B:between(...band.B),w:between(...band.speed)/A,phase:r()*Math.PI*2,dir:r()<.5?-1:1,scale:between(.85,1.25)});}
  // Glints: sparkles under the show (tinted by the formation) and a light path on the water toward the moon or sun.
  const glints=[];
  for(let i=0,n=scaled(520,budget);i<n;i++){let x,z;do{const a=r()*Math.PI*2,f=Math.sqrt(r());x=Math.cos(a)*650*f;z=-60+Math.sin(a)*420*f;}while(Math.abs(x)<H.deck.x&&Math.abs(z)<H.deck.z);glints.push({x,z,phase:r(),rate:between(1.6,3.4),kind:0});}
  for(const [kind,dir] of [[1,H.moon],[2,H.sun]])for(let i=0,n=scaled(130,budget);i<n;i++){const l=between(120,1600),side=(r()-.5)*(10+l*.07);
    glints.push({x:H.camera[0]+dir[0]*l-dir[1]*side,z:H.camera[1]+dir[1]*l+dir[0]*side,phase:r(),rate:between(2,4.5),kind});}
  // Shooting stars (5 × a 14-point trail) and one distant plane (three lights).
  const meteors=[];for(let m=0;m<5;m++){const base={azimuth:between(-1.2,1.2),elevation:between(.45,.95),travel:between(-.6,.6),period:between(17,31),seed:r()};for(let k=0;k<28;k++)meteors.push({...base,k:k/27});}
  for(let k=1;k<=3;k++)meteors.push({azimuth:0,elevation:.14,travel:0,period:520,seed:.37,k:-k});
  // Gulls circling over the water just behind the show's line, where both the wide PC view and the narrow portrait view
  // see them as they pass (the director camera sits at z ≈ 220–450). Against the low evening sun they read as silhouettes.
  const gulls=[];for(let i=0,n=scaled(14,budget);i<n;i++){const cx=(r()<.5?-1:1)*between(60,260),cz=between(-150,-20);
    gulls.push({cx,cz,radius:between(30,70),y:between(35,85),speed:between(7,11),phase:r()*Math.PI*2,flap:between(5,7),dir:r()<.5?-1:1});}
  // Cameras in the crowd along the far promenade.
  // most of the crowd faces the show from the central promenade
  const flashes=[];for(let i=0,n=scaled(300,budget);i<n;i++)flashes.push({x:(r()<.75?between(-1400,1400):between(-2600,2600)),phase:r(),seed:r()});
  return {traffic,ring,lanterns,sky,boats,glints,meteors,gulls,flashes};
}

/** Where a boat is at time t (stage metres) and its heading (radians from +z), the same maths as the shaders. */
export function boatPose(b,t){const a=b.phase+b.dir*b.w*t,vx=-Math.sin(a)*b.A*b.dir,vz=Math.cos(a)*b.B*b.dir;return {x:b.cx+Math.cos(a)*b.A,z:b.cz+Math.sin(a)*b.B,heading:Math.atan2(vx,vz)};}

/** How busy the crowd is: fireworks bursting around show time t (0 quiet … 1 a big salvo). */
export function excitement(bursts,t){
  if(!bursts?.length)return 0;let lo=0,hi=bursts.length;while(lo<hi){const m=(lo+hi)>>1;if(bursts[m]<t-2)lo=m+1;else hi=m;}
  let n=0;for(let i=lo;i<bursts.length&&bursts[i]<=t+.3;i++)n++;return Math.min(1,n/3);
}

// ---- shaders ------------------------------------------------------------------------------------------------
const COMMON=`uniform float uTime,uViewport,uMinPx,uMaxPx,uFog,uNight,uScale;varying vec3 vColor;varying float vSoft;
float hash1(float n){return fract(sin(n*12.9898)*43758.5453);}
float pointPx(float world,vec4 mv){return clamp(world*uScale*projectionMatrix[1][1]*uViewport*.5/max(1.,-mv.z),uMinPx,uMaxPx);}
float fogKeep(vec4 mv){float d=-mv.z*uFog;return exp(-d*d);}
#define HIDE {gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vColor=vec3(0.);vSoft=0.;return;}
`;
const BOAT=`vec3 boatPose(vec4 a,vec4 b,float t){float ang=b.y+b.z*b.x*t;vec2 v=vec2(-sin(ang)*a.z,cos(ang)*a.w)*b.z;return vec3(a.x+cos(ang)*a.z,a.y+sin(ang)*a.w,atan(v.x,v.y));}
vec3 turnY(vec3 p,float h){float c=cos(h),s=sin(h);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
`;
const DOT_FRAGMENT=`varying vec3 vColor;varying float vSoft;
void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;if(r>1.)discard;float halo=(1.-r)*(1.-r),core=1.-smoothstep(0.,.42,r);
  gl_FragColor=vec4(vColor*mix(core,core*.55+halo*.7,vSoft),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const TRAFFIC=`attribute vec4 aRoute;attribute vec4 aLife;uniform vec3 uBridge[9];uniform float uCum[9];uniform float uBridgeLen;uniform vec3 uRoad;
void main(){vec3 p;
  if(aRoute.x<.5){float u=fract(aLife.x+aRoute.y*uTime*aRoute.w/uBridgeLen);vec3 d=normalize(uBridge[1]-uBridge[0]);p=uBridge[0];
    for(int i=0;i<8;i++){if(u>=uCum[i]&&u<=uCum[i+1]){p=mix(uBridge[i],uBridge[i+1],(u-uCum[i])/max(1e-5,uCum[i+1]-uCum[i]));d=normalize(uBridge[i+1]-uBridge[i]);}}
    p+=normalize(vec3(-d.z,0.,d.x))*aRoute.z;}
  else{float u=fract(aLife.x+aRoute.y*uTime*aRoute.w/(uRoad.y-uRoad.x));p=vec3(mix(uRoad.x,uRoad.y,u),uRoad.z,aRoute.z);}
  vec4 mv=modelViewMatrix*vec4(p*uScale,1.);gl_Position=projectionMatrix*mv;
  vColor=mix(vec3(1.,.86,.62)*2.6,vec3(1.,.08,.04)*3.1,step(0.,aRoute.y))*(.75+.5*aLife.z)*mix(.45,1.,uNight)*fogKeep(mv);vSoft=.45;gl_PointSize=pointPx(aLife.y,mv);}`;
const LANTERNS=`attribute vec4 aLife;attribute vec3 aTint;uniform vec4 uRing;uniform float uWaterY;
void main(){float a=aLife.x+uTime*aLife.w;
  vec3 p=vec3(uRing.x+cos(a)*uRing.z*aLife.y,uWaterY+.55+sin(uTime*1.1+aLife.z*6.283)*.18,uRing.y+sin(a)*uRing.w*aLife.y);
  vec4 mv=modelViewMatrix*vec4(p*uScale,1.);gl_Position=projectionMatrix*mv;
  float flicker=.82+.1*sin(uTime*8.7+aLife.z*40.)+.08*sin(uTime*13.1+aLife.z*17.);
  vColor=aTint*flicker*mix(.5,1.,uNight)*fogKeep(mv);vSoft=1.;gl_PointSize=pointPx(6.2,mv);}`;
const SKY_LANTERNS=`attribute vec4 aLife;attribute vec2 aSeed;uniform float uPeriod,uWind;
void main(){float age=fract(aLife.z+uTime/uPeriod)*uPeriod,y=5.+age*aLife.w;
  vec3 p=vec3(aLife.x+age*uWind+sin(age*.11+aSeed.x*6.)*18.,y,aLife.y-age*.4+cos(age*.09+aSeed.y*6.)*12.);
  vec4 mv=modelViewMatrix*vec4(p*uScale,1.);gl_Position=projectionMatrix*mv;
  float fade=smoothstep(0.,8.,age)*(1.-smoothstep(260.,420.,y));if(fade<.002)HIDE
  vColor=vec3(1.,.55,.18)*2.6*fade*(.85+.15*sin(uTime*7.3+aSeed.x*30.))*mix(.35,1.,uNight)*fogKeep(mv);vSoft=1.;gl_PointSize=pointPx(7.5,mv);}`;
const BOAT_LIGHTS=`attribute vec4 aBoatA;attribute vec4 aBoatB;attribute vec4 aLight;uniform float uWaterY;
void main(){vec3 bp=boatPose(aBoatA,aBoatB,uTime),p;float size=2.6;
  if(aLight.w<3.5){p=turnY(aLight.xyz*aBoatB.w,bp.z)+vec3(bp.x,uWaterY+sin(uTime*1.3+aBoatB.y*3.)*.12,bp.y);
    vColor=aLight.w<.5?vec3(3.,.1,.05):aLight.w<1.5?vec3(.15,3.,.4):aLight.w<2.5?vec3(2.4,2.3,2.1):vec3(2.,1.15,.45);vColor*=mix(.35,1.,uNight);}
  else{float k=aLight.z,side=mod(k,2.)<.5?-1.:1.;vec3 q=boatPose(aBoatA,aBoatB,uTime-k*.55);
    p=vec3(q.x,uWaterY+.06,q.y)+turnY(vec3(side*(1.6+k*.85),0.,-5.*aBoatB.w),q.z);float fade=(1.-k/16.)*(1.-k/16.);
    vColor=mix(vec3(.8,.85,.9)*.3,vec3(.3,.8,1.)*.38,uNight)*fade;size=1.1+k*.1;}
  vec4 mv=modelViewMatrix*vec4(p*uScale,1.);gl_Position=projectionMatrix*mv;vColor*=fogKeep(mv);vSoft=.6;gl_PointSize=pointPx(size,mv);}`;
const GLINTS=`attribute vec4 aGlint;attribute float aKind;uniform float uWaterY,uGlowAmount;uniform vec3 uGlow,uMoonPath,uSunPath;
void main(){float s=sin(uTime*aGlint.w+aGlint.z*6.283),pulse=pow(max(s,0.),18.);if(pulse<.01)HIDE
  vec3 c=aKind<.5?mix(vec3(1.),uGlow,.7)*uGlowAmount*1.7:aKind<1.5?uMoonPath:uSunPath;if(dot(c,c)<1e-5)HIDE
  vec4 mv=modelViewMatrix*vec4(vec3(aGlint.x,uWaterY+.05,aGlint.y)*uScale,1.);gl_Position=projectionMatrix*mv;
  vColor=c*pulse*fogKeep(mv);vSoft=.25;gl_PointSize=pointPx(1.5,mv);}`;
const SKY_EVENTS=`attribute vec4 aMeteor;attribute vec2 aTrail;uniform float uMeteors,uPlane;
vec3 skyDir(float az,float el){return vec3(cos(el)*sin(az),sin(el),-cos(el)*cos(az));}
void main(){vec3 d;
  if(aTrail.x>=0.){float c=(uTime+aTrail.y*97.)/aMeteor.w,n=floor(c),age=fract(c)*aMeteor.w;if(uMeteors<.5||age>1.1)HIDE
    vec3 d0=skyDir(aMeteor.x+hash1(n+aTrail.y)*1.4-.7,aMeteor.y+hash1(n*1.7+aTrail.y)*.25),east=normalize(vec3(cos(aMeteor.x),0.,sin(aMeteor.x)));
    vec3 travel=normalize(east*cos(aMeteor.z*3.)+vec3(0.,-.6,0.));d=normalize(d0+travel*(age*.32-aTrail.x*.09));
    vColor=vec3(.85,.9,1.)*3.*(1.-aTrail.x)*(1.-aTrail.x)*smoothstep(0.,.12,age)*(1.-smoothstep(.55,1.05,age));gl_PointSize=(aTrail.x<.02?3.:2.2)*uMinPx;}
  else{float k=-aTrail.x,az=.9+uTime*6.2832/aMeteor.w;d=skyDir(az+(k<1.5?-.0035:k<2.5?.0035:0.),aMeteor.y+(k>2.5?.0012:0.));
    float strobe=step(fract(uTime/1.25),.06);vColor=(k<1.5?vec3(2.2,.08,.05):k<2.5?vec3(.1,2.,.3):vec3(3.)*strobe)*uPlane;if(uPlane<.01)HIDE
    gl_PointSize=1.8*uMinPx;}
  vec4 p=projectionMatrix*modelViewMatrix*vec4(d,1.);gl_Position=p.xyww;vSoft=.2;}`;
const FLASHES=`attribute vec3 aFlash;uniform float uExcite,uRate;uniform vec2 uShore;
void main(){float c=uTime*uRate+aFlash.y,n=floor(c);
  if(fract(c)>.12*uRate||hash1(n*3.1+aFlash.z*91.)>.12+.7*uExcite)HIDE
  vec4 mv=modelViewMatrix*vec4(vec3(aFlash.x,uShore.y,uShore.x+aFlash.z*7.)*uScale,1.);gl_Position=projectionMatrix*mv;
  vColor=vec3(3.2,3.3,3.6)*fogKeep(mv);vSoft=.6;gl_PointSize=pointPx(4.5,mv);}`;
// Lambert with an injected pose: boats loop their paths, gulls circle and flap. One instanced draw each.
function posedLambert(prefix,normal,vertex,key){
  const m=new THREE.MeshLambertMaterial({vertexColors:true}),uniforms={uTime:{value:0},uScale:{value:1},uWaterY:{value:-1.1}};
  m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+prefix)
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n'+normal).replace('#include <begin_vertex>','#include <begin_vertex>\n'+vertex);};
  m.customProgramCacheKey=()=>key;m.userData.uniforms=uniforms;return m;
}
const BOAT_PREFIX='attribute vec4 aBoatA;attribute vec4 aBoatB;uniform float uTime,uScale,uWaterY;\n'+BOAT;
const GULL_PREFIX='attribute float aWing;attribute vec4 aFly;attribute vec4 aFly2;uniform float uTime,uScale;\nvec3 turnY(vec3 p,float h){float c=cos(h),s=sin(h);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}';

// Low-poly shapes with vertex colours (forward +Z, up +Y).
function boatGeometry(){
  const P=[],C=[],quad=(a,b,c,d,col)=>{P.push(...a,...b,...c,...a,...c,...d);for(let i=0;i<6;i++)C.push(...col);},tri=(a,b,c,col)=>{P.push(...a,...b,...c);for(let i=0;i<3;i++)C.push(...col);};
  const hull=[.86,.88,.9],side=[.62,.68,.74],deck=[.36,.27,.2],cabin=[.94,.94,.92],glass=[.08,.12,.16];
  const top={b:[0,1.2,5.2],l:[-1.6,1.2,1.4],r:[1.6,1.2,1.4],sl:[-1.5,1.2,-5],sr:[1.5,1.2,-5]},bot={b:[0,0,4.6],l:[-1.15,0,1.2],r:[1.15,0,1.2],sl:[-1.1,0,-4.8],sr:[1.1,0,-4.8]};
  quad(top.b,top.l,bot.l,bot.b,hull);quad(top.r,top.b,bot.b,bot.r,hull);quad(top.l,top.sl,bot.sl,bot.l,side);quad(top.sr,top.r,bot.r,bot.sr,side);quad(top.sl,top.sr,bot.sr,bot.sl,side);
  tri(top.b,top.r,top.l,deck);quad(top.l,top.r,top.sr,top.sl,deck);
  const c0=[-.9,1.2,-2.6],c1=[.9,1.2,-2.6],c2=[.9,1.2,.7],c3=[-.9,1.2,.7],u=p=>[p[0],2.35,p[2]];
  quad(u(c3),u(c2),u(c1),u(c0),cabin);quad(c3,c2,u(c2),u(c3),glass);quad(c1,c0,u(c0),u(c1),cabin);quad(c0,c3,u(c3),u(c0),glass);quad(c2,c1,u(c1),u(c2),glass);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.computeVertexNormals();return g;
}
function gullGeometry(){// a body sliver and two wings in two segments; aWing 0 at the body, ±1 at the tips (after sky-life.ts)
  const P=[],W=[],C=[],tri=(a,b,c,w,col)=>{P.push(...a,...b,...c);W.push(...w);for(let i=0;i<3;i++)C.push(...col);};
  const white=[.62,.6,.6],grey=[.3,.3,.33];// backlit by the low sun: soft silhouettes
  for(const s of [-1,1]){tri([0,0,.18],[s*.5,.02,-.05],[0,0,-.12],[0,s*.5,0],white);tri([s*.5,.02,-.05],[s,0,-.2],[0,0,-.12],[s*.5,s,0],grey);}
  tri([0,.03,.42],[.06,0,-.1],[-.06,0,-.1],[0,0,0],white);tri([0,0,-.1],[.14,0,-.42],[-.14,0,-.42],[0,0,0],white);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('aWing',new THREE.Float32BufferAttribute(W,1));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.computeVertexNormals();return g;
}

export class HarbourLife{
  constructor({scale=1,budget=1,quiet=false,seed}={}){
    const plan=this.plan=lifePlan(budget,seed),s=scale;Object.assign(this,{scale,quiet,night:1});
    this.group=new THREE.Group();this.group.name='HarbourLife';this.points=[];
    // Traffic
    const bridge=HARBOUR.bridge.map(p=>new THREE.Vector3(...p)),cum=[0];for(let i=1;i<bridge.length;i++)cum.push(cum[i-1]+bridge[i].distanceTo(bridge[i-1]));const length=cum.at(-1);
    this.addPoints('traffic',TRAFFIC,{aRoute:[4,plan.traffic.map(c=>[c.route,c.dir,c.lane,c.speed])],aLife:[4,plan.traffic.map(c=>[c.phase,c.size,c.tint,0])]},
      {uBridge:{value:bridge},uCum:{value:cum.map(v=>v/length)},uBridgeLen:{value:length},uRoad:{value:new THREE.Vector3(HARBOUR.road.x0,HARBOUR.road.x1,HARBOUR.road.y)}});
    this.addPoints('lanterns',LANTERNS,{aLife:[4,plan.lanterns.map(l=>[l.angle,l.radius,l.phase,l.drift])],aTint:[3,plan.lanterns.map(l=>l.tint)]},
      {uRing:{value:new THREE.Vector4(plan.ring.cx,plan.ring.cz,plan.ring.rx,plan.ring.rz)},uWaterY:{value:HARBOUR.waterY}});
    this.addPoints('skyLanterns',SKY_LANTERNS,{aLife:[4,plan.sky.map(l=>[l.x,l.z,l.phase,l.rise])],aSeed:[2,plan.sky.map(l=>l.seeds)]},{uPeriod:{value:200},uWind:{value:.55}});
    // Boats: instanced hulls (one draw) and their lights and wake (one draw), from the same path maths.
    const boatA=plan.boats.map(b=>[b.cx,b.cz,b.A,b.B]),boatB=plan.boats.map(b=>[b.w,b.phase,b.dir,b.scale]);
    const hulls=boatGeometry();hulls.setAttribute('aBoatA',new THREE.InstancedBufferAttribute(new Float32Array(boatA.flat()),4));hulls.setAttribute('aBoatB',new THREE.InstancedBufferAttribute(new Float32Array(boatB.flat()),4));
    const hullMaterial=posedLambert(BOAT_PREFIX,'vec3 bp=boatPose(aBoatA,aBoatB,uTime);objectNormal=turnY(objectNormal,bp.z);',
      'transformed=turnY(transformed*aBoatB.w,bp.z)+vec3(bp.x,uWaterY+sin(uTime*1.3+aBoatB.y*3.)*.12,bp.y);transformed*=uScale;','harbour-boats');
    this.boats=new THREE.InstancedMesh(hulls,hullMaterial,plan.boats.length);this.boats.frustumCulled=false;this.boats.name='boats';this.group.add(this.boats);
    const lights=[[-1.55,1.4,1.6,0],[1.55,1.4,1.6,1],[0,3.6,-.4,2],[0,1.9,-1.2,3]],L=[],A=[],B=[];
    plan.boats.forEach((b,i)=>{for(const l of lights){L.push(l);A.push(boatA[i]);B.push(boatB[i]);}for(let k=0;k<16;k++){L.push([0,0,k,4]);A.push(boatA[i]);B.push(boatB[i]);}});
    this.addPoints('boatLights',BOAT+BOAT_LIGHTS,{aBoatA:[4,A],aBoatB:[4,B],aLight:[4,L]},{uWaterY:{value:HARBOUR.waterY}});
    const night=new THREE.Vector3(.55,.62,.8),gold=new THREE.Vector3(2.2,1.3,.55);this.pathColors={night,gold};
    this.addPoints('glints',GLINTS,{aGlint:[4,plan.glints.map(g=>[g.x,g.z,g.phase,g.rate])],aKind:[1,plan.glints.map(g=>[g.kind])]},
      {uWaterY:{value:HARBOUR.waterY},uGlow:{value:new THREE.Color(1,1,1)},uGlowAmount:{value:0},uMoonPath:{value:night.clone()},uSunPath:{value:new THREE.Vector3()}});
    const events=this.addPoints('skyEvents',SKY_EVENTS,{aMeteor:[4,plan.meteors.map(m=>[m.azimuth,m.elevation,m.travel,m.period])],aTrail:[2,plan.meteors.map(m=>[m.k,m.seed])]},{uMeteors:{value:1},uPlane:{value:1}});
    events.scale.setScalar(7000*s);events.renderOrder=-8;events.onBeforeRender=(r,scene,camera)=>{events.position.copy(camera.position);events.updateMatrixWorld();this.viewport(r,events.material);};
    // Gulls: instanced, wings flap in the vertex shader and fold for glides.
    const gull=gullGeometry(),G=plan.gulls;
    gull.setAttribute('aFly',new THREE.InstancedBufferAttribute(new Float32Array(G.flatMap(g=>[g.cx,g.cz,g.radius,g.y])),4));gull.setAttribute('aFly2',new THREE.InstancedBufferAttribute(new Float32Array(G.flatMap(g=>[g.speed,g.phase,g.flap,g.dir])),4));
    const gullMaterial=posedLambert(GULL_PREFIX,'float ang=aFly2.y+aFly2.w*aFly2.x/aFly.z*uTime,head=atan(-sin(ang)*aFly2.w,cos(ang)*aFly2.w);objectNormal=turnY(objectNormal,head);',
      'float glide=step(.35,sin(uTime*.5+aFly2.y*3.)),flap=sin(uTime*aFly2.z+aFly2.y*7.)*mix(1.,.15,glide);transformed.y+=abs(aWing)*flap*.42;'+
      'float bank=.38*aFly2.w,cb=cos(bank),sb=sin(bank);transformed.xy=vec2(cb*transformed.x-sb*transformed.y,sb*transformed.x+cb*transformed.y);'+
      'transformed=turnY(transformed*3.,head)+vec3(aFly.x+cos(ang)*aFly.z,aFly.w+sin(uTime*.37+aFly2.y)*5.,aFly.y+sin(ang)*aFly.z);transformed*=uScale;','harbour-gulls');
    gullMaterial.side=THREE.DoubleSide;
    this.gulls=new THREE.InstancedMesh(gull,gullMaterial,G.length);this.gulls.frustumCulled=false;this.gulls.name='gulls';this.group.add(this.gulls);
    this.addPoints('flashes',FLASHES,{aFlash:[3,plan.flashes.map(f=>[f.x,f.phase,f.seed])]},{uExcite:{value:0},uRate:{value:.6},uShore:{value:new THREE.Vector2(HARBOUR.shore.z,HARBOUR.shore.y)}});
    for(const mesh of [this.boats,this.gulls]){const u=mesh.material.userData.uniforms;u.uScale.value=s;u.uWaterY.value=HARBOUR.waterY;}
    // Reduced motion: everything holds still at one moment; nothing flashes or streaks across the sky.
    this.frozen=37.5;if(quiet){this.byName.flashes.visible=false;this.byName.skyEvents.material.uniforms.uMeteors.value=0;}
    this.setSky(1);
  }
  // One Points draw per family: a shared soft-dot fragment, attributes from the plan, uniforms per family.
  addPoints(name,vertex,attributes,uniforms){
    const n=Object.values(attributes)[0][1].length,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
    for(const [key,[size,rows]] of Object.entries(attributes))g.setAttribute(key,new THREE.BufferAttribute(new Float32Array(rows.flat()),size));
    const material=new THREE.ShaderMaterial({vertexShader:COMMON+vertex,fragmentShader:DOT_FRAGMENT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
      uniforms:{uTime:{value:0},uViewport:{value:720},uMinPx:{value:1.2},uMaxPx:{value:28},uFog:{value:0},uNight:{value:1},uScale:{value:this.scale},...uniforms}});
    const points=new THREE.Points(g,material);points.name=name;points.frustumCulled=false;points.renderOrder=2;points.onBeforeRender=r=>this.viewport(r,material);
    this.group.add(points);this.points.push(points);(this.byName??={})[name]=points;return points;
  }
  // Point sizes follow the target being drawn (the screen, or the smaller water reflection).
  viewport(renderer,material){const target=renderer.getRenderTarget(),size=renderer.getDrawingBufferSize(TMP),h=target?target.height:size.y,u=material.uniforms;
    u.uViewport.value=h;u.uMinPx.value=Math.max(1,1.2*renderer.getPixelRatio()*(target?target.height/Math.max(1,size.y):1));material.uniformsNeedUpdate=true;}
  /** night: 1 for the dark night, 0 for late afternoon. */
  setSky(night){
    this.night=night;for(const p of this.points)p.material.uniforms.uNight.value=night;
    const u=this.byName.glints.material.uniforms;u.uMoonPath.value.copy(this.pathColors.night).multiplyScalar(night);u.uSunPath.value.copy(this.pathColors.gold).multiplyScalar(1-night);
    const e=this.byName.skyEvents.material.uniforms;e.uMeteors.value=this.quiet?0:night;e.uPlane.value=night?1:.45;
    this.gulls.visible=night<1;
  }
  setFog(density){for(const p of this.points)p.material.uniforms.uFog.value=density;}
  setGlow(color,amount){const u=this.byName.glints.material.uniforms;u.uGlow.value.copy(color);u.uGlowAmount.value=Math.min(1.4,amount);}
  /** t: seconds of real time (ambient motion), excite: 0..1 how busy the fireworks are. */
  update(t,excite=0){
    const time=this.quiet?this.frozen:t;
    for(const p of this.points)p.material.uniforms.uTime.value=time;this.byName.flashes.material.uniforms.uExcite.value=excite;
    this.boats.material.userData.uniforms.uTime.value=time;this.gulls.material.userData.uniforms.uTime.value=time;
  }
  get drawCalls(){let n=0;this.group.traverse(o=>{if((o.isPoints||o.isMesh)&&o.visible)n++;});return n;}
}
const TMP=new THREE.Vector2();
