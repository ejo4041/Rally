import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['browser.js'], bundle: true, outfile: 'dist/browser.js', format: 'esm', platform: 'browser' });
await copyFile('index.html', 'dist/index.html');
