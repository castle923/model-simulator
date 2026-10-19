import assert from 'node:assert/strict';
import {sample,plan,validateWorld,segmentClear,blocked,planMission} from '../lib/planner.ts';
const w=structuredClone(sample);w.obstacles.push({x:2.5,y:.3,w:.5,h:.5,kind:'cone',name:'안전 콘',blocking:true});validateWorld(w);const route=plan(w);for(let i=1;i<route.length;i++)assert(segmentClear(w,route[i-1],route[i]));
const decorated=structuredClone(sample);decorated.obstacles=[{x:2,y:0,w:1,h:4,kind:'helmet',blocking:false}];assert.equal(blocked(decorated,{x:2.5,y:2}),false);assert(plan(decorated).length>=2);decorated.obstacles[0].blocking=true;assert.throws(()=>plan(decorated),/경로 없음/);
for(const invalid of [{x:0,y:0,w:-1,h:1},{x:5.9,y:1,w:.5,h:1},{x:2,y:1,w:.5,h:.5,blocking:'false'},{x:2,y:1,w:.5,h:.5,kind:'arbitrary'},{x:2,y:1,w:.5,h:.5,name:'x'.repeat(41)}]){const d=structuredClone(sample);d.obstacles.push(invalid);assert.throws(()=>validateWorld(d));}
const original=structuredClone(sample);const returned=plan(original);assert.deepEqual(original,sample);assert.deepEqual(returned[0],sample.start);assert.deepEqual(returned.at(-1),sample.goal);
console.log('PASS: object types, blocking toggle, obstacle clearance, blocked map, invalid size/type/bounds/name rejection, input preserved');

const mission=planMission(sample);assert.deepEqual(mission.inbound[0],sample.goal);assert.deepEqual(mission.inbound.at(-1),sample.station);for(const route of [mission.outbound,mission.inbound])for(let i=1;i<route.length;i++)assert(segmentClear(sample,route[i-1],route[i]));
const legacy=structuredClone(sample);delete legacy.station;assert.deepEqual(planMission(legacy).inbound.at(-1),legacy.start);
assert.throws(()=>validateWorld({...sample,station:{x:2.2,y:2}}));assert.throws(()=>validateWorld({...sample,station:{x:30,y:0}}));
console.log("PASS: separate station return, both legs clear, legacy fallback, invalid station rejected");
