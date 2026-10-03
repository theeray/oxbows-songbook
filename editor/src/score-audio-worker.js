import {synthesizeWave} from './audio.js';
self.onmessage=event=>{
 try{const wave=synthesizeWave(event.data);self.postMessage({wave},[wave]);}
 catch(error){self.postMessage({error:'Unable to prepare audio: '+error.message});}
};
