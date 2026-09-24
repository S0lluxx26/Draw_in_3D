import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();
  assert.equal(await page.locator('.edition').textContent(),'STUDIO 16');
  let box=await page.locator('#canvas').boundingBox();const xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const drag=async(a,b)=>{await page.mouse.move(...xy(...a));await page.mouse.down();await page.mouse.move(...xy(...b),{steps:24});await page.mouse.up();};
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const d=await waiting,file=path.join(out,name);await d.saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const history=async id=>{await page.locator('#'+id).click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));};
  await page.locator('#add-paper').click();await drag([.43,.45],[.57,.45]);await count(2);const first=await save('paper-first.json');
  // Regression: orbit behind an existing sheet, leave the legacy plane at Wall,
  // then add another sheet. It must face the user and accept visible local ink.
  await page.locator('[data-tool="orbit"]').click();await drag([.25,.5],[.72,.5]);assert.equal(await page.locator('#plane').inputValue(),'wall');
  await page.locator('#add-paper').click();await count(3);assert.equal(await page.locator('[data-tool="draw"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#focus-sheet').isChecked(),true);await page.locator('#sheet-focus-banner').waitFor({state:'visible'});
  await drag([.43,.48],[.57,.48]);await count(4);const second=await save('paper-orbited.json');assert.ok(second.entities[2].normal[2]<0);assert.equal(second.entities[3].paperId,second.entities[2].id);assert.equal(second.entities[3].pointSpace,'surface');assert.ok(second.entities[3].points.length>10);assert.deepEqual(second.entities.slice(0,2),first.entities);
  // The newly active paper is part of undo/redo, not a stale UI-only reference.
  await history('undo');await count(3);await history('undo');await count(2);assert.equal(await page.locator('#painting-target').inputValue(),first.entities[0].id);
  await history('redo');await count(3);assert.equal(await page.locator('#painting-target').inputValue(),second.entities[2].id);await drag([.43,.48],[.57,.48]);await count(4);
  const beforeBend=await save('paper-before-bend.json');
  await page.locator('[data-paper-bend="90"]').click();const monitor=await save('paper-monitor.json');assert.equal(monitor.entities[2].bend,90);assert.deepEqual(monitor.entities[3],beforeBend.entities[3]);
  await page.locator('[data-paper-bend="180"]').click();const panorama=await save('paper-panorama.json');assert.equal(panorama.entities[2].bend,180);assert.deepEqual(panorama.entities[3],beforeBend.entities[3]);
  await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.inspector').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,'studio051-monitor.png')});
  await page.locator('#preview-panorama').click();await page.locator('#panorama-banner').waitFor({state:'visible'});const front=await page.locator('#canvas').screenshot();await drag([.6,.55],[.4,.55]);const turned=await page.locator('#canvas').screenshot();assert.notDeepEqual(turned,front);assert.deepEqual((await save('paper-panorama-preview.json')).entities,panorama.entities);
  await page.locator('#toast').evaluate(e=>e.hidden=true);await page.screenshot({path:path.join(out,'studio051-panorama-preview.png')});
  // Resize while looking around; restore a usable authoring view afterwards.
  await page.setViewportSize({width:412,height:915});await page.locator('#exit-panorama').click();await page.locator('#panorama-banner').waitFor({state:'hidden'});box=await page.locator('#canvas').boundingBox();await drag([.45,.54],[.55,.54]);await count(5);
  await page.locator('[data-paper-bend="0"]').click();assert.equal(await page.locator('#preview-panorama').isDisabled(),true);await history('undo');assert.equal(await page.locator('#active-paper-bend').inputValue(),'180');
  await page.locator('#show-all-sheets').click();assert.equal(await page.locator('#focus-sheet').isChecked(),false);const finished=await save('paper-workflow-finished.json');assert.equal(finished.entities[4].paperId,second.entities[2].id);assert.deepEqual(errors,[]);
  console.log('PASS: Orbit/add/draw with unchanged Wall setting; second-sheet focus; target restoration after undo/redo; monitor/panorama presets preserve ink; fixed-view preview and return; mobile resize and drawing; zero browser errors.');
}finally{await browser.close();}
