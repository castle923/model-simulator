import assert from 'node:assert/strict';
import {factorySample,prepareFactory} from '../lib/factory.ts';
import {createFleet,tickFleet} from '../lib/fleet.ts';
import {segmentClear} from '../lib/planner.ts';
for(const n of [2,4]){const f=createFleet(n);prepareFactory(f,factorySample);f.paused=false;for(let i=0;i<60000&&!f.paused;i++)tickFleet(f,.01);assert(f.robots.every(r=>r.phase==='done'));}
const w=structuredClone(factorySample);w.obstacles[0].w=2.7;w.obstacles.push({kind:'pallet',name:'추가 팔레트',x:3.5,y:1.75,w:.25,h:.25});const f=createFleet();prepareFactory(f,w);for(const r of f.robots){const gate={x:r.side===1?2.1-.10437:5.9+.10437,y:.7};const points=[gate,...r.prepared];for(let i=1;i<points.length;i++)assert(segmentClear(w,points[i-1],points[i]));}
const invalid=structuredClone(factorySample);invalid.obstacles.push({kind:'wall',x:1.7,y:0,w:.5,h:4});const before=structuredClone(f);assert.throws(()=>prepareFactory(f,invalid));assert.deepEqual(f,before);assert.throws(()=>prepareFactory(createFleet(),{...factorySample,width:9}));console.log('PASS: editable rack + pallet rerouting, 2/4 completion, blocked entrance rejection, atomic routes, fixed-map validation');
