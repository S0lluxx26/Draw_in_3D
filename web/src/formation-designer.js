// The 2D formation designer in the Show editor: draw a formation straight onto the sky stage, adjust it, and watch
// the drones it makes. It edits the formation's sheet ink (formation-design.js), so every change is one Show-editor
// edit (undo, drafts, save) and Run plays exactly what is drawn.
import {STAGE,designStrokes,shapeOutline,filledShape,textStrokes,simplify,hitStroke,bounds,translate,scaleAbout,rotateAbout,mapStrokes,mirrored,snapPoint,budget,colorOf,cssColor} from './formation-design.js';
import {samplePaths} from './drone-show.js';

const TOOLS=[['select','Select','V','⬚'],['pen','Pen','P','✎'],['line','Line','L','╱'],['rect','Box','R','▭'],['ellipse','Ellipse','E','◯'],['heart','Heart','H','♥'],['star','Star','S','★'],['text','Text','T','T'],['erase','Erase','X','⌫']];
export const PALETTE=['#61e8c6','#3f8cff','#ff4f9a','#ffcf3f','#ffffff','#ff4b3a','#6dff6a','#b06bff'];
const VIEW={minX:-35,maxX:35,minY:-1,maxY:47};// the stage plus a margin; y 0 is the waterline
const SHAPE_TOOLS=['line','rect','ellipse','heart','star'];
const rgb=c=>[(c>>16&255)/255,(c>>8&255)/255,(c&255)/255];
const length=points=>points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
// A deterministic harbour skyline along the bottom, so the stage reads the way the audience sees it.
const SKYLINE=Array.from({length:36},(_,i)=>{const h=1.2+((i*7919)%13)/13*3.4+(i%5===2?2.2:0);return [VIEW.minX+i*2,h];});

