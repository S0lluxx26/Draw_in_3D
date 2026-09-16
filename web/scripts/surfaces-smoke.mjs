import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1080},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());await page.goto('http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();
  const box=await page.locator('#canvas').boundingBox(),xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const draw=async points=>{await page.mouse.move(...xy(...points[0]));await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(...xy(...p),{steps:6});await page.mouse.up();};
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const d=await waiting,file=path.join(out,name);await d.saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const set=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');};
  await page.locator('#add-paper').click();await count(1);await page.locator('[data-tool="line"]').click();await draw([[.36,.45],[.64,.45]]);await count(2);
  const flat=await save('surface-flat.json');assert.equal(flat.entities[1].pointSpace,'surface');assert.equal(flat.entities[1].points.length,2);
  await page.locator('#edit-surface').click();await set('surface-bend',160);await set('surface-pitch',15);await set('surface-roll',-10);await set('yaw',20);
  const curved=await save('surface-bent.json');assert.deepEqual(curved.entities[1],flat.entities[1]);assert.equal(curved.entities[0].bend,160);
  await page.locator('#face-surface').click();await page.locator('#paint-surface').click();await page.locator('[data-tool="curve"]').click();await draw([[.4,.52],[.6,.52]]);await count(3);
  await page.locator('[data-tool="draw"]').click();await page.locator('#post-smooth').check();await draw([[.39,.58],[.45,.61],[.54,.58],[.6,.61]]);await count(4);
  const painted=await save('surface-painted.json');assert.ok(painted.entities.slice(1).every(e=>e.paperId===painted.entities[0].id&&e.pointSpace==='surface'&&e.points.every(p=>p[2]===0)));
  await page.locator('#edit-surface').click();await page.locator('#flatten-surface').click();const flattened=await save('surface-flattened.json');assert.deepEqual(flattened.entities.slice(1),painted.entities.slice(1));
  await page.locator('#undo').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));assert.deepEqual((await save('surface-undo.json')).entities,painted.entities);
  await page.locator('#duplicate').click();await count(8);const duplicated=await save('surface-copy.json');assert.equal(duplicated.entities[5].paperId,duplicated.entities[4].id);assert.deepEqual(duplicated.entities[5].points,painted.entities[1].points);
  await page.locator('#undo').click();await count(4);
  // Erase across a curved sparse line; one undo restores the original two samples.
  await page.locator('#outliner .object-row').nth(1).click();await page.locator('[data-tool="erase"]').click();await draw([[.50,.38],[.50,.48]]);
  const erased=await save('surface-erased.json');assert.notDeepEqual(erased.entities,painted.entities);await page.locator('#undo').click();await count(4);assert.deepEqual((await save('surface-restored.json')).entities,painted.entities);
  // Two independent sheets with different transforms in a portable scene.
  await page.locator('#add-paper').click();await count(5);await page.locator('#edit-surface').click();await set('scale',.55);await set('pos-x',-1.7);await set('pos-y',.8);await set('surface-bend',-120);await set('surface-roll',12);
  const portable=await save('surfaces-v4.json');assert.equal(portable.version,4);await writeFile(path.join(root,'../samples/surfaces-v4.json'),JSON.stringify(portable));
  await page.locator('#project-file').setInputFiles(path.join(out,'surfaces-v4.json'));await count(5);assert.deepEqual((await save('surface-reopen.json')).entities,portable.entities);
  await page.locator('#outliner .object-row').first().click();await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.inspector').evaluate(e=>e.scrollTop=e.scrollHeight);await page.screenshot({path:path.join(out,'studio05-surfaces.png')});
  assert.deepEqual(errors,[]);console.log('PASS: draw flat, bend/tilt/roll, draw on a curved sheet, flatten/undo, duplicate linked ink, sparse curved eraser/undo, independent sheets, export/reopen; zero browser errors.');
}finally{await browser.close();}
