import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
// Edit the Demo, save it, reopen it and play it: it performs like the Demo with the edits.
const out=fileURLToPath(new URL('../test-output/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');await page.locator('#undo:disabled').waitFor();
  const change=async(id,value)=>{await page.locator(id).fill(String(value));await page.locator(id).dispatchEvent('change');};
  const card=name=>page.locator('.author-card',{has:page.locator('strong',{hasText:new RegExp(`^\\d+\\. ${name}$`)})}).first();
  await page.locator('#show-editor').click();await page.locator('#author-dialog').waitFor({state:'visible'});await page.locator('#author-demo').click();
  assert.equal(await page.locator('.author-card').count(),12);assert.equal(await page.locator('.author-card:has-text("· 3D")').count(),12,'every card is a Demo 3D formation');
  await page.waitForFunction(()=>document.querySelector('#author-preview-note').textContent.includes('Blender 3D'));
  assert.equal(await page.locator('#author-edit').textContent(),'✎ Convert to drawing');assert.ok(await page.locator('#author-x').isDisabled(),'Demo formations keep their Demo placement');
  // Edits: remove the Robot, stretch the Whale, add falling fire to the Fish, add another Butterfly, star-shaped lights.
  await card('Robot').click();await page.locator('#author-delete').click();
  await card('Whale').click();await change('#author-hold',20);
  await card('Fish').click();await page.locator('#author-cue-fire').check();
  await page.locator('#author-library').selectOption('Butterfly');assert.equal(await page.locator('.author-card').count(),12);
  await page.locator('#author-look-shape').selectOption('star');await change('#author-name','My Demo remix');
  await page.screenshot({path:path.join(out,'demo-editing-editor.png')});
  const saving=page.waitForEvent('download');await page.locator('#author-save').click();const file=path.join(out,'my-demo-remix.show.json');await(await saving).saveAs(file);
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.equal(saved.version,3);assert.deepEqual(saved.cues.map(c=>c.library),['Fish','Butterfly','Hot air balloon','Eiffel Tower','Big ship','Whale','Firework star','Row of fire','Birthday cake','Starship launch','Happy day','Butterfly']);
  assert.equal(saved.cues.find(c=>c.library==='Whale').hold,20);assert.equal(saved.cues[0].fire,true);assert.equal(saved.look.shape,'star');assert.equal(saved.fireworks.style,'demo');
  // Later: a new show, then open the saved file and play it.
  await page.locator('#author-new').click();assert.equal(await page.locator('.author-card').count(),0);
  await page.locator('#author-file').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#author-name').value==='My Demo remix');
  assert.equal(await page.locator('.author-card').count(),12);assert.equal(await page.locator('.author-card:has-text("· 3D")').count(),12);
  await page.locator('#author-play').click();await page.locator('#drone-show').waitFor({state:'visible',timeout:90000});
  assert.equal(await page.locator('#show-title').textContent(),'My Demo remix');
  const cues=await page.locator('#show-cues button').allTextContents();
  assert.deepEqual(cues.slice(0,3),['Takeoff','Fish','Butterfly']);assert.ok(!cues.includes('Robot'));assert.ok(cues.includes('Growing heart'),'the Demo finale');
  assert.equal(await page.locator('#show-demo-settings').getAttribute('aria-label'),'Player settings','your show keeps its own look; only player options');
  await page.waitForFunction(()=>document.querySelector('#show-loading').hidden,null,{timeout:90000});
  await page.locator('#show-cues').getByRole('button',{name:'Whale',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='Whale');
  await page.screenshot({path:path.join(out,'demo-editing-played.png')});
  // 387 s Demo − Robot (22 s) + 2 s longer Whale + another Butterfly (22 s) = 389 s.
  const total=await page.locator('#show-time').textContent();assert.match(total,/\/ 06:29$/,'the edited show length: '+total);
  await page.locator('#show-exit').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('PASS: Edit demo opens the 3D Demo; remove, retime, fire, add a Demo formation and look edits; save; new show; reopen; Play my show performs the edited Demo; no browser errors.');
}finally{await browser.close();}
