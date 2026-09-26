// Pure, deterministic choreography. Distances/timing are for a visual preview,
// not a validated aircraft trajectory or a flight-file format.
import {worldPoint,surfaceWorld,strokeUV,subdivideSurface} from './paper.js';
export const DRONE_COUNT=4096;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const ease=t=>{t=clamp(t);return t*t*t*(10+t*(-15+6*t));};
const rgb=hex=>[16,8,0].map(s=>((hex>>s)&255)/255);
const navigationRed=[1,.025,.035],navigationBlue=[.025,.18,1];
const cyan=rgb(0x52e5ff),blue=rgb(0x628dff),gold=rgb(0xffbe60),pink=rgb(0xff6db3),white=rgb(0xd7f6ff);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const line=(points,color=cyan)=>({points:points.map(p=>[p[0],p[1]+18,p[2]||0]),color});
const box=(x,y,w,h,color=cyan)=>line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],color);
const ellipse=(x,y,rx,ry,color)=>line(Array.from({length:65},(_,i)=>[x+rx*Math.cos(i*Math.PI/32),y+ry*Math.sin(i*Math.PI/32)]),color);

export function samplePaths(paths,count=DRONE_COUNT){
  const prepared=paths.map(path=>{
    const lengths=[0];for(let i=1;i<path.points.length;i++)lengths.push(lengths.at(-1)+distance(path.points[i-1],path.points[i]));
    return {...path,lengths,length:lengths.at(-1)};
  }).filter(p=>Number.isFinite(p.length)&&p.length>1e-8);
  if(!prepared.length)throw new Error('Draw a line or shape with some length, then replay your drawing.');
  // Proportional arc-length sampling, with at least one drone per path when possible.
  const total=prepared.reduce((n,p)=>n+p.length,0),minimum=prepared.length<=count?1:0,remaining=count-minimum*prepared.length;
  // Fractions are quantized so mirror-equal paths tie exactly (then by index) despite float noise from placement round trips.
  const allocations=prepared.map((p,i)=>({i,n:minimum+Math.floor(remaining*p.length/total),fraction:Math.round(remaining*p.length/total%1*1e9)}));
  let spare=count-allocations.reduce((n,a)=>n+a.n,0);
  for(const a of [...allocations].sort((a,b)=>b.fraction-a.fraction||a.i-b.i))if(spare-->0)a.n++;
  const positions=[],colors=[];
  for(const {i,n} of allocations){const path=prepared[i];let segment=1;
    for(let j=0;j<n;j++){
      const at=(j+.5)/n*path.length;while(segment<path.lengths.length-1&&path.lengths[segment]<at)segment++;
      const a=path.points[segment-1],b=path.points[segment],t=(at-path.lengths[segment-1])/(path.lengths[segment]-path.lengths[segment-1]||1);
      positions.push(a.map((v,k)=>v+(b[k]-v)*t));colors.push([...path.color]);
    }
  }
  return {positions,colors};
}

function robot(){return [
  box(-3.8,2.8,7.6,5.8),line([[0,8.6],[0,10]],gold),ellipse(0,10.3,.4,.4,gold),
  box(-2.8,5,.95,1.2,white),box(1.85,5,.95,1.2,white),line([[-1.7,3.8],[1.7,3.8]],gold),
  box(-3,-3.5,6,5.6),line([[-3,1.3],[-5,1.3],[-5,-2.5],[-4,-2.5]],blue),line([[3,1.3],[5,1.3],[5,-2.5],[4,-2.5]],blue),
  box(-2.5,-7,1.7,3.5),box(.8,-7,1.7,3.5),line([[-3.1,-7],[-.5,-7]],gold),line([[.5,-7],[3.1,-7]],gold),
  line([[0,-1.6],[-1.25,-.4],[-1.25,.35],[-.6,.8],[0,.2],[.6,.8],[1.25,.35],[1.25,-.4],[0,-1.6]],pink)
];}
function fish(){return [
  ellipse(0,0,7.5,3.8,cyan),line([[-6.5,1.8],[-11,5.3],[-10,-5.3],[-6.5,-1.8]],gold),
  line([[-2,3.7],[.7,7],[3,3.5]],blue),line([[-2,-3.7],[1,-6],[3,-3.5]],blue),
  ellipse(4.8,1,.55,.6,white),line([[2.8,2.7],[2,1.5],[1.9,0],[2.3,-1.4],[3,-2.5]],gold),
  line([[7.2,.2],[6.1,-.4],[7.1,-1.1]],pink),line([[-2,1],[.7,0],[-2,-1]],blue),
  ellipse(9.4,4,.65,.65,white),ellipse(10.5,6.6,.4,.4,blue)
];}
function tower(){return [
  line([[-7,-8],[-4.7,-3],[-2.2,3],[-.55,9],[.55,9],[2.2,3],[4.7,-3],[7,-8]],gold),
  line([[-7,-8],[-4.5,-8],[-3.4,-5.8],[-1.9,-4.4],[0,-4],[1.9,-4.4],[3.4,-5.8],[4.5,-8],[7,-8]],gold),
  line([[-5,-3],[5,-3]],white),line([[-2.5,3],[2.5,3]],white),line([[-1,7],[1,7]],gold),line([[0,9],[0,11]],white),
  line([[-4.5,-3],[2.2,3],[-2.2,3],[1,7],[-1,7]],gold),line([[4.5,-3],[-2.2,3],[2.2,3],[-1,7],[1,7]],gold),
  line([[-6,-6],[-3,-3]],blue),line([[6,-6],[3,-3]],blue)
];}
const flame=rgb(0xffdf12);
function ship(){return [line([[-14,-3],[14,-3],[10,-8],[-10,-8],[-14,-3]],cyan),box(-8,-3,16,4,white),box(-5,1,9,3,white),box(-2,4,3,2,gold),line([[0,6],[0,10],[4,8],[0,8]],pink),...[-6,-3,0,3,6].map(x=>ellipse(x,-1,.5,.5,gold)),line([[-14,-9],[-9,-8.5],[-4,-9],[1,-8.5],[6,-9],[12,-8.5]],blue)];}
function star(){return [line(Array.from({length:11},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?4.2:10;return [Math.cos(a)*r,Math.sin(a)*r];}),gold)];}
function fireRow(){return Array.from({length:9},(_,i)=>{const x=(i-4)*3;return line([[x-1,-7],[x-.8,-2],[x+.2,5+(i%3)],[x+1.1,-1],[x+1,-7]],flame);});}
function starship(){return [line([[-2,-5],[-2,5],[-1.6,8],[0,11],[1.6,8],[2,5],[2,-5],[-2,-5]],white),line([[-2,6],[-4,3],[-4,0],[-2,1]],cyan),line([[2,6],[4,3],[4,0],[2,1]],cyan),line([[-2,-1],[-5,-6],[-5,-8],[-2,-5]],blue),line([[2,-1],[5,-6],[5,-8],[2,-5]],blue),box(-1.3,-4,2.6,1,gold),ellipse(0,5,.65,1,cyan),...[-1.2,0,1.2].map(x=>line([[x,-5],[x-.35,-7],[x,-11],[x+.35,-7],[x,-5]],flame))];}
const arc=(cx,cy,rx,ry,from,to,n=24)=>Array.from({length:n+1},(_,i)=>{const a=(from+(to-from)*i/n)*Math.PI/180;return [cx+rx*Math.cos(a),cy+ry*Math.sin(a)];});
// Wing lobe: an ellipse whose long axis points away from the body at `angle`, scalloped on its outer half; s=-1 mirrors it.
const lobe=(ax,ay,angle,d,rx,ry,color,s=1,scallop=0)=>{const a=angle*Math.PI/180,c=Math.cos(a),n=Math.sin(a);return line(Array.from({length:129},(_,i)=>{const t=i*Math.PI/64,r=1+scallop*Math.max(0,Math.cos(t))**2*Math.cos(9*t),u=d+rx*Math.cos(t)*r,v=ry*Math.sin(t)*r;return [s*(u*c-v*n)+ax,ay+u*n+v*c];}),color);};
function butterfly(){return [ellipse(0,-.3,.55,4.1,white),ellipse(0,4.45,.62,.62,white),...[-1,1].flatMap(s=>{const at=(x,y,angle,d)=>[s*d*Math.cos(angle*Math.PI/180)+x,y+d*Math.sin(angle*Math.PI/180)];return [
  lobe(0,1,152,6.05,5.6,3.9,pink,s,.07),lobe(0,1,152,6.5,3.5,2.25,gold,s),ellipse(...at(0,1,152,6.6),.95,.95,cyan),
  lobe(0,-.6,230,4.7,3.9,2.1,blue,s,.06),lobe(0,-.6,230,4.9,2.2,1.15,cyan,s),ellipse(...at(0,-.6,230,5),.5,.5,gold),
  line([[s*.25,4.9],[s*.8,6.5],[s*1.6,7.9],[s*2.6,9]],gold),ellipse(s*2.9,9.3,.42,.42,pink)];})];}
