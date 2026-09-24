import {chromium} from 'playwright-core';
import {mkdir,readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../test-output/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1040},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');await page.locator('#undo:disabled').waitFor();
  const download=async(id,name)=>{const pending=page.waitForEvent('download');await page.locator(id).click();const file=path.join(out,name);await(await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const change=async(id,value)=>{await page.locator(id).fill(String(value));await page.locator(id).dispatchEvent('change');};
  await page.locator('#add-paper').click();await page.locator('[data-tool=line]').click();let box=await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.44,box.y+box.height*.44);await page.mouse.down();await page.mouse.move(box.x+box.width*.58,box.y+box.height*.55,{steps:8});await page.mouse.up();
  const original=await download('#export','show-original-drawing.json'),history=await page.locator('#history-status').textContent();
  await page.locator('#show-editor').click();await page.locator('#author-dialog').waitFor({state:'visible'});assert.equal(await page.locator('.author-card').count(),11);
  const demo=await download('#author-save','show-editable-demo.show.json');
  await page.locator('#author-help').click();await page.locator('#author-guide').waitFor({state:'visible'});await page.locator('#author-guide-close').click();
  await page.locator('#author-edit').click();await page.locator('#formation-edit-banner').waitFor({state:'visible'});
  await page.locator('#outliner .object-row').nth(1).click();await change('#color','#ff0088');
  await page.locator('[data-tool=line]').click();box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55,{steps:5});await page.mouse.up();
  await page.screenshot({path:path.join(out,'show-edit-artwork.png')});await page.locator('#formation-save').click();
  assert.equal(await page.locator('#history-status').textContent(),history);
  await page.locator('#author-cards button').nth(1).click();await change('#author-cue-name','Silver fish');await change('#author-hold',5);await page.locator('#author-light').selectOption('draw-on');await page.locator('#author-left').click();
  await page.locator('#author-duplicate').click();assert.equal(await page.locator('.author-card').count(),12);await page.locator('#author-undo').click();assert.equal(await page.locator('.author-card').count(),11);await page.locator('#author-redo').click();await page.locator('#author-delete').click();assert.equal(await page.locator('.author-card').count(),11);
  await change('#author-name','My edited sky story');
  const edited=await download('#author-save','show-edited.show.json');assert.equal(edited.cues[0].name,'Silver fish');
  const robot=edited.cues.find(c=>c.name==='Robot');assert.equal(robot.artwork.length,demo.cues[0].artwork.length+1);assert.equal(robot.artwork[1].color,0xffff0088|0);assert.deepEqual(robot.placement,demo.cues[0].placement);
  // Invalid files and cancelled compilation must leave the current show intact.
  await page.locator('#author-file').setInputFiles({name:'bad.show.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});await page.waitForFunction(()=>document.querySelector('#author-status').classList.contains('author-error'));assert.equal(await page.locator('#author-name').inputValue(),edited.name);
  await page.evaluate(()=>{document.querySelector('#author-play').click();const n=document.querySelector('#author-name');n.value='Cancel compilation check';n.dispatchEvent(new Event('change'));});await page.waitForTimeout(200);assert.equal(await page.locator('#drone-show').isVisible(),false);await change('#author-name',edited.name);
  await page.locator('#author-close').click();assert.deepEqual((await download('#export','show-restored-drawing.json')).entities,original.entities);
  await page.locator('#show-editor').click();await page.locator('#author-file').setInputFiles(path.join(out,'show-edited.show.json'));await page.waitForFunction(()=>document.querySelector('#author-name').value==='My edited sky story');
  await page.locator('#author-play').click();await page.locator('#drone-show').waitFor({state:'visible'});assert.equal(await page.locator('#show-title').textContent(),'My edited sky story');
  await page.locator('#show-cues').getByRole('button',{name:'Robot',exact:true}).click();await page.screenshot({path:path.join(out,'show-authored-performance.png')});await page.locator('#show-exit').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  await page.locator('#author-cards button').nth(1).click();await page.locator('#author-edit').click();await page.locator('#outliner .object-row').nth(1).click();await change('#color','#ffffff');await page.locator('#formation-cancel').click();assert.deepEqual((await download('#author-save','show-after-cancel.show.json')).cues,edited.cues);
  await page.locator('#author-blank').click();await page.locator('[data-tool=ellipse]').click();box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6,{steps:10});await page.mouse.up();await page.locator('#formation-save').click();assert.equal(await page.locator('.author-card').count(),12);await page.locator('#author-fit').click();await page.locator('#author-formation-preview').click();await page.locator('#drone-show').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='New formation');await page.locator('#show-exit').click();
  await page.setViewportSize({width:412,height:915});await page.screenshot({path:path.join(out,'show-editor-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#author-edit').click();await page.screenshot({path:path.join(out,'show-edit-mobile.png')});await page.locator('#formation-cancel').click();await page.setViewportSize({width:1440,height:1040});await page.screenshot({path:path.join(out,'show-editor-desktop.png')});
  // Record one complete 29-second show with real MediaRecorder; no clock mocking.
  const short={...edited,name:'Recording check',cues:[{...edited.cues[0],hold:2,transfer:2}],fireworks:{...edited.fireworks,enabled:false}};
  await page.locator('#author-file').setInputFiles({name:'recording.show.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(short))});await page.waitForFunction(()=>document.querySelector('#author-name').value==='Recording check');
  await page.locator('#author-play').click();await page.locator('#drone-show').waitFor({state:'visible'});
  if(!process.env.DRAW3D_SKIP_RECORD){
    const pending=page.waitForEvent('download',{timeout:55000});await page.locator('#show-record').click();assert.equal(await page.locator('#show-scrub').isDisabled(),true);
    const video=await pending,videoPath=path.join(out,video.suggestedFilename());await video.saveAs(videoPath);assert.ok((await stat(videoPath)).size>10000);assert.match(video.suggestedFilename(),/\.(webm|mp4)$/);
    const bytes=await readFile(videoPath);const metadata=await page.evaluate(async base64=>{const data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([data])),v=document.createElement('video');try{await new Promise((resolve,reject)=>{v.onloadedmetadata=resolve;v.onerror=reject;v.src=url;});return [v.videoWidth,v.videoHeight];}finally{URL.revokeObjectURL(url);}},bytes.toString('base64'));assert.deepEqual(metadata,[1280,720]);
    console.log('PASS: complete real-time video download',video.suggestedFilename());
    await page.locator('#show-record').click();await page.waitForTimeout(250);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>document.querySelector('#show-record-status').textContent.includes('interrupted'));assert.equal(await page.locator('#show-scrub').isDisabled(),false);
  }
  await page.locator('#show-exit').click();await page.locator('#author-recover').click();await page.locator('.author-draft').first().waitFor();
  await page.locator('#author-recovery-close').click();await page.locator('#author-close').click();assert.deepEqual((await download('#export','show-final-original.json')).entities,original.entities);
  const reload=await page.context().newPage();await reload.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');await reload.locator('#show-editor').click();await reload.locator('#author-recover').click();await reload.locator('.author-draft').first().waitFor();await reload.locator('.author-draft').filter({hasText:'Recording check'}).getByRole('button',{name:'Restore',exact:true}).first().click();await reload.waitForFunction(()=>document.querySelector('#author-name').value==='Recording check');assert.equal(await reload.locator('.author-card').count(),1);await reload.close();
  assert.deepEqual(errors,[]);console.log('PASS: edit demo; drawing edits and cancel; stable placement; cards/timing/lights/history; new artwork; file round trip; worker preview; mobile layout; recovery; original drawing/history retained.');
}finally{await browser.close();}
