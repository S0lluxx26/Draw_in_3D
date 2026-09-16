import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {decode,encode} from '../src/model.js';
const original=await readFile(new URL('../../samples/curves.json',import.meta.url),'utf8');
const returned=await readFile(new URL('../../app/build/interop/curves-android.json',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(encode(decode(returned))),JSON.parse(original));
console.log('PASS: browser curves and smoothed strokes survive Android parse/copy/export and web re-import with every saved field unchanged.');
