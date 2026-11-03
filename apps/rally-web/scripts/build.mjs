import {build} from 'esbuild';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {demoApiPlugin,demoHTML} from './demo-build.mjs';
await mkdir('dist',{recursive:true});
await build({entryPoints:{app:'src/main.ts',renderer:'src/renderer.ts'},outdir:'dist',bundle:true,format:'esm',target:'es2022',sourcemap:true,define:{__RALLY_DEMO__:'false'}});
await build({entryPoints:{demo:'src/main.ts'},outdir:'dist',bundle:true,format:'esm',target:'es2022',sourcemap:true,define:{__RALLY_DEMO__:'true'},plugins:[demoApiPlugin]});
await Promise.all(['demo.css','index.html','renderer.html','style.css','favicon.svg','theme-init.js'].map(name=>copyFile('src/'+name,'dist/'+name)));
await writeFile('dist/demo.html',await demoHTML());
console.log('Built regular frontend and isolated simulated workspace.');
