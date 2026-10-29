import { build } from 'esbuild';
import { mkdir, readFile, copyFile } from 'node:fs/promises';
await mkdir('dist/server', {recursive:true});
await mkdir('dist/.openai', {recursive:true});
const define = {};
for (const [name, path] of Object.entries({__HTML__:'web/index.html',__CSS__:'web/style.css',__CLIENT__:'web/client.js',__WORKLET__:'web/pcm-worklet.js',__TEAMS_CLIENT__:'web/teams-client.js'})) {
  define[name] = JSON.stringify(await readFile(path,'utf8'));
}
await build({entryPoints:['src/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',define,legalComments:'none'});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Rally Worker and embedded web assets.');
