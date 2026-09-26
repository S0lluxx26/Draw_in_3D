// Procedural soundtrack for drone shows. The score is a pure function of the show: each stage picks a
// mood (intro, lift, build, drop, peak, spark, outro, end) on a 120 BPM grid, so the Demo's whole-second
// stage boundaries land exactly on beats, and ship-firework bursts get booms at their exact burst times.
// Web Audio synthesises everything (no audio files) a moment ahead of the show clock, so pause, seek,
// speed and recording stay in step with the lights.
import {pyroSchedule} from './pyro.js';

export const BPM=120,BEAT=60/BPM,STEP=BEAT/4,BAR=4*BEAT;
const MUSIC_KEY='draw3d-music-v1',LOOKAHEAD=.35,TICK_MS=40,RESYNC=.12;
// C major, opening on its relative minor (vi–IV–I–V). Voicings sit around middle C; bass an octave or two below.
const CHORDS={Am:{bass:45,tones:[57,60,64]},F:{bass:41,tones:[57,60,65]},C:{bass:48,tones:[55,60,64]},G:{bass:43,tones:[55,59,62]}};
const PROGRESSION=['Am','F','C','G'],LIFT=['C','F','G','G'],HOME=['C','G','Am','F'];
const ARPS=[[0,1,2,3,1,2,3,4,2,3,4,5,3,4,5,4],[0,2,1,3,2,4,3,5,0,2,1,3,2,4,3,5],[5,4,3,2,4,3,2,1,3,2,1,0,2,1,0,1]];
// Lead melodies, one bar per chord: [16th step, MIDI note, length in 16ths]. The 3-3-2 syncopation keeps them driving.
const MELODIES=[[
  [[0,76,3],[3,74,3],[6,72,2],[8,74,2],[10,76,4],[14,79,2]],
  [[0,81,3],[3,79,3],[6,77,2],[8,76,2],[10,72,4],[14,74,2]],
  [[0,76,3],[3,74,3],[6,72,2],[8,76,2],[10,79,4],[14,81,2]],
  [[0,83,3],[3,81,3],[6,79,2],[8,74,2],[10,71,6]]],[
  [[0,69,2],[2,72,2],[4,76,2],[6,72,2],[8,81,4],[12,79,2],[14,76,2]],
  [[0,69,2],[2,72,2],[4,77,2],[6,72,2],[8,81,4],[12,79,2],[14,77,2]],
  [[0,67,2],[2,72,2],[4,76,2],[6,72,2],[8,79,4],[12,76,2],[14,72,2]],
  [[0,67,2],[2,71,2],[4,74,2],[6,79,2],[8,83,6],[14,81,2]]]];
const hz=n=>440*2**((n-69)/12),EPS=1e-6;
const hash=(a,b)=>{let h=Math.imul(a+1,2654435761)^Math.imul(b+7,1597334677);h=Math.imul(h^h>>>15,2246822507);return ((h^h>>>13)>>>0)/4294967296;};

