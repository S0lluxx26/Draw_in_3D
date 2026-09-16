// Authoring operations are baked into the existing editable stroke-point format.
// All interpolation uses convex combinations: no overshoot outside the input hull.
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function resample(points,count){
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+distance(points[i-1],points[i]));
  const total=lengths.at(-1);if(total<1e-9)return Array.from({length:count},()=>[...points[0]]);
  let segment=1;return Array.from({length:count},(_,i)=>{const at=total*i/(count-1);while(segment<points.length-1&&lengths[segment]<at)segment++;const length=lengths[segment]-lengths[segment-1];return lerp(points[segment-1],points[segment],length>1e-9?(at-lengths[segment-1])/length:0);});
}
export function smoothPoints(points,strength=.5,maxPoints=384){
  if(points.length<3||strength<=0)return points.map(p=>[...p]);
  const closed=distance(points[0],points.at(-1))<1e-6,amount=Math.max(0,Math.min(1,strength));
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
  if(length<1e-8)return points.map(p=>[...p]);
  const count=Math.max(3,Math.min(384,maxPoints,Math.max(points.length,Math.min(128,Math.ceil(length/.015)+1))));
  let rounded=points.map(p=>[...p]);
  for(let pass=0;pass<3;pass++){
    const next=closed?[]:[[...rounded[0]]];
    for(let i=0;i<rounded.length-1;i++){next.push(lerp(rounded[i],rounded[i+1],.25),lerp(rounded[i],rounded[i+1],.75));}
    next.push([...(closed?next[0]:rounded.at(-1))]);rounded=next;
  }
  const original=resample(points,count),soft=resample(rounded,count),result=original.map((p,i)=>lerp(p,soft[i],amount));
  if(closed)result[result.length-1]=[...result[0]];else{result[0]=[...points[0]];result[result.length-1]=[...points.at(-1)];}
  return result;
}
export function curvePoints(delta,normal,bend=.35,kind='arc',count=65,startPressure=1,endPressure=1){
  const length=Math.hypot(...delta);if(length<1e-8)return [[0,0,0,startPressure]];
  const cross=[normal[1]*delta[2]-normal[2]*delta[1],normal[2]*delta[0]-normal[0]*delta[2],normal[0]*delta[1]-normal[1]*delta[0]],n=Math.hypot(...cross);
  const side=cross.map(v=>n>1e-8?v/n:0),offset=side.map(v=>v*length*Math.max(-1,Math.min(1,bend)));
  return Array.from({length:Math.max(3,Math.min(65,count))},(_,i)=>{ // Quadratic arc or cubic S, in the captured plane.
    const t=i/(Math.max(3,Math.min(65,count))-1),u=1-t;
    const p=delta.map((v,j)=>kind==='s'?v*t+3*u*t*(u-t)*offset[j]:v*t+2*u*t*offset[j]);
    return [...p,startPressure+(endPressure-startPressure)*t];
  });
}
