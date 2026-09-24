import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../test-output/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1040},acceptDownloads:true}),page=await context.newPage(),errors=[];
  const observe=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('dialog',d=>d.accept());};observe(page);
  const url=process.env.DRAW3D_URL||'http://127.0.0.1:5173';await page.goto(url);await page.locator('#undo:disabled').waitFor();assert.equal(await page.locator('.edition').textContent(),'STUDIO 15');
  const save=async name=>{const wait=page.waitForEvent('download');await page.locator('#export').click();const file=path.join(out,name);await(await wait).saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const settled=async()=>page.waitForFunction(()=>!document.body.classList.contains('busy'));
  const undo=async()=>{await page.locator('#undo').click();await settled();};
  const draftSaved=async(p=page)=>p.waitForFunction(()=>document.querySelector('#draft-status').textContent==='Draft saved in this browser');
  await page.locator('#add-paper').click();await page.locator('#paper-name').fill('Front wall · 벽');await page.locator('#paper-name').press('Tab');
  assert.ok((await page.locator('#painting-target option:checked').textContent()).includes('Front wall'));
  await undo();assert.equal(await page.locator('#paper-name').inputValue(),'');await page.locator('#redo').click();await settled();assert.equal(await page.locator('#paper-name').inputValue(),'Front wall · 벽');
  await page.locator('[data-paper-bend="90"]').click();await page.locator('[data-tool="line"]').click();
  const box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width*.44,box.y+box.height*.46);await page.mouse.down();await page.mouse.move(box.x+box.width*.57,box.y+box.height*.53,{steps:10});await page.mouse.up();
  const base=await save('studio08-base.json');assert.equal(base.version,6);assert.equal(base.entities.length,2);
  const slider=page.locator('#sheet-depth');await slider.scrollIntoViewIfNeeded();const range=await slider.boundingBox(),centre=range.x+range.width/2,y=range.y+range.height/2;
  await page.mouse.move(centre,y);await page.mouse.down();await page.mouse.move(centre+range.width*.25,y,{steps:12});
  assert.ok(Number(await slider.inputValue())>20);assert.match(await page.locator('#sheet-depth-value').textContent(),/nearer/);await page.mouse.up();
  assert.equal(await slider.inputValue(),'0');assert.match(await page.locator('#undo').getAttribute('title'),/Drag sheet depth/);
  const moved=await save('studio08-depth.json');assert.ok(moved.entities[0].position[2]>.2);assert.deepEqual(moved.entities[1],base.entities[1]);await undo();assert.deepEqual((await save('studio08-depth-undo.json')).entities,base.entities);
  await slider.scrollIntoViewIfNeeded();await page.mouse.move(centre,y);await page.mouse.down();await page.mouse.move(centre+range.width*.2,y,{steps:6});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual((await save('studio08-depth-cancel.json')).entities,base.entities);
  // Keyboard and cancelled pointer edits must use the same parent-only operation.
  await slider.focus();await slider.press('ArrowRight');await slider.press('Tab');const keyMove=await save('studio08-keyboard.json');assert.ok(Math.abs(keyMove.entities[0].position[2]-.01)<1e-6);await undo();
  await slider.dispatchEvent('pointerdown',{pointerId:77});await slider.evaluate(e=>e.value='35');await slider.dispatchEvent('input');await slider.dispatchEvent('pointercancel',{pointerId:77});assert.deepEqual((await save('studio08-pointer-cancel.json')).entities,base.entities);
  const prior=await page.locator('#history-status').textContent();await slider.dispatchEvent('pointerdown',{pointerId:78});await slider.evaluate(e=>e.value='45');await slider.dispatchEvent('input');await slider.evaluate(e=>e.value='0');await slider.dispatchEvent('input');await slider.dispatchEvent('change');assert.equal(await page.locator('#history-status').textContent(),prior);
  // Reject out-of-bounds depth while keeping the last valid scene and history.
  const metre=async()=>{await slider.evaluate(e=>e.value=100);await slider.dispatchEvent('input');await slider.dispatchEvent('change');};
  await metre();await metre();const atLimit=await save('studio08-boundary.json'),limitHistory=await page.locator('#history-status').textContent();await metre();assert.deepEqual((await save('studio08-boundary-rejected.json')).entities,atLimit.entities);assert.equal(await page.locator('#history-status').textContent(),limitHistory);await undo();await undo();assert.deepEqual((await save('studio08-boundary-undo.json')).entities,base.entities);
  await page.locator('#toggle-paper').click();const final=await save('named-guides-v6.json');assert.equal(final.entities[0].paperVisible,false);await draftSaved();
  await page.locator('#drafts').click();await page.locator('.draft-card').waitFor();const originalId=await page.locator('.draft-card').getAttribute('data-draft-id');await page.locator('#drafts-done').click();
  // Another tab cannot overwrite the current tab's draft, even with the same name.
  const second=await context.newPage();observe(second);await second.goto(url);await second.locator('#add-paper').click();await second.locator('#paper-name').fill('Second tab');await second.locator('#paper-name').press('Tab');await draftSaved(second);
  await page.reload();await page.locator('#undo:disabled').waitFor();assert.equal(await page.locator('#object-count').textContent(),'0 / 80');await page.locator('#drafts').click();await page.waitForFunction(()=>document.querySelectorAll('.draft-card').length===2);
  const original=page.locator(`.draft-card[data-draft-id="${originalId}"]`);await original.getByRole('button',{name:'Restore',exact:true}).click();await settled();await page.locator('#draft-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#paper-name').inputValue(),'Front wall · 벽');assert.equal(await page.locator('#save-state').textContent(),'Not exported');assert.deepEqual((await save('studio08-restored.json')).entities,final.entities);assert.equal(await page.locator('#undo').isDisabled(),true);
  await draftSaved();await page.locator('#drafts').click();await page.waitForFunction(()=>document.querySelectorAll('.draft-card').length===3);
  const download=page.waitForEvent('download');await original.getByRole('button',{name:'Download',exact:true}).click();const downloaded=path.join(out,'studio08-draft-download.json');await(await download).saveAs(downloaded);assert.deepEqual(JSON.parse(await readFile(downloaded,'utf8')).entities,final.entities);
  await original.getByRole('button',{name:'Delete',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.draft-card').length===2);await page.locator('#drafts-done').click();assert.equal(await page.locator('#object-count').textContent(),'2 / 80');
  await page.setViewportSize({width:412,height:915});await page.locator('#paper-name').scrollIntoViewIfNeeded();await page.locator('#toast').evaluate(e=>e.hidden=true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'studio08-mobile.png')});
  await page.locator('#drafts').click();await page.locator('.draft-card').first().waitFor();await page.screenshot({path:path.join(out,'studio08-drafts-mobile.png')});await page.locator('#drafts-done').click();
  await page.setViewportSize({width:1440,height:1040});await page.locator('#sheet-depth').scrollIntoViewIfNeeded();await page.locator('#toast').evaluate(e=>e.hidden=true);await page.screenshot({path:path.join(out,'studio08-desktop.png')});
  assert.deepEqual(errors,[]);console.log('PASS: named guide undo/redo and v6 export; live depth, one-step undo, keyboard, Esc/pointer cancellation and zero return; local drafts reload/restore/download/delete; multi-tab isolation; mobile layout; no browser errors.');
}finally{await browser.close();}