// Sections follow the show's stages: moves build up, formations drop, drone fireworks peak in a lifted key.
export function musicPlan(show){
  // With ship fireworks, the cinematic landing is the finale: a build on the way home, then a peak under the fireworks.
  const q=t=>Math.round(t/BEAT)*BEAT,sections=[],grand=show.pyro!==false&&show.stages.some(s=>s.kind==='landing'&&s.reverse);
  show.stages.forEach((s,i)=>{
    const next=show.stages[i+1],start=q(s.start),end=q(s.end),last=sections.at(-1);
    const mood=s.kind==='takeoff'?'lift':s.kind==='landing'?(grand?'finale':'outro'):s.kind==='move'&&next?.kind==='landing'?(grand?'homebound':'outro'):s.within||s.phrase&&!s.reveal?'drop':s.kind==='move'?'build':s.kind==='grow'||s.kind==='burst'||s.kind==='beat'||s.kind==='spin'?'peak':s.kind==='fall'?'spark':s.kind==='rise'||s.reveal||s.climax?'drop':i?'end':'intro';
    if(end<=start)return;
    if(last?.mood===mood&&(mood==='outro'||mood==='end'||s.kind==='beat'||s.kind==='spin'||s.within||s.phrase&&!s.reveal))last.end=end;/* the heartbeat continues the heart's peak */else sections.push({mood,start,end,name:s.name});
  });
  const drops=sections.filter(s=>s.mood==='drop').length,lifted=drops>=4?Math.ceil(drops/2):Infinity;let d=0,p=0;
  for(const s of sections){if(s.mood==='drop')s.index=d++;if(s.mood==='peak')s.index=p++;s.shift=(s.mood==='drop'?s.index>=lifted:['peak','spark','finale'].includes(s.mood)&&d>=lifted)?2:0;}
  for(let i=sections.length-2;i>=0;i--)if(sections[i].mood==='build'||sections[i].mood==='homebound')sections[i].shift=sections[i+1].shift;
  // Only timing matters here, and shell timing does not depend on where the launchers are.
  const booms=[];for(const sh of pyroSchedule(show,[[0,0,0]])){
    booms.push({t:sh.t0,voice:'launch',g:.09,dur:.1});
    booms.push({t:sh.t0+sh.delay,voice:'boom',g:.42*Math.min(1.3,sh.radius/75),dur:.1,crackle:['crossette','strobe','willow','crown'].includes(sh.pattern),seed:sh.seed%100000});
  }
  // Shells fired together (the finale's wall) share one fuller hit instead of stacking a dozen.
  const merged=[];for(const b of booms.sort((a,b)=>a.t-b.t)){const same=merged.findLast(m=>m.voice===b.voice&&b.t-m.t<.06);if(same){same.g=Math.min(b.voice==='boom'?.8:.16,same.g+b.g*.3);same.crackle||=b.crackle;}else merged.push({...b});}
  return {sections,booms:merged,duration:show.duration};
}

