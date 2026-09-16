import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decode,encode} from '../src/model.js';
const original=await readFile(new URL('../../samples/paper-v3.json',import.meta.url),'utf8');
const returned=await readFile(new URL('../../app/build/interop/paper-v3-android.json',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(encode(decode(returned))),JSON.parse(original));
console.log('PASS: v3 browser → Android parser/copy/re-encoder → web preserves paper type, attachments, transforms, styles and every point.');
