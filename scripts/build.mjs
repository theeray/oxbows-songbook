import {cp,mkdir,rm,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
execFileSync('npm',['run','build','--','--base','/oxbows-songbook/editor/'],{cwd:'editor',stdio:'inherit'});
for(const name of await readdir('.'))if(/\.(html|css|js)$/.test(name))await cp(name,'dist/'+name);
for(const name of ['assets','audio','music'])await cp(name,'dist/'+name,{recursive:true});
await cp('editor/dist','dist/editor',{recursive:true});
