import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decode,encode} from '../src/model.js';
const original=await readFile(new URL('../../samples/named-guides-v6.json',import.meta.url),'utf8');
const returned=await readFile(new URL('../../app/build/interop/named-guides-android.json',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(encode(decode(returned))),JSON.parse(original));
console.log('PASS: named hidden guide and bent ink survive browser → Android copy/render/export → browser unchanged.');
