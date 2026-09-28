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
