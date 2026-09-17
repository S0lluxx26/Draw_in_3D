import {compileShow} from './show-project.js';
self.onmessage=({data})=>{try{self.postMessage({revision:data.revision,show:compileShow(data.doc)});}catch(error){self.postMessage({revision:data.revision,error:error.message});}};
