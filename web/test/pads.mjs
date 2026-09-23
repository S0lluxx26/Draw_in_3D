// Test helper (not a test file). Landing re-assigns drones to the nearest free pads, so compare frames per pad.
export const landingPads=show=>show.stages.at(-1).to.pad;
export function byPad(show,values){const pad=landingPads(show),out=new Float32Array(values.length);pad.forEach((k,i)=>out.set(values.subarray(i*3,i*3+3),k*3));return out;}
export const droneAtPad=(show,k)=>landingPads(show).indexOf(k);
