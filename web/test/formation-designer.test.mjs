import test from 'node:test';
import assert from 'node:assert/strict';
import assets from '../src/formation-assets.js';
import {STAGE,isDesign,designPaper,designPlacement,designArtwork,designStrokes,flattenArtwork,shapeOutline,filledShape,textStrokes,foldText,simplify,hitStroke,bounds,scaleAbout,rotateAbout,mapStrokes,mirrored,fitStrokes,budget,argb} from '../src/formation-design.js';
import {newCue,drawingCue,editableDemo,demoShowDoc,compileShow,cueFormation,encodeShow,decodeShow,DEMO_TIMING} from '../src/show-project.js';
import {drawingPaths,placePaths} from '../src/drone-show.js';

const pink=argb([1,.3,.6]),cyan=argb([.38,.91,.78]);
const design=(strokes,extra={})=>({...newCue(),name:'Designed',...extra,artwork:designArtwork(designPaper(),strokes)});
const box=points=>bounds([{points}]);
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(yi>p[1]!==yj>p[1]&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)c=!c;}return c;};

test('the designer sheet covers exactly the sky stage, and what is drawn is where the drones fly',()=>{
  const corners=designArtwork(designPaper(),[{color:pink,points:[[STAGE.minX,STAGE.minY],[STAGE.maxX,STAGE.maxY]]}]);
  const stage=placePaths(drawingPaths(corners),designPlacement())[0].points;
  assert.ok(Math.hypot(stage[0][0]-STAGE.minX,stage[0][1]-STAGE.minY)<1e-9&&Math.hypot(stage[1][0]-STAGE.maxX,stage[1][1]-STAGE.maxY)<1e-9,'sheet corners are the stage corners');
  const heart=shapeOutline('heart',[-10,12],[10,32]),cue=design([{color:pink,points:heart}]),f=cueFormation(cue,1024),b=box(f.positions);
  assert.ok(Math.abs(b.minX+10)<.3&&Math.abs(b.maxX-10)<.3&&Math.abs(b.minY-12)<.3&&Math.abs(b.maxY-32)<.3,'the drones fill the drawn heart');
  assert.ok(f.colors.every(c=>Math.abs(c[0]-1)<.01&&Math.abs(c[1]-.3)<.01),'in the drawn colour');
  // Ink past the stage edge is cut off at the edge, never an error.
  const wide=cueFormation(design([{color:cyan,points:[[-60,20],[60,20]]}]),256);assert.ok(wide.positions.every(p=>p[0]>=STAGE.minX-1e-9&&p[0]<=STAGE.maxX+1e-9));
});

test('new, converted and saved formations are designer drawings; 3D drawings flatten to the same drones',()=>{
  assert.ok(isDesign(newCue()),'a new formation is a blank stage');
  const fish=drawingCue('Fish');assert.ok(isDesign(fish),'Convert to drawing lands on the stage');
  const doc=demoShowDoc({count:1024}),mine=design([{color:pink,points:shapeOutline('star',[-8,14],[8,30])}]);
  const saved=decodeShow(encodeShow({...doc,cues:[fish,mine]}));assert.ok(saved.cues.every(isDesign),'still editable after a file round trip (single-precision sheets)');
  assert.ok(designStrokes(saved.cues[1])[0].points.every((p,i)=>Math.hypot(p[0]-designStrokes(mine)[0].points[i][0],p[1]-designStrokes(mine)[0].points[i][1])<1e-4));
  // A drawing from the 3D workspace (its own sheet and placement) flattens onto the stage without moving a drone.
  const workspace={...newCue(editableDemo().cues[0].artwork,'Workspace robot'),placement:{origin:[0,1.4,0],scale:12,position:[3,20,0],yaw:0}};
  assert.ok(!isDesign(workspace));const flat={...workspace,artwork:flattenArtwork(workspace),placement:designPlacement()};assert.ok(isDesign(flat));
  const key=f=>f.positions.map(p=>p.slice(0,2).map(v=>v.toFixed(4)).join(',')).sort();
  assert.deepEqual(key(cueFormation(flat,512)),key(cueFormation(workspace,512)));
  assert.ok(isDesign(editableDemo().cues[0]),'the editable Demo line art is on the stage too');
});

