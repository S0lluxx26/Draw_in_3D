import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');
  await page.locator('#drone-demo-settings').click();
  await page.locator('#demo-count').selectOption('1024');await page.locator('#demo-scale').selectOption('4');await page.locator('#demo-shape').selectOption('star');
  await page.locator('#demo-fire-1').check();await page.locator('#demo-fire-6').uncheck();
  await page.getByRole('button',{name:'Apply & play Demo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#show-fleet').textContent==='1,024');
  await page.locator('#show-cues').getByRole('button',{name:'Fish',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='Fish');
  await mkdir('web/test-output',{recursive:true});await page.screenshot({path:'web/test-output/demo-fish-detailed.png'});
  await page.locator('#show-demo-settings').click();assert.equal(await page.locator('#demo-fire-1').isChecked(),true);assert.equal(await page.locator('#demo-fire-6').isChecked(),false);
  await page.locator('#demo-count').selectOption('256');await page.keyboard.press('Escape');assert.equal(await page.locator('#drone-show').isVisible(),true);assert.equal(await page.locator('#show-fleet').textContent(),'1,024');
  await page.locator('#show-pause').click();await page.locator('#show-demo-settings').click();await page.locator('#demo-cancel').click();await page.waitForFunction(()=>document.querySelector('#show-play-state').textContent==='LIVE PREVIEW');
  await page.locator('#show-demo-settings').click();await page.locator('#demo-shape').selectOption('diamond');await page.getByRole('button',{name:'Apply & play Demo',exact:true}).click();
  await page.locator('#show-cues').getByRole('button',{name:'Starship launch',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='Starship launch');await page.screenshot({path:'web/test-output/demo-starship-detailed.png'});
  await page.setViewportSize({width:412,height:915});await page.locator('#show-demo-settings').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'web/test-output/demo-settings-mobile.png'});await page.locator('#demo-cancel').click();
  await page.locator('#show-exit').click();await page.reload();await page.locator('#drone-demo-settings').click();assert.equal(await page.locator('#demo-count').inputValue(),'1024');assert.equal(await page.locator('#demo-shape').inputValue(),'diamond');
  assert.deepEqual(errors,[]);console.log('PASS: Demo settings apply/restart, fire toggles, light shaders, cancel/resume, mobile layout, reload persistence and no browser errors.');
}finally{await browser.close();}
