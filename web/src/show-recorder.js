// Real-time canvas recording. Source JSON remains the editable show document.
const $=id=>document.getElementById(id);
export class ShowRecorder{
  active=false;
  constructor(player){this.player=player;$('show-record').onclick=()=>this.active?this.finish(true,'Recording cancelled.'):this.start();}
  available(){return typeof MediaRecorder!=='undefined'&&typeof this.player.canvas.captureStream==='function';}
  reset(){const supported=this.available();$('show-record').disabled=!supported;$('show-record').textContent='Record video';$('show-record-status').textContent=supported?'Silent video · real time · keep this tab visible':'Canvas recording is unavailable in this browser.';}
  start(){
    if(!this.available()||!this.player.active||this.active||this.recorder)return;
    const p=this.player;this.cancelled=false;this.chunks=[];this.bytes=0;
    try{
      const mime=['video/webm;codecs=vp8','video/webm','video/webm;codecs=vp9','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
      if(!mime)throw new Error('This browser has no supported video recording format.');
      this.saved={camera:p.camera.clone(),target:p.orbit.target.clone(),ratio:p.renderer.getPixelRatio(),rate:p.clock.rate,frontMode:p.frontMode};
      this.active=true;p.orbit.enabled=false;p.clock.pause(performance.now());p.clock.speed(1,performance.now());p.clock.seek(0,performance.now());
      p.renderer.setPixelRatio(1);p.renderer.setSize(1280,720,false);p.camera.clearViewOffset();p.camera.aspect=16/9;p.front();p.camera.updateProjectionMatrix();p.canvas.style.objectFit='contain';
      p.force=true;p.render(performance.now());this.stream=p.canvas.captureStream(30);this.stream.getTracks().forEach(t=>t.addEventListener('ended',()=>this.finish(true,'Canvas capture ended. No incomplete video was saved.')));
      const recorder=this.recorder=new MediaRecorder(this.stream,{mimeType:mime,videoBitsPerSecond:4000000});
      recorder.ondataavailable=e=>{if(e.data.size&&!this.cancelled){this.bytes+=e.data.size;if(this.bytes>160*1024*1024){this.fail('Video exceeded the 160 MiB recording budget. Try a shorter show.');return;}this.chunks.push(e.data);}};
      recorder.onerror=()=>this.fail('Recording failed. Try a shorter show or another browser.');
      recorder.onstop=()=>{
        if(this.active)this.finish(true,'Recording stopped early. No incomplete video was saved.');
        const cancelled=this.cancelled,chunks=this.chunks;this.recorder=null;this.chunks=[];
        if(!cancelled&&chunks.length){const blob=new Blob(chunks,{type:recorder.mimeType}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='draw-in-3d-show.'+(recorder.mimeType.includes('mp4')?'mp4':'webm');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('show-record-status').textContent='Video downloaded · '+Math.round(blob.size/1024/1024)+' MiB';}
        else if(!cancelled)$('show-record-status').textContent='No video frames were recorded. Try another browser.';
      };
      this.lock(true);recorder.start(1000);p.clock.play(performance.now());$('show-record').textContent='Cancel recording';$('show-record-status').textContent='Recording from takeoff… keep this tab visible.';p.refresh();
    }catch(error){this.finish(true,error.message);if(this.recorder?.state==='inactive')this.recorder=null;$('show-record-status').textContent=error.message;}
  }
  lock(locked){
    for(const id of ['show-pause','show-restart','show-speed','show-trails','show-front','show-scrub'])$(id).disabled=locked;
    for(const b of $('show-cues').children)b.disabled=locked;
  }
  fail(message){this.cancelled=true;this.chunks=[];if(this.active)this.finish(true,message);else $('show-record-status').textContent=message;}
  frame(){if(!this.active)return;const p=this.player;$('show-record-status').textContent=`Recording ${Math.round(100*p.clock.time/p.show.duration)}% · 720p · keep this tab visible`;if(p.clock.time>=p.show.duration&&!this.endTimer)this.endTimer=setTimeout(()=>this.finish(false),150);}
  finish(cancel=true,message='Recording interrupted; no incomplete video was saved.'){
    if(!this.active)return;this.active=false;this.cancelled=cancel;clearTimeout(this.endTimer);this.endTimer=null;
    const p=this.player;p.clock.pause(performance.now());this.lock(false);
    if(this.recorder&&this.recorder.state!=='inactive')this.recorder.stop();
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    if(this.saved){p.camera.copy(this.saved.camera);p.orbit.target.copy(this.saved.target);p.frontMode=this.saved.frontMode;p.renderer.setPixelRatio(this.saved.ratio);p.renderer.setSize(p.canvas.clientWidth,p.canvas.clientHeight,false);p.clock.speed(this.saved.rate,performance.now());p.resize(p.canvas.clientWidth/p.canvas.clientHeight);this.saved=null;}
    p.canvas.style.objectFit='';p.orbit.enabled=true;$('show-record').textContent='Record video';$('show-record-status').textContent=cancel?message:'Finishing video…';p.refresh();
  }
}
