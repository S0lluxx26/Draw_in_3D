// Editor presentation only: a soft studio backdrop and grids that fade out toward
// their edges instead of ending in a hard square. No picking or data depends on this.
import * as THREE from 'three';

export function studioBackdrop(){
  const canvas=document.createElement('canvas');canvas.width=4;canvas.height=256;
  const g=canvas.getContext('2d'),gradient=g.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#172326');gradient.addColorStop(.55,'#111a1d');gradient.addColorStop(1,'#0b1113');
  g.fillStyle=gradient;g.fillRect(0,0,4,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  return texture;
}
// Fade a GridHelper's lines by distance from its centre (local XZ), keeping its colours.
export function fadeGrid(grid,inner,outer,opacity=1){
  const material=grid.material;material.transparent=true;material.depthWrite=false;material.opacity=opacity;
  material.onBeforeCompile=shader=>{
    shader.uniforms.fadeRange={value:new THREE.Vector2(inner,outer)};
    shader.vertexShader='varying float vFadeRadius;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFadeRadius=length(position.xz);');
    shader.fragmentShader='uniform vec2 fadeRange;varying float vFadeRadius;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.-smoothstep(fadeRange.x,fadeRange.y,vFadeRadius);');
  };
  material.customProgramCacheKey=()=>'fade-grid';material.needsUpdate=true;
  return grid;
}
// three r186 OrbitControls reads a missing touch position (and throws) when a pointerup/
// pointercancel arrives for a pointer it never tracked while a mouse or pen is down,
// e.g. a rejected palm touch mid-stroke. Only forward events for tracked pointers.
export function hardenOrbit(controls){
  const up=controls._onPointerUp;if(typeof up!=='function'||typeof controls._isTrackingPointer!=='function')return controls;
  controls.disconnect();controls._onPointerUp=event=>{if(controls._isTrackingPointer(event))up(event);};controls.connect(controls.domElement);
  return controls;
}
