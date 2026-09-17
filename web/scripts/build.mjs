import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await mkdir(path.join(dist, 'vendor'), { recursive: true });
const files=['index.html', 'style.css', 'editor-tools.css', 'editor.js', 'model.js', 'geometry.js', 'images.js', 'editing.js', 'paths.js', 'paper.js', 'stroke-processing.js', 'drawing-assists.js', 'drafts.js', 'drone-show.js', 'drone-player.js', 'drone-show.css'];
const sources=await Promise.all(files.map(file=>readFile(path.join(root,'src',file),'utf8')));
const revision=createHash('sha256').update(sources.join('\n')).digest('hex').slice(0,12);
const localAssets=new Set(files.filter(file=>/\.(js|css)$/.test(file)).map(file=>'./'+file));
for (const [i,file] of files.entries()) {
  // Match HTML and module references so a new page cannot reuse stale app code.
  const source=sources[i].replace(/(['"])(\.\/[^'"\s]+\.(?:js|css))\1/g,(match,quote,url)=>localAssets.has(url)?quote+url+'?v='+revision+quote:match);
  await writeFile(path.join(dist,file),source);
}
for (const file of ['three.module.js', 'three.core.js']) {
  await copyFile(path.join(root, 'node_modules/three/build', file), path.join(dist, 'vendor', file));
}
await copyFile(path.join(root, 'node_modules/three/examples/jsm/controls/OrbitControls.js'), path.join(dist, 'vendor/OrbitControls.js'));
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(dist, 'vendor/THREE-LICENSE.txt'));
await cp(path.join(root, '../samples/starter-map.json'), path.join(dist, 'starter-map.json'));
console.log('Built dist/ with local dependencies. No CDN or network service required.');
