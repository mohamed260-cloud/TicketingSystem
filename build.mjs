import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await cp('worker/index.js','dist/server/index.js');
await cp('.openai','dist/.openai',{recursive:true});
await cp('drizzle','dist/drizzle',{recursive:true});
