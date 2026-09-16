import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await mkdir(path.join(dist, 'vendor'), { recursive: true });
for (const file of ['index.html', 'style.css', 'editor-tools.css', 'editor.js', 'model.js', 'geometry.js', 'images.js', 'editing.js', 'paths.js', 'paper.js', 'stroke-processing.js']) {
  await copyFile(path.join(root, 'src', file), path.join(dist, file));
}
for (const file of ['three.module.js', 'three.core.js']) {
  await copyFile(path.join(root, 'node_modules/three/build', file), path.join(dist, 'vendor', file));
}
await copyFile(path.join(root, 'node_modules/three/examples/jsm/controls/OrbitControls.js'), path.join(dist, 'vendor/OrbitControls.js'));
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(dist, 'vendor/THREE-LICENSE.txt'));
await cp(path.join(root, '../samples/starter-map.json'), path.join(dist, 'starter-map.json'));
console.log('Built dist/ with local dependencies. No CDN or network service required.');
