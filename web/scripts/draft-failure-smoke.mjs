import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;window.failDraftWrites=true;IDBObjectStore.prototype.put=function(...args){if(window.failDraftWrites&&this.name==='scenes')throw new DOMException('Storage full','QuotaExceededError');return put.apply(this,args);};});
  await page.goto('http://127.0.0.1:5173');await page.locator('#add-paper').click();await page.locator('#paper-name').fill('Unsaved first sheet');await page.locator('#paper-name').press('Tab');
  await page.locator('#retry-draft').waitFor({state:'visible'});await page.locator('#new').click();await page.locator('#retry-draft').waitFor({state:'visible'});
  await page.locator('#add-paper').click();await page.locator('#paper-name').fill('Unsaved second sheet');await page.locator('#paper-name').press('Tab');
  await page.waitForFunction(()=>document.querySelector('#draft-status').textContent.startsWith('2 drafts could not save'));
  await page.locator('#drafts').click();await page.waitForFunction(()=>document.querySelectorAll('.draft-card').length===2);
  assert.ok((await page.locator('#draft-list-status').textContent()).includes('only in memory'));
  const first=page.locator('.draft-card').filter({hasText:'Unsaved first sheet'}),waiting=page.waitForEvent('download');await first.getByRole('button',{name:'Download',exact:true}).click();const download=await waiting;const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(exported.entities[0].paperName,'Unsaved first sheet');
  await page.locator('#drafts-done').click();await page.evaluate(()=>window.failDraftWrites=false);await page.locator('#retry-draft').click();await page.waitForFunction(()=>document.querySelector('#draft-status').textContent==='Draft saved in this browser');
  await page.locator('#drafts').click();await page.waitForFunction(()=>document.querySelectorAll('.draft-card').length===2);assert.ok(!(await page.locator('#draft-list').textContent()).includes('NOT SAVED'));
  await page.locator('#drafts-done').click();
  // Corrupt stored data is reported without replacing the active drawing.
  await page.evaluate(async()=>{const {createDraftStore}=await import('./drafts.js');await createDraftStore().put({id:'corrupt-test',name:'Corrupt draft',updatedAt:Date.now(),objects:0,text:'not json'});});
  await page.locator('#drafts').click();const corrupt=page.locator('.draft-card').filter({hasText:'Corrupt draft'});await corrupt.getByRole('button',{name:'Restore',exact:true}).click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));
  assert.equal(await page.locator('#draft-dialog').isVisible(),true);assert.ok((await page.locator('#draft-list-status').textContent()).length>0);await page.locator('#drafts-done').click();assert.equal(await page.locator('#paper-name').inputValue(),'Unsaved second sheet');assert.deepEqual(errors,[]);
  console.log('PASS: failed saves stay visible after New; memory-only draft download; retry persists both documents; corrupt recovery preserves active scene.');
}finally{await browser.close();}
