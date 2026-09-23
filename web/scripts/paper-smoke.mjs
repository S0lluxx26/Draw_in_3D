import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:5173');await page.locator('#add-paper').click();
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);await count(1);
  const box=await page.locator('#canvas').boundingBox(),xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const drag=async(a,b)=>{await page.mouse.move(...xy(...a));await page.mouse.down();await page.mouse.move(...xy(...b),{steps:25});await page.mouse.up();};
  const download=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const d=await waiting,file=path.join(out,name);await d.saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  await page.locator('#width').fill('130');await page.locator('#width').dispatchEvent('change');
  await drag([.33,.41],[.64,.44]);await count(2);await page.locator('[data-color="#f47e97"]').click();await drag([.35,.48],[.62,.57]);await count(3);
  const initial=await download('paper-initial.json');assert.ok(initial.version>=3);// paper files export v4+ since Studio 05assert.equal(initial.entities[1].paperId,initial.entities[0].id);
  // Change the finish under existing paint; its pigment geometry must rebuild.
  await page.locator('#paper-kind').selectOption('rough');await count(3);assert.equal((await download('paper-rough.json')).entities[0].paperKind,'rough');
  await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#paper-kind').value==='watercolor');
  await page.locator('#outliner .object-row').first().click();await page.locator('#pos-x').fill('0.2');await page.locator('#pos-x').dispatchEvent('change');
  const moved=await download('paper-moved.json');assert.ok(Math.abs(moved.entities[0].position[0]-initial.entities[0].position[0]-.2)<1e-6);
  // Since Studio 05 attached ink stores sheet-local points: moving the sheet carries it without rewriting them.
  for(let i=1;i<3;i++){const e=moved.entities[i];assert.equal(e.paperId,moved.entities[0].id);if(e.pointSpace==='surface')assert.deepEqual(e.points,initial.entities[i].points);else assert.ok(Math.abs(e.position[0]-initial.entities[i].position[0]-.2)<1e-6);}
  await page.locator('#duplicate').click();await count(6);const dup=await download('paper-duplicate.json');assert.equal(dup.entities[4].paperId,dup.entities[3].id);
  await page.locator('#undo').click();await count(3);await page.locator('#delete').click();await count(0);await page.locator('#undo').click();await count(3);
  // Save a v3 fixture for the native reader, then reopen and continue on paper.
  const doc=await download('paper-v3.json');if(doc.version===3)await writeFile(path.join(root,'../samples/paper-v3.json'),JSON.stringify(doc));// keep the v3 fixture v3
  await page.locator('#project-file').setInputFiles(path.join(out,'paper-v3.json'));await count(3);
  await page.locator('#painting-target').selectOption(doc.entities[0].id);await page.locator('#paper-kind').selectOption('coated');await drag([.37,.6],[.64,.6]);await count(4);
  await page.locator('#undo').click();await count(3);await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#paper-kind').value==='watercolor');
  await page.locator('#painting-target').selectOption('');await drag([.25,.2],[.65,.2]);await count(4);const free=await download('paper-free.json');assert.equal(free.entities.at(-1).paperId,undefined);
  await page.locator('#undo').click();await count(3);await page.locator('#painting-target').selectOption(doc.entities[0].id);
  await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.inspector').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,'studio03-paper.png')});
  await page.setViewportSize({width:820,height:1180});await page.screenshot({path:path.join(out,'studio03-tablet.png')});
  assert.deepEqual(errors,[]);console.log('PASS: paper creation, attached painting, finish change, parent move/duplicate/delete with undo, v3 save/reopen, coated runoff and free-space drawing; zero browser errors.');
}finally{await browser.close();}
