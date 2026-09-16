// Inspect raster headers before allocating pixels. Embedded projects never load URLs/SVG.
export function rasterSize(bytes) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length>=24 && v.getUint32(0)===0x89504e47 && v.getUint32(4)===0x0d0a1a0a && v.getUint32(12)===0x49484452) return [v.getUint32(16),v.getUint32(20)];
  if(bytes.length>4 && bytes[0]===255 && bytes[1]===216){
    let i=2;
    while(i+4<=bytes.length){
      if(bytes[i++]!==255)break;
      while(bytes[i]===255)i++;
      const marker=bytes[i++];
      if(marker===0xda||marker===0xd9)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if(i+2>bytes.length)break;
      const length=v.getUint16(i);if(length<2||i+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8) return [v.getUint16(i+5),v.getUint16(i+3)];
      i+=length;
    }
  }
  throw new Error('Use a valid PNG or JPEG image.');
}
function bytesOf(base64) { return Uint8Array.from(atob(base64),c=>c.charCodeAt(0)); }
async function loadImage(bytes) {
  const url=URL.createObjectURL(new Blob([bytes]));
  try { const img=new Image();img.src=url;await img.decode();return img; }
  finally { URL.revokeObjectURL(url); }
}
export async function prepareImages(entities, previous=new Map()) {
  const images=new Map();
  for(const e of entities)if(e.type==='image'){
    let img=previous.get(e.image);
    if(!img){
      const bytes=bytesOf(e.image),[w,h]=rasterSize(bytes);
      if(w<1||h<1||w>1024||h>1024)throw new Error('Embedded images must be at most 1024 pixels on each edge.');
      img=await loadImage(bytes);
    }
    if(Math.abs(img.naturalWidth/img.naturalHeight-e.aspect)>.03)throw new Error('Embedded image dimensions do not match the project.');
    images.set(e.image,img);
  }
  return images;
}
export async function importPhoto(file) {
  if(file.size>20*1024*1024)throw new Error('Choose a PNG or JPEG smaller than 20 MiB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),[w,h]=rasterSize(bytes);
  if(w<1||h<1||w>32768||h>32768||w*h>50000000||w/h<.1||w/h>10)throw new Error('Use an image below 50 megapixels with aspect ratio between 1:10 and 10:1.');
  const bitmap=await createImageBitmap(new Blob([bytes]),{imageOrientation:'from-image',resizeWidth:Math.max(1,Math.round(w*Math.min(1,1024/Math.max(w,h)))),resizeQuality:'high'});
  try {
    const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    let payload=canvas.toDataURL('image/png').split(',')[1];
    // Busy photos can exceed Android's PNG budget; downsize until portable.
    while(payload.length>2000000 && Math.max(canvas.width,canvas.height)>128){
      const small=document.createElement('canvas');small.width=Math.max(1,Math.floor(canvas.width*.75));small.height=Math.max(1,Math.floor(canvas.height*.75));
      small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
      canvas.width=small.width;canvas.height=small.height;canvas.getContext('2d').drawImage(small,0,0);
      payload=canvas.toDataURL('image/png').split(',')[1];
    }
    return {image:payload,aspect:canvas.width/canvas.height};
  }finally{bitmap.close();}
}
