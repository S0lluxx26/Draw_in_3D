import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});page.on('dialog',d=>d.accept());await page.goto('http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();await page.locator('.stroke-finish').evaluate(e=>e.open=true);
  const box=await page.locator('#canvas').boundingBox(),xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const draw=async points=>{await page.mouse.move(...xy(...points[0]));await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(...xy(...p));await page.mouse.up();};
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const d=await waiting,file=path.join(out,name);await d.saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  await page.locator('#canvas').focus();await page.keyboard.press('q');await page.locator('#curve-options').waitFor({state:'visible'});
  await draw([[.28,.35],[.68,.35]]);await count(1);const arc=(await save('arc.json')).entities[0];assert.equal(arc.points.length,65);assert.ok(arc.points[32][1]>.2);
  await page.locator('#curve-kind').selectOption('s');await draw([[.28,.48],[.68,.48]]);await count(2);const s=(await save('s-curve.json')).entities[1];assert.ok(s.points[16][1]>0&&s.points[48][1]<0);
  await page.locator('[data-tool="draw"]').click();await page.locator('#smoothing').fill('0');await page.locator('#smooth-strength').fill('100');await page.locator('#smooth-strength').dispatchEvent('input');
  const trace=Array.from({length:31},(_,i)=>[.3+i*.012,.66+(i===0||i===30?0:i%2?.016:-.016)]);await draw(trace);await count(3);
  const raw=await save('curve-raw.json');await page.locator('#outliner .object-row').last().click();await page.locator('#smooth-selected').click();
  const manual=await save('curve-manual.json');assert.notDeepEqual(manual.entities[2].points,raw.entities[2].points);assert.deepEqual(manual.entities[2].points[0],raw.entities[2].points[0]);assert.deepEqual(manual.entities[2].points.at(-1),raw.entities[2].points.at(-1));
  await page.locator('#undo').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));assert.deepEqual((await save('curve-undo.json')).entities,raw.entities);await page.locator('#redo').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));
  // Auto finishing must produce the same geometry without a second undo step.
  await page.locator('[data-tool="draw"]').click();await page.locator('#post-smooth').check();await draw(trace);await count(4);const automatic=await save('curve-auto.json');assert.deepEqual(automatic.entities[3].points,manual.entities[2].points);
  await page.locator('#undo').click();await count(3);await page.locator('#redo').click();await count(4);
  // Esc during a curve preview leaves no object or history entry.
  await page.locator('[data-tool="curve"]').click();const h=await page.locator('#history-status').textContent();await page.mouse.move(...xy(.25,.22));await page.mouse.down();await page.mouse.move(...xy(.5,.25));await page.keyboard.press('Escape');await page.mouse.up();await count(4);assert.equal(await page.locator('#history-status').textContent(),h);
  await page.locator('#add-paper').click();await count(5);await page.locator('[data-tool="curve"]').click();await page.locator('#curve-kind').selectOption('arc');await page.locator('#curve-bend').fill('-40');await page.locator('#curve-bend').dispatchEvent('input');await draw([[.36,.44],[.64,.44]]);await count(6);
  const portable=await save('curves.json');assert.equal(portable.entities.at(-1).paperId,portable.entities[4].id);await writeFile(path.join(root,'../samples/curves.json'),JSON.stringify(portable));
  await page.locator('#project-file').setInputFiles(path.join(out,'curves.json'));await count(6);await page.locator('[data-tool="curve"]').click();await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.inspector').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,'studio04-curves.png')});
  assert.deepEqual(errors,[]);console.log('PASS: arc/S-curve, manual finish with exact undo, automatic finish on release, cancellation, paper curve and file reopen; zero browser errors.');
}finally{await browser.close();}
