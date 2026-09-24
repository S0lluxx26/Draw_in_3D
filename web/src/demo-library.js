// The Demo's formation library: Blender-built 3D formations with their built-in motion (spout, waves, flapping,
// drifting balloons), shared by the Demo and by shows edited from it in the Show editor. Pure: no DOM.
import {buildShow,demoPaths,spoutDrop,spoutPoint,waveDrop,wavePoint,MOTIONS} from './drone-show.js';

export const FLEET_SIZES=[256,512,1024,2048,4096];
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
  const fireCount=fire?Math.floor(count/8):0,extraCount=cue.spout?Math.floor(count/10):cue.waves?Math.floor(count/8):0,bodyCount=count-fireCount-extraCount;
  const world=p=>[p[0]*scale,(p[1]+18)*scale,p[2]*scale];
  const spout=cue.spout&&{hole:world(cue.spout.hole),height:cue.spout.height*scale,spread:cue.spout.spread*scale};
  const waves=cue.waves&&{...cue.waves,unit:scale,wavelength:cue.waves.wavelength*scale,lines:cue.waves.lines.map(l=>({...l,y:(l.y+18)*scale,x0:l.x0*scale,x1:l.x1*scale,z:l.z*scale,amp:l.amp*scale}))};
  const drops=Array.from({length:extraCount},(_,j)=>spout?spoutDrop(j):waveDrop(j,extraCount,cue.waves));
  const formation={positions:[...[...asset.body.positions.slice(0,bodyCount),...asset.fire.positions.slice(0,fireCount)].map(world),...drops.map(d=>d.kind==='spout'?spoutPoint(spout,d):wavePoint(waves,d))],
    colors:[...asset.body.colors.slice(0,bodyCount),...asset.fire.colors.slice(0,fireCount),...drops.map(d=>d.kind==='spout'?[.46+.16*d.radius,.68,.9]:[.1,.5+.18*(d.line%2),1])],
    fire:Array.from({length:count},(_,i)=>i>=bodyCount&&i<bodyCount+fireCount),...extraCount?{extra:Array.from({length:count},(_,i)=>drops[i-bodyCount-fireCount]??0)}:{}};
  return {formation,fireEnabled:fireCount>0,pyro:cue.pyro,effect:cue.effect==='starship'?'starship':fireCount?'fire':cue.effect==='sparkle'?'sparkle':'none',motion:MOTIONS.includes(cue.effect)?cue.effect:undefined,spout,waves};
}
export function compileDemo(assets,value){
  const settings=demoSettings(value),{count}=settings,scale=settings.scale*2;
  const sequence=demoPaths().map(cue=>({...cue,transfer:9,...libraryFormation(assets,cue.name,count,scale,settings.fire[cue.name])}));
  const show=buildShow(null,{count,sequence,transitionLights:true,motionScale:scale,reverseLanding:true,fireworks:{trilogy:true}});
  show.lightShape=settings.shape;show.demo=true;show.pyro=settings.pyro;show.lasers=settings.lasers;return show;
}
