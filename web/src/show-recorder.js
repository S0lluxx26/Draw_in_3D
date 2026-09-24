// Real-time canvas recording. Source JSON remains the editable show document.
const $=id=>document.getElementById(id);
// Status messages; the idle hint is marked so phones can hide it and keep the view clear.
const note=(idle=false)=>{const s=$('show-record-status');s.toggleAttribute?.('data-idle',idle);return s;};
// The whole show must fit the in-memory budget: bitrate adapts to its length, with 20% headroom for encoder overshoot.
// The music track shares that budget.
const BUDGET=160*1024*1024,MAX_BITS=4e6,MIN_BITS=8e5,AUDIO_BITS=128000;
export const recordingBitrate=duration=>Math.min(MAX_BITS,.8*BUDGET*8/duration);
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
        if(!cancelled&&chunks.length){const blob=new Blob(chunks,{type:recorder.mimeType}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='draw-in-3d-show.'+(recorder.mimeType.includes('mp4')?'mp4':'webm');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);note().textContent='Video downloaded · '+Math.round(blob.size/1024/1024)+' MiB';}
        else if(!cancelled)note().textContent='No video frames were recorded. Try another browser.';
      };
      this.lock(true);recorder.start(1000);p.clock.play(performance.now());$('show-record').textContent='Cancel recording';note().textContent=`Recording from takeoff${audio?' with music':''}… keep this tab visible.`;p.refresh();
    }catch(error){this.finish(true,error.message);if(this.recorder?.state==='inactive')this.recorder=null;note().textContent=error.message;}
  }
  lock(locked){
    for(const id of ['show-pause','show-restart','show-speed','show-trails','show-front','show-scrub','show-demo-settings'])$(id).disabled=locked;
    for(const b of $('show-cues').children)b.disabled=locked;
  }
  fail(message){this.cancelled=true;this.chunks=[];if(this.active)this.finish(true,message);else note().textContent=message;}
  frame(){if(!this.active)return;const p=this.player;note().textContent=`Recording ${Math.round(100*p.clock.time/p.show.duration)}% · 720p · keep this tab visible`;if(p.clock.time>=p.show.duration&&!this.endTimer)this.endTimer=setTimeout(()=>this.finish(false),150);}
  finish(cancel=true,message='Recording interrupted; no incomplete video was saved.'){
    if(!this.active)return;this.active=false;this.cancelled=cancel;clearTimeout(this.endTimer);this.endTimer=null;
    const p=this.player;p.clock.pause(performance.now());this.lock(false);
    if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;p.music?.release?.();
    if(this.saved){p.camera.copy(this.saved.camera);p.orbit.target.copy(this.saved.target);p.frontMode=this.saved.frontMode;p.renderer.setPixelRatio(this.saved.ratio);p.renderer.setSize(p.canvas.clientWidth,p.canvas.clientHeight,false);p.clock.speed(this.saved.rate,performance.now());p.resize(p.canvas.clientWidth/p.canvas.clientHeight);this.saved=null;}
    p.canvas.style.objectFit='';p.orbit.enabled=true;$('show-record').textContent='Record video';note().textContent=cancel?message:'Finishing video…';p.refresh();
  }
}
