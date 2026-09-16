// One bounded authoring/transfer walkthrough; not a benchmark or exhaustive suite.
import { chromium } from 'playwright-core';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'test-output');await mkdir(output,{recursive:true});
const executablePath=process.env.DRAW3D_CHROME;
if(!executablePath)throw new Error('Set DRAW3D_CHROME to a local Chrome/Chromium executable.');
const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
page.on('dialog',dialog=>dialog.accept());
const setInput=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');};
const exportFile=async(name)=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const download=await waiting;const filename=path.join(output,name);await download.saveAs(filename);return JSON.parse(await readFile(filename,'utf8'));};
try{
  await page.goto('http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();
  await page.screenshot({path:path.join(output,'web-empty.png')});
  assert.deepEqual(errors,[]);
  const box=await page.locator('#canvas').boundingBox();
  // New desktop stroke with the smallest phone-compatible width and wet effect.
  await setInput('width',2);await page.locator('#wet').check();
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.4);await page.mouse.down();
  for(let i=1;i<=22;i++)await page.mouse.move(box.x+box.width*(.52+i*.008),box.y+box.height*(.4+Math.sin(i/5)*.035));
  await page.mouse.up();assert.equal(await page.locator('#object-count').textContent(),'1 / 80');
  await page.locator('#undo').click();assert.equal(await page.locator('#object-count').textContent(),'0 / 80');
  await page.locator('#redo').click();await page.waitForFunction(()=>document.querySelector('#object-count').textContent==='1 / 80');
  await page.locator('#image-file').setInputFiles(path.join(root,'../samples/panorama-grid.png'));
  await page.waitForFunction(()=>document.querySelector('#object-count').textContent==='2 / 80');
  await setInput('arc',175);await setInput('scale',.8);
  const authored=await exportFile('web-authored.json');
  assert.equal(authored.entities.length,2);assert.equal(authored.entities[0].width,Math.fround(.002));assert.equal(authored.entities[0].wet,true);
  assert.equal(authored.entities[1].arc,175);assert.ok(authored.entities[1].image.length>0);
  // Open a file saved by the Android emulator, preserving its raster and IDs.
  const androidFile=path.join(root,'../artifacts/saved-smoke.json');
  await page.locator('#project-file').setInputFiles(androidFile);
  await page.waitForFunction(()=>document.querySelector('#object-count').textContent==='5 / 80');
  const android=JSON.parse(await readFile(androidFile,'utf8'));
  await page.locator('#play').click();
  for(const type of ['start','checkpoint','goal']){
    const e=android.entities.find(e=>e.type===type);
    const point=await page.evaluate(async position=>{const T=await import('./vendor/three.module.js');const rect=document.querySelector('#canvas').getBoundingClientRect();const cam=new T.PerspectiveCamera(48,rect.width/rect.height,.02,100);cam.position.set(0,1.4,5);cam.lookAt(0,1.4,0);cam.updateMatrixWorld();const p=new T.Vector3(...position).project(cam);return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};},e.position);
    await page.mouse.click(point.x,point.y);
  }
  assert.equal(await page.locator('#game-status').textContent(),'Map complete ✓');
  await page.locator('#play').click();
  const roundTrip=await exportFile('android-via-web.json');
  assert.deepEqual(roundTrip.entities.map(e=>e.id),android.entities.map(e=>e.id));
  assert.equal(roundTrip.entities.find(e=>e.type==='image').image,android.entities.find(e=>e.type==='image').image);
  await page.locator('[data-view="perspective"]').click();
  await page.screenshot({path:path.join(output,'web-starter.png')});
  // Failed import must not discard the scene already open.
  await page.locator('#project-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await page.locator('#toast.error').waitFor();assert.equal(await page.locator('#object-count').textContent(),'5 / 80');
  await page.setViewportSize({width:820,height:1180});await page.screenshot({path:path.join(output,'web-tablet-layout.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: draw, undo/redo, PNG import, curve/transform edit, web export, Android-file import, marker game, round trip, invalid-file preservation. Browser errors: 0.');
}finally{await browser.close();}
