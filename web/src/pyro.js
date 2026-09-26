// Ship-launched pyrotechnics for the sky show. Pure and deterministic: the schedule and
// every particle come from the show and fixed seeds, and positions are evaluated on the GPU
// from show time, so seeking, pausing and recording always agree.
// Physics (per particle, closed form): shells rise ballistically, then stars fly out with
// exponential air drag plus reduced gravity; trail samples replay the same path slightly later.
export const GRAVITY=9.81;
export const PATTERNS=['peony','ring','willow','crossette','palm','strobe'];
export const SHAPES=['heart','star','saturn'];// shaped shells for the landing finale, opening toward the audience
// Showpiece shells for the growing heart and Happy day: a colour-changing chrysanthemum with a bright pistil core,
// a glittering gold brocade crown and crossed double rings.
export const FINE=['chrysanthemum','crown','rings'];
const CHANGE=[[1,.25,.5],[.75,.3,1],[.3,.85,1],[1,.4,.2],[.45,1,.5]];// colours a chrysanthemum turns to
const SHAPE_COLORS={heart:[[1,.16,.3],[1,.45,.62]],star:[[1,.82,.28]],saturn:[[.35,.62,1],[1,.74,.25]]};
const PALETTES=[[[1,.72,.25]],[[1,.22,.12],[1,.95,.85]],[[.25,.5,1],[.8,.9,1]],[[.3,1,.45],[1,.78,.2]],[[.75,.3,1],[1,.35,.75]],[[1,.3,.2],[1,.8,.2],[.3,.8,1],[.5,1,.4],[.9,.4,1]]];
export const PARTICLE_FLOATS=25;// shell(2) origin(3) launch(3) star(3) info(4: type lag life drag) look(4: rgb fade) extra(2: gravity strobe) shift(4: rgb at)
const rng=seed=>()=>{seed=(Math.imul(seed^seed>>>15,2246822507)+0x9e3779b9)>>>0;seed=(seed^seed>>>13)>>>0;return seed/4294967296;};// [0,1)

