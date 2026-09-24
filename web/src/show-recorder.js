// Real-time canvas recording. Source JSON remains the editable show document.
const $=id=>document.getElementById(id);
// Status messages; the idle hint is marked so phones can hide it and keep the view clear.
const note=(idle=false)=>{const s=$('show-record-status');s.toggleAttribute?.('data-idle',idle);return s;};
// The whole show must fit the in-memory budget: bitrate adapts to its length, with 20% headroom for encoder overshoot.
// The music track shares that budget.
const BUDGET=160*1024*1024,MAX_BITS=4e6,MIN_BITS=8e5,AUDIO_BITS=128000;
export const recordingBitrate=duration=>Math.min(MAX_BITS,.8*BUDGET*8/duration);
// Chrome's MediaRecorder writes WebM without a duration, so players show no length and may not seek. Insert
// Segment > Info > Duration before the download. Only the small header is read; the video data is reused as
// Blob slices. Anything unexpected (SeekHead offsets that would shift, an existing duration) keeps the original.
const vint=(b,o)=>{let len=1;while(len<=8&&!(b[o]&(0x80>>(len-1))))len++;if(len>8)throw new Error('bad EBML');let v=b[o]&(0xff>>len),ones=v===(0xff>>len);for(let i=1;i<len;i++){v=v*256+b[o+i];ones&&=b[o+i]===255;}return {v,len,unknown:ones};};
const vintBytes=(v,len)=>{if(v>=2**(7*len)-1)throw new Error('size too large');const out=new Uint8Array(len);for(let i=len-1;i>=0;i--){out[i]=v%256;v=Math.floor(v/256);}out[0]|=1<<(8-len);return out;};
function ebml(b,o){const first=b[o];let idLen=1;while(idLen<=4&&!(first&(0x80>>(idLen-1))))idLen++;if(idLen>4)throw new Error('bad EBML id');let id=0;for(let i=0;i<idLen;i++)id=id*256+b[o+i];
  const size=vint(b,o+idLen),data=o+idLen+size.len;return {id,start:o,idLen,size:size.v,sizeLen:size.len,unknown:size.unknown,data,end:size.unknown?Infinity:data+size.v};}
