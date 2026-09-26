import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
// The Demo and the Show editor stay in step: Demo settings reach the editor, an unedited Demo plays the same way
// from both, player options exist for every show, and the Demo opens straight in the editor.
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173/');await page.locator('#undo:disabled').waitFor();
  const ready=()=>page.waitForFunction(()=>document.querySelector('#show-loading').hidden&&!document.querySelector('#drone-show').hidden,null,{timeout:90000});
  const player=()=>page.evaluate(()=>({title:document.querySelector('#show-title').innerText,fleet:document.querySelector('#show-fleet').textContent,length:document.querySelector('#show-time').textContent.split('/ ')[1],
    cues:[...document.querySelectorAll('#show-cues button')].map(b=>b.textContent),settings:document.querySelector('#show-demo-settings').hidden?null:document.querySelector('#show-demo-settings').getAttribute('aria-label')}));
  const editor=()=>page.evaluate(()=>({count:document.querySelector('#author-count').value,shape:document.querySelector('#author-look-shape').value,scale:document.querySelector('#author-look-scale').value,
    pyro:document.querySelector('#author-look-pyro').checked,lasers:document.querySelector('#author-look-lasers').checked,active:document.querySelector('.author-card.active strong')?.textContent}));
  // 1. Set up the Demo in Demo settings and play it, in Cinematic quality (drone bodies, as a PC GPU gets).
  await page.locator('#drone-demo-settings').click();await page.locator('#demo-count').selectOption('1024');await page.locator('#demo-shape').selectOption('star');await page.locator('#demo-scale').selectOption('4');
  await page.locator('#demo-pyro').uncheck();await page.locator('#demo-lasers').uncheck();await page.locator('#demo-quality').selectOption('high');await page.locator('#demo-apply').click();await ready();
  const demo=await player();assert.equal(demo.title,'SKY STORIES');assert.equal(demo.fleet,'1,024');assert.equal(demo.settings,'Demo settings');
  assert.equal(await page.locator('#show-quality').textContent(),'CINEMATIC');
  await page.locator('#show-exit').click();assert.ok(await page.locator('#drone-show').isHidden(),'Back leaves the Cinematic Demo');
  // 2. The Show editor, opened directly, shows that same Demo; played unedited it matches the Demo.
  await page.locator('#show-editor').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  assert.deepEqual({...await editor(),active:undefined},{count:'1024',shape:'star',scale:'4',pyro:false,lasers:false,active:undefined},'the untouched Demo follows Demo settings');
  await page.locator('#author-play').click();await ready();const edited=await player();
  assert.deepEqual({...edited,settings:null},{...demo,settings:null},'same title, fleet, length and cues as the Demo');
  // 3. Player options exist for every show; applying them keeps playing this show.
  assert.equal(edited.settings,'Player settings');await page.locator('#show-demo-settings').click();await page.locator('#demo-settings').waitFor({state:'visible'});
  assert.equal(await page.locator('#demo-settings-title').textContent(),'Player settings');assert.ok(await page.locator('#demo-count').isHidden()&&await page.locator('#demo-edit').isHidden(),'Demo-only options are hidden');
  assert.ok(await page.locator('#demo-quality').isVisible()&&await page.locator('#demo-camera').isVisible());
  assert.ok(await page.locator('#demo-sky').isVisible(),'the background is a player option');
  await page.locator('#demo-quality').selectOption('balanced');await page.locator('#demo-sky').selectOption('afternoon');await page.locator('#demo-apply').click();await ready();
  assert.equal(await page.locator('#show-quality').textContent(),'BALANCED');assert.equal(await page.locator('#drone-show').getAttribute('data-sky'),'afternoon','Late afternoon applies live');assert.equal(await page.locator('#show-exit').textContent(),'← Back to show','still your show');
  await page.locator('#show-exit').click();await page.locator('#author-dialog').waitFor({state:'visible'});await page.locator('#author-close').click();
  // 4. From the Demo straight into the Show editor, on the formation that was playing.
  await page.locator('#drone-demo').click();await ready();await page.locator('#show-cues').getByRole('button',{name:'Whale',exact:true}).click();
  await page.locator('#show-demo-settings').click();await page.locator('#demo-settings').waitFor({state:'visible'});assert.ok(await page.locator('#demo-edit').isVisible());
  await page.locator('#demo-edit').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  assert.ok(await page.locator('#drone-show').isHidden(),'the Demo stopped');const opened=await editor();assert.equal(opened.active,'7. Whale');assert.equal(opened.count,'1024');
  assert.match(await page.locator('#author-status').textContent(),/Demo as set up in Demo settings/);
  // 5. Run from here starts at the card's time; Back returns to the formation that was playing.
  const cardStart=(await page.locator('.author-card.active small').textContent()).split(' → ')[0];
  await page.locator('#author-formation-preview').click();await ready();
  const [m,sec]=cardStart.split(':').map(Number);assert.equal((await page.locator('#show-time').textContent()).split(' / ')[0],`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`,'Run from here starts as the Whale forms');
  await page.locator('#show-cues').getByRole('button',{name:'Firework star',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#show-phase').textContent==='Firework star');
  await page.locator('#show-exit').click();await page.locator('#author-dialog').waitFor({state:'visible'});
  assert.equal((await editor()).active,'8. Firework star');assert.match(await page.locator('#author-status').textContent(),/Back from the show at Firework star/);
  // 6. A formation that cannot play is flagged on its card, and Play points at it instead of failing mid-compile.
  await page.locator('#author-blank').click();
  const blank=page.locator('.author-card').last();assert.ok(await blank.evaluate(c=>c.classList.contains('problem')));assert.match(await blank.locator('small').textContent(),/^⚠ Nothing drawn yet/);
  await page.locator('.author-card').first().click();await page.locator('#author-play').click();
  assert.match(await page.locator('#author-status').textContent(),/New formation: Nothing drawn yet/);assert.ok(await blank.evaluate(c=>c.classList.contains('active')),'the problem card is selected');assert.ok(await page.locator('#drone-show').isHidden());
  assert.deepEqual(errors,[]);
  console.log('PASS: Demo settings reach the Show editor; an unedited Demo plays the same from both; player settings for every show; Demo → Edit in Show editor on the current formation; Back from the Cinematic Demo; Late afternoon background; Run from here and back to the playing formation; problem cards block Run; no browser errors.');
}finally{await browser.close();}
