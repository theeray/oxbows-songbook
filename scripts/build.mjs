import {createHash} from 'node:crypto';
import {cp,mkdir,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
execFileSync('npm',['run','build','--','--base','/oxbows-songbook/editor/'],{cwd:'editor',stdio:'inherit'});
for(const name of await readdir('.'))if(/\.(html|css|js)$/.test(name))await cp(name,'dist/'+name);
for(const name of ['assets','audio','music'])await cp(name,'dist/'+name,{recursive:true});
await cp('editor/dist','dist/editor',{recursive:true});

// Fingerprint local page assets so refreshes cannot reuse an outdated library script.
const index=await readFile('dist/index.html','utf8');
const assets=[...new Set([...index.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))"/g)].map(match=>match[1]))];
let html=index;
for(const asset of assets){
  const hash=createHash('sha256').update(await readFile('dist/'+asset)).digest('hex').slice(0,12);
  html=html.replaceAll('"'+asset+'"','"'+asset+'?v='+hash+'"');
}
await writeFile('dist/index.html',html);