export async function withWebmDuration(blob,ms){
  try{
    const head=new Uint8Array(await blob.slice(0,65536).arrayBuffer()),header=ebml(head,0);if(header.id!==0x1A45DFA3)return blob;
    const segment=ebml(head,header.end);if(segment.id!==0x18538067)return blob;
    let info=null;for(let o=segment.data;o<head.length-12;){const e=ebml(head,o);if(e.id===0x114D9B74)return blob;if(e.id===0x1549A966){info=e;break;}if(e.id===0x1F43B675||e.unknown)break;o=e.end;}
    if(!info||info.end>head.length)return blob;
    let scale=1e6;for(let o=info.data;o<info.end;){const e=ebml(head,o);if(e.id===0x4489)return blob;if(e.id===0x2AD7B1){scale=0;for(let i=e.data;i<e.end;i++)scale=scale*256+head[i];}o=e.end;}
    const duration=new Uint8Array(11);duration.set([0x44,0x89,0x88]);new DataView(duration.buffer).setFloat64(3,ms*1e6/scale);// timecode units
    const grow=duration.length,need=v=>{let l=1;while(v>=2**(7*l)-1)l++;return l;},infoSize=vintBytes(info.size+grow,Math.max(info.sizeLen,need(info.size+grow)));
    const prefix=head.slice(0,info.start);
    if(!segment.unknown){const bytes=vintBytes(segment.size+grow+infoSize.length-info.sizeLen,segment.sizeLen);prefix.set(bytes,segment.start+segment.idLen);}
    return new Blob([prefix,head.slice(info.start,info.start+info.idLen),infoSize,blob.slice(info.data,info.end),duration,blob.slice(info.end)],{type:blob.type});
  }catch{return blob;}
}
export class ShowRecorder{
  active=false;
  constructor(player){this.player=player;$('show-record').onclick=()=>this.active?this.finish(true,'Recording cancelled.'):this.start();}
  available(){return typeof MediaRecorder!=='undefined'&&typeof this.player.canvas.captureStream==='function';}
  // Recording waits for the scenery too, so every video starts on the same opening shot.
  reset(){const supported=this.available();$('show-record').disabled=!supported||!!this.player.waiting;$('show-record').textContent='Record video';note(supported).textContent=supported?(this.player.music?.enabled?'Video with music':'Silent video')+' · real time · keep this tab visible':'Canvas recording is unavailable in this browser.';}
  start(){
    if(!this.available()||!this.player.active||this.player.waiting||this.active||this.recorder)return;
    const bits=recordingBitrate(this.player.show?.duration);
    if(!(bits>=MIN_BITS)){note().textContent=`This show is too long to record within the 160 MiB video budget (about ${Math.floor(.8*BUDGET*8/MIN_BITS/60)} minutes at minimum quality). Shorten it, then record again.`;return;}
    const p=this.player;this.cancelled=false;this.chunks=[];this.bytes=0;
    try{
      const audio=p.music?.capture?.()??null,mime=(audio?['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm','video/mp4']:['video/webm;codecs=vp8','video/webm','video/webm;codecs=vp9','video/mp4']).find(t=>MediaRecorder.isTypeSupported(t));
      if(!mime){p.music?.release?.();throw new Error('This browser has no supported video recording format.');}
      this.saved={camera:p.camera.clone(),target:p.orbit.target.clone(),ratio:p.renderer.getPixelRatio(),rate:p.clock.rate,frontMode:p.frontMode};
      this.active=true;p.orbit.enabled=false;p.clock.pause(performance.now());p.clock.speed(1,performance.now());p.clock.seek(0,performance.now());
      p.renderer.setPixelRatio(1);p.renderer.setSize(1280,720,false);p.camera.clearViewOffset();p.camera.aspect=16/9;p.front();p.camera.updateProjectionMatrix();p.canvas.style.objectFit='contain';
      p.force=true;p.render(performance.now());this.stream=p.canvas.captureStream(30);this.stream.getTracks().forEach(t=>t.addEventListener('ended',()=>this.finish(true,'Canvas capture ended. No incomplete video was saved.')));if(audio)this.stream.addTrack(audio);
      const recorder=this.recorder=new MediaRecorder(this.stream,{mimeType:mime,videoBitsPerSecond:Math.floor(bits-(audio?AUDIO_BITS:0)),...audio?{audioBitsPerSecond:AUDIO_BITS}:{}});
      recorder.ondataavailable=e=>{if(e.data.size&&!this.cancelled){this.bytes+=e.data.size;if(this.bytes>BUDGET){this.fail('Video exceeded the 160 MiB recording budget. Try a shorter show.');return;}this.chunks.push(e.data);}};
      recorder.onerror=()=>this.fail('Recording failed. Try a shorter show or another browser.');
      recorder.onstop=()=>{
        if(this.active)this.finish(true,'Recording stopped early. No incomplete video was saved.');
        const cancelled=this.cancelled,chunks=this.chunks;this.recorder=null;this.chunks=[];
        if(!cancelled&&chunks.length){const webm=!recorder.mimeType.includes('mp4'),raw=new Blob(chunks,{type:recorder.mimeType});note().textContent='Finishing video…';
          (webm?withWebmDuration(raw,this.elapsed):Promise.resolve(raw)).then(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='draw-in-3d-show.'+(webm?'webm':'mp4');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);note().textContent='Video downloaded · '+Math.round(blob.size/1024/1024)+' MiB';});}
        else if(!cancelled)note().textContent='No video frames were recorded. Try another browser.';
      };
      this.lock(true);recorder.start(1000);this.started=performance.now();p.clock.play(performance.now());$('show-record').textContent='Cancel recording';note().textContent=`Recording from takeoff${audio?' with music':''}… keep this tab visible.`;p.refresh();
    }catch(error){this.finish(true,error.message);if(this.recorder?.state==='inactive')this.recorder=null;note().textContent=error.message;}
  }
  lock(locked){
    for(const id of ['show-pause','show-restart','show-speed','show-trails','show-front','show-scrub','show-demo-settings'])$(id).disabled=locked;
    for(const b of $('show-cues').children)b.disabled=locked;
  }
  fail(message){this.cancelled=true;this.chunks=[];if(this.active)this.finish(true,message);else note().textContent=message;}
  frame(){if(!this.active)return;const p=this.player;note().textContent=`Recording ${Math.round(100*p.clock.time/p.show.duration)}% · 720p · keep this tab visible`;if(p.clock.time>=p.show.duration&&!this.endTimer)this.endTimer=setTimeout(()=>this.finish(false),150);}
  finish(cancel=true,message='Recording interrupted; no incomplete video was saved.'){
    if(!this.active)return;this.active=false;this.cancelled=cancel;this.elapsed=performance.now()-(this.started??performance.now());clearTimeout(this.endTimer);this.endTimer=null;
    const p=this.player;p.clock.pause(performance.now());this.lock(false);
    if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;p.music?.release?.();
    if(this.saved){p.camera.copy(this.saved.camera);p.orbit.target.copy(this.saved.target);p.frontMode=this.saved.frontMode;p.renderer.setPixelRatio(this.saved.ratio);p.renderer.setSize(p.canvas.clientWidth,p.canvas.clientHeight,false);p.clock.speed(this.saved.rate,performance.now());p.resize(p.canvas.clientWidth/p.canvas.clientHeight);this.saved=null;}
    p.canvas.style.objectFit='';p.orbit.enabled=true;$('show-record').textContent='Record video';note().textContent=cancel?message:'Finishing video…';p.refresh();
  }
}
