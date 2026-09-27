import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const target=new URL('../public/ocr/',import.meta.url);await mkdir(target,{recursive:true});
await copyFile(new URL('../node_modules/tesseract.js/dist/worker.min.js',import.meta.url),new URL('worker.min.js',target));
for(const stem of ['tesseract-core-lstm','tesseract-core-simd-lstm'])for(const ext of ['.wasm.js','.wasm'])await copyFile(new URL('../node_modules/tesseract.js-core/'+stem+ext,import.meta.url),new URL(stem+ext,target));
await copyFile(new URL('../node_modules/tesseract.js/LICENSE.md',import.meta.url),new URL('LICENSE.txt',target));
const file=new URL('eng.traineddata.gz',target);
let bytes;try{bytes=await readFile(file);}catch{}
const expected='18c1ac52b75e35d44735fb6c2a60acfaf23033524653200738e98f0243edb75b';
const hash=b=>createHash('sha256').update(b).digest('hex');
if(!bytes||hash(bytes)!==expected){const r=await fetch('https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz');if(!r.ok)throw Error('Text recognition model download failed: '+r.status);bytes=Buffer.from(await r.arrayBuffer());if(hash(bytes)!==expected)throw Error('Text recognition model checksum mismatch.');await writeFile(file,bytes);}
console.log('Text recognition assets prepared ('+bytes.length+' bytes of language data).');