function balloonShape(){
  const cy=4.6,R=6,mx=1.8,my=-2.2,tilt=Math.atan2(my-cy,mx)+Math.acos(R/Math.hypot(mx,my-cy)),half=[[mx,my],...arc(0,cy,R,R,tilt*180/Math.PI,90,40)];
  const gore=(k,color)=>line(half.map(([x,y])=>[k*x,y]),color),tx=R*Math.cos(tilt),ty=cy+R*Math.sin(tilt);
  return [line([...half,...half.slice(0,-1).reverse().map(([x,y])=>[-x,y])],pink),gore(-.87,cyan),gore(-.5,gold),gore(0,white),gore(.5,gold),gore(.87,cyan),
    line(arc(0,cy,R,.7,180,360,40),gold),line(arc(0,ty,tx,.45,180,360,24),blue),line([[-mx,my],[mx,my]],gold),
    line([[-mx,my],[-1.5,-5.4]],white),line([[mx,my],[1.5,-5.4]],white),box(-1.5,-7.6,3,2.2,gold),line([[-1.5,-6.5],[1.5,-6.5]],gold),
    line([[0,-5.2],[-.55,-4.5],[-.35,-3.7],[0,-2.8],[.35,-3.7],[.55,-4.5],[0,-5.2]],flame)];
}
// The line art uses the layout of tools/blender/build_formations.py BALLOONS, scaled by .82 to fit the drawing frame.
const shifted=(paths,dx,dy,k)=>paths.map(p=>({...p,points:p.points.map(([x,y,z])=>[dx+x*k,18+dy+(y-18)*k,z*k])}));
function balloon(){return [...shifted(balloonShape(),0,0,.75),...shifted(balloonShape(),-8.7,2.6,.45),...shifted(balloonShape(),8.7,-2,.45)];}
function cake(){
  const tier=(x,y,w,h,color)=>line([[x,y],[x,y+h],[x+w,y+h],[x+w,y]],color);
  const drip=(x,y,w,phase)=>line(Array.from({length:Math.round(w*10)+1},(_,i)=>{const px=x+w*i/Math.round(w*10),bump=Math.max(0,Math.sin(px*2.3+phase))**4;return [px,y-.35-bump*(.7+.35*Math.cos(px*1.3+phase))];}),white);
  const flameAt=x=>line([[x,7.3],[x-.42,7.9],[x-.3,8.7],[x,9.6],[x+.3,8.7],[x+.42,7.9],[x,7.3]],flame);
  return [line([[-11.2,-8],[-10.5,-8.8],[10.5,-8.8],[11.2,-8]],blue),tier(-9,-8,18,4.8,pink),line([[-9,-8],[9,-8]],pink),tier(-6.5,-3.2,13,4,cyan),tier(-4,.8,8,3.6,blue),
    drip(-9,-3.2,18,0),drip(-6.5,.8,13,1),drip(-4,4.4,8,2),...[-7.5,-5,-2.5,0,2.5,5,7.5].map(x=>ellipse(x,-6.3,.32,.32,gold)),
    line(Array.from({length:111},(_,i)=>{const x=-5.5+i*.1;return [x,-1.6-.6*Math.abs(Math.sin(x*Math.PI/2.2))];}),gold),...[-2,0,2].map(x=>ellipse(x,1.9,.28,.28,pink)),
    ...[-3,-1.5,0,1.5,3].flatMap((x,i)=>[tier(x-.3,4.4,.6,2.6,[gold,pink,cyan,pink,gold][i]),flameAt(x)])];
}
function happyDay(){
  const h=6.4,w=3.6,gap=1.2,glyph={H:[[[0,0],[0,h]],[[w,0],[w,h]],[[0,h/2],[w,h/2]]],A:[[[0,0],[w/2,h],[w,0]],[[w*.24,h*.36],[w*.76,h*.36]]],
    P:[[[0,0],[0,h],[w*.5,h],...arc(w*.5,h*.74,w*.5,h*.26,90,-90,16).slice(1),[0,h*.48]]],Y:[[[0,h],[w/2,h*.48],[w,h]],[[w/2,h*.48],[w/2,0]]],D:[[[0,0],[0,h],[w*.35,h],...arc(w*.35,h/2,w*.65,h/2,90,-90,24).slice(1),[0,0]]]};
  const word=(text,y,colors)=>[...text].flatMap((ch,i)=>{const x=-(text.length*(w+gap)-gap)/2+i*(w+gap);return glyph[ch].map(p=>line(p.map(([px,py])=>[x+px,y+py]),colors[i]));});
  const sparkle=(x,y,r,color)=>line(Array.from({length:9},(_,i)=>{const a=i*Math.PI/4,k=i%2?r*.28:r;return [x+k*Math.cos(a),y+k*Math.sin(a)];}),color);
  return [...word('HAPPY',3.2,[pink,gold,cyan,blue,pink]),...word('DAY',-6.4,[gold,pink,cyan]),ellipse(9.3,-3.2,1.5,1.5,gold),
    ...Array.from({length:8},(_,i)=>{const a=i*Math.PI/4+Math.PI/8;return line([[9.3+2*Math.cos(a),-3.2+2*Math.sin(a)],[9.3+2.7*Math.cos(a),-3.2+2.7*Math.sin(a)]],gold);}),
    line(arc(9.3,-3.2,.85,.85,205,335,12),pink),ellipse(8.75,-2.7,.16,.16,pink),ellipse(9.85,-2.7,.16,.16,pink),sparkle(-9.3,-3.2,2.1,white),sparkle(-10.4,-6.9,.9,cyan),sparkle(-8.2,.4,.8,cyan)];
}
function whale(){return [
  line([[11.2,-.4],[10.9,1.3],[9.4,2.5],[6.2,3.1],[2,3],[-2,2.4],[-6,1.6],[-9,1.3],[-10.5,1.7]],blue),
  line([[11.2,-.4],[10.4,-2],[8,-3.4],[4,-4.2],[0,-4],[-4,-3],[-7.5,-1.5],[-9.5,.3],[-10.5,1.3]],white),
  line([[-10.5,1.6],[-12.4,3.6],[-14.6,4.5],[-13.5,2.4],[-14.6,.3],[-12.4,.5],[-10.5,1.3]],cyan),
  line([[3.6,-3.7],[1.6,-6.3],[-.7,-7.3],[.6,-5.6],[2.1,-3.9]],white),line([[-4.4,2.3],[-5.4,3.4],[-6.4,1.7]],blue),
  ellipse(8.3,-.5,.38,.32,white),line([[11,-.9],[9.5,-1.4],[7,-1.7]],gold),line([[9.2,-2.6],[3,-3.6]],cyan),line([[8.8,-3.1],[2.6,-3.95]],cyan),
  line([[7.4,3.1],[6.8,5.6],[5.4,8.2]],white),line([[7.4,3.1],[8,5.6],[9.4,8.2]],white),ellipse(4.9,8.9,.35,.35,cyan),ellipse(9.9,8.9,.35,.35,cyan)
];}
// Water spout from the Blender whale's blowhole (tools/blender/build_formations.py whale_blowhole), in formation units.
export const WHALE_SPOUT={hole:[7.4,1.538,0],height:9,spread:3.1};
// The sea surface above the swimming fish: three rolling swells, clear of its bubbles, in formation units
// (waves travel toward the tail). Swells below it would sit on the skyline, since the camera looks up at formations.
export const FISH_WAVES={lines:[{y:8.6,x0:-12.5,x1:5.5,z:.6,amp:.42,phase:3.1},{y:10.6,x0:-11,x1:11,z:0,amp:.5,phase:0},{y:12.4,x0:-7,x1:7,z:-.6,amp:.34,phase:1.7}],wavelength:7,speed:.45};
// One wave drone: where along which swell, plus a little thickness, spread evenly by length.
export function waveDrop(j,n,waves){
  const lengths=waves.lines.map(l=>l.x1-l.x0),total=lengths.reduce((a,b)=>a+b,0);let at=(j+.5)/n*total,line=0;
  while(line<lengths.length-1&&at>lengths[line]){at-=lengths[line];line++;}
  const f=x=>x-Math.floor(x);return {kind:'wave',line,x:at/lengths[line],jitter:(f(j*.7548776662)-.5)*.3};
}
const swell=(waves,d,t)=>{const l=waves.lines[d.line],x=l.x0+(l.x1-l.x0)*d.x;return {l,x,a:2*Math.PI*(x/waves.wavelength+waves.speed*t)+l.phase};};
export function wavePoint(waves,d,t=0){const {l,x,a}=swell(waves,d,t);return [x,l.y+l.amp*Math.sin(a)+d.jitter*(waves.unit??1),l.z];}
// Crests catch the light as foam; troughs stay deep blue.
export function waveGlow(waves,d,t){return .3+.7*Math.max(0,Math.sin(swell(waves,d,t).a))**2;}
// Formation motions: the fish swims in its waves, the butterfly flaps, the balloons drift up with flickering
// burners, and the whale swims and blows (see sampleShow).
export const MOTIONS=['flap','swim','fish','balloons','candles'];
// Displays last about 12 s so each formation has time to be admired; the finale lingers longer.
export const demoPaths=()=>[{name:'Robot',paths:robot(),hold:15},{name:'Fish',paths:fish(),hold:15,effect:'fish',waves:FISH_WAVES},{name:'Butterfly',paths:butterfly(),hold:15,effect:'flap'},{name:'Hot air balloon',paths:balloon(),hold:15,effect:'balloons'},{name:'Eiffel Tower',paths:tower(),hold:15},{name:'Big ship',paths:ship(),hold:15},{name:'Whale',paths:whale(),hold:18,effect:'swim',spout:WHALE_SPOUT},{name:'Firework star',paths:star(),hold:15,effect:'sparkle'},{name:'Row of fire',paths:fireRow(),hold:15,effect:'fire'},{name:'Birthday cake',paths:cake(),hold:15,effect:'candles'},{name:'Starship launch',paths:starship(),hold:20,effect:'starship'},{name:'Happy day',paths:happyDay(),hold:19,effect:'sparkle',pyro:true}];
// One spout droplet: position along the jet u, jet side, and a spray offset (angle, radius), all from its index.
export function spoutDrop(j){const f=x=>x-Math.floor(x);return {kind:'spout',u:f(j*.6180339887+.13),side:j%2?1:-1,angle:f(j*.7548776662)*Math.PI*2,radius:Math.sqrt(f(j*.5698402910+.37))};}
// The spout rises from the blowhole and splits into two jets that fan out and droop (formation units).
export function spoutPoint(spout,d,u=d.u){
  const rise=spout.height*(1-(1-u)**2)-.9*Math.max(0,u-.72)**2*spout.height,fan=d.side*spout.spread*u**1.25,spray=(.12+.85*u)*d.radius*spout.spread*.38;
  return [spout.hole[0]+fan+Math.cos(d.angle)*spray,spout.hole[1]+rise+Math.sin(d.angle)*spray*.45,spout.hole[2]+Math.sin(d.angle)*spray];
}

