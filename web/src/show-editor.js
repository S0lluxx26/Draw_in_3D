import {clone} from './model.js';
import {drawingPaths,placePaths} from './drone-show.js';
import {newShow,newCue,editableDemo,captureArtwork,fitArtwork,ShowHistory,SHOW_LIMITS,encodeShow,decodeShow,cueFormation,showDuration} from './show-project.js';
import {createDraftStore,DraftWriter} from './drafts.js';
const $=id=>document.getElementById('author-'+id);
const button=(label,work)=>{const b=document.createElement('button');b.textContent=label;b.onclick=work;return b;};
export function downloadShowFile(text,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download=name.replace(/[^\w .-]/g,'_')+'.show.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}

export class ShowEditor{
  constructor(hooks){
    this.hooks=hooks;this.state=new ShowHistory(editableDemo());this.active=this.doc.cues[0].id;this.selections=new WeakMap();this.revision=0;this.draftId=crypto.randomUUID();
    document.body.insertAdjacentHTML('beforeend',`<dialog id="author-dialog" aria-labelledby="author-heading">
      <header class="author-head"><div><span class="eyebrow">DRAW → ARRANGE → PERFORM</span><h2 id="author-heading">Show editor</h2></div><button id="author-close">Back to drawing</button></header>
      <nav class="author-toolbar" aria-label="Show files"><button id="author-new">New show</button><button id="author-demo">Edit demo</button><button id="author-open">Open show</button><button id="author-save">Save show ↗</button><button id="author-recover">Show drafts</button><button id="author-help">How to make a show</button></nav>
      <div class="author-title"><label>Show name <input id="author-name" maxlength="64"></label><span id="author-total"></span><button id="author-undo" aria-label="Undo show edit">↶</button><button id="author-redo" aria-label="Redo show edit">↷</button><button id="author-play" class="primary">▶ Play my show</button></div>
      <p id="author-status" role="status">Edit the demo or capture your own drawing.</p><p id="author-storage" role="status">Show drafts stay in this browser. Save show for a lasting backup.</p>
      <section id="author-recovery" hidden><h3>Show drafts</h3><div id="author-drafts"></div><button id="author-recovery-close">Close drafts</button></section>
      <div class="author-layout"><section class="author-story"><div class="author-section-head"><h3>Storyboard</h3><span>256 drones</span></div><p class="author-bookend">↑ Automatic takeoff · 8s</p><div id="author-cards"></div><div class="author-add"><button id="author-blank">＋ Draw a formation</button><button id="author-capture">＋ Current drawing</button><button id="author-selection">＋ Selected ink</button></div><p class="author-bookend">✦ Fireworks → ↓ Landing</p></section>
      <section class="author-stage"><canvas id="author-preview" width="680" height="440" aria-label="Front view of sampled drone formation"></canvas><p id="author-preview-note"></p><div class="author-stage-actions"><button id="author-edit" class="primary">✎ Edit drawing</button><button id="author-formation-preview">View in 3D</button><button id="author-fit">Fit to stage</button></div><p class="hint">Dots follow stroke centre lines and colours. Curved sheets retain depth. Images, blocks, brush thickness and paper backgrounds do not become drones.</p></section>
      <section class="author-properties"><h3>Formation</h3><fieldset id="author-fields"><label>Name<input id="author-cue-name" maxlength="64"></label><div class="author-pair"><label>Display · seconds<input id="author-hold" type="number" min="2" max="60" step="0.5"></label><label>Transition · seconds<input id="author-transfer" type="number" min="2" max="30" step="0.5"></label></div><label>Light reveal<select id="author-light"><option value="fade">Fade in</option><option value="draw-on">Draw on in stroke order</option><option value="bottom-up">Bottom to top</option></select></label><label>Brightness<input id="author-brightness" type="number" min="0.1" max="1" step="0.1"></label><p class="hint">Lights fade out before each transfer and reveal after arrival.</p><h4>Placement in the sky</h4><div class="author-triple"><label>X<input id="author-x" type="number" min="-20" max="20" step="1"></label><label>Height<input id="author-y" type="number" min="6" max="34" step="1"></label><label>Depth<input id="author-z" type="number" min="-20" max="20" step="1"></label></div><div class="author-pair"><label>Scale<input id="author-scale" type="number" min="0.1" max="100" step="0.5"></label><label>Rotation · °<input id="author-yaw" type="number" min="-180" max="180" step="5"></label></div><div class="author-actions"><button id="author-left">↑ Earlier</button><button id="author-right">↓ Later</button><button id="author-duplicate">Duplicate</button><button id="author-delete">Delete</button></div></fieldset>
      <h3>Finale</h3><label class="author-check"><input id="author-fireworks" type="checkbox"> Light fireworks</label><div class="author-pair"><label>Duration · s<input id="author-fire-duration" type="number" min="2" max="20" step="1"></label><label>Radius<input id="author-fire-radius" type="number" min="2" max="8" step="0.5"></label></div><p class="hint">A visual simulation. Trajectories are not validated for real aircraft.</p></section></div>
      <div id="author-timeline" aria-label="Show sequence and duration"></div><input id="author-file" type="file" accept=".json,application/json" hidden>
    </dialog><dialog id="author-guide" aria-labelledby="author-guide-title"><h2 id="author-guide-title">Your first sky story</h2>
      <ol><li>Choose <strong>Edit demo</strong>. Robot, Fish and Eiffel Tower are ordinary editable drawings.</li><li>Select Robot and click <strong>Edit drawing</strong>. Use Select or Box select to pick lines and change their colour, move them or erase them. Draw, Line, Curve, Rectangle and Ellipse add new ink. Use Undo as needed.</li><li>Click <strong>Save formation & return</strong>. The original workspace is restored. The formation keeps its sky placement; use <strong>Fit to stage</strong> only when you want a new size and centre.</li><li>Choose Fish and change its artwork. To replace the tower, erase its strokes and draw a heart. Hidden paper is still a drawing guide; its ink appears in the show.</li><li>Use <strong>Earlier / Later</strong> to arrange cards. Set display and transition durations. Choose Fade, Draw on, or Bottom to top. Adjust the fireworks finale.</li><li>Click <strong>Play my show</strong>. Scrub or click a formation to inspect it. <strong>Record video</strong> restarts at 1× and records the canvas in real time; keep this tab visible until landing.</li><li><strong>Save show</strong> downloads an editable .show.json file. <strong>Open show</strong> resumes it in a desktop or mobile browser. Video is a separate result. Native Android drawing import does not read show files.</li></ol>
      <p><strong>Start from your own drawing:</strong> open Show editor, choose New show, then Current drawing or Selected ink. Selecting a paper includes its attached strokes. Draw a formation starts a blank guide. One formation can contain ink on several curved or oriented sheets.</p><p><strong>Recovery:</strong> show drafts are separate from drawing drafts. During artwork editing they save committed strokes too. Browser storage is not a backup; export files. Cancel editing restores the previous formation. Replacing the show with New or Edit demo is undoable.</p><p><strong>Limits:</strong> 12 formations, 256 drones, 80 objects / 4,000 source points per formation. Tiny details may receive very few dots. Scale and position must fit the preview stage. Transfer matching shortens travel; it does not avoid collisions.</p><button id="author-guide-close" class="primary">Got it</button></dialog>`);
    this.store=createDraftStore(globalThis.indexedDB,'draw-in-3d-show-drafts');
    this.writer=new DraftWriter(this.store,(id,state,error)=>{if(id===this.draftId)$('storage').textContent=state==='saved'?'Show draft saved in this browser · Save show for a lasting backup':state==='error'?error.message:state==='pending'?'Show draft pending…':'Saving show draft…';});
    const run=fn=>()=>{try{fn();}catch(e){this.render();this.report(e.message,true);}};
    $('close').onclick=()=>this.close();$('dialog').oncancel=()=>this.cancelCompile();
    $('help').onclick=()=>$('guide').showModal();$('guide-close').onclick=()=>$('guide').close();
    $('new').onclick=run(()=>this.replace(newShow()));$('demo').onclick=run(()=>this.replace(editableDemo()));
    $('name').onchange=run(()=>this.change({...this.doc,name:$('name').value.trim()}));
    $('undo').onclick=()=>this.travel(true);$('redo').onclick=()=>this.travel(false);
    $('save').onclick=run(()=>{downloadShowFile(encodeShow(this.doc),this.doc.name);this.dirty=false;this.report('Editable show downloaded.');});
    $('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0],revision=this.revision;e.target.value='';if(!file)return;try{if(file.size>SHOW_LIMITS.bytes)throw new Error('Show exceeds 16 MiB.');const doc=decodeShow(await file.text());if(revision!==this.revision)throw new Error('The show changed while this file was loading. Open the file again when ready.');this.replace(doc);}catch(error){this.report(error.message,true);}};
    $('recover').onclick=()=>this.recover();$('recovery-close').onclick=()=>$('recovery').hidden=true;
    $('blank').onclick=run(()=>{this.add(newCue());this.edit();});
    for(const [id,selected]of [['capture',false],['selection',true]])$(id).onclick=run(()=>{const source=this.hooks.capture(selected);const artwork=captureArtwork(source.entities,selected?source.selected:undefined);if(!artwork.some(e=>e.type==='stroke'))throw new Error('Choose some ink in the drawing workspace first.');this.add(newCue(artwork,'Formation '+(this.doc.cues.length+1)));});
    $('edit').onclick=run(()=>this.edit());$('fit').onclick=run(()=>this.updateCue({placement:fitArtwork(this.cue.artwork)}));
    $('cue-name').onchange=run(()=>this.updateCue({name:$('cue-name').value.trim()}));
    for(const key of ['hold','transfer','brightness'])$(key).onchange=run(()=>this.updateCue({[key]:Number($(key).value)}));
    $('light').onchange=run(()=>this.updateCue({light:$('light').value}));
    for(const [k,id]of ['x','y','z'].entries())$(id).onchange=run(()=>{const p=this.cue.placement;this.updateCue({placement:{...p,position:p.position.map((v,i)=>i===k?Number($(id).value):v)}});});
    for(const key of ['scale','yaw'])$(key).onchange=run(()=>this.updateCue({placement:{...this.cue.placement,[key]:Number($(key).value)}}));
    $('left').onclick=()=>this.move(-1);$('right').onclick=()=>this.move(1);
    $('duplicate').onclick=run(()=>this.add({...clone(this.cue),id:crypto.randomUUID(),name:(this.cue.name+' copy').slice(0,64)}));
    $('delete').onclick=run(()=>this.change({...this.doc,cues:this.doc.cues.filter(c=>c.id!==this.active)}));
    for(const id of ['fireworks','fire-duration','fire-radius'])$(id).onchange=run(()=>this.change({...this.doc,fireworks:{enabled:$('fireworks').checked,duration:Number($('fire-duration').value),radius:Number($('fire-radius').value)}}));
    $('play').onclick=()=>this.play();$('formation-preview').onclick=()=>this.play(true);
    $('dialog').addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.travel(!e.shiftKey);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.writer.flush();});
    window.addEventListener('beforeunload',e=>{if(this.dirty){e.preventDefault();e.returnValue='';}});
  }
  get doc(){return this.state.doc;}get cue(){return this.doc.cues.find(c=>c.id===this.active);}
  report(message,error=false){$('status').textContent=message;$('status').classList.toggle('author-error',error);}
  open(){if(!$('dialog').open){this.render();$('dialog').showModal();}}
  close(){this.cancelCompile();$('dialog').close();this.hooks.closed?.();}
  change(doc,active=this.active){this.selections.set(this.doc,this.active);this.state.set(doc);this.active=active;this.changed();this.selections.set(this.doc,this.active);}
  changed(){this.cancelCompile();if(!this.cue)this.active=this.doc.cues[0]?.id;this.dirty=true;this.queueDraft();this.render();this.report('Show updated. Preview uses the latest saved formations.');}
  replace(doc){void this.writer.flush();this.draftId=crypto.randomUUID();this.change(doc);}
  queueDraft(doc=this.doc){const saved=doc,id=this.draftId,updatedAt=Date.now();this.writer.enqueue(id,()=>({id,kind:'show',name:saved.name,updatedAt,objects:saved.cues.length,text:encodeShow(saved)}));}
  sessionChanged(entities){if(!this.editing)return;this.dirty=true;const artwork=captureArtwork(entities);this.queueDraft({...this.doc,cues:this.doc.cues.map(c=>c.id===this.editing?{...c,artwork}:c)});}
  travel(back){this.selections.set(this.doc,this.active);if(this.state.travel(back)){this.active=this.selections.get(this.doc);this.changed();}}
  updateCue(patch){this.change({...this.doc,cues:this.doc.cues.map(c=>c.id===this.active?{...c,...patch}:c)});}
  add(cue){if(this.doc.cues.length>=SHOW_LIMITS.cues)throw new Error('A show can contain at most 12 formations.');this.change({...this.doc,cues:[...this.doc.cues,cue]},cue.id);}
  move(delta){const i=this.doc.cues.findIndex(c=>c.id===this.active),j=i+delta;if(i<0||j<0||j>=this.doc.cues.length)return;const cues=[...this.doc.cues];[cues[i],cues[j]]=[cues[j],cues[i]];this.change({...this.doc,cues});}
  edit(){if(!this.cue)return;this.cancelCompile();this.editing=this.active;this.hooks.edit(clone(this.cue.artwork),this.cue.name,(artwork,cancel)=>{if(!cancel)this.updateCue({artwork:captureArtwork(artwork)});else this.queueDraft();this.editing=null;this.open();});$('dialog').close();}
  cancelCompile(){this.revision++;if(this.worker){this.worker.terminate();this.report('Preview preparation cancelled. Your show is still editable.');}this.worker=null;clearTimeout(this.compileTimer);$('play').disabled=!this.doc.cues.length;$('play').textContent='▶ Play my show';}
  play(formationOnly=false){
    if(!this.doc.cues.length)return;this.cancelCompile();const revision=this.revision,active=this.active;
    this.report('Preparing trajectories… You can keep editing; edits cancel this preview.');$('play').disabled=true;$('play').textContent='Preparing…';
    try{
      const worker=this.worker=new Worker(new URL('./show-worker.js',import.meta.url),{type:'module'});
      const fail=message=>{if(revision!==this.revision)return;this.cancelCompile();this.report(message,true);};
      this.compileTimer=setTimeout(()=>fail('Preview took too long. Reduce artwork complexity and try again.'),30000);
      worker.onerror=()=>fail('Could not prepare the show. Reload this page and try again.');
      worker.onmessage=({data})=>{if(data.revision!==this.revision)return;if(data.error){fail(data.error);return;}this.cancelCompile();this.report('Preview ready. Edit a card to change the next performance.');$('dialog').close();try{const index=this.doc.cues.findIndex(c=>c.id===active);this.hooks.play(data.show,()=>this.open(),formationOnly?data.show.cues[index+1].time:undefined);}catch(error){this.open();this.report(error.message,true);}};
      worker.postMessage({revision,doc:this.doc});
    }catch(error){this.cancelCompile();this.report(error.message,true);}
  }
  async recover(){
    $('recovery').hidden=false;$('drafts').textContent='Loading…';
    try{await this.writer.flush();let stored=[];try{stored=await this.store.list();}catch(error){this.report(error.message+' Memory-only drafts are listed below; download them before closing.',true);}const rows=new Map(stored.map(r=>[r.id,r]));for(const [id,job]of this.writer.failed)rows.set(id,{...job.create(),unsaved:true});$('drafts').replaceChildren();
      for(const row of [...rows.values()].sort((a,b)=>b.updatedAt-a.updatedAt)){
        const item=document.createElement('div');item.className='author-draft';const label=document.createElement('span');label.textContent=`${row.name} · ${new Date(row.updatedAt).toLocaleString()}${row.unsaved?' · only in memory':''}`;
        const load=download=>this.loadDraft(row.id,download);
        item.append(label,button('Restore',()=>load()),button('Download',()=>load(true)));$('drafts').append(item);
      }if(!rows.size)$('drafts').textContent='No show drafts yet. Editing a show creates one.';
    }catch(error){$('drafts').textContent=error.message;}
  }
  async loadDraft(id,download=false){
    const revision=this.revision;
    try{const record=this.writer.failed.get(id)?.create()||await this.store.get(id);if(!record)throw new Error('Draft no longer exists.');const doc=decodeShow(record.text);
      if(download)downloadShowFile(encodeShow(doc),doc.name);
      else{if(revision!==this.revision)throw new Error('The show changed while the draft was loading. Restore it again when ready.');this.replace(doc);$('recovery').hidden=true;}
    }catch(error){this.report(error.message,true);}
  }
  render(){
    const c=this.cue; $('name').value=this.doc.name;$('total').textContent=`${this.doc.cues.length} / 12 formations · ${showDuration(this.doc)}s`;
    $('undo').disabled=!this.state.past.length;$('redo').disabled=!this.state.future.length;$('play').disabled=!this.doc.cues.length;
    $('cards').replaceChildren();let time=8;
    for(const [index,cue]of this.doc.cues.entries()){
      const card=button('',()=>{this.active=cue.id;this.render();});card.className='author-card'+(cue.id===this.active?' active':'');card.dataset.cueId=cue.id;card.setAttribute('aria-pressed',String(cue.id===this.active));
      card.draggable=true;card.ondragstart=e=>{e.dataTransfer.setData('text/plain',cue.id);e.dataTransfer.effectAllowed='move';};card.ondragover=e=>e.preventDefault();card.ondrop=e=>{e.preventDefault();e.stopPropagation();const source=this.doc.cues.find(c=>c.id===e.dataTransfer.getData('text/plain'));if(!source||source.id===cue.id)return;const cues=this.doc.cues.filter(c=>c!==source);cues.splice(cues.findIndex(c=>c.id===cue.id),0,source);this.change({...this.doc,cues},source.id);};
      const thumb=document.createElement('canvas');thumb.width=140;thumb.height=90;this.paint(thumb,cue,true);const text=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=`${index+1}. ${cue.name}`;detail.textContent=`${time}s → ${time+cue.transfer}s · hold ${cue.hold}s`;text.append(title,detail);card.append(thumb,text);$('cards').append(card);time+=cue.transfer+cue.hold;
    }
    $('fields').disabled=!c;for(const id of ['edit','formation-preview','fit'])$(id).disabled=!c;
    for(const id of ['blank','capture','selection'])$(id).disabled=this.doc.cues.length>=SHOW_LIMITS.cues;
    if(c){$('cue-name').value=c.name;for(const key of ['hold','transfer','brightness','light'])$(key).value=c[key];['x','y','z'].forEach((key,i)=>$(key).value=c.placement.position[i]);for(const key of ['scale','yaw'])$(key).value=+c.placement[key].toFixed(3);const i=this.doc.cues.indexOf(c);$('left').disabled=i===0;$('right').disabled=i===this.doc.cues.length-1;$('duplicate').disabled=this.doc.cues.length>=SHOW_LIMITS.cues;}
    $('fireworks').checked=this.doc.fireworks.enabled;$('fire-duration').value=this.doc.fireworks.duration;$('fire-radius').value=this.doc.fireworks.radius;
    $('fire-duration').disabled=$('fire-radius').disabled=!this.doc.fireworks.enabled;
    this.paint($('preview'),c);
    $('timeline').replaceChildren();for(const [label,duration]of [['Takeoff',8],...this.doc.cues.flatMap(c=>[['Transfer',c.transfer],[c.name,c.hold]]),...(this.doc.fireworks.enabled?[['Firework launch',7],['Fireworks',this.doc.fireworks.duration]]:[]),['Return / land',17]]){const part=document.createElement('span');part.textContent=label+' · '+duration+'s';part.style.flexGrow=duration;part.title=part.textContent;$('timeline').append(part);}
  }
  paint(canvas,c,thumbnail=false){
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#07111c';ctx.fillRect(0,0,w,h);
    if(!c){if(!thumbnail)$('preview-note').textContent='Add a drawing to begin your show.';return;}
    try{
      const f=cueFormation(c),paths=placePaths(drawingPaths(c.artwork),c.placement);let minX=-34,maxX=34,minY=0,maxY=46;
      if(thumbnail){const p=f.positions;minX=Math.min(...p.map(v=>v[0]))-1;maxX=Math.max(...p.map(v=>v[0]))+1;minY=Math.min(...p.map(v=>v[1]))-1;maxY=Math.max(...p.map(v=>v[1]))+1;}
      const s=Math.min((w-24)/(maxX-minX),(h-24)/(maxY-minY)),ox=(w-(maxX-minX)*s)/2,oy=(h-(maxY-minY)*s)/2;
      const xy=p=>[ox+(p[0]-minX)*s,h-oy-(p[1]-minY)*s];
      if(!thumbnail){ctx.strokeStyle='#193142';ctx.lineWidth=1;for(let y=0;y<=46;y+=5){ctx.beginPath();ctx.moveTo(...xy([-34,y]));ctx.lineTo(...xy([34,y]));ctx.stroke();}ctx.fillStyle='#6e91a8';ctx.font='12px sans-serif';ctx.fillText('FRONT / SKY STAGE',16,24);}
      ctx.lineWidth=.7;for(const path of paths){ctx.beginPath();path.points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](...xy(p)));ctx.strokeStyle='rgba(135,190,209,.2)';ctx.stroke();}
      for(let i=0;i<f.positions.length;i++){ctx.fillStyle=`rgb(${f.colors[i].map(v=>Math.round(v*255)).join(' ')})`;ctx.beginPath();ctx.arc(...xy(f.positions[i]),thumbnail?1:2,0,Math.PI*2);ctx.fill();}
      if(!thumbnail){const sparse=paths.filter(p=>p.points.length>1&&p.points.reduce((n,p1,i)=>i?n+Math.hypot(...p1.map((v,k)=>v-p.points[i-1][k])):0,0)<.5).length;$('preview-note').textContent=`${c.name} · 256 sampled lights · ${paths.length} paths${sparse?' · Small details: inspect the dots':''}`;}
    }catch(error){ctx.fillStyle='#9bb3bf';ctx.font='13px sans-serif';ctx.fillText('Draw your formation',16,h/2);if(!thumbnail)$('preview-note').textContent=error.message;}
  }
}
