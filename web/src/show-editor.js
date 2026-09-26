import {clone} from './model.js';
import {drawingPaths,placePaths} from './drone-show.js';
import {newShow,newCue,demoShowDoc,demoCue,drawingCue,withDemoLook,captureArtwork,fitArtwork,ShowHistory,SHOW_LIMITS,encodeShow,decodeShow,cueFormation,showDuration,DEMO_FINALE,DEMO_TIMING,DEMO_LANDING,cueSequence,cueProblem,cueTimes} from './show-project.js';
const clock=s=>{const r=Math.round(s);return `${Math.floor(r/60)}:${String(r%60).padStart(2,'0')}`;};
// A card's problem is computed once per (immutable) formation.
const problems=new WeakMap(),problemOf=c=>{if(!problems.has(c))problems.set(c,cueProblem(c));return problems.get(c);};
import {FORMATIONS,FLEET_SIZES} from './demo-library.js';
import {FormationDesigner} from './formation-designer.js';
import {isDesign,designStrokes,designArtwork,designPlacement,flattenArtwork,fitStrokes} from './formation-design.js';
// "Edit demo" starts from the Demo exactly as it is set up in Demo settings on this device.
const savedDemoSettings=()=>{try{return JSON.parse(localStorage.getItem('draw3d-demo-settings-v1'));}catch{return undefined;}};
// A show's content without formation IDs: tells whether the Demo is still untouched.
const content=doc=>JSON.stringify({...doc,cues:doc.cues.map(({id,...cue})=>cue)});
import {createDraftStore,DraftWriter} from './drafts.js';
const $=id=>document.getElementById('author-'+id);
const button=(label,work)=>{const b=document.createElement('button');b.textContent=label;b.onclick=work;return b;};
export function downloadShowFile(text,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download=name.replace(/[^\w .-]/g,'_')+'.show.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}

export class ShowEditor{
  constructor(hooks){
    this.hooks=hooks;this.state=new ShowHistory(demoShowDoc(savedDemoSettings()));this.untouched=content(this.doc);this.active=this.doc.cues[0].id;this.selections=new WeakMap();this.revision=0;this.draftId=crypto.randomUUID();
    document.body.insertAdjacentHTML('beforeend',`<dialog id="author-dialog" aria-labelledby="author-heading">
      <header class="author-head"><div><span class="eyebrow">DRAW → ARRANGE → PERFORM</span><h2 id="author-heading">Show editor</h2></div><button id="author-close">Back to drawing</button></header>
      <nav class="author-toolbar" aria-label="Show files"><button id="author-new">New show</button><button id="author-demo">Edit demo</button><button id="author-open">Open show</button><button id="author-save">Save show ↗</button><button id="author-recover">Show drafts</button><button id="author-help">How to make a show</button></nav>
      <div class="author-title"><label>Show name <input id="author-name" maxlength="64"></label><span id="author-total"></span><button id="author-undo" aria-label="Undo show edit">↶</button><button id="author-redo" aria-label="Redo show edit">↷</button><button id="author-play" class="primary">▶ Play my show</button></div>
      <p id="author-status" role="status">Edit the demo or capture your own drawing.</p><p id="author-storage" role="status">Show drafts stay in this browser. Save show for a lasting backup.</p>
      <section id="author-recovery" hidden><h3>Show drafts</h3><div id="author-drafts"></div><button id="author-recovery-close">Close drafts</button></section>
      <div class="author-layout"><section class="author-story"><div class="author-section-head"><h3>Storyboard</h3><select id="author-count" aria-label="Fleet size"><option value="4096">4,096 drones</option><option value="256">256 drones (legacy)</option></select></div><p class="author-bookend">↑ Automatic takeoff · 8s</p><div id="author-cards"></div><div class="author-add"><button id="author-blank">＋ Draw a formation</button><button id="author-capture">＋ Current drawing</button><button id="author-selection">＋ Selected ink</button><select id="author-library" aria-label="Add a Demo formation"><option value="">＋ Demo formation…</option>${FORMATIONS.map(n=>`<option>${n}</option>`).join('')}</select></div><p class="author-bookend">✦ Fireworks → ↓ Landing</p></section>
      <section class="author-stage"><div id="author-designer"></div><p id="author-preview-note"></p><div class="author-stage-actions"><button id="author-formation-preview" class="primary" title="Play the show from this formation's transition, then come back here">▶ Run from here</button><button id="author-edit">✎ Edit drawing</button><button id="author-fit">Fit to stage</button></div><p class="hint">Every line becomes a line of drones in its colour, and the dots are the drones Run flies to. With Select, click a shape to pick it (Alt-click for one line), drag to move, a corner to resize, the knob to rotate; Shift keeps squares and 15° steps.</p></section>
      <section class="author-properties"><h3>Formation</h3><fieldset id="author-fields"><label>Name<input id="author-cue-name" maxlength="64"></label><div class="author-pair"><label>Display · seconds<input id="author-hold" type="number" min="2" max="60" step="0.5"></label><label>Transition · seconds<input id="author-transfer" type="number" min="2" max="30" step="0.5"></label></div><label>Light reveal<select id="author-light"><option value="fade">Fade in</option><option value="draw-on">Draw on in stroke order</option><option value="bottom-up">Bottom to top</option></select></label><label>Motion / effect<select id="author-effect"><option value="none">Still formation</option><option value="sparkle">Firework sparkle</option><option value="fire">Falling fire</option><option value="starship">Starship rise + yellow exhaust</option><option value="flap">Wings flap (butterfly)</option><option value="swim">Swim (whale)</option><option value="fish">Swim (fish)</option><option value="balloons">Balloons drift up</option><option value="candles">Candle flames flicker</option></select></label><label class="author-check" id="author-fire-row" hidden><input id="author-cue-fire" type="checkbox"> Falling fire</label><p id="author-library-note" class="hint" hidden>Demo formation · the Blender 3D model with its built-in motion. Convert to drawing to change its shape or position.</p><label>Brightness<input id="author-brightness" type="number" min="0.1" max="1" step="0.1"></label><p class="hint" id="author-light-hint"></p><div id="author-placement"><h4>Placement in the sky</h4><div class="author-triple"><label>X<input id="author-x" type="number" min="-20" max="20" step="1"></label><label>Height<input id="author-y" type="number" min="6" max="34" step="1"></label><label>Depth<input id="author-z" type="number" min="-20" max="20" step="1"></label></div><div class="author-pair"><label>Scale<input id="author-scale" type="number" min="0.1" max="100" step="0.5"></label><label>Rotation · °<input id="author-yaw" type="number" min="-180" max="180" step="5"></label></div></div><div class="author-actions"><button id="author-left">↑ Earlier</button><button id="author-right">↓ Later</button><button id="author-duplicate">Duplicate</button><button id="author-delete">Delete</button></div></fieldset>
      <h3>Finale</h3><label class="author-check"><input id="author-fireworks" type="checkbox"> Light fireworks</label><label id="author-finale-row">Finale<select id="author-finale"><option value="demo">Demo finale · heart with family, star, firework balls</option><option value="classic">Classic firework bursts</option></select></label><div class="author-pair"><label>Duration · s<input id="author-fire-duration" type="number" min="2" max="20" step="1"></label><label>Radius<input id="author-fire-radius" type="number" min="2" max="8" step="0.5"></label></div><p class="hint">A visual simulation. Trajectories are not validated for real aircraft.</p><h3>Look</h3><div id="author-look"><div class="author-pair"><label>Lights<select id="author-look-shape"><option value="round">Round glow</option><option value="diamond">Diamond</option><option value="star">Star</option></select></label><label>Size<select id="author-look-scale"><option value="2">4×</option><option value="3">6× (Demo)</option><option value="4">8×</option></select></label></div><label class="author-check"><input id="author-look-pyro" type="checkbox"> Ship fireworks</label><label class="author-check"><input id="author-look-lasers" type="checkbox"> Stage lasers at takeoff and landing</label></div><div id="author-classic" hidden><p class="hint">This show uses the earlier small stage. Give it the Demo's scale, harbour camera, look and landing:</p><button id="author-demo-look">Use the Demo's look</button></div></section></div>
      <div id="author-timeline" aria-label="Show sequence and duration"></div><input id="author-file" type="file" accept=".json,application/json" hidden>
    </dialog><dialog id="author-guide" aria-labelledby="author-guide-title"><h2 id="author-guide-title">Your first sky story</h2>
      <ol><li><strong>＋ Draw a formation</strong> opens a blank sky stage in the middle of the editor. Draw with <strong>Pen</strong>, <strong>Line</strong>, <strong>Box</strong>, <strong>Ellipse</strong>, <strong>Heart</strong>, <strong>Star</strong> or <strong>Text</strong>. Every line becomes a line of drones in its colour, and the dots are the drones. <strong>Fill</strong> fills shapes with rings of drones; <strong>Mirror</strong> draws both halves; <strong>Snap</strong> keeps to the grid; <strong>Trace image…</strong> shows a picture to draw over.</li><li>Adjust with <strong>Select</strong>: click a shape (Alt-click for one line), drag it to move, drag a corner to resize, drag the knob to rotate. A colour recolours the selection. <strong>Duplicate</strong>, <strong>Flip</strong>, <strong>Delete</strong>, <strong>Erase</strong>, and Undo (Ctrl+Z) work on the stage too.</li><li>Build the program: add formations, drag cards or use <strong>Earlier / Later</strong>, set each formation's display and transition time, light reveal and motion (a swim adds waves or a spout, balloons drift up, the Starship rises).</li><li><strong>▶ Run from here</strong> plays the show from the selected formation, so you watch the drones fly into it; <strong>← Back to show</strong> returns to the formation on screen. <strong>Play my show</strong> plays everything from takeoff; <strong>Record video</strong> saves it.</li><li>Start from the Demo with <strong>Edit demo</strong>: its 3D formations play as in the Demo; <strong>Convert to drawing</strong> puts one on the stage to change its shape.</li><li><strong>Save show</strong> downloads an editable .show.json file; <strong>Open show</strong> resumes it in a desktop or mobile browser.</li></ol>
      <p><strong>From the 3D drawing workspace:</strong> Current drawing or Selected ink brings ink drawn in 3D, including curved sheets. <strong>Flatten into the designer</strong> puts it on the 2D stage; <strong>Edit in 3D workspace</strong> keeps its depth.</p><p><strong>Recovery:</strong> show drafts are separate from drawing drafts. During artwork editing they save committed strokes too. Browser storage is not a backup; export files. Cancel editing restores the previous formation. Replacing the show with New or Edit demo is undoable.</p><p><strong>Limits:</strong> 14 formations, 4,096 drones, 80 objects / 4,000 source points per formation. Tiny details may receive very few dots. Scale and position must fit the preview stage. Transfer matching shortens travel; it does not avoid collisions.</p><button id="author-guide-close" class="primary">Got it</button></dialog>`);
    // The stage in the middle is the 2D formation designer: its edits are ordinary formation edits (undo, drafts, save).
    this.designer=new FormationDesigner($('designer'),{commit:(strokes,message)=>this.guard(()=>this.updateDesign(strokes,message)),report:(message,error)=>this.report(message,error)});
    this.store=createDraftStore(globalThis.indexedDB,'draw-in-3d-show-drafts');
    this.writer=new DraftWriter(this.store,(id,state,error)=>{if(id===this.draftId)$('storage').textContent=state==='saved'?'Show draft saved in this browser · Save show for a lasting backup':state==='error'?error.message:state==='pending'?'Show draft pending…':'Saving show draft…';});
    const run=fn=>()=>{try{fn();}catch(e){this.render();this.report(e.message,true);}};
    $('close').onclick=()=>this.close();$('dialog').oncancel=()=>this.cancelCompile();
    $('help').onclick=()=>$('guide').showModal();$('guide-close').onclick=()=>$('guide').close();
    $('new').onclick=run(()=>this.replace(newShow()));$('demo').onclick=run(()=>this.openDemo(savedDemoSettings(),false));
    $('name').onchange=run(()=>this.change({...this.doc,name:$('name').value.trim()}));
    $('undo').onclick=()=>this.travel(true);$('redo').onclick=()=>this.travel(false);
    $('save').onclick=run(()=>{downloadShowFile(encodeShow(this.doc),this.doc.name);this.dirty=false;this.report('Editable show downloaded.');});
    $('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0],revision=this.revision;e.target.value='';if(!file)return;try{if(file.size>SHOW_LIMITS.bytes)throw new Error('Show exceeds 16 MiB.');const doc=decodeShow(await file.text());if(revision!==this.revision)throw new Error('The show changed while this file was loading. Open the file again when ready.');this.replace(doc);}catch(error){this.report(error.message,true);}};
    $('recover').onclick=()=>this.recover();$('recovery-close').onclick=()=>$('recovery').hidden=true;
    $('blank').onclick=run(()=>{this.add(newCue(undefined,undefined,this.timing));this.designer.focus('pen');this.report('New formation: draw it on the stage with the pen, shapes or text. The dots are the drones.');});
    for(const [id,selected]of [['capture',false],['selection',true]])$(id).onclick=run(()=>{const source=this.hooks.capture(selected);const artwork=captureArtwork(source.entities,selected?source.selected:undefined);if(!artwork.some(e=>e.type==='stroke'))throw new Error('Choose some ink in the drawing workspace first.');this.add(newCue(artwork,'Formation '+(this.doc.cues.length+1),this.timing));});
    $('edit').onclick=run(()=>this.edit());$('fit').onclick=run(()=>isDesign(this.cue)?this.updateDesign(fitStrokes(designStrokes(this.cue)),'Scaled and centred on the stage.'):this.updateCue({placement:fitArtwork(this.cue.artwork)}));
    $('cue-name').onchange=run(()=>this.updateCue({name:$('cue-name').value.trim()}));
    for(const key of ['hold','transfer','brightness'])$(key).onchange=run(()=>this.updateCue({[key]:Number($(key).value)}));
    $('count').onchange=run(()=>this.change({...this.doc,count:Number($('count').value)}));
    $('effect').onchange=run(()=>this.updateCue({effect:$('effect').value}));
    $('light').onchange=run(()=>this.updateCue({light:$('light').value}));
    $('cue-fire').onchange=run(()=>this.updateCue({fire:$('cue-fire').checked}));
    // A Demo formation needs the Demo's stage: an older show is upgraded first (one undo step each).
    $('library').onchange=run(()=>{const name=$('library').value;$('library').value='';if(!name)return;if(this.doc.version!==3)this.change(withDemoLook(this.doc,savedDemoSettings()));this.add(demoCue(name));});
    $('finale').onchange=run(()=>this.change({...this.doc,fireworks:{...this.doc.fireworks,style:$('finale').value}}));
    for(const id of ['look-shape','look-scale','look-pyro','look-lasers'])$(id).onchange=run(()=>this.change({...this.doc,look:{shape:$('look-shape').value,scale:Number($('look-scale').value),pyro:$('look-pyro').checked,lasers:$('look-lasers').checked}}));
    $('demo-look').onclick=run(()=>this.change(withDemoLook(this.doc,savedDemoSettings())));
    for(const [k,id]of ['x','y','z'].entries())$(id).onchange=run(()=>{const p=this.cue.placement;this.updateCue({placement:{...p,position:p.position.map((v,i)=>i===k?Number($(id).value):v)}});});
    for(const key of ['scale','yaw'])$(key).onchange=run(()=>this.updateCue({placement:{...this.cue.placement,[key]:Number($(key).value)}}));
    $('left').onclick=()=>this.move(-1);$('right').onclick=()=>this.move(1);
    $('duplicate').onclick=run(()=>this.add({...clone(this.cue),id:crypto.randomUUID(),name:(this.cue.name+' copy').slice(0,64)}));
    $('delete').onclick=run(()=>this.change({...this.doc,cues:this.doc.cues.filter(c=>c.id!==this.active)}));
    for(const id of ['fireworks','fire-duration','fire-radius'])$(id).onchange=run(()=>this.change({...this.doc,fireworks:{...this.doc.fireworks,enabled:$('fireworks').checked,duration:Number($('fire-duration').value),radius:Number($('fire-radius').value)}}));
    $('play').onclick=()=>this.play();$('formation-preview').onclick=()=>this.play(true);
    $('dialog').addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.travel(!e.shiftKey);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('save').click();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.writer.flush();});
    window.addEventListener('beforeunload',e=>{if(this.dirty){e.preventDefault();e.returnValue='';}});
  }
  get doc(){return this.state.doc;}get cue(){return this.doc.cues.find(c=>c.id===this.active);}
  // New drawings in a Demo-style show get the Demo's timing.
  get timing(){return this.doc.version===3?DEMO_TIMING:undefined;}
  // The Demo exactly as Demo settings describe it (also opened from the Demo settings dialog); `focus` selects a formation.
  openDemo(settings,show=true,focus){this.replace(demoShowDoc(settings));this.untouched=content(this.doc);const pick=this.doc.cues.find(c=>c.name===focus);if(pick){this.active=pick.id;this.render();}
    this.report('This is the Demo as set up in Demo settings. Edit it, then Save show to keep your version.');if(show)this.open();}
  report(message,error=false){$('status').textContent=message;$('status').classList.toggle('author-error',error);}
  open(){
    // An untouched Demo follows Demo settings changed since it was made; edited shows are never replaced.
    if(this.untouched&&content(this.doc)===this.untouched){const fresh=demoShowDoc(savedDemoSettings()),next=content(fresh);if(next!==this.untouched){const at=this.doc.cues.findIndex(c=>c.id===this.active);this.state.doc=fresh;this.active=fresh.cues[Math.max(0,at)]?.id;this.untouched=next;}}
    if(!$('dialog').open){this.render();$('dialog').showModal();}this.loadAssets();}
  loadAssets(){return this.assetsPromise??=import('./formation-assets.js').then(m=>{this.assets=m.default;if($('dialog').open)this.render();}).catch(error=>this.report('Could not load the Demo formations: '+error.message,true));}
  close(){this.cancelCompile();$('dialog').close();this.hooks.closed?.();}
  change(doc,active=this.active){this.selections.set(this.doc,this.active);this.state.set(doc);this.active=active;this.changed();this.selections.set(this.doc,this.active);}
  changed(){this.cancelCompile();if(!this.cue)this.active=this.doc.cues[0]?.id;this.dirty=true;this.queueDraft();this.render();this.report('Show updated. Preview uses the latest saved formations.');}
  replace(doc){void this.writer.flush();this.draftId=crypto.randomUUID();this.change(doc);}
  queueDraft(doc=this.doc){const saved=doc,id=this.draftId,updatedAt=Date.now();this.writer.enqueue(id,()=>({id,kind:'show',name:saved.name,updatedAt,objects:saved.cues.length,text:encodeShow(saved)}));}
  sessionChanged(entities){if(!this.editing)return;this.dirty=true;const artwork=captureArtwork(entities);this.queueDraft({...this.doc,cues:this.doc.cues.map(c=>c.id===this.editing?{...c,artwork}:c)});}
  travel(back){this.selections.set(this.doc,this.active);if(this.state.travel(back)){this.active=this.selections.get(this.doc);this.changed();}}
  updateCue(patch){this.change({...this.doc,cues:this.doc.cues.map(c=>c.id===this.active?{...c,...patch}:c)});}
  add(cue){if(this.doc.cues.length>=SHOW_LIMITS.cues)throw new Error(`A show can contain at most ${SHOW_LIMITS.cues} formations.`);this.change({...this.doc,cues:[...this.doc.cues,cue]},cue.id);}
  move(delta){const i=this.doc.cues.findIndex(c=>c.id===this.active),j=i+delta;if(i<0||j<0||j>=this.doc.cues.length)return;const cues=[...this.doc.cues];[cues[i],cues[j]]=[cues[j],cues[i]];this.change({...this.doc,cues});}
  // A Demo formation becomes its line art on the stage, ready for the designer.
  convert(){
    if(!this.cue?.library)return;const fire=this.cue.fire,converted=drawingCue(this.cue.library,this.cue);this.change({...this.doc,cues:this.doc.cues.map(c=>c.id===this.active?converted:c)});
    this.report(`${converted.name} is now a drawing on the stage: select, move or recolour its lines, or draw more.${fire?' Its falling fire belongs to the 3D formation; for fire on a drawing, choose Falling fire and use bright yellow ink.':''} Undo restores the 3D Demo formation.`);this.designer.focus('select');
  }
  // Ink from the 3D workspace (curved sheets, several sheets) flattened onto the stage as Run places it.
  flatten(){
    if(!this.cue||this.cue.library||isDesign(this.cue))return;this.updateCue({artwork:flattenArtwork(this.cue),placement:designPlacement()});
    this.report(`${this.cue.name} is now on the 2D stage, where the designer tools edit it. Undo restores the 3D drawing.`);this.designer.focus('select');
  }
  updateDesign(strokes,message){const paper=this.cue.artwork.find(e=>e.type==='paper');this.updateCue({artwork:designArtwork(paper,strokes)});if(message)this.report(message);}
  guard(work){try{work();}catch(error){this.render();this.report(error.message,true);}}
  // The 3D drawing workspace, for curved sheets and depth (Demo formations are converted first).
  edit(){if(!this.cue)return;
    if(this.cue.library){this.convert();return;}
    this.cancelCompile();this.editing=this.active;this.hooks.edit(clone(this.cue.artwork),this.cue.name,(artwork,cancel)=>{if(!cancel)this.updateCue({artwork:captureArtwork(artwork)});else this.queueDraft();this.editing=null;this.open();});$('dialog').close();}
  cancelCompile(){this.revision++;if(this.worker){this.worker.terminate();this.report('Preview preparation cancelled. Your show is still editable.');}this.worker=null;clearTimeout(this.compileTimer);$('play').disabled=!this.doc.cues.length;$('play').textContent='▶ Play my show';}
  play(formationOnly=false){
    if(!this.doc.cues.length)return;
    const broken=this.doc.cues.find(problemOf);if(broken){this.active=broken.id;this.render();this.report(`${broken.name}: ${problemOf(broken)}`,true);return;}
    this.cancelCompile();const revision=this.revision,active=this.active,doc=this.doc;
    this.report('Preparing trajectories… You can keep editing; edits cancel this preview.');$('play').disabled=true;$('play').textContent='Preparing…';
    try{
      const worker=this.worker=new Worker(new URL('./show-worker.js',import.meta.url),{type:'module'});
      const fail=message=>{if(revision!==this.revision)return;this.cancelCompile();this.report(message,true);};
      this.compileTimer=setTimeout(()=>fail('Preview took too long. Reduce artwork complexity and try again.'),30000);
      worker.onerror=()=>fail('Could not prepare the show. Reload this page and try again.');
      worker.onmessage=({data})=>{if(data.revision!==this.revision)return;if(data.error){fail(data.error);return;}this.cancelCompile();this.report('Preview ready. Edit a card to change the next performance.');$('dialog').close();try{const from=cueTimes(doc).find(t=>t.id===active);this.hooks.play(data.show,time=>this.returnFrom(doc,time),formationOnly?from?.start:undefined);}catch(error){this.open();this.report(error.message,true);}};
      worker.postMessage({revision,doc:this.doc});
    }catch(error){this.cancelCompile();this.report(error.message,true);}
  }
  // Back from Run: select the formation that was on screen, so the next edit is on what you just watched.
  returnFrom(doc,time){
    const at=doc===this.doc&&Number.isFinite(time)?cueTimes(doc).find(t=>time>=t.start&&time<t.end):null;
    if(at){this.active=at.id;this.report(`Back from the show at ${this.cue.name} (${clock(time)}). Edit it, then Run from here to check.`);}
    this.open();
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
    const v3=this.doc.version===3,sizes=v3?[...FLEET_SIZES].reverse():[4096,256];
    if($('count').dataset.sizes!==String(sizes)){$('count').dataset.sizes=String(sizes);$('count').innerHTML=sizes.map(n=>`<option value="${n}">${n.toLocaleString()} drones${!v3&&n===256?' (legacy)':''}</option>`).join('');}
    $('count').value=this.doc.count;const c=this.cue; $('name').value=this.doc.name;$('total').textContent=`${this.doc.cues.length} / ${SHOW_LIMITS.cues} formations · ${clock(showDuration(this.doc))}`;
    $('undo').disabled=!this.state.past.length;$('redo').disabled=!this.state.future.length;$('play').disabled=!this.doc.cues.length||!!this.worker;// stays off while a preview is preparing
    // Cards are kept per formation and updated in place. Clicking a card after typing in a field blurs the field,
    // which applies the edit and re-renders mid-click; replacing the pressed card would drop that click.
    this.cardNodes??=new Map();const keep=new Set(this.doc.cues.map(c=>c.id));for(const id of this.cardNodes.keys())if(!keep.has(id))this.cardNodes.delete(id);
    let time=8;const nodes=[];
    for(const [index,cue]of this.doc.cues.entries()){
      let card=this.cardNodes.get(cue.id);
      if(!card){
        const id=cue.id;card=button('',()=>{this.active=id;this.render();});card.className='author-card';card.dataset.cueId=id;card.draggable=true;
        card.ondragstart=e=>{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';};card.ondragover=e=>e.preventDefault();
        card.ondrop=e=>{e.preventDefault();e.stopPropagation();const source=this.doc.cues.find(c=>c.id===e.dataTransfer.getData('text/plain'));if(!source||source.id===id)return;const cues=this.doc.cues.filter(c=>c!==source);cues.splice(cues.findIndex(c=>c.id===id),0,source);this.change({...this.doc,cues},source.id);};
        card.thumb=document.createElement('canvas');card.thumb.width=140;card.thumb.height=90;const text=document.createElement('span');card.heading=document.createElement('strong');card.detail=document.createElement('small');
        text.append(card.heading,card.detail);card.append(card.thumb,text);this.cardNodes.set(id,card);
      }
      card.classList.toggle('active',cue.id===this.active);card.setAttribute('aria-pressed',String(cue.id===this.active));
      // Cues are immutable, so a card repaints only when its formation (or the Demo library) changes.
      if(card.painted!==cue||card.paintedWith!==this.assets){this.paint(card.thumb,cue,true);card.painted=cue;card.paintedWith=this.assets;}
      const problem=problemOf(cue);card.classList.toggle('problem',!!problem);card.title=problem||'';
      card.heading.textContent=`${index+1}. ${cue.name}`;card.detail.textContent=problem?'⚠ '+problem:`${clock(time)} → ${clock(time+cue.transfer)} · hold ${cue.hold}s${cue.library?' · 3D':''}`;
      nodes.push(card);time+=cue.transfer+cue.hold;
    }
    const list=$('cards');if(nodes.length!==list.children.length||nodes.some((n,i)=>list.children[i]!==n))list.replaceChildren(...nodes);
    $('fields').disabled=!c;for(const id of ['edit','formation-preview','fit'])$(id).disabled=!c;
    for(const id of ['blank','capture','selection'])$(id).disabled=this.doc.cues.length>=SHOW_LIMITS.cues;
    const library=!!c?.library;$('edit').textContent=library?'✎ Convert to drawing':'Edit in 3D workspace';$('placement').hidden=!!c&&isDesign(c);$('fire-row').hidden=$('library-note').hidden=!library;
    if(c){$('cue-name').value=c.name;$('cue-fire').checked=!!c.fire;for(const id of ['effect','fit','x','y','z','scale','yaw'])$(id).disabled=library;for(const key of ['hold','transfer','brightness','light','effect'])$(key).value=c[key]??'none';const rises=['starship','balloons'].includes(c.effect);$('light').disabled=rises;$('light').title=rises?'This formation lights up as it rises, so a reveal does not apply.':'';['x','y','z'].forEach((key,i)=>$(key).value=c.placement.position[i]);for(const key of ['scale','yaw'])$(key).value=+c.placement[key].toFixed(3);const i=this.doc.cues.indexOf(c);$('left').disabled=i===0;$('right').disabled=i===this.doc.cues.length-1;$('duplicate').disabled=this.doc.cues.length>=SHOW_LIMITS.cues;}
    $('fireworks').checked=this.doc.fireworks.enabled;$('fire-duration').value=this.doc.fireworks.duration;$('fire-radius').value=this.doc.fireworks.radius;
    $('finale-row').hidden=!v3;$('finale').value=this.doc.fireworks.style??'classic';
    $('fire-duration').disabled=$('fire-radius').disabled=!this.doc.fireworks.enabled||v3&&this.doc.fireworks.style==='demo';
    // How lights behave between formations in this show (Run plays it the same way).
    $('light-hint').textContent=v3?'In flight every drone blinks red or blue at a quarter light; the formation lights up on arrival.':'Lights fade out before each transfer and reveal after arrival.';
    $('look').hidden=!v3;$('classic').hidden=v3;$('library').disabled=this.doc.cues.length>=SHOW_LIMITS.cues;
    if(v3){$('look-shape').value=this.doc.look.shape;$('look-scale').value=this.doc.look.scale;$('look-pyro').checked=this.doc.look.pyro;$('look-lasers').checked=this.doc.look.lasers;}
    this.stage(c);
    $('timeline').replaceChildren();for(const [label,duration]of [['Takeoff',8],...this.doc.cues.flatMap(c=>[['Transfer',c.transfer],[c.name,c.hold]]),...(this.doc.fireworks.enabled?v3&&this.doc.fireworks.style==='demo'?[['Demo finale',DEMO_FINALE]]:[['Firework launch',7],['Fireworks',this.doc.fireworks.duration]]:[]),['Return / land',v3?DEMO_LANDING:17]]){const part=document.createElement('span');part.textContent=label+' · '+duration+'s';part.style.flexGrow=duration;part.title=part.textContent;$('timeline').append(part);}
  }
  // The designer shows the formation exactly as Run plays it; drawings on the stage sheet are edited in place.
  stage(c){
    const v3=this.doc.version===3,unit=v3?this.doc.look.scale*2:1,count=this.doc.count;
    if(!c){this.designer.show({cue:null,formation:null,editable:false,count,unit,banner:{text:'Add a formation to begin your show: ＋ Draw a formation starts a blank stage.'}});$('preview-note').textContent='';return;}
    const {formation,note}=this.formationFor(c,unit);$('preview-note').textContent=note;
    const banner=c.library?{text:`${c.name} is a 3D Demo formation. Convert it to a drawing to change it on the stage.`,actions:[['✎ Convert to drawing',()=>this.guard(()=>this.convert())]]}
      :isDesign(c)?null:{text:`${c.name} was drawn in the 3D workspace.`,actions:[['Flatten into the designer',()=>this.guard(()=>this.flatten())],['Edit in 3D workspace',()=>this.guard(()=>this.edit())]]};
    this.designer.show({cue:c,formation,editable:isDesign(c),count,unit,banner});
  }
  // The drones this formation flies to, in stage units, and a one-line summary.
  formationFor(c,unit){
    if(c.library&&!this.assets){this.loadAssets();return {formation:null,note:`${c.name} · Demo formation · loading…`};}
    try{
      if(this.doc.version===3){
        const played=cueSequence(this.doc,c,this.assets),f=played.formation,water=f.extra?.filter(Boolean).length||0,fire=f.fire?.filter(Boolean).length||0;
        const parts=[`${(this.doc.count-water-fire).toLocaleString()} lights`,water&&`${water.toLocaleString()} ${played.spout?'in the spout':'in the waves'}`,fire&&`${fire.toLocaleString()} falling fire`].filter(Boolean).join(' · ');
        const formation={positions:f.positions.map(p=>p.map(v=>v/unit)),colors:f.colors};
        return {formation,note:c.library?`${c.name} · Demo formation · Blender 3D · ${parts}`:`${c.name} · ${parts}${this.spacing(c,unit)}`};
      }
      return {formation:cueFormation(c,this.doc.count),note:`${c.name} · ${this.doc.count.toLocaleString()} sampled lights${this.spacing(c,unit)}`};
    }catch(error){return {formation:null,note:error.message};}
  }
  // How closely the drones sit along the lines, in metres of the performed show.
  spacing(c,unit){
    const paths=placePaths(drawingPaths(c.artwork),c.placement),total=paths.reduce((n,p)=>n+p.points.slice(1).reduce((m,q,i)=>m+Math.hypot(...q.map((v,k)=>v-p.points[i][k])),0),0);
    return total>0?` · ${paths.length} line${paths.length===1?'':'s'} · a drone every ${(total*unit/this.doc.count).toFixed(total*unit/this.doc.count<1?2:1)} m`:'';
  }
  // A small card thumbnail of the formation's shape.
  paint(canvas,c){
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#07111c';ctx.fillRect(0,0,w,h);
    if(c.library&&!this.assets){this.loadAssets();return;}
    try{
      const body=c.library&&this.assets[c.library].body,f=body?{positions:body.positions.slice(0,256),colors:body.colors.slice(0,256).map(v=>v.map(x=>x*c.brightness))}:cueFormation(c,256),p=f.positions;
      const minX=Math.min(...p.map(v=>v[0]))-1,maxX=Math.max(...p.map(v=>v[0]))+1,minY=Math.min(...p.map(v=>v[1]))-1,maxY=Math.max(...p.map(v=>v[1]))+1;
      const s=Math.min((w-12)/(maxX-minX),(h-12)/(maxY-minY)),ox=(w-(maxX-minX)*s)/2,oy=(h-(maxY-minY)*s)/2;
      for(let i=0;i<p.length;i++){ctx.fillStyle=`rgb(${f.colors[i].map(v=>Math.round(v*255)).join(' ')})`;ctx.beginPath();ctx.arc(ox+(p[i][0]-minX)*s,h-oy-(p[i][1]-minY)*s,1,0,Math.PI*2);ctx.fill();}
    }catch{ctx.fillStyle='#5f8aa3';ctx.font='11px sans-serif';ctx.fillText('Draw it',12,h/2+4);}
  }
}
