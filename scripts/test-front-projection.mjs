import assert from 'node:assert/strict';
import {initialScene} from '../lib/scene-local.ts';
import {projectFront} from '../lib/front-projection.ts';
const s=initialScene();s.entities=[{id:'w',kind:'worker',name:'사람',x:3,y:2.8,w:.4,h:.4,floor:1,blocking:true},{id:'h',kind:'helmet',name:'안전모',x:4,y:2.9,w:.3,h:.3,floor:1,blocking:true},{id:'back',kind:'box',name:'뒤',x:.1,y:2.8,w:.3,h:.3,floor:1,blocking:true},{id:'upstairs',kind:'box',name:'2층',x:3,y:2.9,w:.3,h:.3,floor:2,blocking:true}];const pose={x:1,y:3,yaw:0,floor:1},poses={R1:pose,R2:{x:8,y:3,yaw:Math.PI,floor:1}},base=projectFront(s,pose,'R1',poses);assert.ok(base.find(o=>o.id==='w'));assert.ok(base.find(o=>o.id==='h'));assert.ok(!base.find(o=>['R1','back','upstairs'].includes(o.id)));assert.ok(base.every(o=>[o.x,o.y,o.w,o.h,o.depth].every(Number.isFinite)&&o.w>0&&o.h>0));
const resized=structuredClone(s);resized.entities[0].h=.8;assert.ok(projectFront(resized,pose,'R1',poses).find(o=>o.id==='w').w>base.find(o=>o.id==='w').w);console.log('PASS map object resize changes projected footprint');
const closer=projectFront(s,pose,'R1',{...poses,R2:{...poses.R2,x:3}});assert.ok(closer.find(o=>o.id==='R2').w>base.find(o=>o.id==='R2').w);console.log('PASS other robot current runtime pose, not fixed start pose');
const removed=structuredClone(s);removed.robots=removed.robots.filter(r=>r.id!=='R2');assert.ok(!projectFront(removed,pose,'R1',poses).find(o=>o.id==='R2'));assert.ok(projectFront(s,{...pose,yaw:Math.PI},'R1',poses).find(o=>o.id==='back'));assert.ok(!projectFront(s,{...pose,yaw:Math.PI},'R1',poses).find(o=>o.id==='w'));console.log('PASS deleted robot removed + selected yaw/front + floor filtering');
assert.ok(base.every((o,i)=>i===0||base[i-1].depth>=o.depth));console.log('PASS far-to-near illustrative painter ordering');
console.log('All front projection checks passed.');

