import test from 'node:test';
import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import assets from '../src/formation-assets.js';
import {FORMATIONS,FLEET_SIZES} from '../src/demo-settings.js';

const nearest=points=>{let min=Infinity;for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const d=Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1],points[i][2]-points[j][2]);if(d<min)min=d;}return min;};

test('Blender v2 formations decode to full fleets with bounded LED colours and a compact file',async()=>{
  for(const name of FORMATIONS){
    const {body,fire}=assets[name];
    assert.equal(body.positions.length,4096);assert.equal(body.colors.length,4096);assert.equal(fire.positions.length,512);
    for(const c of [...body.colors,...fire.colors])assert.ok(c.length===3&&c.every(v=>v>=0&&v<=1));
    assert.ok(body.colors.some(c=>Math.max(...c)>.6),name+' has bright lights');
  }
  assert.ok((await stat(new URL('../src/formation-assets.js',import.meta.url))).size<900*1024,'asset stays compact (11 formations)');
});
test('every fleet-size prefix of a formation is evenly spread (farthest-point order)',()=>{
  for(const name of ['Robot','Eiffel Tower']){
    const points=assets[name].body.positions,small=nearest(points.slice(0,FLEET_SIZES[0])),mid=nearest(points.slice(0,1024));
    assert.ok(small>mid*1.6,`${name}: 256-light prefix spacing ${small.toFixed(3)} vs 1024 ${mid.toFixed(3)}`);
    assert.ok(mid>0);
  }
});
