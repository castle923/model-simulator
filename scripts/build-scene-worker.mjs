import {build} from 'esbuild';
await build({entryPoints:['app/scene.worker.ts'],bundle:true,format:'esm',platform:'browser',outfile:'public/scene-worker.js',target:'es2022'});
console.log('Local scene validation worker built.');
