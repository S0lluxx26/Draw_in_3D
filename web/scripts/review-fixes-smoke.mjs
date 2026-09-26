import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
  const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());};watch(page);
  const url=process.env.DRAW3D_URL||'http://127.0.0.1:5173/';await page.goto(url);
  await page.locator('#drone-demo-settings').click();await page.locator('#demo-count').selectOption('512');await page.locator('#demo-scale').selectOption('4');await page.locator('#demo-edit').click();
  assert.equal(await page.locator('#author-count').inputValue(),'512');assert.equal(await page.locator('#author-look-scale').inputValue(),'4');
  await page.locator('#author-close').click();await page.locator('#show-editor').click();assert.equal(await page.locator('#author-count').inputValue(),'512');
  await page.locator('#author-new').click();await page.locator('#author-blank').click();await page.locator('[data-draw=text]').click();await page.locator('[data-role=text]').fill('HI');
  const point=async(p,x,y)=>{const b=await p.locator('#author-preview').boundingBox();return [b.x+(x+35)/70*b.width,b.y+(47-y)/48*b.height];};
  await page.mouse.click(...await point(page,0,24));const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#author-save').click()]);const path=await download.path(),doc=JSON.parse(await readFile(path,'utf8'));
  assert.equal(doc.cues[0].artwork.filter(e=>e.designGroup).length,6);
  // A fresh page has no in-memory groups. Reopening must still select the whole word.
  const fresh=await context.newPage();watch(fresh);await fresh.goto(url);await fresh.locator('#show-editor').click();await fresh.locator('#author-file').setInputFiles(path);await fresh.locator('.designer-banner').waitFor({state:'hidden'});
  await fresh.locator('[data-draw=select]').click();await fresh.mouse.click(...await point(fresh,-4.2,24));await fresh.locator('[data-act=delete]').click();assert.match(await fresh.locator('#author-status').textContent(),/^6 lines deleted/);
  await fresh.locator('#author-undo').click();await fresh.locator('#author-close').click();
  // Observe the real OrbitControls listener: director updates stay quiet, user changes still request frames.
  await fresh.evaluate(()=>{localStorage.setItem('draw3d-graphics-v1','battery');localStorage.setItem('draw3d-demo-settings-v1',JSON.stringify({count:256,pyro:false,lasers:false}));});await fresh.reload();
  await fresh.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/drone-player.js'));const {DronePlayer}=await import(url),original=DronePlayer.prototype.render;DronePlayer.prototype.render=function(now){window.reviewPlayer=this;return original.call(this,now);};});
  await fresh.locator('#drone-demo').click();await fresh.waitForFunction(()=>window.reviewPlayer?.active&&!window.reviewPlayer.waiting,null,{timeout:90000});
  const result=await fresh.evaluate(()=>{const p=window.reviewPlayer;p.clock.pause(performance.now());p.force=false;p.updateCamera(p.clock.time+.1,performance.now());const cameraForced=p.force;p.orbit.dispatchEvent({type:'change'});const userForced=p.force;
    p.force=false;p.clock.play(performance.now());const before=p.lastFrame;p.render(before+5);const skipped=p.lastFrame===before;p.clock.pause(performance.now());p.frontMode=false;p.cameraMode='free';p.camera.position.x+=1;const settling=p.render(performance.now());const settled=!p.render(performance.now());return {cameraForced,userForced,skipped,settling,settled};});
  assert.deepEqual(result,{cameraForced:false,userForced:true,skipped:true,settling:true,settled:true});assert.deepEqual(errors,[]);
  console.log('PASS: unsaved Demo settings survive editor handoff/reopen; fresh-page word grouping and Undo; director camera respects frame cap; manual orbit still redraws.');
}finally{await browser.close();}
