// Studio 24 UI: the title screen, Files menu, settings sheet, player HUD and formation library on phones and desktop.
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const out=fileURLToPath(new URL('../test-output/',import.meta.url));await mkdir(out,{recursive:true});
const url=process.env.DRAW3D_URL||'http://127.0.0.1:5173/';
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const open=async(viewport,{touch=true,locale='en-US'}={})=>{
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch&&viewport.width<900,locale});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(url);return page;
};
// Every visible control inside `root` fits the viewport and is at least `min` px on both sides.
const targets=(page,root,min=44)=>page.evaluate(([root,min])=>{
  const bad=[];for(const el of document.querySelectorAll(root+' :is(button,select,a[href],label.show-trail-toggle)')){
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(!r.width||!r.height||s.visibility==='hidden'||el.closest('[hidden]'))continue;
    const strip=el.closest('#show-cues');// the formation strip scrolls sideways
    if(r.height<min-.5||(!strip&&(r.width<min-.5||r.left<-1||r.right>innerWidth+1))||r.top<-1||r.bottom>innerHeight+1)bad.push(`${el.id||el.textContent.trim().slice(0,24)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);}
  return bad;},[root,min]);
const ready=page=>page.waitForFunction(()=>document.querySelector('#show-loading').hidden&&!document.querySelector('#drone-show').hidden,null,{timeout:90000});
try{
  // 1. Phone, portrait: the title screen is the front door, full screen, every action reachable and touch-sized.
  let page=await open({width:390,height:844});
  assert.ok(await page.locator('#welcome').isVisible(),'the title screen greets a first visit');
  const cover=await page.evaluate(()=>{const r=document.getElementById('welcome').getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round);});
  assert.deepEqual(cover,[0,0,390,844],'full screen on a phone');
  assert.equal(await page.evaluate(()=>document.elementFromPoint(40,420).closest('#welcome')!==null),true,'it covers the editor underneath');
  assert.deepEqual(await targets(page,'#welcome'),[],'title actions fit and are at least 44 px');
  assert.ok((await page.locator('#welcome-demo').boundingBox()).height>=56,'the main action is the biggest');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll');
  await page.screenshot({path:out+'ui-title-phone.png'});
  // Start drawing: the editor, touch-sized, with the Files menu folded into the header.
  await page.locator('#welcome-draw').click();assert.ok(await page.locator('#welcome').isHidden());
  assert.ok(await page.locator('#editor-files').isHidden(),'files live in the menu on phones');
  await page.locator('#files-menu').click();assert.equal(await page.locator('#files-menu').getAttribute('aria-expanded'),'true');
  assert.deepEqual(await targets(page,'#editor-files'),[],'menu rows are touch-sized');
  await page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));assert.ok(await page.locator('#editor-files').isHidden(),'a tap outside closes the menu');
  await page.locator('#files-menu').click();await page.keyboard.press('Escape');assert.ok(await page.locator('#editor-files').isHidden(),'Escape closes it too');
  assert.deepEqual(await targets(page,'#editor-tools'),[],'tool rail buttons are touch-sized');
  // Home brings the title back over the drawing; Draw again returns without losing anything.
  await page.locator('#home').click();assert.ok(await page.locator('#welcome').isVisible());assert.equal((await page.locator('#welcome-draw').textContent()).trim(),'Start drawing');
  await page.locator('#welcome-draw').click();
  // Settings as a bottom sheet: sections, touch-sized controls, closes without applying.
  await page.locator('#drone-demo-settings').scrollIntoViewIfNeeded();await page.locator('#drone-demo-settings').click();await page.locator('#demo-settings').waitFor({state:'visible'});
  const sheet=await page.locator('#demo-settings').boundingBox();assert.ok(sheet.x<=1&&sheet.width>=388&&sheet.y+sheet.height>=843,'a bottom sheet on phones');
  assert.equal(await page.locator('#demo-settings .settings-group').count(),3);
  for(const id of ['demo-count','demo-scale','demo-shape','demo-sky','demo-quality','demo-camera'])assert.ok((await page.locator('#'+id).boundingBox()).height>=44,id+' is touch-sized');
  assert.match(await page.locator('#demo-settings').textContent(),/fireworks all through the show/,'the fireworks note matches the show');
  await page.screenshot({path:out+'ui-settings-phone.png'});
  await page.locator('#demo-close').click();assert.ok(await page.locator('#demo-settings').isHidden());
  await page.context().close();

  // 2. Phone, landscape: the main action used to fall off the screen.
  page=await open({width:844,height:390});
  assert.deepEqual(await targets(page,'#welcome'),[],'landscape title actions fit and are touch-sized');
  await page.screenshot({path:out+'ui-title-landscape.png'});
  // Watch from the title; Back returns to the title.
  await page.locator('#welcome-demo').click();await ready(page);
  assert.equal(await page.locator('#show-exit').textContent(),'Back','from the title, Back goes back to it');
  assert.deepEqual(await targets(page,'#drone-show',40),[],'player controls fit a landscape phone');
  await page.locator('#show-exit').click();assert.ok(await page.locator('#welcome').isVisible(),'back on the title screen');
  await page.context().close();

  // 3. Phone, portrait player: every control on one row, at least 40 px.
  page=await open({width:360,height:740});
  await page.locator('#welcome-demo').click();await ready(page);
  assert.deepEqual(await targets(page,'#drone-show',40),[],'player controls fit a 360 px phone');
  assert.equal(await page.locator('#show-pause').getAttribute('data-word'),'Pause');
  await page.screenshot({path:out+'ui-player-phone.png'});
  await page.context().close();

  // 4. Desktop: the title sits in the canvas; drawing straight away dismisses it; Escape closes Home.
  page=await open({width:1440,height:900},{touch:false});
  assert.ok(await page.locator('#welcome').isVisible()&&await page.locator('#show-editor').isVisible(),'Show editor, Demo and Play map stay available');
  const canvas=await page.locator('#canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width*.75,canvas.y+canvas.height*.3);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.85,canvas.y+canvas.height*.4,{steps:6});await page.mouse.up();
  assert.ok(await page.locator('#welcome').isHidden(),'a drag on the canvas starts drawing');
  // Behind Home the editor's shortcuts wait: Delete must not remove a selection you cannot see.
  await page.locator('#canvas').focus();await page.keyboard.press('Control+a');await page.locator('#home').click();assert.equal((await page.locator('#welcome-draw').textContent()).trim(),'Continue drawing');
  await page.keyboard.press('Delete');assert.equal(await page.locator('#object-count').textContent(),'1 / 80','nothing deleted behind the title');
  await page.keyboard.press('Escape');assert.ok(await page.locator('#welcome').isHidden());
  // Undo back to an empty canvas keeps you in the editor.
  await page.locator('#undo').click();assert.equal(await page.locator('#object-count').textContent(),'0 / 80');assert.ok(await page.locator('#welcome').isHidden(),'the title stays away once you have drawn');
  // The formation library: picture cards of the Demo formations; one tap adds a formation.
  await page.locator('#show-editor').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  const before=await page.locator('.author-card').count();await page.locator('#author-library-open').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#author-library canvas')].every(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let lit=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]>200)lit++;return lit>20;}),null,{timeout:30000});
  assert.equal(await page.locator('#author-library [data-library]').count(),12);
  await page.screenshot({path:out+'ui-library.png'});
  await page.locator('#author-library [data-library="Whale"]').click();assert.equal(await page.locator('.author-card').count(),before+1);assert.ok(await page.locator('#author-library').isHidden());
  await page.locator('#author-close').click();
  await page.context().close();

  // 5. Vietnamese: the title reads correctly and the Demo's own names follow the language.
  page=await open({width:390,height:844},{locale:'vi-VN'});
  assert.equal(await page.locator('#welcome-draw').textContent(),'Bắt đầu vẽ');assert.equal(await page.locator('#welcome em').textContent(),'Cả một thế giới.');
  assert.ok(!/Georgia/.test((await page.locator('#welcome em').evaluate(e=>getComputedStyle(e).fontFamily)).split(',')[0]),'a Vietnamese-capable serif first');
  await page.locator('#welcome-demo').click();await ready(page);
  assert.equal(await page.locator('#show-title').textContent(),'CÂU CHUYỆN BẦU TRỜI');assert.ok(await page.locator('#show-cues').getByRole('button',{name:'Cá voi',exact:true}).isVisible(),'formation names in Vietnamese');
  await page.locator('#show-exit').click();await page.locator('#welcome select[data-language]').selectOption('en');
  await page.locator('#welcome-demo').click();await ready(page);assert.ok(await page.locator('#show-cues').getByRole('button',{name:'Whale',exact:true}).isVisible(),'and back in English');
  await page.context().close();

  assert.deepEqual(errors,[]);
  console.log('PASS: title screen (phone, landscape, desktop), Home/Escape, Files menu, settings sheet, phone player, formation library, Vietnamese names.');
}finally{await browser.close();}