function stepEvents(sec,k,out,seed){
  const t=sec.start+k*STEP,s=k%16,bar=Math.floor(k/16),sub=s%4,len=sec.end-sec.start,p=(t-sec.start)/len,left=sec.end-t,x=sec.shift||0,m=sec.mood;
  const ch=CHORDS[m==='intro'?'Am':m==='lift'?LIFT[bar%4]:m==='build'?(t-sec.start<len*.45?'F':'G'):m==='outro'?HOME[Math.floor(bar/2)%4]:m==='end'?'C':PROGRESSION[bar%4]];
  const hit=(voice,g,more)=>out.push({t,voice,g,dur:.1,...more}),tone=(voice,n,dur,g,more)=>out.push({t,voice,n:n+x,dur,g,...more});
  const arp=(pattern,g,bright)=>tone('pluck',ch.tones[pattern[s]%3]+12*Math.floor(pattern[s]/3)+12,STEP*1.6,g,{bright});
  const pad=(dur,g)=>out.push({t,voice:'pad',notes:ch.tones.map(n=>n+x),dur,g});
  const sparkle=(chance,g,dur)=>{if(hash(seed,k)<chance)tone('bell',ch.tones[Math.floor(hash(k,seed)*3)]+24,dur,g);};
  switch(m){
    case 'intro':// launch pads close-up: a soft pad swelling toward takeoff
      if(k===0){pad(len,.35);hit('riser',.12,{dur:len});}
      if(sub%2===0)arp(ARPS[0],.07,.25);break;
    case 'lift':
      if(k===0){hit('crash',.3);hit('impact',.5);hit('riser',.14,{dur:len});}
      if(s===0)pad(Math.min(BAR,left),.4);
      if(sub===0)hit('kick',.85,{pump:true});if(sub===2){hit('hat',.18,{open:true});tone('bass',ch.bass,STEP*1.7,.3,{cut:300+1500*p});}if(s%2)hit('hat',.06);
      arp(ARPS[0],.07,.3+.5*p);if(left<=BEAT+EPS)hit('snare',.15+.25*(1-left/BEAT));break;
    case 'build':case 'homebound':{// filter sweeps, a riser and a snare roll into the next formation; the last beat drops out
      const gap=left<=BEAT+EPS;
      if(k===0)hit('riser',.2,{dur:len});
      if(s===0)pad(Math.min(BAR,left),.34);
      if(sub===0&&left>BAR+EPS)hit('kick',.75,{pump:true});
      if(!gap){hit('hat',.03+.09*p);if(sub%2===0)tone('bass',ch.bass,STEP*1.4,.2,{cut:250+2000*p});arp(ARPS[1],.075,.2+.7*p);}
      if(left<=2*BAR+EPS&&(left<=BAR+EPS||sub%2===0))hit('snare',.12+.38*(1-left/(2*BAR)));
      if(Math.abs(left-BAR)<EPS)tone('sweep',ch.tones[0],BAR,.06);
      break;}
    case 'drop':case 'peak':case 'finale':{// formation reveal: four-on-the-floor, offbeat bass, arpeggio and lead
      const peak=m==='peak'||m==='finale',idx=sec.index||0;
      if(k===0){hit('crash',peak?.45:.38);hit('impact',peak?.9:.75);}else if(s===0&&(peak||bar%4===0))hit('crash',.2);
      if(s===0)pad(Math.min(BAR,left),.28);
      if(sub===0)hit('kick',1,{pump:true});if(s===4||s===12)hit('clap',.4);
      if(sub===2)hit('hat',.2,{open:true});else if(s%2)hit('hat',.06);
      if(sub===2)tone('bass',ch.bass,STEP*1.7,.34,{cut:1300});if(sub===3)tone('bass',ch.bass+12,STEP*.9,.16,{cut:1800});
      arp(ARPS[idx%2],.08,.85);
      if(peak||idx>0)for(const [step,n,length] of MELODIES[(idx+(peak?1:0))%2][bar%4])if(step===s){tone('lead',n,length*STEP,.14);if(peak)tone('bell',n+12,length*STEP,.045);}
      break;}
    case 'spark':// falling sparks: half-time groove, descending arpeggio, glittering bells
      if(k===0)hit('crash',.25);
      if(s===0){pad(Math.min(BAR,left),.3);tone('bass',ch.bass,Math.min(BAR*.95,left),.28,{cut:800});}
      if(s===0||s===10)hit('kick',s?.55:.85,{pump:true});if(s===8)hit('clap',.42);hit('hat',s%2?.035:.07);
      arp(ARPS[2],.07,.7);sparkle(.3,.06,.8);break;
    case 'outro':{// returning home and landing: pads, soft arpeggio and a fading heartbeat
      const fade=1-.65*p;
      if(s===0&&bar%2===0){pad(Math.min(2*BAR,left),.35*fade);tone('bass',ch.bass-12,Math.min(2*BAR,left),.18*fade,{cut:500});}
      if(sub%2===0)arp(ARPS[0],.06*fade,.3);if(s===0&&p<.45)hit('kick',.45*fade);if(sub===2&&p<.6)hit('hat',.05*fade,{open:true});
      if(sub===0)sparkle(.12,.05*fade,1);break;}
    case 'end':
      if(k===0){pad(len,.4);tone('bass',ch.bass-12,len,.15,{cut:450});tone('bell',84,2.5,.1);hit('crash',.14);}
      break;
  }
}
// Every note that starts in [from, to), in time order. Adjacent windows never repeat or skip an event.
export function musicEvents(plan,from,to){
  const out=[];
  plan.sections.forEach((sec,i)=>{
    if(sec.end<=from||sec.start>=to)return;
    const step=v=>Math.ceil((v-sec.start)/STEP-EPS);
    for(let k=Math.max(0,step(from)),last=step(Math.min(to,sec.end));k<last;k++)stepEvents(sec,k,out,i);
  });
  for(const b of plan.booms)if(b.t>=from&&b.t<to)out.push(b);
  return out.sort((a,b)=>a.t-b.t);
}
// Long notes already sounding at `time`, so a seek resumes mid-phrase instead of in silence.
export function sustainedAt(plan,time){return musicEvents(plan,Math.max(0,time-30),time).filter(e=>e.dur>=.9&&e.t+e.dur>time+.05);}