// Median-split partition, in place (O(n log n)). Each level splits on the axis where both clouds are widest, so a flat
// launch grid never decides a vertical split by index. Quickselect with an (axis, index) tie-break is deterministic.
function partitionAssign(previous,targets,permutation){
  const n=previous.length,A=new Int32Array(n),B=new Int32Array(n),pa=new Float64Array(n*3),pb=new Float64Array(n*3),stack=[0,n];
  for(let i=0;i<n;i++){A[i]=B[i]=i;for(let k=0;k<3;k++){pa[i*3+k]=previous[i][k];pb[i*3+k]=targets[i][k];}}
  const range=(ids,p,k,lo,hi)=>{let min=Infinity,max=-Infinity;for(let m=lo;m<hi;m++){const v=p[ids[m]*3+k];if(v<min)min=v;if(v>max)max=v;}return max-min;};
  const select=(ids,p,k,lo,hi,kth)=>{let l=lo,r=hi-1;while(r>l){const pid=ids[(l+r)>>1],pv=p[pid*3+k];let i=l,j=r;
    while(i<=j){while(p[ids[i]*3+k]<pv||p[ids[i]*3+k]===pv&&ids[i]<pid)i++;while(p[ids[j]*3+k]>pv||p[ids[j]*3+k]===pv&&ids[j]>pid)j--;if(i<=j){const t=ids[i];ids[i]=ids[j];ids[j]=t;i++;j--;}}
    if(kth<=j)r=j;else if(kth>=i)l=i;else break;}};
  while(stack.length){const hi=stack.pop(),lo=stack.pop();if(hi-lo===1){permutation[A[lo]]=B[lo];continue;}
    let axis=0,best=-1;for(let k=0;k<3;k++){const rb=range(B,pb,k,lo,hi),score=Math.min(range(A,pa,k,lo,hi),rb)+1e-6*rb;if(score>best){best=score;axis=k;}}
    const mid=lo+((hi-lo)>>1);select(A,pa,axis,lo,hi,mid);select(B,pb,axis,lo,hi,mid);stack.push(lo,mid,mid,hi);}
}
// Pairwise uncrossing. Swapping the targets of i and j changes Σ|a−b|² by 2(aᵢ−aⱼ)·(bᵢ−bⱼ). A pair is swapped only
// when that is negative and the pair would pass closer than min(start gap, end gap, reach)/√2, so every swap shortens
// squared travel and the search terminates. reach ≥ the fleet's smallest start/end gap, hence every checked pair keeps
// ≥ min(start gap, end gap)/√2 apart during a synchronized straight transfer. Candidates share or touch a hash cell
// (about two drones each) at q = 0, ½ or 1; a worklist rescans only drones whose target changed. Deterministic.
function uncross(previous,targets,permutation){
  const n=permutation.length,size=1<<Math.ceil(Math.log2(n*2)),mask=size-1,a=new Float64Array(n*3),b=new Float64Array(n*3),T=new Float64Array(n*3),inv=new Int32Array(n),seen=new Uint32Array(size);
  for(let i=0;i<n;i++){inv[permutation[i]]=i;for(let k=0;k<3;k++){a[i*3+k]=previous[i][k];T[i*3+k]=targets[i][k];b[i*3+k]=targets[permutation[i]][k];}}
  const lo=[0,1,2].map(k=>{let m=Infinity;for(let i=k;i<n*3;i+=3)m=Math.min(m,a[i],T[i]);return m;});
  const hash=(x,y,z)=>(Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791))&mask;let stamp=0;
  const binning=(P,cells)=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<n*3;i++){min[i%3]=Math.min(min[i%3],P[i]);max[i%3]=Math.max(max[i%3],P[i]);}
    const e=max.map((v,k)=>Math.max(v-min[k],1e-9));let cell=Math.max(Math.cbrt(e[0]*e[1]*e[2]/n),Math.sqrt(Math.max(e[0]*e[1],e[1]*e[2],e[0]*e[2])/n),Math.max(...e)/n);
    for(let r=0;r<5;r++){stamp++;let used=0;for(let i=0;i<n*3;i+=3){for(let k=0;k<3;k++)cells[i+k]=Math.floor((P[i+k]-lo[k])/cell);const h=hash(cells[i],cells[i+1],cells[i+2]);if(seen[h]!==stamp){seen[h]=stamp;used++;}}
      if(n/used<=2.6||r===4)break;cell*=Math.sqrt(2*used/n);}
    return cell;};
  // Static grids for start and end points; gap is an upper bound on the smallest gap in that point set.
  const grid=P=>{const cells=new Int32Array(n*3),cell=binning(P,cells),head=new Int32Array(size+1),fill=new Int32Array(size),items=new Int32Array(n);let gap=Infinity;
    for(let i=0;i<n;i++)head[hash(cells[i*3],cells[i*3+1],cells[i*3+2])+1]++;for(let h=0;h<size;h++){head[h+1]+=head[h];fill[h]=head[h];}for(let i=0;i<n;i++)items[fill[hash(cells[i*3],cells[i*3+1],cells[i*3+2])]++]=i;
    for(let h=0;h<size;h++)if(head[h+1]-head[h]>1){const i=items[head[h]]*3,j=items[head[h]+1]*3;gap=Math.min(gap,Math.hypot(P[i]-P[j],P[i+1]-P[j+1],P[i+2]-P[j+2]));}
    return {cells,cell,head,items,gap};};
  const G0=grid(a),G1=grid(T),reach=Math.max(Math.min(G0.cell,G1.cell),Math.min(G0.gap,G1.gap))**2;
  // The mid-flight grid changes with assignments: per-bucket linked lists allow O(1) moves.
  const mid=new Float64Array(n*3);for(let i=0;i<n*3;i++)mid[i]=(a[i]+b[i])/2;const cm=new Int32Array(n*3),midCell=binning(mid,cm),mh=new Int32Array(size).fill(-1),mn=new Int32Array(n),mp=new Int32Array(n),mb=new Int32Array(n);
  const place=i=>{for(let k=0;k<3;k++)cm[i*3+k]=Math.floor(((a[i*3+k]+b[i*3+k])/2-lo[k])/midCell);const h=mb[i]=hash(cm[i*3],cm[i*3+1],cm[i*3+2]);mp[i]=-1;mn[i]=mh[h];if(mh[h]>=0)mp[mh[h]]=i;mh[h]=i;};
  const unplace=i=>{if(mp[i]>=0)mn[mp[i]]=mn[i];else mh[mb[i]]=mn[i];if(mn[i]>=0)mp[mn[i]]=mp[i];};
  for(let i=n-1;i>=0;i--)place(i);
  const queue=new Int32Array(n),queued=new Uint8Array(n);let head=0,tail=0,waiting=0;
  const push=i=>{if(!queued[i]){queued[i]=1;queue[tail]=i;tail=(tail+1)%n;waiting++;}};
  const check=(i,j)=>{const i3=i*3,j3=j*3,x0=a[i3]-a[j3],y0=a[i3+1]-a[j3+1],z0=a[i3+2]-a[j3+2],x1=b[i3]-b[j3],y1=b[i3+1]-b[j3+1],z1=b[i3+2]-b[j3+2],dot=x0*x1+y0*y1+z0*z1;if(dot>=-1e-9)return false;
    const s0=x0*x0+y0*y0+z0*z0,s1=x1*x1+y1*y1+z1*z1,u=Math.min(1,Math.max(0,(s0-dot)/(s0+s1-2*dot||1)));
    if((1-u)*(1-u)*s0+u*u*s1+2*u*(1-u)*dot>=Math.min(s0,s1,reach)/2)return false;
    const t=permutation[i];permutation[i]=permutation[j];permutation[j]=t;inv[permutation[i]]=i;inv[permutation[j]]=j;for(let k=0;k<3;k++){const v=b[i3+k];b[i3+k]=b[j3+k];b[j3+k]=v;}
    unplace(i);unplace(j);place(i);place(j);push(i);push(j);return true;};
  // The first sweep visits each cell pair once (half stencil); a swap requeues both drones for a full rescan.
  const scan=(i,half)=>{for(let g=0;g<3;g++){const cells=g===0?G0.cells:g===1?G1.cells:cm,o=g===1?permutation[i]*3:i*3,X=cells[o],Y=cells[o+1],Z=cells[o+2];
    for(let dx=-1;dx<=1;dx++){const hx=Math.imul(X+dx,73856093);for(let dy=-1;dy<=1;dy++){const hxy=hx^Math.imul(Y+dy,19349663);for(let dz=-1;dz<=1;dz++){
      if(half&&(dx<0||dx===0&&(dy<0||dy===0&&dz<0)))continue;const h=(hxy^Math.imul(Z+dz,83492791))&mask,same=half&&dx===0&&dy===0&&dz===0;
      if(g===2){for(let j=mh[h];j>=0;j=mn[j])if(j!==i&&!(same&&j<i)&&check(i,j))return;}
      else{const G=g?G1:G0;for(let m=G.head[h],end=G.head[h+1];m<end;m++){const j=g?inv[G.items[m]]:G.items[m];if(j!==i&&!(same&&j<i)&&check(i,j))return;}}
    }}}}};
  for(let i=0;i<n;i++)if(!queued[i])scan(i,true);
  for(let work=0;waiting&&work<64*n;work++){const i=queue[head];head=(head+1)%n;waiting--;queued[i]=0;scan(i,false);}
}
// Small fleets use exact Hungarian matching (minimum squared travel, hence uncrossed). Large fleets use a deterministic
// median-split partition (O(n log n), O(n) live storage), then pairwise uncrossing of spatial neighbours.
// This is a visual preview: it is not a certified separation or aircraft-feasibility check.
export function matchFormation(previous,target){
  const n=previous.length;if(target.positions.length!==n)throw new Error('Formation must match the fleet size.');
  const permutation=new Int32Array(n),pick=values=>Array.from(permutation,i=>values[i]);
  const result=()=>({positions:pick(target.positions),colors:pick(target.colors),order:Array.from(permutation,i=>target.order?.[i]??i/Math.max(1,n-1)),...(target.fire?{fire:pick(target.fire)}:{}),...(target.extra?{extra:pick(target.extra)}:{}),...(target.pad?{pad:pick(target.pad)}:{})});
  if(n>256){partitionAssign(previous,target.positions,permutation);uncross(previous,target.positions,permutation);return result();}
  const costs=previous.map(a=>Float64Array.from(target.positions,b=>a.reduce((s,v,k)=>s+(v-b[k])**2,0)));
  const u=new Float64Array(n+1),v=new Float64Array(n+1),p=new Int32Array(n+1),way=new Int32Array(n+1);
  for(let i=1;i<=n;i++){
    p[0]=i;let j0=0;const min=new Float64Array(n+1).fill(Infinity),used=new Uint8Array(n+1);
    do{
      used[j0]=1;const i0=p[j0];let delta=Infinity,j1=0;
      for(let j=1;j<=n;j++)if(!used[j]){const cur=costs[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
      for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;
      j0=j1;
    }while(p[j0]!==0);
    do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);
  }
  for(let j=1;j<=n;j++)permutation[p[j]-1]=j-1;
  return result();
}

export function drawingPaths(entities){
  const papers=new Map(entities.filter(e=>e.type==='paper').map(p=>[p.id,p]));
  const paths=entities.filter(e=>e.type==='stroke').flatMap(e=>{
    const paper=papers.get(e.paperId);
    if(!paper)return [{points:e.points.map(p=>worldPoint(e,p)),color:rgb(e.color&0xffffff)}];
    // Match the visible sheet crop, including on hidden/curved drawing guides.
    const uv=e.points.map(p=>strokeUV(e,p,paper)),segments=[];
    for(let i=1;i<uv.length;i++){
      const a=uv[i-1],b=uv[i];let lo=0,hi=1;
      for(let k=0;k<2;k++){const limit=paper.panelWidth/(k?paper.aspect:1)/2,d=b[k]-a[k];if(Math.abs(d)<1e-10){if(Math.abs(a[k])>limit){hi=-1;break;}}else{const x=(-limit-a[k])/d,y=(limit-a[k])/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}}
      if(hi>lo){const start=a.map((v,k)=>v+(b[k]-v)*lo),end=a.map((v,k)=>v+(b[k]-v)*hi),last=segments.at(-1);if(last&&distance(last.at(-1),start)<1e-8)last.push(end);else segments.push([start,end]);}
    }
    return subdivideSurface(segments,paper).map(path=>({points:path.map(p=>surfaceWorld(paper,p)),color:rgb(e.color&0xffffff)}));
  });
  return paths;
}
export function fitPaths(paths){
  const points=paths.flatMap(p=>p.points);if(!points.length)throw new Error('Draw a line or shape first. Replay uses stroke lines and their colours.');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  const scale=Math.min(22/Math.max(.001,max[0]-min[0]),18/Math.max(.001,max[1]-min[1]),12/Math.max(.001,max[2]-min[2]));
  return {origin:min.map((v,k)=>(v+max[k])/2),scale,position:[0,18,0],yaw:0};
}
export function placePaths(paths,placement){
  const {origin,scale,position,yaw}=placement,a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return paths.map(path=>({...path,points:path.points.map(p=>{const [x,y,z]=p.map((v,k)=>(v-origin[k])*scale);return [x*c+z*s+position[0],y+position[1],-x*s+z*c+position[2]];})}));
}
export function drawingFormation(entities){const paths=drawingPaths(entities);return samplePaths(placePaths(paths,fitPaths(paths)));}

function fireworksSeeds(count){
  const positions=[],colors=[];
  for(let i=0;i<count;i++){
    const cluster=i<count/2?0:1,index=i%(count/2),theta=index*2.399963229728653,y=1-2*(index+.5)/(count/2),r=Math.sqrt(1-y*y),centre=cluster? [7,18,-1]:[-7,22,0];
    positions.push([centre[0]+r*Math.cos(theta)*1.4,centre[1]+y*1.4,centre[2]+r*Math.sin(theta)*.7]);
    colors.push([...(cluster?[pink,blue,white][index%3]:[gold,cyan,white][index%3])]);
  }
  return {positions,colors};
}
// Full-size targets plus compact launch seeds. Reuse the fleet; no extra particles.
// A family inside the growing heart: man, boy, woman and girl holding hands (heart-local units, all inside its
// innermost contour). The little girl waves.
// The family inside the growing heart: a man, a boy, a woman and a waving girl holding hands. Each is a filled
// silhouette (face and hair, shoulders and arms, shirt or dress, legs, shoes) sampled on an even grid for exactly
// `count` lights, rim first and a little brighter so the outlines read. Heart-local units (its centre is 24 up).
function familyFigures(count){
  const base=-3.1,skin=[1,.78,.6],shoe=[.85,.9,1];
  const people=[{x:-4,h:6.7,shirt:cyan,legs:[.3,.45,1],hair:[.55,.75,1]},{x:-1.3,h:4.1,shirt:gold,legs:[1,.5,.12],hair:[1,.85,.4],shorts:true},
    {x:1.55,h:6.2,shirt:pink,hair:[1,.45,.7],dress:true,long:true},{x:4.15,h:3.7,shirt:[1,.72,.88],hair:[1,.6,.8],dress:true,pigtails:true,wave:true}];
  const near=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?clamp(((px-ax)*dx+(py-ay)*dy)/l):0;return Math.hypot(px-ax-t*dx,py-ay-t*dy);};
  const inPoly=(x,y,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if(yi>y!==yj>y&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
  const parts=[],hand=(a,b)=>[(a.x+b.x)/2,base+Math.min(a.h,b.h)*.46];// in paint order: later parts cover earlier ones
  people.forEach((p,who)=>{
    const {x,h}=p,y=f=>base+h*f,r=h*(h<5?.125:.1),hy=y(.87),left=people[who-1],right=people[who+1];
    const add=(color,test)=>parts.push({who,color,test}),capsule=(ax,ay,bx,by,w,color)=>add(color,(px,py)=>near(px,py,ax,ay,bx,by)<=w),disc=(cx,cy,rr)=>(px,py)=>(px-cx)**2+(py-cy)**2<=rr*rr;
    if(p.long)add(p.hair,(px,py)=>disc(x,hy,r*1.25)(px,py)||Math.abs(px-x)<=r*1.18&&py<=hy&&py>=hy-r*1.9);// long hair behind the face
    if(p.pigtails)for(const s of [-1,1])add(p.hair,disc(x+s*r*1.35,hy-r*.25,r*.5));
    for(const s of [-1,1]){
      if(p.dress)capsule(x+s*h*.05,y(.25),x+s*h*.055,y(.05),h*.03,skin);
      else if(p.shorts){capsule(x+s*h*.05,y(.46),x+s*h*.06,y(.3),h*.055,p.legs);capsule(x+s*h*.06,y(.3),x+s*h*.065,y(.05),h*.035,skin);}
      else capsule(x+s*h*.05,y(.46),x+s*h*.07,y(.05),h*.05,p.legs);
      capsule(x+s*h*.07,y(.03),x+s*h*.12,y(.03),h*.03,shoe);
    }
    // Arms: sleeves from the shoulders to hands that meet the neighbours' hands; the girl waves.
    for(const s of [-1,1]){
      const next=s<0?left:right,wave=p.wave&&s>0&&!next,[ax,ay]=[x+s*h*.13,y(.74)];
      const [bx,by]=next?(s<0?hand(next,p):hand(p,next)):wave?[x+h*.3,y(1)]:[x+s*h*.22,y(.42)],[ex,ey]=wave?[x+h*.27,y(.72)]:[(ax+bx)/2+s*h*.02,(ay+by)/2];
      capsule(ax,ay,ex,ey,h*.038,p.shirt);capsule(ex,ey,bx,by,h*.032,wave?skin:p.shirt);add(skin,disc(bx,by,h*.042));
    }
    if(p.dress)add(p.shirt,(px,py)=>inPoly(px,py,[[x-h*.12,y(.765)],[x+h*.12,y(.765)],[x+h*.075,y(.56)],[x+h*.24,y(.22)],[x-h*.24,y(.22)],[x-h*.075,y(.56)]]));
    else add(p.shirt,(px,py)=>inPoly(px,py,[[x-h*.15,y(.765)],[x+h*.15,y(.765)],[x+h*.11,y(.46)],[x-h*.11,y(.46)]]));
    capsule(x-h*.13,y(.745),x+h*.13,y(.745),h*.03,p.shirt);capsule(x,y(.8),x,y(.76),h*.035,skin);// shoulders, neck
    add(skin,disc(x,hy,r));add(p.hair,(px,py)=>disc(x,hy,r*(p.long?1.1:1.08))(px,py)&&py>=hy+r*(p.long?.45:.3));// face, hair on top
  });
  const at=(px,py)=>{let hit=null;for(const part of parts)if(part.test(px,py))hit=part;return hit;};
  const grid=step=>{const points=[];for(let gy=base-.2;gy<=base+7.3;gy+=step)for(let gx=-6;gx<=6.4;gx+=step){const part=at(gx,gy);if(part)points.push({x:gx,y:gy,part});}return points;};
  let lo=.01,hi=1.5;for(let k=0;k<22;k++){const mid=(lo+hi)/2;if(grid(mid).length>=count)lo=mid;else hi=mid;}
  const points=grid(lo),step=lo;
  for(const q of points)q.rim=[[step,0],[-step,0],[0,step],[0,-step]].some(([dx,dy])=>at(q.x+dx,q.y+dy)?.who!==q.part.who);
  const rim=points.filter(q=>q.rim),inner=points.filter(q=>!q.rim),pick=(list,n)=>Array.from({length:n},(_,k)=>list[Math.floor(k*list.length/n)]);
  const chosen=rim.length>=count?pick(rim,count):[...rim,...pick(inner,count-rim.length)];
  return {positions:chosen.map(q=>[q.x,q.y,0]),colors:chosen.map(q=>q.part.color.map(v=>Math.min(1,q.rim?v*1.05+.08:v*.8)))};
}
function shapedFirework(kind,count,scale){
  const positions=[],colors=[],centres=[];
  // The heart keeps ~72% of the fleet for its contours; the rest draw the family inside it.
  const outline=kind==='heart'?count-Math.floor(count*.28):count,family=outline<count?familyFigures(count-outline):null;
  for(let i=0;i<count;i++){
    if(i>=outline){const p=family.positions[i-outline],centre=[0,24,0];colors.push([...family.colors[i-outline]]);centres.push(centre.map(v=>v*scale));positions.push(p.map((v,k)=>(centre[k]+v)*scale));continue;}
    let p,centre=[0,24,0];
    if(kind==='balls'){
      const cluster=i%3,j=Math.floor(i/3),n=Math.floor((count+2-cluster)/3),y=1-2*(j+.5)/n,a=j*2.399963229728653,r=Math.sqrt(Math.max(0,1-y*y));
      centre=[(cluster-1)*15,cluster===1?29:22,cluster===1?-3:0];p=[r*Math.cos(a)*6,y*6,r*Math.sin(a)*6];
      colors.push([...[gold,pink,cyan][cluster]]);
    }else{
      // Several nested contours give the growing silhouettes depth and texture.
      const ring=i%8,t=(Math.floor(i/8)+.5)/Math.ceil(outline/8),a=t*Math.PI*2,r=.76+ring*.034;
      if(kind==='heart')p=[16*Math.sin(a)**3*r*.7,(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*r*.7,Math.sin(ring*2.4)*.7];
      else{const edge=t*10,k=Math.floor(edge),f=edge-k,vertex=j=>{const angle=Math.PI/2+j*Math.PI/5,radius=j%2?4.8:11;return [Math.cos(angle)*radius,Math.sin(angle)*radius];},v=vertex(k),w=vertex(k+1);p=[(v[0]+(w[0]-v[0])*f)*r,(v[1]+(w[1]-v[1])*f)*r,Math.sin(ring*2.4)*.7];}
      colors.push([...(kind==='heart'?[pink,gold][ring%2]:[gold,white][ring%2])]);
    }
    centres.push(centre.map(v=>v*scale));positions.push(p.map((v,k)=>(centre[k]+v)*scale));
  }
  return {positions,colors,centres};
}
// Return, descent and rest on the pads for the Demo and shows edited from it (seconds).
export const CINEMATIC_LANDING=Object.freeze([9,20,8]);
// While drones fly between shapes in the Demo they blink red and blue at this share of an LED's full light, so the
// movement shows. Frame colours are gamma values (the LED shader raises them to 2.2), hence TRAVEL_LEVEL.
export const TRAVEL_BLINK=.25,TRAVEL_LEVEL=TRAVEL_BLINK**(1/2.2);
// World units per Demo metre: the Blender scenery, ship fireworks and camera framing are modelled at Demo scale.
export function stageUnit(show){
  const xs=show.home.map(p=>p[0]),span=Math.max(...xs)-Math.min(...xs),side=Math.ceil(Math.sqrt(show.count));
  return (side>1&&span>0?span*side/(15*(side-1)):1)/6;
}
export function buildShow(custom,options={}){
  const count=options.count??custom?.positions.length??DRONE_COUNT,side=Math.ceil(Math.sqrt(count));
  const home=Array.from({length:count},(_,i)=>[(i%side-(side-1)/2)*15/side*(options.motionScale??1),.12,(Math.floor(i/side)-(side-1)/2)*13/side*(options.motionScale??1)]);
  const dark=()=>Array.from({length:count},()=>[0,0,0]);
  const ground={positions:home,colors:dark()},hover={positions:home.map(p=>[p[0],6*(options.motionScale??1),p[2]]),colors:dark()};
  const stages=[],cues=[];let cursor=0,previous=ground;
  const add=(name,kind,duration,target,details={})=>{if(kind==='move'&&details.transitionLights&&stages.length)stages.at(-1).fadeBeforeMove=true;const stage={name,kind,start:cursor,end:cursor+duration,from:previous,to:target,...details};stages.push(stage);cursor+=duration;previous=target;return stage;};
  add('Launch grid','hold',2,ground);cues.push({label:'Takeoff',time:2});add('Takeoff','takeoff',6,hover);
  const sequence=options.sequence??(custom?[{name:'Your drawing',formation:custom,hold:12}]:demoPaths().map(f=>({...f,formation:samplePaths(f.paths,count)})));
  for(const {name,formation,hold,transfer=7,light='fade',effect='none',fireEnabled,pyro,motion=MOTIONS.includes(effect)?effect:undefined,spout,waves} of sequence){
    // `pyro` marks a formation that ship-launched fireworks accompany; motion, spout and waves animate the display.
    const target=matchFormation(previous.positions,formation),details={...(pyro?{pyro:true}:{}),...(motion?{motion}:{}),...(spout&&target.extra?{spout}:{}),...(waves&&target.extra?{waves}:{})};
    add('Forming '+name,'move',transfer,target,{transitionLights:options.transitionLights});cues.push({label:name,time:cursor+Math.min(hold/2,2)});
    const lift=effect==='starship'?10:motion==='balloons'?3.5:0;// the Starship launches; balloons drift gently up
    if(lift){const raised={...target,positions:target.positions.map(p=>[p[0],p[1]+lift*(options.motionScale??1),p[2]])};add(name,'rise',hold,raised,{effect,fireEnabled,motionScale:options.motionScale,...details});}
    else add(name,'hold',hold,target,{reveal:true,light,effect,fireEnabled,motionScale:options.motionScale,...details});
  }
  if(options.fireworks?.enabled!==false&&options.fireworks?.trilogy){
    for(const [kind,name] of [['heart','Growing heart'],['star','Five-point star'],['balls','Three firework balls']]){
      const shape=shapedFirework(kind,count,options.motionScale??1);
      const rawSeeds={positions:shape.positions.map((p,i)=>p.map((v,k)=>shape.centres[i][k]+(v-shape.centres[i][k])*.12)),colors:dark()};
      const seeds=matchFormation(previous.positions,rawSeeds),indices=seeds.order.map(rank=>Math.round(rank*(count-1)));
      add('Launching '+name.toLowerCase(),'move',9,seeds,{transitionLights:options.transitionLights});
      const expanded={positions:indices.map(i=>shape.positions[i]),colors:indices.map(i=>shape.colors[i])};
      cues.push({label:name,time:cursor+4.5});add(name,'grow',6,expanded);
      const fallen={positions:expanded.positions.map((p,i)=>[p[0]+Math.sin(i*2.4)*.7*(options.motionScale??1),p[1]-7*(options.motionScale??1),p[2]]),colors:dark()};
      add(name+' · falling sparks','fall',7,fallen);
    }
  }else if(options.fireworks?.enabled!==false){
  const fireworks=fireworksSeeds(count),motionScale=options.motionScale??1;fireworks.positions=fireworks.positions.map(p=>p.map(v=>v*motionScale));const seeds=matchFormation(previous.positions,fireworks);add('Firework launch','move',7,seeds,{transitionLights:options.transitionLights});cues.push({label:'Fireworks',time:cursor+5});
  const centres=seeds.positions.map(p=>(p[0]<0?[-7,22,0]:[7,18,-1]).map(v=>v*motionScale));
  const burst={positions:seeds.positions.map((p,i)=>p.map((v,k)=>centres[i][k]+(v-centres[i][k])*(options.fireworks?.radius??6.3)/1.4-(k===1?2.5*motionScale:0))),colors:seeds.colors};
  const duration=options.fireworks?.duration??9;cues[cues.length-1].time=cursor+duration*.55;
  add('Fireworks','burst',duration,burst,{centres});
  }
  // Return to the nearest free pads (uncrossed), not each drone's own pad; `pad` carries the landing permutation.
  const back=matchFormation(previous.positions,{...hover,pad:Array.from({length:count},(_,i)=>i)}),landed={positions:back.pad.map(k=>home[k]),colors:dark(),pad:back.pad};
  // The cinematic landing is long enough for the ship-firework finale over the harbour.
  const [homeward,descent,rest]=options.reverseLanding?CINEMATIC_LANDING:[7,8,2];
  add('Returning home','move',homeward,back,{transitionLights:options.transitionLights});cues.push({label:'Landing',time:cursor+(options.reverseLanding?4:2)});add('Landing','landing',descent,landed,{reverse:options.reverseLanding});add('Landed','hold',rest,landed);
  return {count,home,stages,cues,duration:cursor,custom:!!custom,title:options.title};
}

export function stageAt(show,time){const t=clamp(Number.isFinite(time)?time:0,0,show.duration);return show.stages.find(s=>t<s.end)||show.stages.at(-1);}
export function groundFocus(show,time){
  if(!show.demo&&!show.cinematic)return 0;
  const takeoff=show.stages.find(s=>s.kind==='takeoff'),departure=show.stages[show.stages.indexOf(takeoff)+1],arrival=show.stages.find(s=>s.name==='Returning home');
  if(time<=takeoff.end)return 1;
  if(time<departure.end)return 1-ease((time-departure.start)/(departure.end-departure.start));
  if(time>=arrival.start)return ease((time-arrival.start)/(arrival.end-arrival.start));
  return 0;
}
// All trajectories interpolate between endpoints, so their combined bounds also
// bound the complete performance. Include landing pads when framing the camera.
export function frontView(show,aspect,fov=46,verticalOffset=0){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const stage of show.stages)for(const p of [...stage.from.positions,...stage.to.positions])for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  const target=min.map((v,k)=>(v+max[k])/2),half=min.map((v,k)=>(max[k]-v)/2),tan=Math.tan(fov*Math.PI/360);
  const distance=half[2]+Math.max(38,half[0]/(tan*Math.max(.1,aspect)),half[1]/(tan*Math.max(.3,1-2*Math.abs(verticalOffset))))*1.25;
  return {target,position:[target[0],target[1]+distance*.04,target[2]+distance]};
}
// Formation motion during a hold. Bounds come from the formation itself, so authored shows work too.
const motionCache=new WeakMap();
function motionFrame(s){
  let m=motionCache.get(s);if(m)return m;
  const P=s.to.positions,extra=s.to.extra;let min=Infinity,max=-Infinity,bottom=Infinity,top=-Infinity,z=0,n=0;
  for(let i=0;i<P.length;i++)if(!extra?.[i]){min=Math.min(min,P[i][0]);max=Math.max(max,P[i][0]);bottom=Math.min(bottom,P[i][1]);top=Math.max(top,P[i][1]);}
  const cx=(min+max)/2,L=Math.max(1e-6,max-min),hinge=.035*L;
  for(let i=0;i<P.length;i++)if(!extra?.[i]&&Math.abs(P[i][0]-cx)<hinge){z+=P[i][2];n++;}
  // Candle flames: the warm lights in the top 14%, above the candles (the sprinkles and the flame bases stay still).
  m={max,cx,L,hinge,cz:n?z/n:0,top,flameBase:top-.14*(top-bottom)};motionCache.set(s,m);return m;
}
// Whale blows: the spout shoots up, sprays for a couple of seconds, fades, rests, and blows again.
export function blowGlow(elapsed,u){const c=elapsed-.8,cycle=(c%4.6+4.6)%4.6;if(c<0)return 0;const front=Math.min(1,cycle/.7),glow=cycle<2.8?1:cycle<3.8?3.8-cycle:0;return u<=front?glow*(1-u)**.45:0;}
function moveDrone(s,m,i,elapsed,envelope,out){
  const o=i*3,P=out.positions;
  if(s.motion==='flap'){// wings turn about the body, tips toward the audience and back
    const dx=P[o]-m.cx,side=dx<0?-1:1,wing=Math.abs(dx)-m.hinge;if(wing<=0)return;
    const angle=envelope*.4*Math.sin(elapsed*Math.PI*2*.55),c=Math.cos(angle),sn=Math.sin(angle),dz=P[o+2]-m.cz;
    P[o]=m.cx+side*(m.hinge+wing*c-dz*sn);P[o+2]=m.cz+wing*sn+dz*c;
  }else if(s.motion==='swim'){
    const d=s.to.extra?.[i];
    if(d&&s.spout){// a droplet flows up its jet; the lights follow each blow
      const u=(d.u+elapsed*.55)%1,p=spoutPoint(s.spout,d,u),b=.06+.94*blowGlow(elapsed,u);
      for(let k=0;k<3;k++){P[o+k]+=envelope*(p[k]-P[o+k]);out.colors[o+k]*=1-envelope*(1-b);}
    }else{// a slow vertical wave travels from head to flukes, plus a gentle bob
      const w=clamp((m.max-P[o])/m.L),phase=elapsed*Math.PI*2*.3;
      P[o+1]+=envelope*m.L*(.045*w**1.8*Math.sin(phase-2.2*w)+.012*Math.sin(phase+1.3));
    }
  }else if(s.motion==='fish'){
    const d=s.to.extra?.[i];
    if(d&&s.waves){// a wave drone rides its swell; crests glow like foam
      const p=wavePoint(s.waves,d,elapsed),b=waveGlow(s.waves,d,elapsed);
      for(let k=0;k<3;k++){P[o+k]+=envelope*(p[k]-P[o+k]);out.colors[o+k]*=1-envelope*(1-b);}
    }else{// the body swings side to side from head to tail while the fish rises and dips a little, nose first
      const w=clamp((m.max-P[o])/m.L),phase=elapsed*Math.PI*2*.8,bob=elapsed*Math.PI*2*.28;
      P[o+2]+=envelope*m.L*.06*w**1.6*Math.sin(phase-2.4*w);
      P[o+1]+=envelope*m.L*(.02*Math.sin(bob)+.014*(P[o]-m.cx)/m.L*Math.cos(bob));
    }
  }else if(s.motion==='candles'){// each candle flame dances and flickers on its own; the cake stays still
    const c=s.to.colors[i];
    if(P[o+1]>m.flameBase&&c[0]>.5&&c[2]<.4*c[0]){
      const u=clamp((P[o+1]-m.flameBase)/Math.max(1e-6,m.top-m.flameBase)),flame=Math.round((P[o]-m.cx)/(m.L*.08));// lights of one flame share its phase
      P[o]+=envelope*m.L*(.012*u*u*Math.sin(elapsed*6.3+flame*1.9)+.003*u*Math.sin(elapsed*17+i));P[o+1]+=envelope*m.L*.008*u*Math.sin(elapsed*9.1+flame*2.6);
      const f=1-envelope*(.4-.4*Math.sin(elapsed*11+flame*2.3+i*.4)**2*(.7+.3*Math.sin(elapsed*2.7+flame)));for(let k=0;k<3;k++)out.colors[o+k]*=f;
    }
  }else if(s.motion==='balloons'){// each balloon sways on its own; the burner flames flicker
    const dx=P[o]-m.cx,group=dx<-.235*m.L?0:dx>.235*m.L?2:1,c=s.to.colors[i];
    P[o+1]+=envelope*m.L*.007*Math.sin(elapsed*1.25+group*2.1);P[o]+=envelope*m.L*.004*Math.sin(elapsed*.8+group*1.3);
    if(c[0]>.3&&c[1]/c[0]>.75&&c[2]/c[0]<.25){const f=1-envelope*(.45-.45*Math.sin(elapsed*13+i*2.7)**2*(.6+.4*Math.sin(elapsed*3.1+group)));for(let k=0;k<3;k++)out.colors[o+k]*=f;}
  }
}
export function createFrame(show){return {positions:new Float32Array(show.count*3),colors:new Float32Array(show.count*3),phase:'',time:0};}
export function sampleShow(show,time,out=createFrame(show)){
  const t=clamp(Number.isFinite(time)?time:0,0,show.duration),s=stageAt(show,t),elapsed=t-s.start,duration=s.end-s.start;
  out.time=t;out.phase=s.name;
  const window=Math.sin(Math.PI*elapsed/duration)**2,animated=['sparkle','fire','starship'].includes(s.effect),travel=ease((elapsed-.65)/(duration-1.3)),progress=ease(elapsed/duration),fadeOut=1-ease(elapsed/.6),fadeIn=ease(elapsed/.65),navigation=ease(elapsed/.35)*ease((duration-elapsed)/.35);
  const side=Math.ceil(Math.sqrt(show.count)),motion=(s.kind==='hold'||s.kind==='rise')&&s.motion?motionFrame(s):null,envelope=motion?ease(elapsed/1.2)*ease((duration-elapsed)/1.2):0;
  for(let i=0;i<show.count;i++){
    let q=0,light=0,navLight=0,color=s.to.colors[i];
    if(s.kind==='hold'){q=1;const reveal=Math.min(2,duration/2),rank=s.light==='draw-on'?(s.to.order?.[i]??0):s.light==='bottom-up'?clamp((s.to.positions[i][1]/(s.motionScale??1)-2)/42):0;light=s.reveal?ease((elapsed-rank*reveal*.75)/(s.light==='fade'||!s.light?Math.min(1.1,reveal):reveal*.25)):1;}
    // Lit transitions: the shape's lights are off in flight and every drone blinks red or blue at TRAVEL_BLINK.
    else if(s.kind==='move'){q=travel;light=s.transitionLights?0:fadeOut;color=s.from.colors[i];if(s.transitionLights)navLight=TRAVEL_LEVEL*navigation*(.35+.65*Math.sin(elapsed*8+i*.12)**2);}
    else if(s.kind==='takeoff'||s.kind==='landing'){// Row and LED phase follow the pad, so each pad reverses its own takeoff.
      const pad=s.to.pad?.[i]??i,row=Math.floor(pad/side)/Math.max(1,side-1),navTime=s.reverse?6*(1-elapsed/duration):elapsed,navDuration=s.reverse?6:duration;q=s.reverse?1-ease((navTime-row*.65)/(6-.65)):ease((elapsed-row*.65)/(duration-.65));light=ease(navTime/.35)*ease((navDuration-navTime)/.35)*(.35+.65*Math.sin(navTime*8+pad*.12)**2);color=(Math.floor(navTime*3)+pad)%2?navigationRed:navigationBlue;}
    else if(s.kind==='grow'){q=progress;light=fadeIn;}
    // Sparks accelerate uniformly for 80% of the fall, then brake to rest, matching the next transfer's zero start speed.
    else if(s.kind==='fall'){const u=elapsed/duration;q=u<.8?u*u/.8:.8+2*(u-.8)-(u-.8)**2/.2;light=(1-ease(elapsed/duration))*(1-.92*Math.sin(Math.PI*elapsed/duration)**2*(.5+.5*Math.sin(elapsed*12+i*2.4)));color=s.from.colors[i];}
    else if(s.kind==='burst'||s.kind==='rise'){q=progress;light=fadeIn;}
    if(s.fadeBeforeMove)light*=ease((duration-elapsed)/.6);
    const flameDrone=color[0]>0&&color[1]/color[0]>.7&&color[2]/color[0]<.2;
    const falling=(s.to.fire?.[i]??flameDrone)&&s.fireEnabled!==false&&(s.effect==='starship'||s.effect==='fire'),fallPhase=(elapsed*.65+i*.61803398875)%1,fall=fallPhase<.75?ease(fallPhase/.75):1-ease((fallPhase-.75)/.25);
    let pulse=animated?1-.55*window*(1+Math.sin(elapsed*9+i*.67))/2:s.kind==='burst'?1-.14*window*(1+Math.sin(elapsed*4+i*.2))/2:1;
    if(falling)pulse*=1-window+window*ease(fallPhase/.08)*(1-ease((fallPhase-.55)/.2));
    for(let k=0;k<3;k++){
      out.positions[i*3+k]=s.from.positions[i][k]+(s.to.positions[i][k]-s.from.positions[i][k])*q;
      if(k===1&&falling)out.positions[i*3+k]-=window*(s.effect==='starship'?3:1.6)*(s.motionScale??1)*fall;
      if(k===1)out.positions[i*3+k]=Math.max(.12,out.positions[i*3+k]);
      out.colors[i*3+k]=color[k]*light*pulse+navLight*((Math.floor(elapsed*3)+i)%2?navigationRed[k]:navigationBlue[k]);
    }
    if(envelope>0)moveDrone(s,motion,i,elapsed,envelope,out);
  }
  return out;
}

export class ShowClock{
  constructor(duration){this.duration=duration;this.time=0;this.rate=1;this.playing=false;this.anchor=0;}
  read(now){if(this.playing){this.time=clamp(this.time+Math.max(0,now-this.anchor)*this.rate/1000,0,this.duration);this.anchor=now;if(this.time>=this.duration)this.playing=false;}return this.time;}
  play(now){if(this.time>=this.duration)this.time=0;this.anchor=now;this.playing=true;}
  pause(now){this.read(now);this.playing=false;}
  seek(time,now){this.time=clamp(Number.isFinite(time)?time:0,0,this.duration);this.anchor=now;}
  speed(rate,now){this.read(now);this.rate=clamp(Number.isFinite(rate)?rate:1,.25,2);}
}
