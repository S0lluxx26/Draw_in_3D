// Graphics quality tiers for the sky show. Pure, so it can be tested without a GPU.
// high: bloom, water reflection, drone bodies · balanced: bloom, cheaper reflection · battery: direct render.
export const QUALITY_LEVELS=['auto','high','balanced','battery'];
export const TIERS={
  high:{bloom:true,reflection:.5,bodies:true,pixelRatio:2,stars:1},
  balanced:{bloom:true,reflection:.3,bodies:false,pixelRatio:1.5,stars:.75},
  battery:{bloom:false,reflection:0,bodies:false,pixelRatio:1,stars:.5}
};
export function detectTier(env={}){
  const {mobile=false,cores=4,memory=4,saveData=false,maxTexture=4096,webgl2=true}=env;
  if(saveData||!webgl2||maxTexture<4096)return 'battery';
  if(!mobile&&cores>=6&&memory>=4)return 'high';
  if(!mobile||(cores>=8&&memory>=6))return 'balanced';
  return 'battery';
}
export function browserEnvironment(renderer){
  const nav=globalThis.navigator||{},coarse=globalThis.matchMedia?.('(pointer:coarse)').matches;
  return {mobile:/Android|iPhone|iPad|Mobile/i.test(nav.userAgent||'')||(!!coarse&&(nav.maxTouchPoints||0)>1),cores:nav.hardwareConcurrency||4,memory:nav.deviceMemory||4,
    saveData:!!nav.connection?.saveData,maxTexture:renderer?.capabilities?.maxTextureSize??4096,webgl2:renderer?.capabilities?.isWebGL2!==false};
}
export function resolveTier(choice,env){return TIERS[choice]?choice:detectTier(env);}
// Frame-time governor: lowers the render scale when frames are slow, recovers slowly when fast.
export class FrameGovernor{
  constructor(max=1,min=.6){this.max=max;this.min=min;this.scale=max;this.average=16.7;this.last=0;this.changed=0;}
  sample(now){
    if(!this.last){this.last=now;return this.scale;}
    const dt=Math.min(250,now-this.last);this.last=now;this.average+=(dt-this.average)*.08;
    if(now-this.changed<1500)return this.scale;
    if(this.average>38&&this.scale>this.min){this.scale=Math.max(this.min,+(this.scale-.15).toFixed(2));this.changed=now;}
    else if(this.average<20&&this.scale<this.max){this.scale=Math.min(this.max,+(this.scale+.1).toFixed(2));this.changed=now;}
    return this.scale;
  }
  reset(){this.last=0;this.average=16.7;this.scale=this.max;this.changed=0;}
}
