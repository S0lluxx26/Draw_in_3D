import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1365,height:1000},locale:'en-US',acceptDownloads:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const url=process.env.DRAW3D_URL||'http://127.0.0.1:5184/';await page.goto(url);
 await page.selectOption('#app-language','vi');assert.equal(await page.locator('html').getAttribute('lang'),'vi');assert.equal(await page.locator('#open').textContent(),'Mở dự án');
 await page.locator('[data-tool=curve]').click();assert.equal(await page.locator('#tool-name').textContent(),'Vẽ đường cong');
 await page.locator('#help').click();assert.match(await page.locator('#guide').textContent(),/Đường cong và làm mượt/);await page.locator('#guide-done').click();
 await page.locator('#drone-demo-settings').click();assert.equal(await page.locator('#demo-settings-title').textContent(),'Cài đặt Demo');assert.equal(await page.locator('#demo-shape').inputValue(),'round');await page.locator('#demo-cancel').click();
 await page.locator('#show-editor').click();assert.equal(await page.locator('#author-heading').textContent(),'Biên tập màn trình diễn');await page.locator('#author-new').click();await page.locator('#author-blank').click();
 await page.locator('#author-name').fill('Heart');await page.locator('#author-name').press('Tab');await page.locator('#author-cue-name').fill('Xin chào Việt Nam');await page.locator('#author-cue-name').press('Tab');
 await page.locator('[data-draw=text]').click();await page.locator('[data-role=text]').fill('HI');const b=await page.locator('#author-preview').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
 const save=async()=>{const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#author-save').click()]);return JSON.parse(await readFile(await d.path(),'utf8'));};const vietnamese=await save();assert.equal(vietnamese.name,'Heart');assert.equal(vietnamese.cues[0].name,'Xin chào Việt Nam');assert.ok(vietnamese.cues[0].artwork.length>1);
 await page.locator('#author-help').click();assert.match(await page.locator('#author-guide').textContent(),/chữ Latin không dấu/);await page.locator('#author-guide-close').click();await page.locator('#author-close').click();
 await page.selectOption('#app-language','en');assert.equal(await page.locator('#open').textContent(),'Open project');assert.equal(await page.locator('#tool-name').textContent(),'Curve drawing');await page.locator('#show-editor').click();assert.deepEqual(await save(),vietnamese);await page.locator('#author-close').click();
 await page.selectOption('#app-language','vi');await page.reload();assert.equal(await page.locator('#app-language').inputValue(),'vi');assert.equal(await page.locator('#open').textContent(),'Mở dự án');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#app-language').isVisible());const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(overflow.scroll<=overflow.width,JSON.stringify(overflow));
 await mkdir('web/test-output',{recursive:true});await page.screenshot({path:'web/test-output/vi-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 const viContext=await browser.newContext({locale:'vi-VN'});const auto=await viContext.newPage();await auto.goto(url);assert.equal(await auto.locator('#app-language').inputValue(),'vi');await viContext.close();
 console.log('PASS: Vietnamese menus, dynamic labels, guides, data-preserving language switch, saved preference, browser default, mobile layout.');
}finally{await browser.close();}
