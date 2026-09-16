import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decode,encode} from '../src/model.js';
const original=await readFile(new URL('../../samples/surfaces-v4.json',import.meta.url),'utf8');
const returned=await readFile(new URL('../../app/build/interop/surfaces-v4-android.json',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(encode(decode(returned))),JSON.parse(original));
console.log('PASS: v4 sheets and surface-local strokes survive Android parse/copy/export and web re-import with every saved field unchanged.');
