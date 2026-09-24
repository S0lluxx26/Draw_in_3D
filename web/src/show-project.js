// Editable source is separate from compiled drone positions and drawing-only files.
import {entity,clone,validate,documentOf,decode} from './model.js';
import {demoPaths,drawingPaths,fitPaths,placePaths,samplePaths,buildShow,DRONE_COUNT} from './drone-show.js';

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
export function newCue(artwork=blankArtwork(),label='New formation'){
  const paths=drawingPaths(artwork);
  return {id:crypto.randomUUID(),name:label,artwork,hold:8,transfer:7,light:'fade',effect:'none',brightness:1,
    placement:paths.length?fitArtwork(artwork):{origin:[0,1.4,0],scale:10,position:[0,18,0],yaw:0}};
}
export function fitArtwork(artwork){const p=fitPaths(drawingPaths(artwork));return {...p,scale:Math.min(100,Math.max(.1,p.scale))};}
export function newShow(){return {format:'draw-in-3d-show',version:2,name:'My sky story',count:DRONE_COUNT,cues:[],fireworks:{enabled:true,duration:9,radius:6.3}};}
export function editableDemo(){
  const doc=newShow();doc.name='Sky stories';
  doc.cues=demoPaths().map(({name,paths,hold,effect='none'})=>{
    const paper=blankArtwork(name+' guide')[0];
    const artwork=[paper,...paths.map(path=>({...entity('stroke'),paperId:paper.id,pointSpace:'surface',color:(0xff000000|path.color.reduce((n,v,k)=>n|(Math.round(v*255)<<(16-k*8)),0)),points:path.points.map(p=>[p[0]/10,(p[1]-18)/10,p[2]/10,1])}))];
    return {...newCue(artwork,name),hold,effect,placement:{origin:[0,1.4,0],scale:10,position:[0,18,0],yaw:0}};
  });return validateShow(doc);
}
export function validateShow(doc){
  need(doc?.format==='draw-in-3d-show'&&[1,2].includes(doc.version),'Open a Draw in 3D show file (version 1 or 2). Drawing files use Open project.');
  name(doc.name,'Show name');need([256,DRONE_COUNT].includes(doc.count),'Supported fleets are 256 and 4096 drones.');
  need(Array.isArray(doc.cues)&&doc.cues.length<=SHOW_LIMITS.cues,`A show can contain up to ${SHOW_LIMITS.cues} formations.`);
  need(doc.cues.every(c=>c&&typeof c==='object'&&!Array.isArray(c)),'Each formation must be an object with a name, artwork and timing.');
  need(doc.version===2||doc.count===256&&doc.cues.every(c=>!c.effect||c.effect==='none'),'Large fleets and animated effects require show version 2.');
  const ids=new Set();
  for(const c of doc.cues){
    need(typeof c.id==='string'&&c.id.length>0&&c.id.length<=100&&!ids.has(c.id),'Invalid or duplicate formation ID.');ids.add(c.id);name(c.name,'Formation name');need(['none','sparkle','fire','starship','flap','swim'].includes(c.effect??'none'),'Unknown formation effect.');
    need(Array.isArray(c.artwork)&&c.artwork.every(e=>e&&typeof e==='object'&&!Array.isArray(e)),`${c.name}: formation artwork must be a list of strokes and paper guides.`);
    validate(documentOf(c.artwork));need(c.artwork.every(e=>['paper','stroke'].includes(e.type)),'Formations contain strokes and their paper guides only.');
    num(c.hold,2,60,'Display duration');num(c.transfer,2,30,'Transition duration');num(c.brightness,.1,1,'Brightness');
    need(['fade','draw-on','bottom-up'].includes(c.light),'Unknown light preset.');
    const p=c.placement;need(p&&Array.isArray(p.origin)&&p.origin.length===3&&Array.isArray(p.position)&&p.position.length===3,'Invalid formation placement.');
    p.origin.forEach(v=>num(v,-100,100,'Source origin'));p.position.forEach((v,k)=>num(v,k===1?6:-20,k===1?34:20,'Stage position'));
    num(p.scale,.1,100,'Stage scale');num(p.yaw,-180,180,'Stage rotation');
  }
  need(typeof doc.fireworks?.enabled==='boolean','Invalid fireworks setting.');num(doc.fireworks.duration,2,20,'Fireworks duration');num(doc.fireworks.radius,2,8,'Fireworks radius');return doc;
}
export function encodeShow(doc){validateShow(doc);const text=JSON.stringify(doc);need(new TextEncoder().encode(text).length<=SHOW_LIMITS.bytes,'Show exceeds the 16 MiB file limit.');return text;}
export function decodeShow(text){
  need(new TextEncoder().encode(text).length<=SHOW_LIMITS.bytes,'Show exceeds the 16 MiB file limit.');
  const d=validateShow(JSON.parse(text));
  // Rebuild the known schema; imported properties never become application state.
  return {format:d.format,version:2,name:d.name,count:d.count,cues:d.cues.map(c=>({id:c.id,name:c.name,artwork:decode(JSON.stringify(documentOf(c.artwork))),hold:c.hold,transfer:c.transfer,light:c.light,effect:c.effect??'none',brightness:c.brightness,placement:{origin:[...c.placement.origin],position:[...c.placement.position],scale:c.placement.scale,yaw:c.placement.yaw}})),fireworks:{enabled:d.fireworks.enabled,duration:d.fireworks.duration,radius:d.fireworks.radius}};
}
export function cueFormation(c,count=DRONE_COUNT){
  const paths=placePaths(drawingPaths(c.artwork),c.placement);
  need(paths.every(path=>path.points.every(p=>Math.abs(p[0])<=34&&p[1]>=2&&p[1]<=46&&Math.abs(p[2])<=24)),`${c.name}: ink is outside the sky stage. Use Fit to stage or adjust placement.`);
  const f=samplePaths(paths,count);f.colors=f.colors.map(c0=>c0.map(v=>v*c.brightness));return f;
}
export function compileShow(doc){
  validateShow(doc);need(doc.cues.length>0,'Add at least one formation to your show.');
  const sequence=doc.cues.map(c=>{try{return {...c,formation:cueFormation(c,doc.count)};}catch(error){throw new Error(c.name+': '+error.message);}});
  return buildShow(null,{sequence,fireworks:doc.fireworks,title:doc.name,count:doc.count});
}
export const showDuration=doc=>25+doc.cues.reduce((n,c)=>n+c.hold+c.transfer,0)+(doc.fireworks.enabled?7+doc.fireworks.duration:0);

// Immutable cue edits share untouched artwork arrays; history is bounded.
export class ShowHistory{
  constructor(doc=newShow()){this.doc=doc;this.past=[];this.future=[];}
  set(doc){validateShow(doc);if(doc===this.doc)return;this.past.push(this.doc);if(this.past.length>SHOW_LIMITS.history)this.past.shift();this.future=[];this.doc=doc;}
  travel(back){const source=back?this.past:this.future,dest=back?this.future:this.past;if(!source.length)return false;dest.push(this.doc);this.doc=source.pop();return true;}
}
