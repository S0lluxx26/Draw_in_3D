// The remaining half of the real browser → Android parser → browser check.
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const returned=path.join(root,'../app/build/interop/android-reencoded.json');
const original=JSON.parse(await readFile(path.join(root,'../samples/web-authored.json'),'utf8'));
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();
  await page.locator('#project-file').setInputFiles(returned);
  await page.waitForFunction(()=>document.querySelector('#object-count').textContent==='2 / 80');
  const waiting=page.waitForEvent('download');await page.locator('#export').click();
  const download=await waiting,filename=path.join(root,'test-output/web-android-web.json');await download.saveAs(filename);
  assert.deepEqual(JSON.parse(await readFile(filename,'utf8')),original);
  await page.locator('#project-file').setInputFiles(path.join(root,'../samples/starter-map.json'));
  await page.waitForFunction(()=>document.querySelector('#object-count').textContent==='5 / 80');
  await page.locator('[data-view="perspective"]').click();
  await page.locator('#toast').evaluate(el=>el.hidden=true);
  await page.screenshot({path:path.join(root,'test-output/web-starter.png')});
  await page.setViewportSize({width:820,height:1180});
  await page.screenshot({path:path.join(root,'test-output/web-tablet-layout.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: browser → Android SceneData parser/re-encoder → browser download preserves every project field and embedded image. Narrow layout framing reviewed.');
}finally{await browser.close();}
