import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decode,encode} from '../src/model.js';
const original=await readFile(new URL('../../samples/editor-v2.json',import.meta.url),'utf8');
const returned=await readFile(new URL('../../app/build/interop/editor-v2-android.json',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(encode(decode(returned))),JSON.parse(original));
console.log('PASS: v2 browser → Android parser/copy/re-encoder → web preserves every field, block dimension, style and stroke point.');
