import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decode,encode} from '../src/model.js';
const original=await readFile(new URL('../../samples/drawing-assists.json',import.meta.url),'utf8');
const returned=await readFile(new URL('../../app/build/interop/drawing-assists-android.json',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(encode(decode(returned))),JSON.parse(original));
console.log('PASS: mirror/snap strokes and parallel guides survive existing Android decode/render-data/copy/export and web import unchanged.');
