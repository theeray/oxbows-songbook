import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=new URL('../public/models/',import.meta.url);
await mkdir(folder,{recursive:true});
const expected='ed2e1a86ea75712ee6cdc740e96f7a36753543cf9bb980227c071c9256d9d82e';
let model;
try {model=Buffer.concat(await Promise.all(['00','01'].map(n=>readFile(new URL('notes-'+n,folder)))));}catch{}
const digest=data=>createHash('sha256').update(data).digest('hex');
if(!model||digest(model)!==expected){
 console.log('Downloading Oemer note recognition model (38 MB)…');
 const response=await fetch('https://github.com/BreezeWhite/oemer/releases/download/checkpoints/2nd_model.onnx');
 if(!response.ok)throw Error('Model download failed: '+response.status);
 model=Buffer.from(await response.arrayBuffer());
 if(digest(model)!==expected)throw Error('Model checksum mismatch; refusing to use unverified model.');
 await writeFile(new URL('notes-00',folder),model.subarray(0,20000000));
 await writeFile(new URL('notes-01',folder),model.subarray(20000000));
}
console.log('Recognition model verified.');
