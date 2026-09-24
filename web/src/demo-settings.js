import {demoSettings,compileDemo,FLEET_SIZES,FORMATIONS} from './demo-library.js';
import {QUALITY_LEVELS} from './quality.js';
export {FLEET_SIZES,LIGHT_SHAPES,FORMATIONS,demoSettings,compileDemo} from './demo-library.js';

export function installDemoSettings({play,player,notify}){
  const key='draw3d-demo-settings-v1';let settings=demoSettings(),assets,cached,wasPlaying=false,opener,generation=0;
  try{settings=demoSettings(JSON.parse(localStorage.getItem(key)));}catch{}
  const dialog=document.createElement('dialog');dialog.id='demo-settings';dialog.setAttribute('aria-labelledby','demo-settings-title');
  dialog.innerHTML=`<form><h2 id="demo-settings-title">Demo settings</h2><p>Blender-built 3D formations. Settings apply to this Demo; saved shows stay independent.</p>
    <label>Number of drones<select id="demo-count">${FLEET_SIZES.map(n=>`<option value="${n}">${n.toLocaleString()}</option>`).join('')}</select></label>
    <label>Drone light shape<select id="demo-shape"><option value="round">Round glow</option><option value="diamond">Diamond</option><option value="star">Star</option></select></label>
    <label>Graphics quality<select id="demo-quality"><option value="auto">Auto (recommended)</option><option value="high">Cinematic · bloom, reflections, drone bodies</option><option value="balanced">Balanced · bloom, lighter reflections</option><option value="battery">Battery saver · no post effects</option></select></label>
    <label>Formation size / spacing<select id="demo-scale"><option value="2">4× original size</option><option value="3">6× original size (default)</option><option value="4">8× original size</option></select></label>
    <label class="switch-row"><span>Ship fireworks<small>Barges and the yacht launch real fireworks during Happy day, the drone fireworks and the finale</small></span><input type="checkbox" id="demo-pyro"></label>
    <label class="switch-row"><span>Stage lasers<small>Beams from the launch deck light up the takeoff and the landing</small></span><input type="checkbox" id="demo-lasers"></label>
    <label>Camera when you drag<select id="demo-camera"><option value="follow">Stay around the show (recommended)</option><option value="free">Free orbit</option></select></label>
    <fieldset><legend>Add falling yellow fire to</legend>${FORMATIONS.map((name,i)=>`<label><input type="checkbox" id="demo-fire-${i}">${name}</label>`).join('')}</fieldset>
    <p>Lower drone counts leave more space between lights and reduce phone workload. Drag to orbit and see the depth. Scale increases world-space spacing; it is not a flight-separation guarantee.</p>
    <p id="demo-settings-status" role="status"></p><div class="demo-actions"><button type="button" id="demo-cancel">Cancel</button><button class="primary" type="submit">Apply &amp; play Demo</button></div></form>`;
  document.body.append(dialog);
  const $=id=>document.getElementById(id);
  // Yield a frame first so the "Preparing" state paints before the synchronous compile.
  async function load(value){assets??=(await import('./formation-assets.js')).default;await new Promise(r=>requestAnimationFrame(()=>setTimeout(r)));return compileDemo(assets,value);}
  async function launch(){const request=++generation,button=$('drone-demo');button.setAttribute('aria-busy','true');button.classList.add('busy');try{const show=cached??await load(settings);if(request!==generation||document.querySelector('dialog[open]'))return;cached=show;play(show);}catch(error){notify('Could not load Demo: '+error.message,true);}finally{button.removeAttribute('aria-busy');button.classList.remove('busy');}}
  function open(){if(player()?.recorder.active)return;generation++;opener=document.activeElement;wasPlaying=!!player()?.active&&player().clock.playing;if(wasPlaying)player().toggle();
    $('demo-count').value=settings.count;$('demo-quality').value=player()?.quality||'auto';$('demo-shape').value=settings.shape;$('demo-pyro').checked=settings.pyro;$('demo-lasers').checked=settings.lasers;$('demo-camera').value=player()?.cameraMode||'follow';$('demo-scale').value=settings.scale;FORMATIONS.forEach((name,i)=>$('demo-fire-'+i).checked=settings.fire[name]);$('demo-settings-status').textContent='';dialog.showModal();}
  function cancel(){generation++;dialog.close();if(wasPlaying&&player()?.active&&!player().clock.playing)player().toggle();opener?.focus();}
  $('demo-cancel').onclick=cancel;dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const request=++generation,submit=e.submitter;submit.disabled=true;$('demo-settings-status').textContent='Preparing formations…';
    try{const next=demoSettings({count:Number($('demo-count').value),shape:$('demo-shape').value,scale:Number($('demo-scale').value),pyro:$('demo-pyro').checked,lasers:$('demo-lasers').checked,fire:Object.fromEntries(FORMATIONS.map((name,i)=>[name,$('demo-fire-'+i).checked]))});const show=await load(next);
      // A dismissed dialog must not restart playback when a delayed asset fetch returns.
      if(!dialog.open||request!==generation)return;settings=next;cached=show;try{localStorage.setItem(key,JSON.stringify(settings));}catch{notify('Demo settings could not be saved on this device.');}
      const quality=$('demo-quality').value;if(QUALITY_LEVELS.includes(quality)){try{localStorage.setItem('draw3d-graphics-v1',quality);}catch{}if(player())player().quality=quality;}
      player()?.setCameraMode($('demo-camera').value);
      dialog.close();wasPlaying=false;if(player()?.active)player().stop();play(show);
    }catch(error){$('demo-settings-status').textContent=error.message;}finally{submit.disabled=false;}};
  $('drone-demo').onclick=launch;$('drone-demo-settings').onclick=open;$('show-demo-settings').onclick=open;
}
