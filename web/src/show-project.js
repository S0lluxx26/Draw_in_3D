// Editable source is separate from compiled drone positions and drawing-only files.
import {entity,clone,validate,documentOf,decode} from './model.js';
import {demoPaths,drawingPaths,fitPaths,placePaths,samplePaths,buildShow,DRONE_COUNT,MOTIONS,CINEMATIC_LANDING} from './drone-show.js';
import {FORMATIONS,FLEET_SIZES,LIGHT_SHAPES,DEMO_TRANSFER,demoSettings,libraryCue,libraryFormation,extrasFor,drawingExtras} from './demo-library.js';
import {designPaper,designPlacement,toSheet,argb} from './formation-design.js';

export const SHOW_LIMITS=Object.freeze({cues:14,bytes:16*1024*1024,history:24});
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const num=(v,min,max,label)=>need(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,`${label} must be between ${min} and ${max}.`);
const name=(v,label)=>need(typeof v==='string'&&v.trim().length>0&&v.length<=64&&!/[\u0000-\u001f\u007f]/.test(v),`${label} needs 1–64 characters without control characters.`);
export function blankArtwork(label='Drawing guide'){
  return [{...entity('paper'),paperName:label,panelWidth:3.2,aspect:4/3,position:[0,1.4,0],paperVisible:false}];
}
export function captureArtwork(entities,selection){
  const strokes=entities.filter(e=>e.type==='stroke'&&(!selection||selection.has(e.id)||selection.has(e.paperId)));
  const parents=new Set(strokes.map(e=>e.paperId).filter(Boolean));
  const result=entities.filter(e=>strokes.includes(e)||e.type==='paper'&&(parents.has(e.id)||!selection));
  validate(documentOf(result));return clone(result);
}
export const DEMO_TIMING=Object.freeze({hold:15,transfer:DEMO_TRANSFER});// a Demo formation's display and transition
// Without artwork, a new formation is a blank sky stage for the 2D designer; captured ink is fitted to the stage.
export function newCue(artwork,label='New formation',timing={hold:8,transfer:7}){
  const blank=!artwork,ink=artwork||[designPaper()],paths=blank?[]:drawingPaths(ink);
  return {id:crypto.randomUUID(),name:label,artwork:ink,hold:timing.hold,transfer:timing.transfer,light:'fade',effect:'none',brightness:1,
    placement:blank?designPlacement():paths.length?fitArtwork(ink):{origin:[0,1.4,0],scale:10,position:[0,18,0],yaw:0}};
}
export function fitArtwork(artwork){const p=fitPaths(drawingPaths(artwork));return {...p,scale:Math.min(100,Math.max(.1,p.scale))};}
export function newShow(){return {format:'draw-in-3d-show',version:2,name:'My sky story',count:DRONE_COUNT,cues:[],fireworks:{enabled:true,duration:9,radius:6.3}};}
// A Demo formation's line art as editable stage ink (Convert to drawing): the 2D designer edits it in place.
export function drawingCue(name,base={}){
  const {paths,hold,effect='none'}=libraryCue(name),paper=designPaper();
  const artwork=[paper,...paths.map(path=>({...entity('stroke'),paperId:paper.id,pointSpace:'surface',color:argb(path.color),points:path.points.map(toSheet)}))];
  const cue={...newCue(artwork,name),hold,effect,placement:designPlacement()};
  for(const key of ['id','name','hold','transfer','light','brightness'])if(base[key]!==undefined)cue[key]=base[key];
  return cue;
}
// The Demo as editable line drawings (show version 2).
export function editableDemo(){
  const doc=newShow();doc.name='Sky stories';
  doc.cues=demoPaths().map(({name})=>drawingCue(name));return validateShow(doc);
}
// The Demo itself as an editable show (version 3): the Blender-built formations with their built-in motion, the
// Demo's look and its finale. Edit, reorder, remove or add formations, save the file, and it plays like the Demo.
const DEFAULT_PLACEMENT={origin:[0,1.4,0],scale:10,position:[0,18,0],yaw:0};
export const demoCue=(name,fire=false)=>({id:crypto.randomUUID(),name,library:name,artwork:[],hold:libraryCue(name).hold,transfer:DEMO_TRANSFER,light:'fade',effect:libraryCue(name).effect??'none',fire,brightness:1,placement:structuredClone(DEFAULT_PLACEMENT)});
export function demoShowDoc(settings){
  const s=demoSettings(settings);
  return validateShow({format:'draw-in-3d-show',version:3,name:'Sky stories',count:s.count,look:{shape:s.shape,scale:s.scale,pyro:s.pyro,lasers:s.lasers},
    cues:FORMATIONS.map(name=>demoCue(name,s.fire[name])),fireworks:{enabled:true,style:'demo',duration:9,radius:6.3}});
}
// Give an older show the Demo's scale, look and landing (its drawings stay as they are).
export function withDemoLook(doc,settings){
  const s=demoSettings(settings);
  return validateShow({...doc,version:3,count:FLEET_SIZES.includes(doc.count)?doc.count:s.count,look:{shape:s.shape,scale:s.scale,pyro:s.pyro,lasers:s.lasers},fireworks:{...doc.fireworks,style:'classic'}});
}
export function validateShow(doc){
  need(doc?.format==='draw-in-3d-show'&&[1,2,3].includes(doc.version),'Open a Draw in 3D show file (version 1, 2 or 3). Drawing files use Open project.');
  const v3=doc.version===3;
  name(doc.name,'Show name');need(v3?FLEET_SIZES.includes(doc.count):[256,DRONE_COUNT].includes(doc.count),v3?'Supported fleets are 256 to 4,096 drones.':'Supported fleets are 256 and 4096 drones.');
  need(Array.isArray(doc.cues)&&doc.cues.length<=SHOW_LIMITS.cues,`A show can contain up to ${SHOW_LIMITS.cues} formations.`);
  need(doc.cues.every(c=>c&&typeof c==='object'&&!Array.isArray(c)),'Each formation must be an object with a name, artwork and timing.');
  need(doc.version>=2||doc.count===256&&doc.cues.every(c=>!c.effect||c.effect==='none'),'Large fleets and animated effects require show version 2 or later.');
  const ids=new Set();
  for(const c of doc.cues){
    need(typeof c.id==='string'&&c.id.length>0&&c.id.length<=100&&!ids.has(c.id),'Invalid or duplicate formation ID.');ids.add(c.id);name(c.name,'Formation name');need(['none','sparkle','fire','starship','flap','swim','fish','balloons'].includes(c.effect??'none'),'Unknown formation effect.');
    if(c.library!==undefined){need(v3&&FORMATIONS.includes(c.library),`${c.name}: unknown Demo formation.`);need(Array.isArray(c.artwork)&&c.artwork.length===0,`${c.name}: a Demo formation has no drawing.`);need(c.fire===undefined||typeof c.fire==='boolean','Invalid falling-fire setting.');}
    need(Array.isArray(c.artwork)&&c.artwork.every(e=>e&&typeof e==='object'&&!Array.isArray(e)),`${c.name}: formation artwork must be a list of strokes and paper guides.`);
    validate(documentOf(c.artwork));need(c.artwork.every(e=>['paper','stroke'].includes(e.type)),'Formations contain strokes and their paper guides only.');
    num(c.hold,2,60,'Display duration');num(c.transfer,2,30,'Transition duration');num(c.brightness,.1,1,'Brightness');
    need(['fade','draw-on','bottom-up'].includes(c.light),'Unknown light preset.');
    const p=c.placement;need(p&&Array.isArray(p.origin)&&p.origin.length===3&&Array.isArray(p.position)&&p.position.length===3,'Invalid formation placement.');
    p.origin.forEach(v=>num(v,-100,100,'Source origin'));p.position.forEach((v,k)=>num(v,k===1?6:-20,k===1?34:20,'Stage position'));
    num(p.scale,.1,100,'Stage scale');num(p.yaw,-180,180,'Stage rotation');
  }
  need(typeof doc.fireworks?.enabled==='boolean','Invalid fireworks setting.');num(doc.fireworks.duration,2,20,'Fireworks duration');num(doc.fireworks.radius,2,8,'Fireworks radius');
  if(v3){const l=doc.look;need(l&&LIGHT_SHAPES.includes(l.shape)&&[2,3,4].includes(l.scale)&&typeof l.pyro==='boolean'&&typeof l.lasers==='boolean','Invalid show look.');need(['demo','classic'].includes(doc.fireworks.style),'Unknown finale.');}
  return doc;
}
export function encodeShow(doc){validateShow(doc);const text=JSON.stringify(doc);need(new TextEncoder().encode(text).length<=SHOW_LIMITS.bytes,'Show exceeds the 16 MiB file limit.');return text;}
export function decodeShow(text){
  need(new TextEncoder().encode(text).length<=SHOW_LIMITS.bytes,'Show exceeds the 16 MiB file limit.');
  const d=validateShow(JSON.parse(text));
  // Rebuild the known schema; imported properties never become application state.
  const v3=d.version===3;
  return {format:d.format,version:v3?3:2,name:d.name,count:d.count,cues:d.cues.map(c=>({id:c.id,name:c.name,...(c.library?{library:c.library,fire:!!c.fire}:{}),artwork:c.library?[]:decode(JSON.stringify(documentOf(c.artwork))),hold:c.hold,transfer:c.transfer,light:c.light,effect:c.effect??'none',brightness:c.brightness,placement:{origin:[...c.placement.origin],position:[...c.placement.position],scale:c.placement.scale,yaw:c.placement.yaw}})),
    fireworks:{enabled:d.fireworks.enabled,duration:d.fireworks.duration,radius:d.fireworks.radius,...(v3?{style:d.fireworks.style}:{})},...(v3?{look:{shape:d.look.shape,scale:d.look.scale,pyro:d.look.pyro,lasers:d.look.lasers}}:{})};
}
export function cueFormation(c,count=DRONE_COUNT){
  const paths=placePaths(drawingPaths(c.artwork),c.placement);
  need(paths.every(path=>path.points.every(p=>Math.abs(p[0])<=34&&p[1]>=2&&p[1]<=46&&Math.abs(p[2])<=24)),`${c.name}: ink is outside the sky stage. Use Fit to stage or adjust placement.`);
  const f=samplePaths(paths,count);f.colors=f.colors.map(c0=>c0.map(v=>v*c.brightness));return f;
}
// One formation of a version 3 show exactly as it will play (world units): Run compiles every formation with this,
// and the Show editor previews the selected one with it, so the preview never drifts from the performance.
export function cueSequence(doc,c,assets){
  const scale=doc.look.scale*2;
  if(c.library){const lib=libraryFormation(assets,c.library,doc.count,scale,c.fire);lib.formation.colors=lib.formation.colors.map(v=>v.map(x=>x*c.brightness));return {...c,...lib,name:c.name};}
  // Drawings swim like the Demo formations: the whale swim adds a spout, the fish swim adds waves.
  const motion=MOTIONS.includes(c.effect)?c.effect:undefined,extra=extrasFor(motion,doc.count),f=cueFormation(c,doc.count-extra);f.positions=f.positions.map(p=>p.map(v=>v*scale));
  const water=drawingExtras(motion,f.positions,extra,scale);if(!water)return {...c,formation:f};
  f.positions.push(...water.positions);f.colors.push(...water.colors.map(v=>v.map(x=>x*c.brightness)));f.extra=[...Array(doc.count-extra).fill(0),...water.drops];
  return {...c,formation:f,...(water.spout?{spout:water.spout}:{waves:water.waves})};
}
// Why a formation cannot play yet (checked on its card before Run), or null.
export function cueProblem(c){
  if(c.library)return null;
  if(!drawingPaths(c.artwork).length)return 'Nothing drawn yet. Draw the formation on the stage.';
  try{cueFormation(c,64);return null;}catch(error){return error.message.replace(c.name+': ','');}
}
// When each formation starts forming (its transfer) and when its display ends, as Run plays them.
export function cueTimes(doc){let t=8;return doc.cues.map(c=>{const start=t;t+=c.transfer+c.hold;return {id:c.id,start,end:t};});}
// assets: the Demo's formation library (formation-assets.js), needed when the show uses Demo formations.
export function compileShow(doc,assets){
  validateShow(doc);need(doc.cues.length>0,'Add at least one formation to your show.');
  if(doc.version!==3){
    const sequence=doc.cues.map(c=>{try{return {...c,formation:cueFormation(c,doc.count)};}catch(error){throw new Error(c.name+': '+error.message);}});
    return buildShow(null,{sequence,fireworks:doc.fireworks,title:doc.name,count:doc.count});
  }
  // Version 3 plays at the Demo's scale and look: Demo formations come from the Blender library with their motion,
  // and drawings are placed on the same stage (stage units × scale), so both kinds sit together naturally.
  const scale=doc.look.scale*2;
  const sequence=doc.cues.map(c=>{try{return cueSequence(doc,c,assets);}catch(error){throw new Error(c.name+': '+error.message);}});
  const finale=!doc.fireworks.enabled?{enabled:false}:doc.fireworks.style==='demo'?{trilogy:true}:{duration:doc.fireworks.duration,radius:doc.fireworks.radius};
  const show=buildShow(null,{sequence,count:doc.count,transitionLights:true,motionScale:scale,reverseLanding:true,fireworks:finale,title:doc.name});
  return Object.assign(show,{lightShape:doc.look.shape,pyro:doc.look.pyro,lasers:doc.look.lasers,cinematic:true});
}
export const DEMO_FINALE=66;// heart, star and firework balls: three 9 s launches, 6 s growth and 7 s falling sparks
export const DEMO_LANDING=CINEMATIC_LANDING.reduce((a,b)=>a+b);// return, descent under the firework finale, rest
export const showDuration=doc=>doc.version===3
  ?8+doc.cues.reduce((n,c)=>n+c.hold+c.transfer,0)+(doc.fireworks.enabled?(doc.fireworks.style==='demo'?DEMO_FINALE:7+doc.fireworks.duration):0)+DEMO_LANDING
  :25+doc.cues.reduce((n,c)=>n+c.hold+c.transfer,0)+(doc.fireworks.enabled?7+doc.fireworks.duration:0);

// Immutable cue edits share untouched artwork arrays; history is bounded.
export class ShowHistory{
  constructor(doc=newShow()){this.doc=doc;this.past=[];this.future=[];}
  set(doc){validateShow(doc);if(doc===this.doc)return;this.past.push(this.doc);if(this.past.length>SHOW_LIMITS.history)this.past.shift();this.future=[];this.doc=doc;}
  travel(back){const source=back?this.past:this.future,dest=back?this.future:this.past;if(!source.length)return false;dest.push(this.doc);this.doc=source.pop();return true;}
}
