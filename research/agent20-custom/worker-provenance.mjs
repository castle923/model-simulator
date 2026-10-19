import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const result=await build({entryPoints:['app/scene.worker.ts'],bundle:true,format:'esm',platform:'browser',outfile:'public/scene-worker.js',target:'es2022',write:false});
const expected=result.outputFiles[0].contents,actual=readFileSync('public/scene-worker.js');
assert.deepEqual(actual,Buffer.from(expected),'published worker must match current source build exactly');
console.log(JSON.stringify({ok:true,case:'in-memory esbuild matches public worker bytes; no product file written',sha256:createHash('sha256').update(actual).digest('hex')},null,2));
