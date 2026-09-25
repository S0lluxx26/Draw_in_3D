import {demoSettings,compileDemo,FLEET_SIZES,FORMATIONS} from './demo-library.js';
import {QUALITY_LEVELS,SKY_MODES,SKY_KEY} from './quality.js';
export {FLEET_SIZES,LIGHT_SHAPES,FORMATIONS,demoSettings,compileDemo} from './demo-library.js';

export function installDemoSettings({play,player,notify,edit}){
  const key='draw3d-demo-settings-v1';let settings=demoSettings(),assets,cached,wasPlaying=false,opener,generation=0;
  try{settings=demoSettings(JSON.parse(localStorage.getItem(key)));}catch{}
  const dialog=document.createElement('dialog');dialog.id='demo-settings';dialog.setAttribute('aria-labelledby','demo-settings-title');
  dialog.innerHTML=`<form><h2 id="demo-settings-title">Demo settings</h2><p class="demo-only">Blender-built 3D formations. Settings apply to this Demo; saved shows stay independent.</p>
    <p class="player-only">These player options apply to every show. This show's formations and look are set in the Show editor.</p>
    <label class="demo-only">Number of drones<select id="demo-count">${FLEET_SIZES.map(n=>`<option value="${n}">${n.toLocaleString()}</option>`).join('')}</select></label>
    <label class="demo-only">Drone light shape<select id="demo-shape"><option value="round">Round glow</option><option value="diamond">Diamond</option><option value="star">Star</option></select></label>
    <label>Graphics quality<select id="demo-quality"><option value="auto">Auto (recommended)</option><option value="high">Cinematic · bloom, reflections, drone bodies</option><option value="balanced">Balanced · bloom, lighter reflections</option><option value="battery">Battery saver · no post effects</option></select></label>
    <label>Background<select id="demo-sky"><option value="night">Dark night</option><option value="afternoon">Late afternoon</option></select></label>
    <label class="demo-only">Formation size / spacing<select id="demo-scale"><option value="2">4× original size</option><option value="3">6× original size (default)</option><option value="4">8× original size</option></select></label>
    <label class="switch-row demo-only"><span>Ship fireworks<small>Barges and the yacht launch real fireworks during Happy day, the drone fireworks and the finale</small></span><input type="checkbox" id="demo-pyro"></label>
    <label class="switch-row demo-only"><span>Stage lasers<small>Beams from the launch deck light up the takeoff and the landing</small></span><input type="checkbox" id="demo-lasers"></label>
    <label>Camera when you drag<select id="demo-camera"><option value="follow">Stay around the show (recommended)</option><option value="free">Free orbit</option></select></label>
    <fieldset class="demo-only"><legend>Add falling yellow fire to</legend>${FORMATIONS.map((name,i)=>`<label><input type="checkbox" id="demo-fire-${i}">${name}</label>`).join('')}</fieldset>
    <p class="demo-only">Lower drone counts leave more space between lights and reduce phone workload. Drag to orbit and see the depth. Scale increases world-space spacing; it is not a flight-separation guarantee.</p>
    <p id="demo-settings-status" role="status"></p><div class="demo-actions"><button type="button" id="demo-edit" class="demo-only" title="Open this Demo in the Show editor to rearrange, retime or add formations and save it">✎ Edit in Show editor</button><button type="button" id="demo-cancel">Cancel</button><button class="primary" type="submit" id="demo-apply">Apply &amp; play Demo</button></div></form>`;
  document.body.append(dialog);
  const $=id=>document.getElementById(id);
  // Yield a frame first so the "Preparing" state paints before the synchronous compile.
  async function load(value){assets??=(await import('./formation-assets.js')).default;await new Promise(r=>requestAnimationFrame(()=>setTimeout(r)));return compileDemo(assets,value);}
  async function launch(){const request=++generation,button=$('drone-demo');button.setAttribute('aria-busy','true');button.classList.add('busy');try{const show=cached??await load(settings);if(request!==generation||document.querySelector('dialog[open]'))return;cached=show;play(show);}catch(error){notify('Could not load Demo: '+error.message,true);}finally{button.removeAttribute('aria-busy');button.classList.remove('busy');}}
  // For the Demo (or before any show) the dialog sets up the Demo; while another show plays it offers the player options only.
  const demoMode=()=>!player()?.active||!!player().show?.demo;
  function open(){if(player()?.recorder.active)return;generation++;opener=document.activeElement;wasPlaying=!!player()?.active&&player().clock.playing;if(wasPlaying)player().toggle();
    const demo=demoMode();dialog.classList.toggle('player-settings',!demo);$('demo-settings-title').textContent=demo?'Demo settings':'Player settings';$('demo-apply').textContent=demo?'Apply & play Demo':'Apply';
    $('demo-count').value=settings.count;$('demo-quality').value=player()?.quality||'auto';$('demo-shape').value=settings.shape;$('demo-pyro').checked=settings.pyro;$('demo-lasers').checked=settings.lasers;$('demo-camera').value=player()?.cameraMode||'follow';$('demo-sky').value=player()?.sky||'night';$('demo-scale').value=settings.scale;FORMATIONS.forEach((name,i)=>$('demo-fire-'+i).checked=settings.fire[name]);$('demo-settings-status').textContent='';dialog.showModal();}
  function cancel(){generation++;dialog.close();if(wasPlaying&&player()?.active&&!player().clock.playing)player().toggle();opener?.focus();}
  $('demo-cancel').onclick=cancel;dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});dialog.addEventListener('keydown',e=>e.stopPropagation());
  const chosen=()=>demoSettings({count:Number($('demo-count').value),shape:$('demo-shape').value,scale:Number($('demo-scale').value),pyro:$('demo-pyro').checked,lasers:$('demo-lasers').checked,fire:Object.fromEntries(FORMATIONS.map((name,i)=>[name,$('demo-fire-'+i).checked]))});
  // Straight from the Demo to the Show editor, with these settings and the formation now on screen selected.
  $('demo-edit').onclick=()=>{generation++;const p=player(),time=p?.active?p.clock.time:0,focus=p?.active?[...p.show.cues].reverse().find(c=>c.time<=time+1)?.label:undefined;dialog.close();wasPlaying=false;if(p?.active)p.stop();edit?.(chosen(),focus);};
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();
    if(!demoMode()){const quality=$('demo-quality').value;player().setCameraMode($('demo-camera').value);player().setSky($('demo-sky').value);if(QUALITY_LEVELS.includes(quality))player().setQuality(quality);dialog.close();if(wasPlaying&&player()?.active&&!player().clock.playing)player().toggle();wasPlaying=false;return;}
    const request=++generation,submit=e.submitter;submit.disabled=true;$('demo-settings-status').textContent='Preparing formations…';
    try{const next=chosen();const show=await load(next);
      // A dismissed dialog must not restart playback when a delayed asset fetch returns.
      if(!dialog.open||request!==generation)return;settings=next;cached=show;try{localStorage.setItem(key,JSON.stringify(settings));}catch{notify('Demo settings could not be saved on this device.');}
      const quality=$('demo-quality').value;if(QUALITY_LEVELS.includes(quality)){try{localStorage.setItem('draw3d-graphics-v1',quality);}catch{}if(player())player().quality=quality;}
      player()?.setCameraMode($('demo-camera').value);
      const sky=$('demo-sky').value;if(SKY_MODES.includes(sky)){try{localStorage.setItem(SKY_KEY,sky);}catch{}if(player())player().sky=sky;}
      dialog.close();wasPlaying=false;if(player()?.active)player().stop();play(show);
    }catch(error){$('demo-settings-status').textContent=error.message;}finally{submit.disabled=false;}};
  $('drone-demo').onclick=launch;$('drone-demo-settings').onclick=open;$('show-demo-settings').onclick=open;
}
