// Run with the local Voilà checkout as the first argument after editor changes.
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve(process.argv[2]||'../sites/voila');
await mkdir('editor',{recursive:true});
for(const path of ['src','public','scripts','tests','index.html','pdf.html','vite.config.js','package.json','package-lock.json'])await cp(resolve(source,path),'editor/'+path,{recursive:true,filter:p=>!p.includes('/notes-')&&!p.includes('/public/ort/')&&!p.includes('/public/ocr')});
await cp(resolve(source,'src/transfer.js'),'score-transfer.js');