export class FormationDesigner{
  constructor(root,hooks){
    this.hooks=hooks;this.tool='pen';this.color=PALETTE[0];this.fill=false;this.mirror=false;this.snap=false;this.view='both';
    this.selection=new Set();this.strokes=[];this.editable=false;this.gesture=null;this.hover=-1;
    // Lines made in one action (a filled shape, a word, a mirrored pair) select together; ids survive every edit.
    this.groups=new Map();
    root.innerHTML=`<div class="designer-bar" role="toolbar" aria-label="Formation designer">
        <div class="designer-group">${TOOLS.map(([id,label,key,icon])=>`<button type="button" data-draw="${id}" title="${label} (${key})" aria-label="${label}" aria-pressed="false"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div>
        <div class="designer-group designer-colors">${PALETTE.map(c=>`<button type="button" class="designer-swatch" data-color="${c}" style="--swatch:${c}" aria-label="Colour ${c}" title="Colour"></button>`).join('')}<input type="color" data-role="color" aria-label="Any colour" title="Any colour"></div>
        <div class="designer-group designer-options"><label title="Shapes fill with rings of drones"><input type="checkbox" data-opt="fill"> Fill</label><label title="New lines are mirrored across the centre"><input type="checkbox" data-opt="mirror"> Mirror</label><label title="Snap to the 1-unit grid"><input type="checkbox" data-opt="snap"> Snap</label>
          <select data-role="view" aria-label="Show on the stage"><option value="both">Drones + lines</option><option value="drones">Drones</option><option value="lines">Lines</option></select></div>
        <div class="designer-group designer-text" hidden><input data-role="text" maxlength="24" value="HELLO" aria-label="Text to place"><select data-role="size" aria-label="Letter height"><option value="4">Small</option><option value="6" selected>Medium</option><option value="9">Large</option></select></div>
        <div class="designer-group"><button type="button" data-act="duplicate" title="Duplicate the selection (Ctrl+D)">Duplicate</button><button type="button" data-act="flip" title="Flip the selection left–right">Flip</button><button type="button" data-act="delete" title="Delete the selection (Del)">Delete</button><button type="button" data-act="clear" title="Remove all lines">Clear</button><button type="button" data-act="trace" title="Show a picture behind the stage to draw over (not saved in the show)">Trace image…</button><input type="file" data-role="trace" accept="image/*" hidden></div>
      </div>
      <div class="designer-stage"><canvas id="author-preview" tabindex="0" aria-label="Sky stage: draw the formation here"></canvas><div class="designer-banner" hidden><span></span><div class="designer-banner-actions"></div></div></div>`;
    const $=selector=>root.querySelector(selector);
    this.canvas=$('canvas');this.bar=$('.designer-bar');this.banner=$('.designer-banner');this.textBox=$('.designer-text');
    for(const b of root.querySelectorAll('[data-draw]'))b.onclick=()=>this.setTool(b.dataset.draw);
    for(const b of root.querySelectorAll('[data-color]'))b.onclick=()=>this.pick(b.dataset.color);
    $('[data-role=color]').oninput=e=>this.pick(e.target.value);
    for(const box of root.querySelectorAll('[data-opt]'))box.onchange=()=>{this[box.dataset.opt]=box.checked;this.draw();};
    $('[data-role=view]').onchange=e=>{this.view=e.target.value;this.draw();};
    this.text=$('[data-role=text]');this.size=$('[data-role=size]');
    for(const b of root.querySelectorAll('[data-act]'))b.onclick=()=>this.act(b.dataset.act);
    // A picture to trace: shown faintly behind the stage while designing, never part of the show.
    this.traceInput=$('[data-role=trace]');this.traceInput.onchange=()=>{const file=this.traceInput.files[0];this.traceInput.value='';if(!file)return;const image=new Image();image.onload=()=>{this.backdrop=image;this.syncBar();this.draw();};image.onerror=()=>this.hooks.report('That file is not a picture this browser can show.',true);image.src=URL.createObjectURL(file);};
    const c=this.canvas;
    c.addEventListener('pointerdown',e=>this.down(e));c.addEventListener('pointermove',e=>this.move(e));
    c.addEventListener('pointerup',e=>this.up(e));c.addEventListener('pointercancel',e=>this.cancelPointer(e));c.addEventListener('lostpointercapture',e=>this.cancelPointer(e));
    c.addEventListener('pointerleave',()=>{if(!this.gesture&&this.hover>=0){this.hover=-1;this.draw();}});
    c.addEventListener('keydown',e=>this.key(e));
    new ResizeObserver(()=>this.resize()).observe($('.designer-stage'));
    this.setTool('pen');this.pick(PALETTE[0]);
  }
  // ---- state from the Show editor ----
  // formation: the drones Run will fly to (stage units); unit: metres per stage unit; banner: why it is read-only.
  show({cue,formation,editable,count,unit,banner}){
    if(this.cue!==cue)this.cancelGesture();
    this.cue=cue;this.editable=editable;this.strokes=editable?designStrokes(cue):[];this.groups=new Map(this.strokes.filter(s=>s.group).map(s=>[s.id,s.group]));this.formation=formation;this.count=count;this.unit=unit;
    const ids=new Set(this.strokes.map(s=>s.id));for(const id of this.selection)if(!ids.has(id))this.selection.delete(id);
    this.bar.classList.toggle('disabled',!editable);for(const el of this.bar.querySelectorAll('button,input,select'))el.disabled=!editable;
    this.banner.hidden=!banner;if(banner){this.banner.querySelector('span').textContent=banner.text;const actions=this.banner.querySelector('.designer-banner-actions');actions.replaceChildren(...(banner.actions||[]).map(([label,run])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=run;return b;}));}
    this.syncBar();this.draw();
  }
  focus(tool){if(tool)this.setTool(tool);this.canvas.focus({preventScroll:true});}
  setTool(tool){this.cancelGesture();this.tool=tool;this.textBox.hidden=tool!=='text';this.canvas.dataset.tool=tool;this.syncBar();this.draw();}
  pick(color){this.color=color;this.bar.querySelector('[data-role=color]').value=color;
    if(this.selection.size&&this.editable)this.commit(this.strokes.map(s=>this.selection.has(s.id)?{...s,color:colorOf(color)}:s),'Colour changed.');this.syncBar();}
  syncBar(){
    for(const b of this.bar.querySelectorAll('[data-draw]')){const on=b.dataset.draw===this.tool;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}
    for(const b of this.bar.querySelectorAll('[data-color]'))b.classList.toggle('active',b.dataset.color===this.color);
    const none=!this.selection.size;for(const act of ['duplicate','flip','delete'])this.bar.querySelector(`[data-act=${act}]`).disabled=!this.editable||none;
    this.bar.querySelector('[data-act=clear]').disabled=!this.editable||!this.strokes.length;this.bar.querySelector('[data-act=trace]').textContent=this.backdrop?'Hide image':'Trace image…';
  }
  // ---- edits: every change goes back to the Show editor as the formation's new ink ----
  commit(strokes,message){
    const b=budget(strokes);
    if(b.strokes>b.maxStrokes||b.points>b.maxPoints){this.hooks.report(`This formation is full: at most ${b.maxStrokes} lines and ${b.maxPoints.toLocaleString()} points. Delete or simplify some lines first.`,true);this.draw();return false;}
    this.hooks.commit(strokes,message);return true;
  }
  added(lines,message){
    const color=colorOf(this.color),fresh=lines.map(points=>({id:crypto.randomUUID(),color,points}));
    const all=this.mirror?[...fresh,...mirrored(fresh).map(s=>({...s,id:crypto.randomUUID()}))]:fresh,group=crypto.randomUUID();
    for(const s of all)s.group=group;
    this.commit([...this.strokes,...all],message);
  }
  get selected(){return this.strokes.filter(s=>this.selection.has(s.id));}
  // The lines that belong with this one: its drawing group, or (for drawings opened from a file) the same-colour
  // lines inside a closed outline, such as the rings of a filled shape.
  group(id){
    const ids=new Set([id]),g=this.groups.get(id),hit=this.strokes.find(s=>s.id===id);
    if(g){for(const s of this.strokes)if(this.groups.get(s.id)===g)ids.add(s.id);return ids;}
    const first=hit.points[0],last=hit.points.at(-1);if(Math.hypot(first[0]-last[0],first[1]-last[1])>1e-3)return ids;
    const b=bounds([hit]),inside=c=>c.minX>=b.minX-1e-6&&c.maxX<=b.maxX+1e-6&&c.minY>=b.minY-1e-6&&c.maxY<=b.maxY+1e-6;
    for(const s of this.strokes)if(s!==hit&&s.color===hit.color&&!this.groups.has(s.id)&&inside(bounds([s])))ids.add(s.id);
    return ids;
  }
  act(action){
    if(!this.editable)return;
    if(action==='trace'){if(this.backdrop){URL.revokeObjectURL(this.backdrop.src);this.backdrop=null;this.syncBar();this.draw();}else this.traceInput.click();return;}
    if(action==='clear'){if(this.strokes.length){this.selection.clear();this.commit([],'Stage cleared. Undo brings the lines back.');}return;}
    if(!this.selection.size)return;
    if(action==='delete'){const n=this.selection.size;this.commit(this.strokes.filter(s=>!this.selection.has(s.id)),`${n} line${n>1?'s':''} deleted.`);this.selection.clear();}
    if(action==='duplicate'){const renamed=new Map(),copies=mapStrokes(this.selected,translate(2,-2)).map(s=>{const id=crypto.randomUUID(),g=this.groups.get(s.id);if(g&&!renamed.has(g))renamed.set(g,crypto.randomUUID());return {...s,id,...(g?{group:renamed.get(g)}:{})};});this.selection=new Set(copies.map(s=>s.id));this.commit([...this.strokes,...copies],'Duplicated. Drag the copy into place.');}
    if(action==='flip'){const b=bounds(this.selected),flip=([x,y])=>[2*b.cx-x,y];this.replaceSelected(mapStrokes(this.selected,flip),'Flipped left–right.');}
    this.syncBar();
  }
  replaceSelected(changed,message){const byId=new Map(changed.map(s=>[s.id,s]));this.commit(this.strokes.map(s=>byId.get(s.id)||s),message);}
  // ---- geometry of the view ----
  resize(){const wrap=this.canvas.parentElement,dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(200,wrap.clientWidth);
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(w*dpr*(VIEW.maxY-VIEW.minY)/(VIEW.maxX-VIEW.minX));this.draw();}
  get scale(){return this.canvas.width/(VIEW.maxX-VIEW.minX);}
  px([x,y]){return [(x-VIEW.minX)*this.scale,(VIEW.maxY-y)*this.scale];}
  at(e){const r=this.canvas.getBoundingClientRect(),k=this.canvas.width/r.width;return [VIEW.minX+(e.clientX-r.left)*k/this.scale,VIEW.maxY-(e.clientY-r.top)*k/this.scale];}
  tolerance(pixels=9){const r=this.canvas.getBoundingClientRect();return pixels*(this.canvas.width/Math.max(1,r.width))/this.scale;}
  snapped(p){return this.snap?snapPoint(p):p;}
  handles(){if(!this.selection.size)return null;const b=bounds(this.gesture?.preview||this.selected),pad=this.tolerance(6);
    const box={minX:b.minX-pad,maxX:b.maxX+pad,minY:b.minY-pad,maxY:b.maxY+pad};
    return {box,corners:[[box.minX,box.minY],[box.maxX,box.minY],[box.maxX,box.maxY],[box.minX,box.maxY]],rotate:[(box.minX+box.maxX)/2,box.maxY+this.tolerance(24)],centre:[b.cx,b.cy]};}
  // One pointer owns a gesture. Cancel before releasing capture to ignore its lost-capture event.
  cancelGesture(){const id=this.pointerId;this.pointerId=null;this.gesture=null;this.live=null;if(id!=null&&this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}
  cancelPointer(e){if(e.pointerId!==this.pointerId)return;this.cancelGesture();this.draw();}
  // ---- pointer ----
  down(e){
    if(!this.editable||e.button>0||this.pointerId!=null)return;e.preventDefault();this.pointerId=e.pointerId;this.canvas.setPointerCapture(e.pointerId);this.canvas.focus({preventScroll:true});
    const p=this.at(e);
    if(this.tool==='pen')this.gesture={kind:'pen',points:[p]};
    else if(SHAPE_TOOLS.includes(this.tool)){const a=this.snapped(p);this.gesture={kind:'shape',a,b:a};}
    else if(this.tool==='text'){const lines=textStrokes(this.text.value||'HELLO',this.snapped(p),Number(this.size.value));if(lines.length)this.added(lines,'Text placed. Select it to move, scale or recolour it.');else this.hooks.report('Type some letters or numbers for the Text tool first.',true);}
    else if(this.tool==='erase'){this.gesture={kind:'erase',removed:new Set()};this.erase(p);}
    else this.beginSelect(p,e.shiftKey,e.altKey);
    this.draw();
  }
  beginSelect(p,shift,single){
    const h=this.handles(),near=(q,r=9)=>Math.hypot(q[0]-p[0],q[1]-p[1])<this.tolerance(r),base=this.selected;
    if(h&&near(h.rotate,11)){this.gesture={kind:'rotate',start:p,centre:h.centre,base};return;}
    const corner=h?h.corners.findIndex(q=>near(q)):-1;
    if(corner>=0){this.gesture={kind:'scale',start:p,anchor:h.corners[(corner+2)%4],base};return;}
    const i=hitStroke(this.strokes,p,this.tolerance());
    if(i>=0){const id=this.strokes[i].id,ids=single?new Set([id]):this.group(id);if(shift){const on=!this.selection.has(id);for(const k of ids)if(on)this.selection.add(k);else this.selection.delete(k);}else if(!this.selection.has(id))this.selection=ids;
      this.gesture={kind:'move',start:p,base:this.selected};}
    else if(h&&p[0]>=h.box.minX&&p[0]<=h.box.maxX&&p[1]>=h.box.minY&&p[1]<=h.box.maxY)this.gesture={kind:'move',start:p,base};
    else{if(!shift)this.selection.clear();this.gesture={kind:'box',a:p,b:p};}
    this.syncBar();
  }
  move(e){
    if(this.pointerId!=null&&e.pointerId!==this.pointerId)return;
    const p=this.at(e),g=this.gesture;
    if(!g){if(this.editable&&this.tool==='select'){const i=hitStroke(this.strokes,p,this.tolerance());if(i!==this.hover){this.hover=i;this.draw();}}return;}
    if(g.kind==='pen'){const last=g.points.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>this.tolerance(1.5))g.points.push(p);}
    else if(g.kind==='shape'){g.b=this.snapped(p);g.square=e.shiftKey;}
    else if(g.kind==='erase')this.erase(p);
    else if(g.kind==='box')g.b=p;
    else if(g.kind==='move'){let d=[p[0]-g.start[0],p[1]-g.start[1]];if(this.snap)d=snapPoint(d);g.preview=mapStrokes(g.base,translate(...d));}
    else if(g.kind==='scale'){const k=Math.max(.05,Math.hypot(p[0]-g.anchor[0],p[1]-g.anchor[1])/Math.max(1e-6,Math.hypot(g.start[0]-g.anchor[0],g.start[1]-g.anchor[1])));g.preview=mapStrokes(g.base,scaleAbout(g.anchor,k));}
    else if(g.kind==='rotate'){let a=Math.atan2(p[1]-g.centre[1],p[0]-g.centre[0])-Math.atan2(g.start[1]-g.centre[1],g.start[0]-g.centre[0]);if(e.shiftKey)a=Math.round(a/(Math.PI/12))*Math.PI/12;g.preview=mapStrokes(g.base,rotateAbout(g.centre,a));}
    this.liveDots();this.draw();
  }
  up(e){
    if(e.pointerId!==this.pointerId)return;const g=this.gesture;this.cancelGesture();if(!g)return;
    if(g.kind==='pen'){const points=simplify(g.points);if(length(points)>.3)this.added([points],'Line drawn.');}
    else if(g.kind==='shape'){const lines=this.shapeLines(g);if(lines)this.added(lines,`${this.tool==='rect'?'Box':this.tool[0].toUpperCase()+this.tool.slice(1)} added${this.fill&&this.tool!=='line'?', filled with drones':''}.`);}
    else if(g.kind==='erase'){if(g.removed.size){this.selection=new Set([...this.selection].filter(id=>!g.removed.has(id)));this.commit(this.strokes.filter(s=>!g.removed.has(s.id)),`${g.removed.size} line${g.removed.size>1?'s':''} erased.`);}}
    else if(g.kind==='box'){const x0=Math.min(g.a[0],g.b[0]),x1=Math.max(g.a[0],g.b[0]),y0=Math.min(g.a[1],g.b[1]),y1=Math.max(g.a[1],g.b[1]);
      for(const s of this.strokes)if(s.points.some(([x,y])=>x>=x0&&x<=x1&&y>=y0&&y<=y1))this.selection.add(s.id);this.syncBar();}
    else if(g.preview)this.replaceSelected(g.preview,g.kind==='move'?'Moved.':g.kind==='scale'?'Resized.':'Rotated.');
    this.draw();
  }
  shapeLines(g){
    const [a,b]=[g.a,g.b];
    if(this.tool==='line'){let end=b;if(g.square){const d=Math.hypot(b[0]-a[0],b[1]-a[1]),t=Math.round(Math.atan2(b[1]-a[1],b[0]-a[0])/(Math.PI/12))*Math.PI/12;end=[a[0]+d*Math.cos(t),a[1]+d*Math.sin(t)];}
      return Math.hypot(end[0]-a[0],end[1]-a[1])>.2?[[a,end]]:null;}
    if(Math.abs(b[0]-a[0])<.3&&Math.abs(b[1]-a[1])<.3)return null;
    const outline=shapeOutline(this.tool,a,b,{square:g.square});return this.fill?filledShape(outline):[outline];
  }
  erase(p){const i=hitStroke(this.strokes.filter(s=>!this.gesture.removed.has(s.id)),p,this.tolerance(10));if(i<0)return;const alive=this.strokes.filter(s=>!this.gesture.removed.has(s.id));this.gesture.removed.add(alive[i].id);}
  key(e){
    if(!this.editable)return;const k=e.key.toLowerCase();
    if(e.ctrlKey||e.metaKey){if(k==='a'){e.preventDefault();this.selection=new Set(this.strokes.map(s=>s.id));this.setTool('select');}if(k==='d'){e.preventDefault();this.act('duplicate');}return;}
    const tool=TOOLS.find(t=>t[2].toLowerCase()===k);if(tool){e.preventDefault();this.setTool(tool[0]);return;}
    if(k==='delete'||k==='backspace'){e.preventDefault();this.act('delete');return;}
    if(k==='escape'){if(this.gesture||this.selection.size){e.preventDefault();e.stopPropagation();this.cancelGesture();this.selection.clear();this.syncBar();this.draw();}return;}
    const nudge={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,1],arrowdown:[0,-1]}[k];
    if(nudge&&this.selection.size){e.preventDefault();const step=e.shiftKey?2:.5;this.replaceSelected(mapStrokes(this.selected,translate(nudge[0]*step,nudge[1]*step)),'Nudged.');}
  }
  // While dragging or drawing, the drones follow the lines live (a lighter sample of the fleet).
  liveDots(){
    const now=performance.now();if(this.live&&now-this.live.at<90)return;
    const g=this.gesture,moving=g?.preview?new Set(g.base.map(s=>s.id)):null;
    let lines=this.strokes.filter(s=>!moving?.has(s.id)&&!g?.removed?.has(s.id));
    if(g?.preview)lines=[...lines,...g.preview];
    if(g?.kind==='pen'&&g.points.length>1)lines=[...lines,{color:colorOf(this.color),points:g.points}];
    if(g?.kind==='shape'){const extra=this.shapeLines(g);if(extra)lines=[...lines,...extra.map(points=>({color:colorOf(this.color),points}))];}
    try{this.live={at:now,...samplePaths(lines.map(s=>({points:s.points.map(([x,y])=>[x,y,0]),color:rgb(s.color)})),Math.min(this.count||1024,2048))};}catch{this.live={at:now,positions:[],colors:[]};}
  }
  // ---- drawing the stage ----
  draw(){
    const c=this.canvas,g=c.getContext('2d'),W=c.width,H=c.height;if(!W||!H)return;
    const s=this.scale,px=p=>this.px(p),dpr=W/Math.max(1,c.getBoundingClientRect().width||W);
    const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#040a13');sky.addColorStop(.75,'#0a1a28');sky.addColorStop(1,'#10263a');g.fillStyle=sky;g.fillRect(0,0,W,H);
    g.lineWidth=1;for(let x=-34;x<=34;x+=2){g.strokeStyle=x%10?'#0f2233':'#173247';g.beginPath();g.moveTo(...px([x,STAGE.minY]));g.lineTo(...px([x,STAGE.maxY]));g.stroke();}
    for(let y=2;y<=46;y+=2){g.strokeStyle=(y-2)%10?'#0f2233':'#173247';g.beginPath();g.moveTo(...px([STAGE.minX,y]));g.lineTo(...px([STAGE.maxX,y]));g.stroke();}
    // Waterline and skyline: the audience's view of the harbour.
    g.fillStyle='#050b12';g.beginPath();g.moveTo(...px([VIEW.minX,0]));for(const [x,h] of SKYLINE){g.lineTo(...px([x,h]));g.lineTo(...px([x+1.6,h]));g.lineTo(...px([x+1.6,0]));}g.lineTo(...px([VIEW.maxX,0]));g.closePath();g.fill();
    g.fillStyle='#03070c';g.fillRect(0,px([0,0])[1],W,H);
    if(this.backdrop){// fitted inside the stage, keeping its proportions
      const b=this.backdrop,sw=STAGE.maxX-STAGE.minX,sh=STAGE.maxY-STAGE.minY,k=Math.min(sw/b.width,sh/b.height),w=b.width*k,h=b.height*k,[x,y]=px([-w/2,(STAGE.minY+STAGE.maxY)/2+h/2]);
      g.globalAlpha=.32;g.drawImage(b,x,y,w*s,h*s);g.globalAlpha=1;}
    g.setLineDash([6*dpr,5*dpr]);g.strokeStyle='#2f6680';g.strokeRect(...px([STAGE.minX,STAGE.maxY]),(STAGE.maxX-STAGE.minX)*s,(STAGE.maxY-STAGE.minY)*s);
    if(this.mirror){g.strokeStyle='#7ee8c5';g.beginPath();g.moveTo(...px([0,STAGE.minY]));g.lineTo(...px([0,STAGE.maxY]));g.stroke();}
    g.setLineDash([]);g.fillStyle='#5f8aa3';g.font=`${11*dpr}px Inter,sans-serif`;g.fillText('SKY STAGE',...px([STAGE.minX+.6,STAGE.maxY-1.6]));
    if(this.unit){const label=`${Math.round((STAGE.maxX-STAGE.minX)*this.unit)} × ${Math.round((STAGE.maxY-STAGE.minY)*this.unit)} m`;g.textAlign='right';g.fillText(label,...px([STAGE.maxX-.6,STAGE.maxY-1.6]));g.textAlign='left';}
    const gesture=this.gesture,moving=gesture?.preview?new Set(gesture.base.map(s=>s.id)):null;
    const lines=[...this.strokes.filter(s=>!moving?.has(s.id)&&!gesture?.removed?.has(s.id)),...(gesture?.preview||[])];
    // Lines under the drones: faint when the drones are shown too.
    if(this.view!=='drones'){g.lineCap=g.lineJoin='round';
      for(const st of lines){const sel=this.selection.has(st.id);if(sel){g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=5*dpr;this.path(g,st.points);g.stroke();}
        g.strokeStyle=cssColor(st.color);g.globalAlpha=this.view==='lines'||sel?1:.4;g.lineWidth=(this.view==='lines'?2.2:1.6)*dpr;this.path(g,st.points);g.stroke();g.globalAlpha=1;}
      if(this.hover>=0&&this.tool==='select'&&!gesture&&this.strokes[this.hover]){g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=4*dpr;const ids=this.group(this.strokes[this.hover].id);for(const st of this.strokes)if(ids.has(st.id)){this.path(g,st.points);g.stroke();}}}
    if(this.view!=='lines'){
      const dots=gesture&&this.live?this.live:this.formation;
      if(dots?.positions?.length){const n=dots.positions.length,r=Math.max(1.1,Math.min(3.2,2.6*Math.sqrt(1200/n)))*dpr,fade=gesture?.kind==='erase'?.5:1;
        for(let i=0;i<n;i++){const [x,y]=px(dots.positions[i]),col=dots.colors[i];g.fillStyle=`rgba(${Math.round(col[0]*255)},${Math.round(col[1]*255)},${Math.round(col[2]*255)},${fade})`;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}}}
    // In-progress pen line or shape, in the chosen colour.
    if(gesture?.kind==='pen'||gesture?.kind==='shape'){const extra=gesture.kind==='pen'?[gesture.points]:this.shapeLines(gesture)||[];
      g.strokeStyle=this.color;g.lineWidth=2*dpr;for(const points of extra){this.path(g,points);g.stroke();if(this.mirror){this.path(g,points.map(([x,y])=>[-x,y]));g.stroke();}}}
    if(gesture?.kind==='box'){g.setLineDash([4*dpr,4*dpr]);g.strokeStyle='#7ee8c5';const [x0,y0]=px(gesture.a),[x1,y1]=px(gesture.b);g.strokeRect(x0,y0,x1-x0,y1-y0);g.setLineDash([]);}
    const h=this.handles();
    if(h&&this.editable){const [x0,y0]=px([h.box.minX,h.box.maxY]),[x1,y1]=px([h.box.maxX,h.box.minY]);g.setLineDash([5*dpr,4*dpr]);g.strokeStyle='#7ee8c5';g.lineWidth=1*dpr;g.strokeRect(x0,y0,x1-x0,y1-y0);g.setLineDash([]);
      g.fillStyle='#7ee8c5';for(const q of h.corners){const [x,y]=px(q);g.fillRect(x-4*dpr,y-4*dpr,8*dpr,8*dpr);}
      const [rx,ry]=px(h.rotate);g.beginPath();g.moveTo((x0+x1)/2,y0);g.lineTo(rx,ry);g.stroke();g.beginPath();g.arc(rx,ry,5*dpr,0,Math.PI*2);g.fill();}
    if(this.editable&&!this.strokes.length&&!gesture){g.fillStyle='#8fb5c7';g.font=`${15*dpr}px Inter,sans-serif`;g.textAlign='center';g.fillText('Draw your formation here: pen, shapes or text',...px([0,26]));g.font=`${12*dpr}px Inter,sans-serif`;g.fillStyle='#5f8aa3';g.fillText('The dots are the drones. Run from here to watch them fly into it.',...px([0,22.5]));g.textAlign='left';}
  }
  path(g,points){g.beginPath();points.forEach((p,i)=>g[i?'lineTo':'moveTo'](...this.px(p)));}
}
