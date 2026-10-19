import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialScene,planScene,validateScene,sceneWorld,PlanningError} from '../lib/scene-local.ts';
import {segmentClear} from '../lib/planner.ts';
import {seed,stepSimulation} from '../lib/scene-runtime.ts';
const raw=JSON.parse(fs.readFileSync('../outputs/root/edited-driving-repro-scene.json','utf8'));const fixture=raw.scene??raw;
function run(s,label){validateScene(s);const routes=planScene(s),poses=seed(s),owners=new Map(),lift={current:null};let t=0;for(;t<600;t+=.02){stepSimulation(s,routes,.02,.8,poses,owners,lift,t);for(const p of Object.values(poses))assert.ok(segmentClear(sceneWorld(s,p.floor,p,p),p,p),label+' physical body collision');if(Object.values(poses).every(p=>p.phase==='임무 완료'))break;}assert.ok(t<600,label+' joint timeout '+JSON.stringify(poses));assert.equal(owners.size,0,label+' released reservations');console.log('PASS',label,t.toFixed(2));}
run(fixture,'actual rev149 edited two-car map');
const example=initialScene();example.entities=example.entities.filter(e=>!e.blocking);Object.assign(example.entities.find(e=>e.kind==='charger'),{x:4.5,y:4});Object.assign(example.entities.find(e=>e.id==='q1'),{x:6,y:4});example.robots=[{...example.robots[0],x:1,y:1,goal:{x:8,y:1},model:'car'}];
for(const [name,edit] of [['added obstacle',s=>s.entities.push({id:'new-box',name:'새 상자',kind:'box',x:4,y:2,w:.5,h:.5,floor:1,blocking:true})],['dragged robot',s=>Object.assign(s.robots[0],{x:1.2,y:1.3,yaw:.2})]]){const s=structuredClone(example);edit(s);run(s,name);}
const impossible=structuredClone(example);impossible.entities.push({id:'goal-cover',name:'목표를 덮은 상자',kind:'box',x:7.7,y:.7,w:.6,h:.6,floor:1,blocking:true});assert.throws(()=>planScene(impossible),e=>e instanceof PlanningError&&e.diagnostic.robotId==='R1'&&e.diagnostic.leg==='임무 목표 방문'&&e.diagnostic.blockers.some(b=>b.includes('goal-cover')));console.log('PASS impossible destination reports robot, leg and object');
