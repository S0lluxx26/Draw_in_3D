import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { entity, decode, encode, documentOf, validate, curve } from '../src/model.js';
import { rasterSize } from '../src/images.js';

test('Android starter project survives a web round trip with exact embedded image bytes',async()=>{
  const original=decode(await readFile(new URL('../../samples/starter-map.json',import.meta.url),'utf8'));
  const actual=decode(encode(original));
  assert.equal(actual.length,5);
  assert.deepEqual(actual.map(e=>e.id),original.map(e=>e.id));
  const image=actual.find(e=>e.type==='image');
  assert.equal(image.image,original.find(e=>e.type==='image').image);
  assert.deepEqual(rasterSize(Buffer.from(image.image,'base64')),[1024,512]);
  assert.equal(actual.find(e=>e.type==='stroke').wet,true);
});
test('Web export uses float32 range endpoints accepted by Android',()=>{
  const stroke=entity();stroke.points=[[0,0,0,.1]];stroke.width=.002;stroke.alpha=.05;stroke.scale=.1;stroke.panelWidth=.1;stroke.aspect=.1;
  const parsed=JSON.parse(encode([stroke])).entities[0];
  assert.equal(parsed.width,Math.fround(.002));assert.equal(parsed.alpha,Math.fround(.05));assert.equal(parsed.scale,Math.fround(.1));
  assert.equal(decode(JSON.stringify(documentOf([parsed])))[0].color,stroke.color);
});
test('Import rejects corrupt or unportable scenes before the editor commits them',()=>{
  const stroke=entity();stroke.points=[[0,0,0,1]];
  assert.throws(()=>validate(documentOf([stroke,stroke])),/duplicate/);
  assert.throws(()=>validate(documentOf([{...stroke,scale:-1}])),/scale/);
  assert.throws(()=>validate(documentOf([{...stroke,position:[4,0,0]}])),/radius/);
  assert.throws(()=>validate(documentOf([{...stroke,points:[[NaN,0,0,1]]}])),/coordinate/);
  assert.throws(()=>validate(documentOf([{...stroke,points:Array(385).fill([0,0,0,1])}])),/384/);
  assert.throws(()=>decode('{"version":2}'),/supported/);
  assert.throws(()=>rasterSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),/PNG or JPEG/);
});
test('Curved panels keep Android coordinates and the flat limit',()=>{
  assert.deepEqual(curve(1,2,0),[1,0,0]);
  assert.deepEqual(curve(.5,2,150),[0,0,0]);
  const p=curve(1,2,180);assert.ok(Math.abs(p[0]-2/Math.PI)<1e-7);assert.ok(Math.abs(p[2]-2/Math.PI)<1e-7);
});
