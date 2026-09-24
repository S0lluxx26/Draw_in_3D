import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const url=process.env.DRAW3D_URL||'https://s0lluxx26.github.io/Draw_in_3D/';
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
  await mkdir(new URL('../test-output/',import.meta.url),{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1040}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const response=await page.goto(url);assert.equal(response.status(),200);await page.locator('#undo:disabled').waitFor();
  assert.ok(await page.evaluate(()=>isSecureContext));
  assert.equal(await page.locator('.edition').textContent(),'STUDIO 15');
  await page.locator('#example').click();await page.waitForFunction(()=>document.querySelector('#project-name').textContent==='Starter scene');
  assert.ok(await page.locator('#outliner .object-row').count()>0);await page.locator('#toast').evaluate(e=>e.hidden=true);
  await page.locator('#add-paper').click();await page.locator('#edit-surface').click();
  await page.locator('#surface-bend').fill('160');await page.locator('#surface-bend').dispatchEvent('change');
  assert.equal(await page.locator('#surface-bend-value').textContent(),'160°');
  await page.locator('#toast').evaluate(e=>e.hidden=true);
  await page.screenshot({path:fileURLToPath(new URL('../test-output/github-pages-desktop.png',import.meta.url))});
  await page.setViewportSize({width:412,height:915});await page.locator('[data-tool="curve"]').click();await page.locator('#curve-options').waitFor({state:'visible'});
  assert.ok(await page.locator('#canvas').isVisible());assert.ok(await page.locator('#export').isVisible());
  await page.screenshot({path:fileURLToPath(new URL('../test-output/github-pages-mobile.png',import.meta.url))});
  assert.deepEqual(errors,[]);console.log('PASS: Studio 09 HTTPS editor, project subpath assets, starter scene, bendable surface, desktop/mobile layouts and curve control; zero browser errors.');
}finally{await browser.close();}
