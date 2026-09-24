import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {strokeUV} from '../src/paper.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-output');await mkdir(out,{recursive:true});
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<.00001,`${a} != ${b}`));
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();assert.equal(await page.locator('.edition').textContent(),'STUDIO 14');
  let box=await page.locator('#canvas').boundingBox();const xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const drag=async(a,b)=>{await page.mouse.move(...xy(...a));await page.mouse.down();await page.mouse.move(...xy(...b),{steps:20});await page.mouse.up();};
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const file=path.join(out,name);await (await waiting).saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const history=async id=>{await page.locator('#'+id).click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));};
  const uv=(e,p,index)=>strokeUV(e,e.points.at(index),p);
  const mirror=(a,b,p,k)=>{assert.equal(a.points.length,b.points.length);a.points.forEach((point,i)=>{const v=strokeUV(a,point,p);v[k]*=-1;near(strokeUV(b,b.points[i],p),v);assert.equal(point[3],b.points[i][3]);});};
  const paperPixels=async()=>{const png=await page.locator('#canvas').screenshot();return page.evaluate(async data=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const pixels=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>170&&pixels[i+1]>170&&pixels[i+2]>140)n++;return n;},png.toString('base64'));};
  await page.locator('#add-paper').click();await page.locator('[data-brush="Pen"]').click();await page.locator('#color').fill('#ff9459');await page.locator('#color').dispatchEvent('change');await page.locator('#wet').uncheck();await page.locator('#mirror-strokes').selectOption('u');await page.locator('[data-tool="line"]').click();
  // Live partner before release, cancellation restores both, one undo removes the pair.
  await page.mouse.move(...xy(.57,.43));await page.mouse.down();await page.mouse.move(...xy(.6,.54),{steps:10});await count(3);await page.keyboard.press('Escape');await page.mouse.up();await count(1);
  await drag([.57,.43],[.6,.54]);await count(3);const paired=await save('assists-pair.json');mirror(paired.entities[1],paired.entities[2],paired.entities[0],0);
  await history('undo');await count(1);await history('redo');await count(3);await page.locator('[data-paper-bend="90"]').click();
  await page.locator('#mirror-strokes').selectOption('v');await page.locator('[data-tool="curve"]').click();await drag([.44,.43],[.55,.47]);await count(5);const curved=await save('assists-curved.json');mirror(curved.entities[3],curved.entities[4],curved.entities[0],1);
  await page.locator('#mirror-strokes').selectOption('off');await page.locator('[data-paper-bend="0"]').click();await page.locator('[data-tool="line"]').click();await drag([.43,.6],[.57,.6]);await count(6);const base=await save('assists-snap-base.json');
  await page.locator('#snap-ends').check();const end=xy(.57,.6);await page.mouse.move(end[0]+6,end[1]-4);await page.locator('#snap-cursor').waitFor({state:'visible'});await page.mouse.down();await page.mouse.move(...xy(.6,.57),{steps:10});await page.mouse.up();await count(7);const snapped=await save('assists-snapped.json');near(uv(snapped.entities[6],snapped.entities[0],0),uv(base.entities[5],base.entities[0],-1));
  // Freehand smoothing and mirroring must keep an exactly snapped endpoint.
  await page.locator('#mirror-strokes').selectOption('u');await page.locator('[data-tool="draw"]').click();await page.locator('.stroke-finish > summary').click();await page.locator('#post-smooth').check();
  await page.mouse.move(...xy(.48,.56));await page.mouse.down();await page.mouse.move(...xy(.49,.58),{steps:10});const start=xy(.43,.6);await page.mouse.move(start[0]+5,start[1]-3,{steps:10});await page.locator('#snap-cursor').waitFor({state:'visible'});await page.mouse.up();await count(9);const freehand=await save('assists-freehand.json');near(uv(freehand.entities[7],freehand.entities[0],-1),uv(base.entities[5],base.entities[0],0));mirror(freehand.entities[7],freehand.entities[8],freehand.entities[0],0);
  const opaque=await paperPixels();await page.locator('#see-through').check();assert.equal(await page.locator('#focus-sheet').isChecked(),false);assert.ok(await paperPixels()<opaque*.1);assert.deepEqual((await save('assists-translucent.json')).entities,freehand.entities);
  await page.locator('#sheet-nearer').click();const nearer=await save('assists-nearer.json');near(nearer.entities[0].position,[0,1.4,.1]);assert.deepEqual(nearer.entities.slice(1),freehand.entities.slice(1));await history('undo');assert.deepEqual((await save('assists-depth-undo.json')).entities,freehand.entities);
  await page.locator('#sheet-farther').click();near((await save('assists-farther.json')).entities[0].position,[0,1.4,-.1]);await history('undo');
  await page.locator('#parallel-sheet').click();await count(10);const layered=await save('assists-layer.json');assert.equal(await page.locator('#painting-target').inputValue(),layered.entities[9].id);near(layered.entities[9].position,[0,1.4,.1]);assert.equal(layered.entities[9].points.length,0);assert.deepEqual(layered.entities.slice(0,9),freehand.entities);assert.equal(layered.entities.filter(e=>e.paperId===layered.entities[9].id).length,0);
  await page.setViewportSize({width:412,height:915});box=await page.locator('#canvas').boundingBox();await page.locator('#mirror-strokes').selectOption('u');await drag([.54,.43],[.58,.52]);await count(12);await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.drawing-assists').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'studio07-mobile-helpers.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#view-ink').click();const result=await save('drawing-assists.json');assert.equal(result.version,5);assert.equal(result.entities[10].paperId,result.entities[9].id);mirror(result.entities[10],result.entities[11],result.entities[9],0);
  await page.locator('#new').click();await page.locator('#project-file').setInputFiles(path.join(out,'drawing-assists.json'));await count(12);assert.deepEqual((await save('assists-reopened.json')).entities,result.entities);assert.deepEqual(errors,[]);
  await page.setViewportSize({width:1440,height:1040});await page.locator('#painting-target').selectOption(result.entities[0].id);await page.locator('#show-papers').click();await page.locator('#face-and-draw').click();await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.drawing-assists').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'studio07-drawing-helpers.png')});
  // The shared gesture changes must preserve ordinary free-space tools and grid snapping.
  await page.locator('#new').click();await count(0);box=await page.locator('#canvas').boundingBox();await page.locator('#snap').check();await page.locator('[data-tool="block"]').click();await drag([.463,.48],[.574,.57]);await count(1);
  await page.locator('[data-tool="ellipse"]').click();await drag([.44,.41],[.54,.49]);await count(2);await page.locator('[data-tool="draw"]').click();await drag([.44,.55],[.54,.58]);await count(3);
  const plain=await save('assists-free-space.json'),block=plain.entities[0];for(const axis of [0,1])for(const sign of [-1,1]){const corner=(block.position[axis]+sign*block.size[axis]/2)*10;assert.ok(Math.abs(corner-Math.round(corner))<.00001);}assert.ok(plain.entities.every(e=>!e.paperId));await history('undo');await count(2);assert.deepEqual(errors,[]);
  console.log('PASS: live mirrored strokes/cancel/undo; curved and smoothed mirrors; endpoint snapping; translucent view preserves file; sheet depth/undo; blank parallel layers; mobile drawing; export/reopen; free-space/grid tools; no browser errors.');
}finally{await browser.close();}
