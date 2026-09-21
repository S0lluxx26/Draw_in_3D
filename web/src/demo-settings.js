import {buildShow,demoPaths} from './drone-show.js';

export const FLEET_SIZES=[256,512,1024,2048,4096];
export const LIGHT_SHAPES=['round','diamond','star'];
export const FORMATIONS=['Robot','Fish','Eiffel Tower','Big ship','Firework star','Row of fire','Starship launch'];
export function demoSettings(value={}){
  return {count:FLEET_SIZES.includes(value?.count)?value.count:4096,
    shape:LIGHT_SHAPES.includes(value?.shape)?value.shape:'round',
    scale:[2,3,4].includes(value?.scale)?value.scale:3,
    fire:Object.fromEntries(FORMATIONS.map(name=>[name,typeof value?.fire?.[name]==='boolean'?value.fire[name]:['Row of fire','Starship launch'].includes(name)]))};
}
export function compileDemo(assets,value){
  const settings=demoSettings(value),{count}=settings,scale=settings.scale*2;
  const sequence=demoPaths().map(cue=>{
    const asset=assets[cue.name],fireCount=settings.fire[cue.name]?Math.floor(count/8):0,bodyCount=count-fireCount;
    const raw=[...asset.body.positions.slice(0,bodyCount),...asset.fire.positions.slice(0,fireCount)];
    const formation={positions:raw.map(p=>[p[0]*scale,(p[1]+18)*scale,p[2]*scale]),
      colors:[...asset.body.colors.slice(0,bodyCount),...asset.fire.colors.slice(0,fireCount)],
      fire:Array.from({length:count},(_,i)=>i>=bodyCount)};
    return {...cue,transfer:9,formation,fireEnabled:fireCount>0,effect:cue.effect==='starship'?'starship':fireCount?'fire':cue.effect==='sparkle'?'sparkle':'none'};
  });
  const show=buildShow(null,{count,sequence,transitionLights:true,motionScale:scale,reverseLanding:true,fireworks:{trilogy:true}});
  show.lightShape=settings.shape;show.demo=true;return show;
}

export function installDemoSettings({play,player,notify}){
  const key='draw3d-demo-settings-v1';let settings=demoSettings(),assets,cached,wasPlaying=false,opener,generation=0;
  try{settings=demoSettings(JSON.parse(localStorage.getItem(key)));}catch{}
  const dialog=document.createElement('dialog');dialog.id='demo-settings';dialog.setAttribute('aria-labelledby','demo-settings-title');
  dialog.innerHTML=`<form><h2 id="demo-settings-title">Demo settings</h2><p>Blender-built 3D formations. Settings apply to this Demo; saved shows stay independent.</p>
    <label>Number of drones<select id="demo-count">${FLEET_SIZES.map(n=>`<option value="${n}">${n.toLocaleString()}</option>`).join('')}</select></label>
    <label>Drone light shape<select id="demo-shape"><option value="round">Round glow</option><option value="diamond">Diamond</option><option value="star">Star</option></select></label>
    <label>Formation size / spacing<select id="demo-scale"><option value="2">4× original size</option><option value="3">6× original size (default)</option><option value="4">8× original size</option></select></label>
    <fieldset><legend>Add falling yellow fire to</legend>${FORMATIONS.map((name,i)=>`<label><input type="checkbox" id="demo-fire-${i}">${name}</label>`).join('')}</fieldset>
    <p>Lower drone counts leave more space between lights and reduce phone workload. Drag to orbit and see the depth. Scale increases world-space spacing; it is not a flight-separation guarantee.</p>
    <p id="demo-settings-status" role="status"></p><div class="demo-actions"><button type="button" id="demo-cancel">Cancel</button><button class="primary" type="submit">Apply &amp; play Demo</button></div></form>`;
  document.body.append(dialog);
  const $=id=>document.getElementById(id);
  async function load(value){assets??=(await import('./formation-assets.js')).default;return compileDemo(assets,value);}
  async function launch(){const request=++generation;try{const show=cached??await load(settings);if(request!==generation||document.querySelector('dialog[open]'))return;cached=show;play(show);}catch(error){notify('Could not load Demo: '+error.message,true);}}
  function open(){if(player()?.recorder.active)return;generation++;opener=document.activeElement;wasPlaying=!!player()?.active&&player().clock.playing;if(wasPlaying)player().toggle();
    $('demo-count').value=settings.count;$('demo-shape').value=settings.shape;$('demo-scale').value=settings.scale;FORMATIONS.forEach((name,i)=>$('demo-fire-'+i).checked=settings.fire[name]);$('demo-settings-status').textContent='';dialog.showModal();}
  function cancel(){generation++;dialog.close();if(wasPlaying&&player()?.active&&!player().clock.playing)player().toggle();opener?.focus();}
  $('demo-cancel').onclick=cancel;dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const request=++generation,submit=e.submitter;submit.disabled=true;$('demo-settings-status').textContent='Preparing formations…';
    try{const next=demoSettings({count:Number($('demo-count').value),shape:$('demo-shape').value,scale:Number($('demo-scale').value),fire:Object.fromEntries(FORMATIONS.map((name,i)=>[name,$('demo-fire-'+i).checked]))});const show=await load(next);
      // A dismissed dialog must not restart playback when a delayed asset fetch returns.
      if(!dialog.open||request!==generation)return;settings=next;cached=show;try{localStorage.setItem(key,JSON.stringify(settings));}catch{notify('Demo settings could not be saved on this device.');}
      dialog.close();wasPlaying=false;if(player()?.active)player().stop();play(show);
    }catch(error){$('demo-settings-status').textContent=error.message;}finally{submit.disabled=false;}};
  $('drone-demo').onclick=launch;$('drone-demo-settings').onclick=open;$('show-demo-settings').onclick=open;
}