export class ShowMusic{
  constructor(getClock,{context=null}={}){
    this.getClock=getClock;this.ctx=context;this.plan=null;this.anchor=null;this.gen=null;this.timer=0;this.tap=null;
    try{this.enabled=localStorage.getItem(MUSIC_KEY)!=='off';}catch{this.enabled=true;}
    this.unlock=()=>{if(this.plan)this.prime();};if(this.ctx)this.build();
  }
  // on · off (muted by the viewer) · locked (waiting for a tap: browser autoplay rules) · unavailable
  get state(){if(!this.enabled)return 'off';if(!this.ctx)return globalThis.AudioContext||globalThis.webkitAudioContext?'locked':'unavailable';return this.ctx.state==='running'?'on':'locked';}
  // Create or resume the audio context. Browsers allow this only after a user gesture on the page.
  prime(){
    if(!this.enabled)return;
    if(!this.ctx){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;try{this.ctx=new AC();}catch{return;}this.build();}
    if(this.ctx.state!=='running'&&this.ctx.state!=='closed')this.ctx.resume?.().catch(()=>{});
  }
  build(){
    const c=this.ctx,rate=c.sampleRate;
    // Unlocked by a tap, or suspended by the browser (e.g. an iOS interruption): update at once.
    c.onstatechange=()=>{this.onchange?.();this.tick();};
    this.noise=c.createBuffer(1,rate*2,rate);const white=this.noise.getChannelData(0);let seed=1;for(let i=0;i<white.length;i++){seed=Math.imul(seed,1664525)+1013904223|0;white[i]=seed/2147483648;}
    // A limiter keeps kicks, booms and chords from clipping when they coincide.
    const l=this.limiter=c.createDynamicsCompressor();l.threshold.value=-10;l.knee.value=6;l.ratio.value=12;l.attack.value=.003;l.release.value=.25;l.connect(c.destination);
    this.master=c.createGain();this.master.gain.value=.7;this.master.connect(l);
    // Sidechain "pump": each kick plays this one-beat dip into the synth bus gain. Short sources keep
    // the cost flat; thousands of automation events on one long-lived gain slow Chrome down over a show.
    this.duck=c.createBuffer(1,Math.round(rate*.4),rate);const dip=this.duck.getChannelData(0);for(let i=0;i<dip.length;i++){const t=i/rate;dip[i]=-.65*Math.min(1,t/.005)*Math.exp(-t/.08);}
    const ir=c.createBuffer(2,Math.round(rate*2.4),rate);for(let ch=0;ch<2;ch++){const data=ir.getChannelData(ch);for(let i=0;i<data.length;i++){seed=Math.imul(seed,1664525)+1013904223|0;data[i]=seed/2147483648*(1-i/data.length)**3;}}
    this.reverb=c.createConvolver();this.reverb.buffer=ir;const wet=c.createGain();wet.gain.value=.35;this.reverb.connect(wet).connect(this.master);
    this.echo=c.createDelay(1);this.echo.delayTime.value=3*STEP;const feedback=c.createGain(),damp=c.createBiquadFilter(),echoWet=c.createGain();
    feedback.gain.value=.3;damp.type='lowpass';damp.frequency.value=2800;echoWet.gain.value=.22;this.echo.connect(damp).connect(feedback).connect(this.echo);damp.connect(echoWet).connect(this.master);
  }
  start(show){
    this.flush();this.plan=musicPlan(show);this.prime();clearInterval(this.timer);this.timer=setInterval(()=>this.tick(),TICK_MS);
    for(const type of ['pointerdown','keydown'])globalThis.addEventListener?.(type,this.unlock,true);
  }
  stop(){
    clearInterval(this.timer);this.timer=0;this.flush(.08);this.plan=null;
    for(const type of ['pointerdown','keydown'])globalThis.removeEventListener?.(type,this.unlock,true);
    if(this.ctx?.state==='running')setTimeout(()=>{if(!this.plan)this.ctx.suspend?.().catch(()=>{});},400);// idle audio hardware costs battery
  }
  toggle(){this.enabled=!this.enabled;try{localStorage.setItem(MUSIC_KEY,this.enabled?'on':'off');}catch{}if(this.enabled)this.prime();else this.flush(.08);this.tick();return this.enabled;}
  // Called every 40 ms and on every player refresh: follows the show clock and schedules a little ahead.
  tick(now=performance.now()){
    const c=this.ctx,clock=this.getClock(),plan=this.plan;if(!c||!clock||!plan)return;
    const time=clock.read(now);
    if(!(clock.playing&&this.enabled&&c.state==='running')){if(this.gen)this.flush(time>=plan.duration-EPS?1.6:.04);return;}// the last chord rings out
    const at=c.currentTime,rate=clock.rate;
    if(this.anchor&&(rate!==this.anchor.rate||Math.abs(this.anchor.show+(at-this.anchor.audio)*rate-time)>RESYNC))this.flush(.04);// seek, restart or speed change
    if(!this.anchor){
      // Output latency is compensated so booms reach the ear with their flashes.
      this.anchor={audio:at,show:time,rate,lag:Math.min(.25,c.outputLatency||c.baseLatency||0)};this.cursor=time;this.gen=this.generation();
      for(const e of sustainedAt(plan,time))this.play(e,at,rate,(time-e.t)/rate);
    }
    const a=this.anchor,to=Math.min(plan.duration,a.show+(at+LOOKAHEAD-a.audio)*rate);
    // Notes due within the latency window play at once (the first beat after a start or seek); only
    // notes left behind by a stalled main thread are skipped.
    if(to>this.cursor){for(const e of musicEvents(plan,this.cursor,to)){const when=a.audio-a.lag+(e.t-a.show)/rate;if(when>=at-a.lag-.03)this.play(e,Math.max(at,when),rate);}this.cursor=to;}
  }
  // Each playback run gets its own buses, so a seek or pause silences exactly what was scheduled ahead.
  generation(){const c=this.ctx,g={bus:c.createGain(),pump:c.createGain(),rev:c.createGain(),echo:c.createGain(),sources:new Set()};g.bus.connect(this.master);g.pump.connect(g.bus);g.rev.connect(this.reverb);g.echo.connect(this.echo);return g;}
  flush(fade=.04){
    const g=this.gen;this.gen=null;this.anchor=null;if(!g)return;const at=this.ctx.currentTime;
    for(const n of [g.bus,g.rev,g.echo]){n.gain.cancelScheduledValues(at);n.gain.setValueAtTime(n.gain.value,at);n.gain.linearRampToValueAtTime(0,at+fade);}
    for(const s of g.sources)try{s.stop(at+fade+.02);}catch{}
    setTimeout(()=>{for(const n of [g.bus,g.pump,g.rev,g.echo])n.disconnect();},(fade+.15)*1000);
  }
  // A fresh audio track per recording: stopping a recorded track must not silence the next one.
  capture(){if(this.state!=='on'||!this.ctx.createMediaStreamDestination)return null;this.release();this.tap=this.ctx.createMediaStreamDestination();this.limiter.connect(this.tap);return this.tap.stream.getAudioTracks()[0]||null;}
  release(){if(this.tap){try{this.limiter.disconnect(this.tap);}catch{}this.tap=null;}}

