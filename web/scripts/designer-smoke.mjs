import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The 2D formation designer: draw a formation on the sky stage, adjust it, run it, save it and open it again.
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');await page.locator('#undo:disabled').waitFor();
  await page.locator('#show-editor').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  await page.locator('#author-new').click();assert.equal(await page.locator('.author-card').count(),0);
  // 1. A blank stage, ready for the pen.
  await page.locator('#author-blank').click();assert.equal(await page.locator('.author-card').count(),1);
  assert.equal(await page.locator('[data-draw=pen]').getAttribute('aria-pressed'),'true');assert.ok(await page.locator('.designer-banner').isHidden());
  const stage=page.locator('#author-preview'),box=await stage.boundingBox(),at=(x,y)=>[box.x+(x+35)/70*box.width,box.y+(47-y)/48*box.height];
  const drag=async(a,b,steps=10)=>{await page.mouse.move(...at(...a));await page.mouse.down();await page.mouse.move(...at(...b),{steps});await page.mouse.up();};
  const lines=async()=>Number((await page.locator('#author-preview-note').textContent()).match(/(\d+) lines?/)?.[1]??0);
  // 2. Draw: a filled pink heart, gold text and a cyan pen line.
  await page.locator('[data-draw=heart]').click();await page.locator('[data-opt=fill]').check();await page.locator('[data-color="#ff4f9a"]').click();await drag([-10,12],[10,32]);
  const heartLines=await lines();assert.ok(heartLines>=5,'a filled heart is several rings: '+heartLines);
  await page.locator('[data-opt=fill]').uncheck();await page.locator('[data-draw=text]').click();await page.locator('[data-role=text]').fill('Mai');await page.locator('[data-color="#ffcf3f"]').click();await page.mouse.click(...at(0,39));
  const withText=await lines();assert.ok(withText>heartLines+3,'MAI adds letter strokes');
  await page.locator('[data-draw=pen]').click();await page.locator('[data-color="#61e8c6"]').click();
  await page.mouse.move(...at(-28,7));await page.mouse.down();for(let i=0;i<=30;i++)await page.mouse.move(...at(-28+i*1.8,7+2*Math.sin(i/3)));await page.mouse.up();
  assert.equal(await lines(),withText+1);assert.match(await page.locator('#author-preview-note').textContent(),/a drone every [\d.]+ m/);
  // 3. Select the heart: all its rings come together; delete, then undo.
  await page.locator('[data-draw=select]').click();await page.mouse.click(...at(0,12.3));
  assert.ok(await page.locator('[data-act=delete]').isEnabled());await page.locator('[data-act=delete]').click();
  assert.equal(await lines(),withText+1-heartLines,'the whole filled heart is one shape');assert.match(await page.locator('#author-status').textContent(),new RegExp(`${heartLines} lines deleted`));
  await page.locator('#author-undo').click();assert.equal(await lines(),withText+1);
  // 4. Move it with the mouse, nudge with the keyboard; Ctrl+A and Delete clear, Ctrl+Z restores.
  await page.mouse.click(...at(0,12.3));await drag([0,12.3],[-6,9.3],6);assert.equal(await page.locator('#author-status').textContent(),'Moved.');
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#author-status').textContent(),'Nudged.');
  await stage.focus();await page.keyboard.press('Control+a');await page.keyboard.press('Delete');assert.equal(await lines(),0);
  await page.keyboard.press('Control+z');assert.equal(await lines(),withText+1);
  // 5. Mirror draws both halves.
  await page.locator('[data-draw=line]').click();await page.locator('[data-opt=mirror]').check();await drag([6,20],[14,26]);assert.equal(await lines(),withText+3);await page.locator('[data-opt=mirror]').uncheck();
  const drawn=await lines();
  // 6. Run from here: the drones fly into the drawing; Back returns to it.
  await page.locator('#author-formation-preview').click();await page.locator('#drone-show').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#show-loading').hidden,null,{timeout:90000});
  await page.locator('#show-cues').getByRole('button',{name:'New formation',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='New formation');
  await page.locator('#show-exit').click();await page.locator('#author-dialog').waitFor({state:'visible'});assert.match(await page.locator('#author-status').textContent(),/Back from the show at New formation/);
  // 7. Save, start over, open the file: the formation is still a designer drawing.
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#author-save').click()]);const file=await download.path();const saved=JSON.parse(await readFile(file,'utf8'));
  assert.equal(saved.cues[0].artwork.filter(e=>e.type==='stroke').length,drawn);
  await page.locator('#author-new').click();await page.locator('#author-file').setInputFiles(file);await page.waitForFunction(()=>document.querySelectorAll('.author-card').length===1);
  assert.ok(await page.locator('[data-draw=pen]').isEnabled(),'editable after reopening');assert.equal(await lines(),drawn);
  // 8. A Demo formation converts to a drawing on the stage, water included.
  await page.locator('#author-demo').click();await page.locator('.author-card').nth(6).click();assert.ok(await page.locator('.designer-banner').isVisible());assert.ok(await page.locator('[data-draw=pen]').isDisabled());
  await page.locator('.designer-banner button').click();assert.ok(await page.locator('.designer-banner').isHidden());assert.ok(await page.locator('[data-draw=pen]').isEnabled());
  assert.match(await page.locator('#author-preview-note').textContent(),/in the spout/);
  // 9. Phone width: the designer fits, no sideways scrolling.
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const small=await stage.boundingBox();assert.ok(small.width<=390&&small.width>250,'the stage uses the phone width: '+small.width);
  assert.deepEqual(errors,[]);
  console.log('PASS: blank stage; filled heart, text, pen, mirrored line; group select, delete/undo, move, nudge, select-all; Run from here and back; save and reopen still editable; Demo Whale converts with its spout; phone layout; no browser errors.');
}finally{await browser.close();}