// When shells fire: during stages flagged pyro, drone-firework stages and the landing finale.
export function pyroSchedule(show,origins,{scale=1}={}){
  if(show.pyro===false||!origins?.length)return [];
  const random=rng(90173+show.count),shells=[],fire=(time,index,pattern,strength=1,spread=1)=>{
    const origin=origins[index%origins.length],height=(165+85*random())*scale*strength,delay=2.2+.8*random();
    const vy=height/delay+.5*GRAVITY*scale*delay;// meets the burst height exactly at `delay`
    shells.push({t0:time,delay,origin:origin.slice(),launch:[(random()-.5)*14*scale*spread,vy,(random()-.5)*14*scale],pattern,palette:Math.floor(random()*PALETTES.length),radius:(55+40*random())*scale*strength,seed:Math.floor(random()*1e9)});
  };
  let k=0;const finale=show.stages.findLastIndex(s=>s.kind==='fall'||s.kind==='burst');
  show.stages.forEach((s,index)=>{
    const length=s.end-s.start;
    if(s.pyro){// celebration salvo, then a crescendo
      const n=Math.max(4,Math.floor(length*1.1));
      const salvo=[...PATTERNS,...FINE,'heart'];for(let i=0;i<n-3;i++)fire(s.start+.3+i*(length-3.5)/Math.max(1,n-3),k++,salvo[i%salvo.length]);
      for(let i=0;i<3;i++)fire(s.end-3.2+i*.12,k++,['chrysanthemum','crown','heart'][i],1.15);
    }else if(s.kind==='grow'&&s.heart){// the heart blooms among heart shells and chrysanthemums
      ['heart','chrysanthemum','heart','chrysanthemum'].forEach((p,i)=>fire(s.start+.2+i*1.15,k++,p,1,2));
    }else if(s.kind==='beat'){// while it beats: crowns, rings and hearts all around it
      ['crown','rings','heart','crown','rings'].forEach((p,i)=>fire(s.start+i*.9,k++,p,1.05,2.4));
    }else if(s.kind==='spin'){// the spinning star among stars, rings and a crown
      ['star','rings','crown','star'].forEach((p,i)=>fire(s.start-.6+i*.9,k++,p,1.05,2.4));
    }else if(s.grows){// the tower grows among rising palms and crowns; a wall of shells when it stands complete
      ['palm','crown','palm','crown','chrysanthemum'].forEach((p,i)=>fire(s.start-.6+i*.9,k++,p,1,2.2));
      ['peony','ring','crossette','star','heart','rings'].forEach((p,i)=>fire(s.start+s.grows.time-1.4+i*.08,k++,p,1.1,3));
    }else if(s.salute){// the ships salute the liner
      ['peony','ring','palm','chrysanthemum','crown','rings','willow','heart'].forEach((p,i)=>fire(s.start+.4+i*1.5,k++,p,1,2.6));
    }else if(s.fairy){// hearts, stars and showpieces for the princess
      ['heart','star','chrysanthemum','heart','saturn','crown','star'].forEach((p,i)=>fire(s.start+.4+i*1.8,k++,p,1,2.4));
    }else if(s.kind==='rise'){// balloons drift up among soft bursts; the Starship launches among crackling ones
      (s.effect==='starship'?['crossette','strobe','palm']:['peony','ring','willow']).forEach((p,i)=>fire(s.start+.5+i*(s.end-s.start-3)/3,k++,p,.95,2));
    }else if(s.kind==='hold'&&s.reveal&&!s.phrase){// every other formation is welcomed by a pair of shells
      for(let i=0;i<2;i++)fire(s.start+.2+i*1.7,k++,PATTERNS[(k+i)%PATTERNS.length],.9,2);
    }else if(s.phrase){// every phrase of the sentence gets two showpiece shells
      // three shells a phrase: a showpiece as it forms, a classic, then a shaped shell
      fire(s.start-.8,k++,FINE[k%FINE.length],.95,2.2);fire(s.start+.5,k++,PATTERNS[k%PATTERNS.length],.9,2.8);fire(s.start+1.6,k++,SHAPES[k%SHAPES.length],1,2.4);
    }else if(s.kind==='grow'||s.kind==='burst'){
      for(let i=0;i<3;i++)fire(s.start+.4+i*length/3.4,k++,PATTERNS[(i*2+k)%PATTERNS.length],.95);
    }
    if(index===finale){// finale over the last drone firework, while the camera still looks at the sky
      for(let i=0;i<9;i++)fire(s.start+.3+i*.5,k++,PATTERNS[(i+3)%PATTERNS.length],1.1);
    }
    if(s.kind==='landing'&&s.reverse){// grand finale while the fleet lands: rolling salvos with shaped shells,
      // a wall of every kind of shell at once, then a willow curtain as the drones touch down
      for(let t=.5,w=0;t<length*.6;t+=1.8,w++)for(let j=0;j<3;j++)fire(s.start+t+j*.08,k++,j===1?SHAPES[w%SHAPES.length]:PATTERNS[(w*2+j)%PATTERNS.length],1,2.2);
      [...PATTERNS,...SHAPES,...SHAPES].forEach((p,j)=>fire(s.start+length*.64+j*.04,k++,p,1.1,3));
      for(let j=0;j<6;j++)fire(s.start+length*.8+j*.2,k++,'willow',1.05,2.5);
    }
  });
  return shells.filter(sh=>sh.t0>=0&&sh.t0+sh.delay+4.5<=show.duration+1e-9);
}

