import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../test-output/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');await page.locator('#undo:disabled').waitFor();
  await page.locator('#drone-drawing').click();await page.locator('#toast').waitFor();assert.ok((await page.locator('#toast').textContent()).includes('Draw'));assert.equal(await page.locator('#drone-show').isVisible(),false);
  await page.locator('#add-paper').click();await page.locator('[data-paper-bend="90"]').click();await page.locator('[data-tool="line"]').click();const canvas=await page.locator('#canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width*.44,canvas.y+canvas.height*.44);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.58,canvas.y+canvas.height*.55,{steps:10});await page.mouse.up();
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const file=path.join(out,name);await(await waiting).saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const before=await save('drone-editor-before.json'),history=await page.locator('#history-status').textContent();
  await page.locator('#drone-demo').click();await page.locator('#drone-show').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#show-scrub').valueAsNumber>.4);
  await page.locator('#show-pause').click();await page.waitForFunction(()=>document.querySelector('#show-play-state').textContent==='PAUSED');const paused=await page.locator('#show-scrub').inputValue();await page.waitForTimeout(150);assert.equal(await page.locator('#show-scrub').inputValue(),paused);
  await page.locator('#show-pause').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>document.querySelector('#show-play-state').textContent==='PAUSED');
  for(const [label,phase]of [['Robot','Robot'],['Fish','Fish'],['Eiffel Tower','Eiffel Tower'],['Big ship','Big ship'],['Firework star','Firework star'],['Row of fire','Row of fire'],['Starship launch','Starship launch'],['Fireworks','Fireworks'],['Landing','Landing']]){
    await page.locator('#show-cues').getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(phase=>document.querySelector('#show-phase').textContent===phase,phase);await page.screenshot({path:path.join(out,'drone-'+label.toLowerCase().replaceAll(' ','-')+'.png')});
  }
  await page.locator('#show-scrub').fill('155');await page.locator('#show-scrub').dispatchEvent('input');await page.waitForFunction(()=>document.querySelector('#show-play-state').textContent==='SHOW COMPLETE');assert.equal(await page.locator('#show-lit').textContent(),'0 / 4096');
  await page.locator('#show-pause').click();await page.waitForFunction(()=>document.querySelector('#show-scrub').valueAsNumber<2);await page.locator('#show-speed').selectOption('2');await page.locator('#show-restart').click();await page.waitForFunction(()=>document.querySelector('#show-scrub').valueAsNumber>.1);await page.locator('#show-pause').click();
  await page.locator('#show-cues').getByRole('button',{name:'Robot',exact:true}).click();await page.locator('#show-trails').uncheck();await page.locator('#show-front').click();
  const front=await page.locator('#canvas').screenshot();await page.mouse.move(720,450);await page.mouse.down();await page.mouse.move(920,490,{steps:12});await page.mouse.up();assert.notDeepEqual(await page.locator('#canvas').screenshot(),front);await page.locator('#show-front').click();
  await page.setViewportSize({width:412,height:915});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'drone-mobile.png')});
  await page.locator('#show-exit').click();assert.equal(await page.locator('#drone-show').isVisible(),false);assert.equal(await page.locator('#history-status').textContent(),history);assert.deepEqual((await save('drone-editor-after.json')).entities,before.entities);
  await page.locator('#drone-drawing').click();await page.locator('#show-cues').getByRole('button',{name:'Your drawing',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='Your drawing');assert.equal(await page.locator('#show-title').textContent(),'YOUR INK, IN THE SKY');await page.screenshot({path:path.join(out,'drone-my-drawing.png')});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#drone-show').isVisible(),false);assert.deepEqual((await save('drone-editor-after-custom.json')).entities,before.entities);
  // A second entry must reuse the editor context without leaving duplicate controls.
  await page.locator('#drone-demo').click();await page.locator('#show-exit').click();await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#object-count').textContent==='1 / 80');assert.deepEqual(errors,[]);
  console.log('PASS: automatic Demo playback; formation cues and landing; pause/replay/seek/speed; mobile stage; curved drawing conversion; editor/history preservation; repeated entry/exit; no browser errors.');
}finally{await browser.close();}
