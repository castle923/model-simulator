import assert from 'node:assert/strict';
import {defaultCustomization} from '../lib/robot-customization.ts';
import {createIndustrialWorld,applyIndustrialCustomizations,enqueueIndustrialCommand,stepIndustrialWorld} from '../lib/industrial-runtime.ts';

assert.equal(createIndustrialWorld({robotConfigs:{}}).robots.length,4);
const w=createIndustrialWorld();stepIndustrialWorld(w,.2);
const before=w.robots.map(({x,y,yaw})=>({x,y,yaw})),time=w.time,epoch=w.coordinator.epoch;
const small=defaultCustomization();small.kind='amr';small.label='소형 AMR';small.length=.20;small.width=.15;small.maxSpeed=.08;
const fast=defaultCustomization();fast.kind='tracked';fast.label='소형 궤도형';fast.maxSpeed=.22;
assert(applyIndustrialCustomizations(w,{R1:small,R2:fast}).ok);
assert.equal(w.time,time);assert.equal(w.coordinator.epoch,epoch);assert.deepEqual(w.robots.map(({x,y,yaw})=>({x,y,yaw})),before);
assert.equal(w.robots[0].profile.maxSpeed,.08);assert.equal(w.robots[1].profile.maxSpeed,.22);
assert.equal(w.robots[0].profile.length,.20);assert.equal(w.robots[0].customization.kind,'amr');
const saved=JSON.parse(JSON.stringify({profile:w.profile,robotConfigs:Object.fromEntries(w.robots.filter(r=>r.customization).map(r=>[r.id,r.customization]))}));
const reloaded=createIndustrialWorld(saved);assert.deepEqual(reloaded.robots.map(r=>r.customization),w.robots.map(r=>r.customization));
let snapshot=JSON.stringify(w);const tooLarge=defaultCustomization('amr');
assert.equal(applyIndustrialCustomizations(w,{R1:small,R2:tooLarge}).ok,false);assert.equal(JSON.stringify(w),snapshot,'rejected config must be atomic');
const protrudingCamera=structuredClone(small);protrudingCamera.cameras[0].y=.3;assert.equal(applyIndustrialCustomizations(w,{R1:protrudingCamera}).ok,false);assert.equal(JSON.stringify(w),snapshot);
const extended=structuredClone(small);extended.manipulators=[{id:'arm-left',label:'팔',side:'left',reach:.1,payloadKg:.2,stowed:false,joints:[],enabled:true}];
assert.equal(applyIndustrialCustomizations(w,{R1:extended}).ok,false);assert.equal(JSON.stringify(w),snapshot);
extended.manipulators[0].stowed=true;assert.equal(applyIndustrialCustomizations(w,{R1:extended}).ok,true);
for(const [robotId,stationId] of [['R1','B'],['R2','A'],['R3','D'],['R4','C']])assert(enqueueIndustrialCommand(w,{robotId,stationId,kind:'navigate'}).ok);
snapshot=JSON.stringify(w);assert.equal(applyIndustrialCustomizations(w,{R1:small}).ok,false);assert.equal(JSON.stringify(w),snapshot,'busy queue must preserve complete state');
const speeds={R1:0,R2:0};while(w.time<240&&w.metrics.completed<4){stepIndustrialWorld(w,.04);for(const r of w.robots){assert(r.v<=r.profile.maxSpeed+1e-8);if(r.id in speeds)speeds[r.id]=Math.max(speeds[r.id],r.v);}assert.equal(w.metrics.oracleStops,0);assert(w.metrics.maxOccupancy<=1);}
assert.equal(w.metrics.completed,4,'heterogeneous fleet completes crossing');assert(speeds.R1>.07);assert(speeds.R2>.20);assert(speeds.R2>speeds.R1*2);
console.log(JSON.stringify({ok:true,cases:['atomic paused customization preserves poses/time/epoch','per robot kinds and heterogeneous speeds','configuration JSON roundtrip','oversized body rejected atomically','extended arm rejects narrow aisle','stowed arm accepted','busy queue rejection','four heterogeneous tasks complete without guard stop'],speeds,time:w.time},null,2));