// Shaped shells keep their outline: star speeds scale with the shape (not normalised), in a plane facing the audience.
function shapeDirections(n,pattern,random){
  const yaw=(random()-.5)*.5,roll=(random()-.5)*.3,cr=Math.cos(roll),sr=Math.sin(roll),cy=Math.cos(yaw),sy=Math.sin(yaw),out=[];
  const turn=([x,y,z])=>{const x1=x*cr-y*sr,y1=x*sr+y*cr;return [x1*cy+z*sy,y1,-x1*sy+z*cy];};
  if(pattern==='heart')for(let i=0;i<n;i++){const t=i*2*Math.PI/n,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);out.push(turn([x/17,(y+2.5)/17,0]));}
  else if(pattern==='star'){const tips=Array.from({length:10},(_,j)=>{const a=Math.PI/2+j*Math.PI/5,r=j%2?.4:1;return [Math.cos(a)*r,Math.sin(a)*r];});
    for(let i=0;i<n;i++){const u=i*10/n,j=Math.floor(u),f=u-j,a=tips[j],b=tips[(j+1)%10];out.push(turn([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,0]));}}
  else{const core=Math.round(n*.55),tilt=.38;// saturn: a small sphere inside a tilted ring
    for(let i=0;i<core;i++){const y=1-2*(i+.5)/core,r=Math.sqrt(1-y*y),a=i*2.399963229728653;out.push([Math.cos(a)*r*.5,y*.5,Math.sin(a)*r*.5]);}
    for(let i=core;i<n;i++){const a=(i-core)*2*Math.PI/(n-core);out.push(turn([Math.cos(a),Math.sin(a)*Math.sin(tilt),Math.sin(a)*Math.cos(tilt)]));}}
  return out;
}
function unitDirections(n,pattern,random){
  if(SHAPES.includes(pattern))return shapeDirections(n,pattern,random);
  const dirs=[];
  if(pattern==='rings'){// two rings crossing at right angles, tipped toward the audience
    const tilt=.35+random()*.4,half=n/2;for(let i=0;i<n;i++){const a=(i%half)*2*Math.PI/half;dirs.push(i<half?[Math.cos(a),Math.sin(a)*Math.cos(tilt),Math.sin(a)*Math.sin(tilt)]:[Math.sin(a)*Math.sin(tilt),Math.cos(a),Math.sin(a)*Math.cos(tilt)]);}
    return dirs;}
  if(pattern==='ring'){const tilt=random()*Math.PI;for(let i=0;i<n;i++){const a=i*2*Math.PI/n;dirs.push([Math.cos(a),Math.sin(a)*Math.cos(tilt),Math.sin(a)*Math.sin(tilt)]);}}// tilted ring
  else if(pattern==='palm'){for(let i=0;i<n;i++){const arm=i%7,a=arm*2*Math.PI/7+.2,y=.35+.5*random();const r=Math.sqrt(1-y*y);dirs.push([Math.cos(a)*r,y,Math.sin(a)*r]);}}
  else for(let i=0;i<n;i++){const y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),a=i*2.399963229728653+random()*.3;dirs.push([Math.cos(a)*r,y,Math.sin(a)*r]);}
  return dirs.map(d=>{const l=Math.hypot(...d)||1;return d.map(v=>v/l);});
}
// Particle buffer: comet trail while rising, launch and burst flashes, stars with trail samples.
export function pyroParticles(shells){
  const out=[];
  const push=(sh,type,lag,life,drag,star,color,fade,gravity,strobe,shift=[0,0,0,0])=>out.push(sh.t0,sh.delay,...sh.origin,...sh.launch,...star,type,lag,life,drag,...color,fade,gravity,strobe,...shift);
  for(const sh of shells){
    const random=rng(sh.seed),palette=PALETTES[sh.palette];
    push(sh,2,0,.35,0,[0,0,0],[6,4.2,2.4],1,0,0);// muzzle flash on the ship
    for(let j=0;j<7;j++)push(sh,0,j*.035,0,0,[0,0,0],[1.6,1.05,.5],1-j/7,0,0);// rising comet
    push(sh,3,0,.16,0,[0,0,0],[4,3.6,3],1,0,0);// burst flash
    if(FINE.includes(sh.pattern)){fineShell(sh,random,push);continue;}
    const n={peony:150,ring:90,willow:110,crossette:120,palm:84,strobe:130,heart:140,star:130,saturn:150}[sh.pattern],dirs=unitDirections(n,sh.pattern,random),shaped=SHAPES.includes(sh.pattern);
    const drag={peony:1.5,ring:1.6,willow:1.1,crossette:1.4,palm:1.0,strobe:1.5,heart:1.4,star:1.4,saturn:1.5}[sh.pattern],life={peony:2.3,ring:2.1,willow:4.2,crossette:2.4,palm:3,strobe:2.8,heart:2.7,star:2.6,saturn:2.6}[sh.pattern];
    const trail=sh.pattern==='willow'||sh.pattern==='palm'?5:3,gravity=sh.pattern==='willow'?1:.55,speed=sh.radius*drag;
    for(let i=0;i<dirs.length;i++){
      // Shaped shells burst evenly and fade together, so the outline stays readable.
      const base=sh.pattern==='willow'?[1,.62,.2]:shaped?SHAPE_COLORS[sh.pattern][sh.pattern==='saturn'?+(i>=Math.round(n*.55)):i%SHAPE_COLORS[sh.pattern].length]:palette[i%palette.length];
      const v=shaped?dirs[i].map(c=>c*speed):dirs[i].map(c=>c*speed*(.9+.2*random())),l=shaped?life*(.95+.1*random()):life*(.8+.35*random());
      const color=base.map(c=>c*4.4),strobe=sh.pattern==='strobe'?9+6*random():sh.pattern==='crossette'?-1:0;
      for(let t=0;t<trail;t++)push(sh,1,t*(sh.pattern==='willow'?.09:.05),l,drag,v,color,[1,.5,.28,.16,.08][t],gravity,strobe);
    }
  }
  return new Float32Array(out);
}
// The showpiece shells. Stars of a chrysanthemum trail long tails and turn colour half-way through their life
// around a white pistil; the crown is heavy gold brocade that droops and glitters; the rings cross in two colours.
function fineShell(sh,random,push){
  const trailOf=(n,lag,fades)=>fades.slice(0,n).map((f,t)=>[t*lag,f]);
  if(sh.pattern==='chrysanthemum'){
    const dirs=unitDirections(150,'peony',random),to=CHANGE[sh.seed%CHANGE.length],speed=sh.radius*1.3;
    for(const d of dirs){const v=d.map(c=>c*speed*(.94+.12*random())),l=3.1*(.9+.2*random());
      for(const [lag,fade] of trailOf(4,.07,[1,.55,.3,.14]))push(sh,1,lag,l,1.3,v,[4.4,3.4,1.5],fade,.5,0,[to[0]*4.4,to[1]*4.4,to[2]*4.4,.5]);}
    for(const d of unitDirections(50,'peony',random)){const v=d.map(c=>c*speed*.42),l=2.1;// pistil core
      for(const [lag,fade] of trailOf(2,.05,[1,.45]))push(sh,1,lag,l,1.4,v,[4.2,4.4,4.6],fade,.45,0);}
  }else if(sh.pattern==='crown'){
    const dirs=unitDirections(110,'peony',random).map(d=>[d[0],Math.abs(d[1])*.8+.2*d[1],d[2]]),speed=sh.radius*1.05;// a crown: more stars upward
    for(const d of dirs){const v=d.map(c=>c*speed*(.9+.2*random())),l=4.6*(.9+.2*random());
      for(const [lag,fade] of trailOf(5,.11,[1,.6,.36,.2,.1]))push(sh,1,lag,l,1.05,v,[4.4,3,1.2],fade,1,-2);}
  }else{
    const dirs=unitDirections(120,'rings',random),speed=sh.radius*1.55,colours=[[.3,.85,1],[1,.3,.75]];
    dirs.forEach((d,i)=>{const v=d.map(c=>c*speed),l=2.4,c=colours[i<60?0:1].map(x=>x*4.4);
      for(const [lag,fade] of trailOf(3,.05,[1,.5,.28]))push(sh,1,lag,l,1.55,v,c,fade,.55,0);});
  }
}
// CPU reference of the shader (tests and bounds): world position and brightness of particle i at time.
export function evaluateParticle(data,i,time,scale=1){
  const o=i*PARTICLE_FLOATS,f=k=>data[o+k],type=f(11),lag=f(12),life=f(13),drag=f(14),g=GRAVITY*scale;
  const t=time-f(0)-lag,tb=f(1),origin=[f(2),f(3),f(4)],launch=[f(5),f(6),f(7)];
  const rise=s=>origin.map((v,k)=>v+launch[k]*s-(k===1?.5*g*s*s:0));
  if(type===0)return t>0&&t<tb?{position:rise(t),brightness:f(18)*(.4+.6*t/tb)}:null;
  if(type===2)return t>0&&t<life?{position:origin,brightness:1-t/life}:null;
  const ts=t-tb,burst=rise(tb);
  if(type===3)return ts>0&&ts<life?{position:burst,brightness:1-ts/life}:null;
  if(!(ts>0&&ts<life))return null;
  const spread=(1-Math.exp(-drag*ts))/drag;
  return {position:burst.map((v,k)=>v+f(8+k)*spread-(k===1?.5*g*f(19)*ts*ts:0)),brightness:f(18)*(1-(ts/life)**2)};
}
export const PYRO_VERTEX=`attribute vec2 shell;attribute vec3 origin,launch,star;attribute vec4 info,look,shift;attribute vec2 extra;
uniform float time,gravity,sizeWorld,viewport,minSize;varying vec3 vColor;varying float vGlow;
float hash(float n){return fract(sin(n)*43758.5453);}
void main(){
  float type=info.x,lag=info.y,life=info.z,drag=info.w,t=time-shell.x-lag,tb=shell.y;vec3 p=origin,col=look.rgb;float b=0.,size=sizeWorld;
  vec3 burst=origin+launch*tb-vec3(0.,.5*gravity*tb*tb,0.);
  if(type<.5){if(t>0.&&t<tb){p=origin+launch*t-vec3(0.,.5*gravity*t*t,0.);b=look.w*(.4+.6*t/tb)*(.75+.25*sin(t*60.+lag*90.));size*=.6;}}
  else if(type<1.5){float ts=t-tb;if(ts>0.&&ts<life){float spread=(1.-exp(-drag*ts))/drag,f=ts/life;p=burst+star*spread-vec3(0.,.5*gravity*extra.x*ts*ts,0.);
    b=look.w*(1.-f*f)*(.8+.2*sin(ts*23.+star.x));
    if(extra.y>0.)b*=step(.45,fract(ts*extra.y+hash(star.y)));// strobe
    if(extra.y<0.&&extra.y>-1.5&&f>.45)b*=1.6*step(.5,hash(floor(ts*14.)+star.z));// crossette crackle
    if(extra.y<-1.5&&f>.3)b*=.3+1.5*step(.55,hash(floor(ts*24.)+star.x*7.+star.z*3.));// brocade glitter
    if(shift.w>0.)col=mix(look.rgb,shift.rgb,smoothstep(shift.w-.08,shift.w+.08,f));// colour-changing stars
    size*=mix(1.,.55,f);}}
  else if(type<2.5){if(t>0.&&t<life){p=origin+vec3(0.,sizeWorld*1.5,0.);b=1.-t/life;size*=3.;}}
  else{float ts=t-tb;if(ts>0.&&ts<life){p=burst;b=1.-ts/life;size*=3.5;}}
  if(b<=.001){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vColor=vec3(0.);vGlow=0.;return;}
  vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
  float px=size*projectionMatrix[1][1]*viewport*.5/max(-mv.z,.001),s=clamp(px,minSize,160.);
  vColor=col*b*(px<minSize?px*px/(minSize*minSize):1.);vGlow=type>1.5?1.:0.;gl_PointSize=s;}`;
export const PYRO_FRAGMENT=`varying vec3 vColor;varying float vGlow;void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=dot(p,p);if(r>1.)discard;
  float core=exp(-r*(vGlow>.5?3.:9.));gl_FragColor=vec4(vColor*core,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
