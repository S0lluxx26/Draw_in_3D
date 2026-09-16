// Shared durable contract: app/src/main/java/com/drawin3d/SceneData.java.
import {PAPER_TYPES} from './paper.js';
export const LIMITS = Object.freeze({ objects: 80, points: 4000, stroke: 384, images: 6, bytes: 16 * 1024 * 1024, imageChars: 2 * 1024 * 1024 });
export const BRUSHES = ['Pen', 'Marker', 'Neon', 'Spray', 'Water'];
export const TYPES = ['stroke', 'image', 'start', 'checkpoint', 'goal', 'block', 'paper'];
export function entity(type = 'stroke') {
  return { id: crypto.randomUUID(), type, brush: 'Pen', pattern:'solid', size:[.5,.5,.5], paperKind:'watercolor',paperId:'',pointSpace:'object',bend:0,pitch:0,roll:0,position: [0,0,0], normal: [0,0,1], yaw: 0, scale: 1, width: .018, alpha: 1, arc: 100, panelWidth: 2, aspect: 2, color: 0xff61e8c6 | 0, wet: false, surface: false, image: '', points: [] };
}
export const versionOf = entities => entities.some(e=>e.pointSpace==='surface'||e.bend||e.pitch||e.roll)?4:entities.some(e=>e.type==='paper'||e.paperId)?3:entities.some(e=>e.type==='block'||(e.pattern&&e.pattern!=='solid'))?2:1;
export function documentOf(entities) {
  return { version: versionOf(entities), units: 'metres', coordinates: 'right-handed-y-up', alignment: 'manual-origin-required', entities };
}
export const clone = value => structuredClone(value);
export function counts(entities) {
  return { objects: entities.length, points: entities.reduce((n,e) => n+e.points.length, 0), images: entities.filter(e => e.type === 'image').length };
}
export function withinBounds(e) {
  if(e.pointSpace==='surface')return true;
  if (e.type === 'stroke') {
    const a = e.yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return e.points.every(p => Math.hypot(e.position[0] + e.scale*(p[0]*c+p[2]*s), e.position[1]+p[1]*e.scale, e.position[2]+e.scale*(-p[0]*s+p[2]*c)) <= 3.65);
  }
  const radius = e.type === 'block' ? Math.hypot(...e.size)/2 : ['image','paper'].includes(e.type) ? e.panelWidth * Math.sqrt(1 + 1/e.aspect**2) / 2 : .2;
  return Math.hypot(...e.position) + radius*e.scale <= 4;
}
function need(ok, message) { if (!ok) throw new Error(message); }
function number(v, lo, hi, label) { need(typeof v === 'number' && Number.isFinite(v) && v >= lo-1e-7 && v <= hi+1e-7, `Invalid ${label}.`); }
function vector(v, length, max) { need(Array.isArray(v) && v.length === length, 'Invalid coordinate vector.'); v.forEach(n => number(n,-max,max,'coordinate')); }
export function validate(doc) {
  need(doc && [1,2,3,4].includes(doc.version) && doc.units === 'metres' && doc.coordinates === 'right-handed-y-up', 'This file is not a supported Draw in 3D project.');
  need(Array.isArray(doc.entities) && doc.entities.length <= LIMITS.objects, 'A project can contain at most 80 objects.');
  const ids = new Set();
  for (const e of doc.entities) {
    need(e && typeof e.id === 'string' && e.id.length <= 100 && !ids.has(e.id), 'Invalid or duplicate object ID.'); ids.add(e.id);
    need(TYPES.includes(e.type) && BRUSHES.includes(e.brush), 'Unknown object or brush type.');
    need(['solid','dash','dot'].includes(e.pattern??'solid'), 'Unknown stroke pattern.');
    need(doc.version>=2 || e.type!=='block' && (!e.pattern||e.pattern==='solid'), 'Blocks and patterned strokes need project version 2.');
    need(doc.version>=3 || e.type!=='paper'&&!e.paperId,'Paper surfaces need project version 3.');
    need(['object','surface'].includes(e.pointSpace??'object'),'Unknown point coordinate space.');
    need(e.pointSpace!=='surface'||e.type==='stroke'&&!!e.paperId,'Surface points need a paper reference.');
    need(doc.version>=4||e.pointSpace!=='surface'&&!e.bend&&!e.pitch&&!e.roll,'Bent surfaces need project version 4.');
    for(const key of ['bend','pitch','roll'])number(e[key]??0,key==='bend'?-300:-36000,key==='bend'?300:36000,key);
    need(e.type==='paper'||!e.bend&&!e.pitch&&!e.roll,'Only paper has surface transforms.');
    if(e.type==='paper')need(Object.hasOwn(PAPER_TYPES,e.paperKind),'Unknown paper type.');
    if(e.paperId!==undefined)need(typeof e.paperId==='string'&&e.paperId.length<=100,'Invalid paper attachment.');
    if(e.type==='block'){vector(e.size,3,4);e.size.forEach(v=>number(v,.02,4,'block dimension'));}
    vector(e.position,3,4); vector(e.normal,3,1.01);
    const n = Math.hypot(...e.normal); need(n >= .9 && n <= 1.1, 'Invalid surface normal.');
    for (const [key,lo,hi] of [['yaw',-36000,36000],['scale',.1,4],['width',e.pointSpace==='surface'?.0005:.002,e.pointSpace==='surface'?1.5:.15],['alpha',.05,1],['arc',0,300],['panelWidth',.1,4],['aspect',.1,10]]) number(e[key],lo,hi,key);
    need(Number.isInteger(e.color) && e.color >= -2147483648 && e.color <= 2147483647, 'Invalid ARGB colour.');
    need(typeof e.wet === 'boolean' && typeof e.surface === 'boolean', 'Invalid brush flags.');
    need(Array.isArray(e.points) && e.points.length <= LIMITS.stroke, 'A stroke can have at most 384 points.');
    for (const p of e.points) { vector(p,4,e.pointSpace==='surface'?1024:8); number(p[3],.1,2,'pressure'); }
    if(e.pointSpace==='surface')need(Math.abs(e.position[2])<1e-7&&e.points.every(p=>Math.abs(p[2])<1e-7),'Surface points must have zero depth.');
    need(e.type !== 'stroke' || e.points.length > 0, 'Empty stroke.');
    need(typeof e.image === 'string', 'Invalid image data.');
    if (e.type === 'image') need(e.image.length > 0 && e.image.length <= LIMITS.imageChars && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(e.image), 'Missing or oversized image data.');
    else need(e.image.length === 0, 'Unexpected image data.');
    need(withinBounds(e), 'This edit exceeds the shared 4 m map radius. Move or shrink the object.');
  }
  const c = counts(doc.entities);
  for(const e of doc.entities)if(e.paperId)need(e.type==='stroke'&&doc.entities.some(p=>p.id===e.paperId&&p.type==='paper'),'Attached stroke has no paper sheet.');
  need(c.points <= LIMITS.points && c.images <= LIMITS.images, 'Phone budget exceeded: 4,000 points or 6 images.');
  return doc;
}
export function decode(text) {
  need(new TextEncoder().encode(text).length <= LIMITS.bytes, 'Project exceeds the 16 MiB file limit.');
  const doc = validate(JSON.parse(text));
  // Recreate only defined fields; import/export is data, never executable content.
  return doc.entities.map(e => {
    const clean = entity(e.type);
    for (const key of Object.keys(clean)) if(e[key]!==undefined) clean[key] = clone(e[key]);
    return clean;
  });
}
export function encode(entities) {
  validate(documentOf(entities));
  // Android validates against float constants: e.g. 0.002f is slightly ABOVE
  // JS's literal 0.002. Store float32 values to accept both range endpoints.
  const compatible = entities.map(e => {
    const copy = clone(e);
    for (const key of ['yaw','scale','width','alpha','arc','panelWidth','aspect','bend','pitch','roll']) copy[key] = Math.fround(e[key]);
    for (const key of ['position','normal']) copy[key] = e[key].map(Math.fround);
    copy.points = e.points.map(p => p.map(Math.fround));
    if(e.type==='block')copy.size=e.size.map(Math.fround);else delete copy.size;
    if(!e.pattern||e.pattern==='solid')delete copy.pattern;
    if(e.type!=='paper')delete copy.paperKind;
    if(!e.paperId)delete copy.paperId;
    if(e.pointSpace!=='surface')delete copy.pointSpace;
    for(const key of ['bend','pitch','roll'])if(!e[key])delete copy[key];
    return copy;
  });
  const text = JSON.stringify(validate(documentOf(compatible)));
  need(new TextEncoder().encode(text).length <= LIMITS.bytes, 'Project exceeds the 16 MiB file limit.');
  return text;
}
export const argb = hex => (0xff000000 | Number.parseInt(hex.slice(1),16));
export const hexColor = color => '#' + (color & 0xffffff).toString(16).padStart(6,'0');
export function curve(u, width, degrees) {
  const a = degrees*Math.PI/180;
  return Math.abs(a) < .0001 ? [(u-.5)*width,0,0] : [width/a*Math.sin((u-.5)*a),0,width/a*(1-Math.cos((u-.5)*a))];
}
