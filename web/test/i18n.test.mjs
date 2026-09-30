import test from 'node:test';
import assert from 'node:assert/strict';
import {translate,preferredLanguage} from '../src/i18n.js';
test('language preference uses supported saved choices before browser language',()=>{
 assert.equal(preferredLanguage('en','vi-VN'),'en');assert.equal(preferredLanguage(null,'vi-VN'),'vi');assert.equal(preferredLanguage('xx','fr'),'en');
});
test('Vietnamese labels preserve whitespace, shortcuts and numeric values',()=>{
 assert.equal(translate(' Draw ','vi'),' Vẽ ');assert.equal(translate('Draw (D)','vi'),'Vẽ (D)');assert.equal(translate('Undo  (Ctrl+Z)','vi'),'Hoàn tác (Ctrl+Z)');assert.equal(translate('4,096 drones','vi'),'4,096 drone');assert.equal(translate('Tap Checkpoint 2 of 3','vi'),'Chạm điểm kiểm tra 2 / 3');
 assert.equal(translate('Unrecognised error','vi'),'Unrecognised error');assert.equal(translate('constructor','vi'),'constructor');assert.equal(translate('Draw','en'),'Draw');
});
test('every static message the app shows has a Vietnamese translation',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs'),dir=new URL('../src/',import.meta.url);
 const internal=new Set(['bad EBML','bad EBML id','size too large','WebGL 2 unavailable','Focused on ']);// never shown as written, or followed by user data
 const missing=[];
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.js')&&!['vi.js','i18n.js','formation-assets.js'].includes(f))){
  for(const [,text] of readFileSync(new URL(file,dir),'utf8').matchAll(/(?:notify\(|report\(|textContent=|new Error\()'([^'`]+)'/g)){
   if(!/[a-z]{3}/.test(text)||internal.has(text))continue;
   const sample=/(: | · )$/.test(text)?text+'3':text;// a prefix followed by a detail or a count
   if(translate(sample,'vi')===sample)missing.push(file+': '+text);
  }
 }
 assert.deepEqual(missing,[]);
});
test('every phase and formation name of the Demo reads in Vietnamese; names in your own shows are left alone',async()=>{
 const [{default:assets},{compileDemo},{sampleShow}]=await Promise.all([import('../src/formation-assets.js'),import('../src/demo-library.js'),import('../src/drone-show.js')]);
 const demo=compileDemo(assets,{count:256}),names=new Set(demo.cues.map(c=>c.label));
 for(let t=0;t<=demo.duration;t+=.25)names.add(sampleShow(demo,t).phase);
 assert.deepEqual([...names].filter(n=>n&&translate(n,'vi')===n),[]);
 assert.equal(translate('Forming Fish','vi'),'Đang tạo hình Cá');assert.equal(translate('Launching growing heart','vi'),'Phóng trái tim lớn dần');
 assert.equal(translate('Forming My kite','vi'),'Forming My kite');
});
