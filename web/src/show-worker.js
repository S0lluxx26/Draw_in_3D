import {compileShow} from './show-project.js';
// Demo formations come from the Blender library, loaded only when a show uses them.
self.onmessage=async({data})=>{try{const assets=data.doc.cues.some(c=>c.library)?(await import('./formation-assets.js')).default:null;self.postMessage({revision:data.revision,show:compileShow(data.doc,assets)});}catch(error){self.postMessage({revision:data.revision,error:error.message});}};
