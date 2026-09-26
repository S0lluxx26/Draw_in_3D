import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await mkdir(path.join(dist, 'vendor'), { recursive: true });
const files=['index.html', 'style.css', 'editor-tools.css', 'editor.js', 'editor-look.js', 'model.js', 'geometry.js', 'images.js', 'editing.js', 'paths.js', 'paper.js', 'stroke-processing.js', 'drawing-assists.js', 'drafts.js', 'drone-show.js', 'show-camera.js', 'quality.js', 'pyro.js', 'demo-settings.js', 'formation-assets.js', 'drone-player.js', 'sky-stage.js', 'drone-show.css', 'show-project.js', 'show-editor.js', 'formation-design.js', 'formation-designer.js', 'show-editor.css', 'show-worker.js', 'show-recorder.js', 'show-music.js', 'lasers.js', 'demo-library.js'];
const binaries=['assets/sky-stage.glb'];
const sources=await Promise.all(files.map(file=>readFile(path.join(root,'src',file),'utf8')));
const binaryData=await Promise.all(binaries.map(file=>readFile(path.join(root,'src',file))));
const revision=createHash('sha256').update(sources.join('\n')).update(Buffer.concat(binaryData)).digest('hex').slice(0,12);
const localAssets=new Set([...files.filter(file=>/\.(js|css)$/.test(file)),...binaries].map(file=>'./'+file));
for (const [i,file] of files.entries()) {
  // Match HTML and module references so a new page cannot reuse stale app code or assets.
  const source=sources[i].replace(/(['"])(\.\/[^'"\s]+\.(?:js|css|glb))\1/g,(match,quote,url)=>localAssets.has(url)?quote+url+'?v='+revision+quote:match);
  await writeFile(path.join(dist,file),source);
}
for (const [i,file] of binaries.entries()) { await mkdir(path.dirname(path.join(dist,file)),{recursive:true}); await writeFile(path.join(dist,file),binaryData[i]); }
for (const file of ['three.module.js', 'three.core.js']) {
  await copyFile(path.join(root, 'node_modules/three/build', file), path.join(dist, 'vendor', file));
}
await copyFile(path.join(root, 'node_modules/three/examples/jsm/controls/OrbitControls.js'), path.join(dist, 'vendor/OrbitControls.js'));
// Three.js add-ons keep their relative layout; follow their relative imports so nothing is missed.
const addons=path.join(root,'node_modules/three/examples/jsm'),pending=['postprocessing/EffectComposer.js','postprocessing/RenderPass.js','postprocessing/UnrealBloomPass.js','postprocessing/OutputPass.js','loaders/GLTFLoader.js','loaders/DRACOLoader.js','objects/Reflector.js'],copied=new Set();
while(pending.length){
  const file=pending.pop();if(copied.has(file))continue;copied.add(file);
  const text=await readFile(path.join(addons,file),'utf8');
  for(const [,spec] of text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g))pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)));
  await mkdir(path.join(dist,'vendor/addons',path.dirname(file)),{recursive:true});await writeFile(path.join(dist,'vendor/addons',file),text);
}
await mkdir(path.join(dist,'vendor/draco'),{recursive:true});
for (const file of ['draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js']) await copyFile(path.join(addons,'libs/draco/gltf',file),path.join(dist,'vendor/draco',file));
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(dist, 'vendor/THREE-LICENSE.txt'));
await cp(path.join(root, '../samples/starter-map.json'), path.join(dist, 'starter-map.json'));
console.log(`Built dist/ (${copied.size} three.js add-ons, revision ${revision}) with local dependencies. No CDN or network service required.`);
