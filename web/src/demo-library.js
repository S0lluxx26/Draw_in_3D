// The Demo's formation library: Blender-built 3D formations with their built-in motion (spout, waves, flapping,
// drifting balloons), shared by the Demo and by shows edited from it in the Show editor. Pure: no DOM.
import {buildShow,demoPaths,demoHold,spoutDrop,spoutPoint,waveDrop,wavePoint,MOTIONS} from './drone-show.js';

export const FLEET_SIZES=[256,512,1024,2048,4096];
export const DEMO_TRANSFER=7;// seconds between Demo formations
export const LIGHT_SHAPES=['round','diamond','star'];
export const FORMATIONS=['Robot','Fish','Butterfly','Hot air balloon','Eiffel Tower','Big ship','Whale','Firework star','Row of fire','Birthday cake','Starship launch','Happy day'];
export function demoSettings(value={}){
  return {count:FLEET_SIZES.includes(value?.count)?value.count:4096,
    shape:LIGHT_SHAPES.includes(value?.shape)?value.shape:'round',
    scale:[2,3,4].includes(value?.scale)?value.scale:3,
    pyro:typeof value?.pyro==='boolean'?value.pyro:true,
    lasers:typeof value?.lasers==='boolean'?value.lasers:true,
    fire:Object.fromEntries(FORMATIONS.map(name=>[name,typeof value?.fire?.[name]==='boolean'?value.fire[name]:['Row of fire','Starship launch'].includes(name)]))};
}
// The built-in definition (line art, timing, motion) of a library formation.
export const libraryCue=name=>demoPaths().find(c=>c.name===name);
// One library formation for a fleet of `count` at world scale `scale`, ready for buildShow's sequence.
export function libraryFormation(assets,name,count,scale,fire=false){
  // Extra drones: a tenth of the fleet becomes the whale's water spout, an eighth the fish's waves. The body keeps
  // an evenly spread prefix of its lights. Spout and waves are converted to world units here.
  const cue=libraryCue(name),asset=assets?.[name];if(!cue||!asset)throw new Error(`The Demo formation "${name}" is not available.`);
  // The whale has both: a spout (a tenth) and its sea (a twelfth).
  const fireCount=fire?Math.floor(count/8):0,spoutCount=cue.spout?Math.floor(count/10):0,waveCount=cue.waves?Math.floor(count/(cue.spout?12:8)):0,extraCount=spoutCount+waveCount,bodyCount=count-fireCount-extraCount;
  const world=p=>[p[0]*scale,(p[1]+18)*scale,p[2]*scale];
  const spout=cue.spout&&{hole:world(cue.spout.hole),height:cue.spout.height*scale,spread:cue.spout.spread*scale};
  const waves=cue.waves&&{...cue.waves,unit:scale,wavelength:cue.waves.wavelength*scale,lines:cue.waves.lines.map(l=>({...l,y:(l.y+18)*scale,x0:l.x0*scale,x1:l.x1*scale,z:l.z*scale,amp:l.amp*scale}))};
  const drops=[...Array.from({length:spoutCount},(_,j)=>spoutDrop(j)),...Array.from({length:waveCount},(_,j)=>waveDrop(j,waveCount,cue.waves))];
  const formation={positions:[...[...asset.body.positions.slice(0,bodyCount),...asset.fire.positions.slice(0,fireCount)].map(world),...drops.map(d=>d.kind==='spout'?spoutPoint(spout,d):wavePoint(waves,d))],
    colors:[...asset.body.colors.slice(0,bodyCount),...asset.fire.colors.slice(0,fireCount),...drops.map(d=>d.kind==='spout'?[.46+.16*d.radius,.68,.9]:[.1,.5+.18*(d.line%2),1])],
    fire:Array.from({length:count},(_,i)=>i>=bodyCount&&i<bodyCount+fireCount),...extraCount?{extra:Array.from({length:count},(_,i)=>drops[i-bodyCount-fireCount]??0)}:{}};
  // Its sentence, if it has one: every phrase uses the whole fleet (no fire, no water).
  const phrases=(cue.prelude||[]).filter(label=>assets[label]).map(label=>{const b=assets[label].body;return {label,formation:{positions:b.positions.slice(0,count).map(world),colors:b.colors.slice(0,count).map(c=>[...c])}};});
  return {formation,fireEnabled:fireCount>0,pyro:cue.pyro,effect:cue.effect==='starship'?'starship':fireCount?'fire':cue.effect==='sparkle'?'sparkle':'none',motion:MOTIONS.includes(cue.effect)?cue.effect:undefined,spout,waves,...(phrases.length?{phrases}:{})};
}
// Drawings with the whale or fish swim get the same water as the Demo formations: a spout from the top of the
// drawing's front (the whale's head faces +x) or rolling waves above it. `positions` are world points of the
// sampled drawing (count − extras lights); `unit` converts formation units to world units.
export const extrasFor=(motion,count)=>motion==='swim'?Math.floor(count/10):motion==='fish'?Math.floor(count/8):0;
export function drawingExtras(motion,positions,extraCount,unit){
  if(!extraCount||!positions.length)return null;
  const xs=positions.map(p=>p[0]),ys=positions.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),maxY=Math.max(...ys),L=Math.max(1e-6,maxX-minX);
  if(motion==='swim'){
    const front=positions.filter(p=>p[0]>maxX-.35*L),top=front.reduce((a,b)=>b[1]>a[1]?b:a,front[0]);
    const spout={hole:[top[0],top[1]+.01*L,top[2]],height:.35*L,spread:.12*L};
    const drops=Array.from({length:extraCount},(_,j)=>spoutDrop(j));
    return {spout,drops,positions:drops.map(d=>spoutPoint(spout,d)),colors:drops.map(d=>[.46+.16*d.radius,.68,.9])};
  }
  const lines=[{y:maxY+.05*L,x0:minX,x1:minX+.7*L,z:.6*unit,amp:.017*L,phase:3.1},{y:maxY+.13*L,x0:minX+.06*L,x1:maxX-.06*L,z:0,amp:.02*L,phase:0},{y:maxY+.2*L,x0:minX+.22*L,x1:maxX-.22*L,z:-.6*unit,amp:.013*L,phase:1.7}];
  const waves={lines,wavelength:.27*L,speed:.45,unit},drops=Array.from({length:extraCount},(_,j)=>waveDrop(j,extraCount,waves));
  return {waves,drops,positions:drops.map(d=>wavePoint(waves,d)),colors:drops.map(d=>[.1,.5+.18*(d.line%2),1])};
}
export function compileDemo(assets,value){
  const settings=demoSettings(value),{count}=settings,scale=settings.scale*2;
  const sequence=demoPaths().map(cue=>({...cue,hold:demoHold(cue),transfer:DEMO_TRANSFER,...libraryFormation(assets,cue.name,count,scale,settings.fire[cue.name])}));
  const show=buildShow(null,{count,sequence,transitionLights:true,motionScale:scale,reverseLanding:true,fireworks:{trilogy:true}});
  show.lightShape=settings.shape;show.demo=true;show.pyro=settings.pyro;show.lasers=settings.lasers;return show;
}