test('shapes fill their drag box; filled shapes put rings of drones inside the outline',()=>{
  for(const kind of ['rect','ellipse','heart','star']){
    const o=shapeOutline(kind,[-6,10],[10,22]),b=box(o);
    assert.ok(Math.abs(b.minX+6)<1e-9&&Math.abs(b.maxX-10)<1e-9&&Math.abs(b.minY-10)<1e-9&&Math.abs(b.maxY-22)<1e-9,kind+' fits the box');
    assert.ok(Math.hypot(o[0][0]-o.at(-1)[0],o[0][1]-o.at(-1)[1])<1e-9,kind+' is closed');
    const rings=filledShape(o);assert.ok(rings.length>=4);
    for(const ring of rings.slice(1))assert.ok(ring.every(p=>inside(p,o)),kind+' rings stay inside');
  }
  const sq=box(shapeOutline('ellipse',[0,10],[4,20],{square:true}));assert.ok(Math.abs(sq.width-sq.height)<1e-9,'Shift draws circles');
  const heart=shapeOutline('heart',[-5,10],[5,20]);assert.ok(heart.every(([x,y])=>heart.some(([u,v])=>Math.abs(u+x)<.2&&Math.abs(v-y)<.2)),'the heart is symmetric');
});

test('text: a single-stroke font for letters and digits; accents fold away; centred at the chosen height',()=>{
  assert.equal(foldText('Hà Nội đẹp ♥ 2026!'),'HA NOI DEP ♥ 2026!');
  for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')assert.ok(textStrokes(ch,[0,20],6).length>0,ch);
  const lines=textStrokes('MAI',[4,30],8),b=bounds(lines.map(points=>({points})));
  assert.ok(Math.abs(b.cx-4)<1e-9&&Math.abs(b.maxY-b.minY-8)<.05&&Math.abs(b.cy-30)<.05);
  assert.equal(textStrokes('   ',[0,20]).length,0);
});

test('adjusting: hit tests, move, resize, rotate, mirror, fit, simplify and the drawing budget',()=>{
  const strokes=[{id:'a',color:pink,points:[[0,10],[10,10]]},{id:'b',color:cyan,points:[[0,20],[0,30]]}];
  assert.equal(hitStroke(strokes,[5,10.2],.5),0);assert.equal(hitStroke(strokes,[.3,25],.5),1);assert.equal(hitStroke(strokes,[20,40],.5),-1);
  const big=mapStrokes(strokes,scaleAbout([0,10],2));assert.deepEqual(big[0].points[1],[20,10]);
  const turned=mapStrokes(strokes,rotateAbout([0,10],Math.PI/2));assert.ok(Math.hypot(turned[0].points[1][0],turned[0].points[1][1]-20)<1e-9);
  assert.deepEqual(mirrored(strokes)[0].points,[[0,10],[-10,10]]);
  const fit=bounds(fitStrokes(strokes));assert.ok(Math.abs(fit.cx)<1e-9&&Math.abs(fit.cy-24)<1e-9&&Math.max(fit.width/44,fit.height/30)>.999);
  const wobbly=Array.from({length:600},(_,i)=>[i*.05,10+Math.sin(i*.02)*.001]);assert.ok(simplify(wobbly).length<10,'a straight-ish pen line keeps few points');
  const heavy=Array.from({length:2000},(_,i)=>[i*.02,10+Math.sin(i)*2]);assert.ok(simplify(heavy,.0001).length<=384,'never above the per-line limit');
  const b=budget(Array.from({length:81},()=>strokes[0]));assert.ok(b.strokes>b.maxStrokes,'the designer knows when a formation is full');
});

test('a designed formation plays in a Demo-style show like any other, with the Demo timing',()=>{
  const doc=demoShowDoc({count:512}),mine=design([{color:pink,points:shapeOutline('heart',[-9,12],[9,30])},...textStrokes('HI',[0,36],5).map(points=>({color:cyan,points}))],{...DEMO_TIMING});
  const show=compileShow({...doc,cues:[doc.cues[0],mine]},assets),stage=show.stages.find(s=>s.name==='Designed');
  assert.equal(stage.end-stage.start,15);assert.equal(stage.to.positions.length,512);
  const unit=doc.look.scale*2,b=box(stage.to.positions.map(p=>[p[0]/unit,p[1]/unit]));assert.ok(b.minY>11&&b.maxY<39.5&&Math.abs(b.cx)<1,'where it was drawn, at the show scale');
});
