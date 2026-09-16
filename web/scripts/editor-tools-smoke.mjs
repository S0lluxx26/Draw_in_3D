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
  await page.goto('http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();
  const box=await page.locator('#canvas').boundingBox();
  const xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const drag=async(a,b,steps=12)=>{await page.mouse.move(...xy(...a));await page.mouse.down();await page.mouse.move(...xy(...b),{steps});await page.mouse.up();};
  const tool=async name=>page.locator(`[data-tool="${name}"]`).click();
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);
  const download=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const d=await waiting,file=path.join(out,name);await d.saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  await page.screenshot({path:path.join(out,'studio02-empty.png')});
  await tool('line');await page.locator('#pattern').selectOption('dash');await drag([.22,.37],[.55,.37]);await count(1);
  await tool('rectangle');await page.locator('#pattern').selectOption('solid');await page.locator('[data-color="#a99cf5"]').click();await drag([.27,.5],[.43,.64]);await count(2);
  await tool('ellipse');await page.locator('[data-color="#7ee8c5"]').click();await drag([.53,.48],[.69,.64]);await count(3);
  await tool('block');await page.locator('[data-color="#ffa467"]').click();await drag([.44,.66],[.63,.8]);await count(4);
  // Box-select a pair, duplicate the pair, then undo and redo as single operations.
  await tool('marquee');await drag([.23,.45],[.73,.65]);assert.equal(await page.locator('#selection-count').textContent(),'2 selected');
  await page.locator('#duplicate').click();await count(6);await page.locator('#undo').click();await count(4);await page.locator('#redo').click();await count(6);
  await page.locator('#delete').click();await count(4);await page.locator('#undo').click();await count(6);await page.locator('#redo').click();await count(4);
  // Select all and move the collection. One undo returns every object exactly.
  await page.locator('#canvas').focus();await page.keyboard.press('Control+a');assert.equal(await page.locator('#selection-count').textContent(),'4 selected');
  const before=await download('tools-before-move.json');await tool('move');await drag([.82,.6],[.85,.62]);
  const moved=await download('tools-moved.json');assert.notDeepEqual(moved.entities.map(e=>e.position),before.entities.map(e=>e.position));
  await page.locator('#undo').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));
  const restored=await download('tools-restored.json');assert.deepEqual(restored.entities,before.entities);
  // New solid line; the segment eraser must cut a sparse two-point segment.
  await tool('line');await page.locator('#pattern').selectOption('solid');await drag([.25,.26],[.7,.26]);await count(5);
  await tool('erase');await drag([.48,.22],[.48,.3]);await count(6);
  await page.locator('#undo').click();await count(5);await page.locator('#redo').click();await count(6);
  // Escape cancels a move without adding an undo entry.
  await tool('select');await page.locator('#canvas').focus();await page.keyboard.press('Control+a');await tool('move');const historyBefore=await page.locator('#history-status').textContent();
  await page.mouse.move(...xy(.82,.6));await page.mouse.down();await page.mouse.move(...xy(.85,.63),{steps:5});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.locator('#history-status').textContent(),historyBefore);
  const portable=await download('editor-v2.json');assert.equal(portable.version,2);assert.ok(portable.entities.some(e=>e.type==='block'));assert.ok(portable.entities.some(e=>e.pattern==='dash'));
  await writeFile(path.join(root,'../samples/editor-v2.json'),JSON.stringify(portable));
  await page.locator('#project-file').setInputFiles(path.join(out,'editor-v2.json'));await count(6);
  await page.locator('[data-view="perspective"]').click();await page.locator('#toast').evaluate(e=>e.hidden=true);await page.screenshot({path:path.join(out,'studio02-tools.png')});
  await page.setViewportSize({width:820,height:1180});await page.screenshot({path:path.join(out,'studio02-tablet.png')});
  assert.deepEqual(errors,[]);console.log('PASS: line/dash, rectangle, ellipse, solid block, box selection, group duplicate/delete/move, gesture undo/redo, segment erase, Escape rollback, v2 export/import; zero browser errors.');
}finally{await browser.close();}
