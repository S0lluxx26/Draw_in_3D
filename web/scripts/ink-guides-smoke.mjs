import {chromium} from 'playwright-core';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-output');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.DRAW3D_CHROME,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('dialog',d=>d.accept());
  await page.goto(process.env.DRAW3D_URL||'http://127.0.0.1:5173');await page.locator('#undo:disabled').waitFor();assert.equal(await page.locator('.edition').textContent(),'STUDIO 11');
  let box=await page.locator('#canvas').boundingBox();const xy=(x,y)=>[box.x+box.width*x,box.y+box.height*y];
  const drag=async(a,b)=>{await page.mouse.move(...xy(...a));await page.mouse.down();await page.mouse.move(...xy(...b),{steps:24});await page.mouse.up();};
  const count=async n=>page.waitForFunction(n=>document.querySelector('#object-count').textContent===`${n} / 80`,n);
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#export').click();const file=path.join(out,name);await (await waiting).saveAs(file);return JSON.parse(await readFile(file,'utf8'));};
  const history=async id=>{await page.locator('#'+id).click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));};
  const pixels=async()=>{const png=await page.locator('#canvas').screenshot();return page.evaluate(async data=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const cx=c.getContext('2d');cx.drawImage(im,0,0);const p=cx.getImageData(0,0,c.width,c.height).data;let paper=0,ink=0;for(let i=0;i<p.length;i+=4){if(p[i]>170&&p[i+1]>170&&p[i+2]>140)paper++;if(p[i]>110&&p[i]>p[i+1]*1.25&&p[i+1]>p[i+2]*1.2)ink++;}return {paper,ink};},png.toString('base64'));};
  await page.locator('#add-paper').click();await page.locator('[data-brush="Pen"]').click();await page.locator('#color').fill('#ff9459');await page.locator('#color').dispatchEvent('change');await page.locator('#wet').uncheck();
  await drag([.41,.43],[.59,.53]);await count(2);await page.locator('[data-paper-bend="90"]').click();
  const original=await save('ink-before-hide.json'),painted=await pixels();assert.ok(painted.paper>20000);assert.ok(painted.ink>150);
  await page.locator('#toggle-paper').click();assert.equal(await page.locator('#toggle-paper').textContent(),'Show sheet');const hidden=await save('ink-hidden.json'),floating=await pixels();assert.equal(hidden.version,5);assert.equal(hidden.entities[0].paperVisible,false);assert.deepEqual(hidden.entities[1],original.entities[1]);assert.ok(floating.paper<painted.paper*.05);assert.ok(floating.ink>150);
  await history('undo');assert.equal(await page.locator('#toggle-paper').textContent(),'Hide sheet · keep ink');await history('redo');assert.equal(await page.locator('#toggle-paper').textContent(),'Show sheet');
  await drag([.43,.54],[.57,.57]);await count(3);await page.locator('#view-ink').click();assert.equal(await page.locator('#focus-sheet').isChecked(),false);assert.equal(await page.locator('[data-tool="orbit"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#workspace-guides').isChecked(),false);
  await drag([.4,.5],[.55,.5]);await page.locator('#add-paper').click();await count(4);assert.equal(await page.locator('#focus-sheet').isChecked(),false);assert.equal(await page.locator('#color').inputValue(),'#ff9459');await drag([.43,.43],[.57,.5]);await count(5);
  await page.locator('[data-paper-bend="180"]').click();await page.locator('#view-ink').click();const all=await save('ink-guides-v5.json');assert.equal(all.entities.length,5);assert.ok(all.entities.filter(e=>e.type==='paper').every(e=>e.paperVisible===false));assert.equal(all.entities[4].paperId,all.entities[3].id);assert.deepEqual(all.entities[1].points,original.entities[1].points);
  await page.locator('#toast').evaluate(e=>e.hidden=true);await page.locator('.inspector').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,'studio06-floating-ink.png')});
  await page.locator('#new').click();await page.locator('#project-file').setInputFiles(path.join(out,'ink-guides-v5.json'));await count(5);assert.deepEqual((await save('ink-reopened.json')).entities,all.entities);
  // Hidden guides stay selectable through Paint on, usable on a narrow canvas, and deletable explicitly.
  await page.setViewportSize({width:412,height:915});await page.locator('#painting-target').selectOption(all.entities[0].id);await page.locator('#face-and-draw').click();box=await page.locator('#canvas').boundingBox();await drag([.46,.43],[.54,.43]);await count(6);
  await page.locator('#toggle-paper').click();assert.equal(await page.locator('#toggle-paper').textContent(),'Hide sheet · keep ink');await history('undo');
  await page.locator('#edit-surface').click();assert.equal(await page.locator('#delete').textContent(),'Delete sheet + ink');await page.locator('#delete').click();await count(2);await history('undo');await count(6);
  await page.locator('#show-papers').click();const visible=await save('ink-shown.json');assert.equal(visible.version,4);assert.ok(visible.entities.every(e=>e.paperVisible!==false));await history('undo');assert.equal((await save('ink-final.json')).version,5);
  await page.locator('#toast').evaluate(e=>e.hidden=true);await page.screenshot({path:path.join(out,'studio06-mobile-guide.png')});assert.deepEqual(errors,[]);
  console.log('PASS: rendered ink survives paper removal; curved/multiple guides; hidden drawing; undo/redo; export/reopen; mobile layout; explicit parent deletion/undo; show-all/undo; zero browser errors.');
}finally{await browser.close();}