  // Finished notes are disconnected right away: waiting for garbage collection lets thousands of
  // silent nodes pile up in the audio graph over a five-minute show.
  track(node){this.note.nodes.push(node);return node;}
  run(node,when,stop){const g=this.gen,note=this.note;node.start(when);node.stop(stop);g.sources.add(node);note.live++;
    node.onended=()=>{g.sources.delete(node);if(--note.live===0)for(const n of note.nodes)n.disconnect();};return node;}
  gain(){return this.track(this.ctx.createGain());}
  osc(type,freq,when){const o=this.track(this.ctx.createOscillator());o.type=type;o.frequency.setValueAtTime(freq,when);return o;}
  filter(type,freq,q=.7){const f=this.track(this.ctx.createBiquadFilter());f.type=type;f.frequency.value=freq;f.Q.value=q;return f;}
  noiseSource(){const s=this.track(this.ctx.createBufferSource());s.buffer=this.noise;s.loop=true;return s;}
  perc(param,when,g,decay,attack=.002){param.setValueAtTime(0,when);param.linearRampToValueAtTime(g,when+attack);param.exponentialRampToValueAtTime(1e-4,when+attack+decay);}
  send(node,{drum=false,rev=0,echo=0}={}){
    const g=this.gen;node.connect(drum?g.bus:g.pump);// melodic parts duck under the kick (sidechain pump)
    for(const [amount,target] of [[rev,g.rev],[echo,g.echo]])if(amount){const s=this.gain();s.gain.value=amount;node.connect(s).connect(target);}
  }
  play(e,when,rate,off=0){
    const g=this.gen,d=Math.max(.03,e.dur/rate-off),v=e.g,amp=()=>this.gain();this.note={nodes:[],live:0};
    switch(e.voice){
      case 'kick':{const o=this.osc('sine',150,when),a=amp();o.frequency.exponentialRampToValueAtTime(45,when+.12);this.perc(a.gain,when,v,.38,.001);o.connect(a);this.send(a,{drum:true});this.run(o,when,when+.45);
        if(e.pump){const dip=this.track(this.ctx.createBufferSource());dip.buffer=this.duck;dip.playbackRate.value=rate;dip.connect(g.pump.gain);this.run(dip,when,when+.4/rate);}break;}
      case 'hat':{const s=this.noiseSource(),f=this.filter('highpass',e.open?6500:8000,.8),a=amp();this.perc(a.gain,when,v,e.open?.16:.04);s.connect(f).connect(a);this.send(a,{drum:true});this.run(s,when,when+.25);break;}
      case 'clap':{const s=this.noiseSource(),f=this.filter('bandpass',1500,1.1),a=amp(),p=a.gain;p.setValueAtTime(0,when);
        for(const dt of [0,.011,.022]){p.setValueAtTime(v,when+dt);p.linearRampToValueAtTime(v*.25,when+dt+.009);}p.setValueAtTime(v,when+.031);p.exponentialRampToValueAtTime(1e-4,when+.24);
        s.connect(f).connect(a);this.send(a,{drum:true,rev:.4});this.run(s,when,when+.3);break;}
      case 'snare':{const s=this.noiseSource(),f=this.filter('bandpass',2400,.6),a=amp(),o=this.osc('triangle',190,when),b=amp();this.perc(a.gain,when,v,.13);this.perc(b.gain,when,v*.6,.07);
        s.connect(f).connect(a);o.connect(b);this.send(a,{drum:true,rev:.2});this.send(b,{drum:true});this.run(s,when,when+.2);this.run(o,when,when+.12);break;}
      case 'crash':{const s=this.noiseSource(),f=this.filter('highpass',4500,.4),a=amp();this.perc(a.gain,when,v,2.4);s.connect(f).connect(a);this.send(a,{drum:true,rev:.35});this.run(s,when,when+2.5);break;}
      case 'impact':case 'boom':{// formation arrival / firework burst: a deep drop plus a noise blast
        const long=e.voice==='boom',o=this.osc('sine',long?80:110,when),a=amp(),s=this.noiseSource(),f=this.filter('lowpass',long?2400:500,.5),b=amp();
        o.frequency.exponentialRampToValueAtTime(long?26:30,when+(long?1.1:.9));this.perc(a.gain,when,v,1.3,.004);o.connect(a);this.send(a,{drum:true,rev:.5});this.run(o,when,when+1.45);
        if(long){f.frequency.setValueAtTime(2400,when);f.frequency.exponentialRampToValueAtTime(300,when+.9);}this.perc(b.gain,when,v*(long?.9:.7),long?1:.5);s.connect(f).connect(b);this.send(b,{drum:true,rev:.5});this.run(s,when,when+1.1);
        if(e.crackle){const n=this.noiseSource(),h=this.filter('highpass',3500,.7),k=amp(),p=k.gain;p.setValueAtTime(0,when);
          for(let i=0;i<18;i++){const t=when+.35+i*.06+hash(i,e.seed)*.04;p.setValueAtTime(v*.5*(1-i/18),t);p.setValueAtTime(0,t+.012);}
          n.connect(h).connect(k);this.send(k,{drum:true,rev:.4});this.run(n,when,when+1.6);}
        break;}
      case 'launch':{const s=this.noiseSource(),f=this.filter('bandpass',600,2),a=amp(),o=this.osc('sine',160,when),b=amp();f.frequency.setValueAtTime(600,when);f.frequency.exponentialRampToValueAtTime(2600,when+.5);
        this.perc(a.gain,when,v,.5,.02);s.connect(f).connect(a);this.send(a,{drum:true});this.run(s,when,when+.6);
        o.frequency.exponentialRampToValueAtTime(55,when+.1);this.perc(b.gain,when,v*1.4,.14,.001);o.connect(b);this.send(b,{drum:true});this.run(o,when,when+.2);break;}
      case 'riser':{const s=this.noiseSource(),f=this.filter('bandpass',350,3),a=amp(),k=Math.min(.99,off/(e.dur/rate));
        f.frequency.setValueAtTime(350*20**k,when);f.frequency.exponentialRampToValueAtTime(7000,when+d);a.gain.setValueAtTime(v*k,when);a.gain.linearRampToValueAtTime(v,when+d);a.gain.linearRampToValueAtTime(0,when+d+.05);
        s.connect(f).connect(a);this.send(a,{rev:.3});this.run(s,when,when+d+.06);break;}
      case 'sweep':{const o=this.osc('sawtooth',hz(e.n),when),f=this.filter('lowpass',900,2),a=amp();o.frequency.exponentialRampToValueAtTime(hz(e.n+12),when+d);f.frequency.setValueAtTime(900,when);f.frequency.exponentialRampToValueAtTime(6000,when+d);
        a.gain.setValueAtTime(1e-4,when);a.gain.linearRampToValueAtTime(v,when+d);a.gain.linearRampToValueAtTime(0,when+d+.03);o.connect(f).connect(a);this.send(a,{rev:.3});this.run(o,when,when+d+.05);break;}
      case 'bass':{const f=this.filter('lowpass',e.cut*2.5,5),a=amp(),sub=this.osc('sine',hz(e.n-12),when),level=amp();
        f.frequency.setValueAtTime(e.cut*2.5,when);f.frequency.exponentialRampToValueAtTime(e.cut,when+.12);a.gain.setValueAtTime(0,when);a.gain.linearRampToValueAtTime(v,when+.005);a.gain.setValueAtTime(v,when+d);a.gain.linearRampToValueAtTime(0,when+d+.03);
        for(const cents of [-7,7]){const o=this.osc('sawtooth',hz(e.n),when);o.detune.value=cents;o.connect(f);this.run(o,when,when+d+.05);}
        level.gain.value=.5;sub.connect(level).connect(a);f.connect(a);this.send(a);this.run(sub,when,when+d+.05);break;}
      case 'pluck':{const o=this.osc(e.bright>.6?'sawtooth':'square',hz(e.n),when),f=this.filter('lowpass',500,4),a=amp(),top=500+4500*e.bright;
        f.frequency.setValueAtTime(top,when);f.frequency.exponentialRampToValueAtTime(Math.min(top,450),when+.2);this.perc(a.gain,when,v,.22);o.connect(f).connect(a);this.send(a,{rev:.25,echo:.35});this.run(o,when,when+.3);break;}
      case 'pad':{const f=this.filter('lowpass',1500,.8),a=amp(),level=v*.2,attack=off>0?.05:Math.min(.35,d*.5);
        a.gain.setValueAtTime(0,when);a.gain.linearRampToValueAtTime(level,when+attack);a.gain.setValueAtTime(level,when+d);a.gain.linearRampToValueAtTime(0,when+d+.6);
        for(const n of e.notes)for(const cents of [-9,9]){const o=this.osc('sawtooth',hz(n),when);o.detune.value=cents;o.connect(f);this.run(o,when,when+d+.65);}
        f.connect(a);this.send(a,{rev:.6});break;}
      case 'lead':{const f=this.filter('lowpass',3400,1.5),a=amp(),lfo=this.osc('sine',5.5,when),depth=amp();depth.gain.setValueAtTime(0,when);depth.gain.linearRampToValueAtTime(9,when+Math.min(.3,d));lfo.connect(depth);
        for(const [type,cents] of [['sawtooth',-6],['square',6]]){const o=this.osc(type,hz(e.n),when);o.detune.value=cents;depth.connect(o.detune);o.connect(f);this.run(o,when,when+d+.12);}
        a.gain.setValueAtTime(0,when);a.gain.linearRampToValueAtTime(v,when+.008);a.gain.exponentialRampToValueAtTime(v*.6,when+.008+Math.min(.2,d*.5));a.gain.setValueAtTime(v*.6,when+d);a.gain.linearRampToValueAtTime(0,when+d+.1);
        f.connect(a);this.send(a,{rev:.35,echo:.45});this.run(lfo,when,when+d+.12);break;}
      case 'bell':{const a=amp();this.perc(a.gain,when,v,Math.max(.3,d),.003);
        for(const [ratio,k] of [[1,1],[2.76,.35],[5.4,.12]]){const o=this.osc('sine',hz(e.n)*ratio,when),s=amp();s.gain.value=k;o.connect(s).connect(a);this.run(o,when,when+Math.max(.3,d)+.05);}
        this.send(a,{rev:.6,echo:.3});break;}
    }
  }
}
