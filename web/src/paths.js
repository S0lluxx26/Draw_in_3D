export const interpolate=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// Pattern density is bounded by source point count, even for adversarial zigzags.
export function strokePaths(e){
  const points=e.points;if(!e.pattern||e.pattern==='solid'||points.length<2)return [points];
  const lengths=points.slice(1).map((p,i)=>distance(p,points[i]));
  const total=lengths.reduce((a,b)=>a+b,0);if(total<1e-6)return [[points[0]]];
  const budget=Math.min(64,Math.max(8,Math.floor(points.length/2)));
  const period=Math.max(e.width*(e.pattern==='dot'?2.4:6),e.pattern==='dot'?.035:.09,total/budget);
  const result=[];let travelled=0,nextDot=0,current=[];
  for(let i=0;i<lengths.length;i++){
    const length=lengths[i],a=points[i],b=points[i+1];if(length<1e-8)continue;
    if(e.pattern==='dot'){
      while(nextDot<=travelled+length+1e-7){result.push([interpolate(a,b,Math.max(0,Math.min(1,(nextDot-travelled)/length)))]);nextDot+=period;}
    }else{
      let t=0;
      while(t<length-1e-8){
        const phase=((travelled+t+1e-9)%period),on=phase<period*.62;
        const step=Math.min(length-t,(on?period*.62:period)-phase+1e-9);
        if(on){const p=interpolate(a,b,t/length),q=interpolate(a,b,(t+step)/length);if(!current.length)current.push(p);current.push(q);}
        else if(current.length){result.push(current);current=[];}
        t+=Math.max(step,1e-8);
      }
    }
    travelled+=length;
  }
  if(current.length)result.push(current);return result.length?result:[[points[0]]];
}
