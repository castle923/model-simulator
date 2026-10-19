import assert from 'node:assert/strict';
import {initialScene,generatePatch,applyPatch,planScene,sceneWorld} from '../lib/scene-local.ts';
import {applyMission,parseMission,validateMissionCode} from '../lib/vibe-mission.ts';
import {seed,stepSimulation} from '../lib/scene-runtime.ts';
import {blocked} from '../lib/planner.ts';
const targetDistance=(p,e)=>Math.hypot(Math.max(e.x-p.x,0,p.x-e.x-e.w),Math.max(e.y-p.y,0,p.y-e.y-e.h));
const s=initialScene();s.entities=s.entities.filter(e=>!e.blocking);s.entities.push(...[
 ['w1','worker',4,3],['w2','worker',7,2],['h1','helmet',4,2],['h2','helmet',5,2],
].map(([id,kind,x,y])=>({id,kind,name:id,x,y,w:.3,h:.3,floor:1,blocking:false})));
assert.equal(parseMission(s,'작업자 1번이 안전모를 착용하지 않았으니 안전모를 픽업하여 보호장구를 착용하지 않은 작업자 1번에게 전달해줘','R1','h1').workerId,'w1');
const code=parseMission(s,'안전모 2번을 픽업하여 작업자 2번에게 전달해줘','R1');assert.equal(code.workerId,'w2');assert.equal(code.helmetId,'h2');
const applied=applyMission(s,code);assert.deepEqual(applied.robots[1],s.robots[1]);assert.deepEqual(applied.entities,s.entities);assert.equal(s.robots[0].mission,undefined);assert.notEqual(applied.entities[0],s.entities[0]);console.log('PASS exact numbered targets / other robot and map unchanged');
assert.throws(()=>parseMission(s,'안전모를 작업자에게 전달해줘','R1'),/여러/);assert.throws(()=>parseMission(s,'안전모 2번을 작업자 2번에게 전달해줘','R1','h1','w2'),/다릅니다/);assert.throws(()=>parseMission(s,'안전모 99번을 작업자 2번에게 전달해줘','R1'),/99/);for(const text of ['안전모를 작업자 1번과 작업자 2번에게 전달해줘','안전모 1번과 안전모 2번을 작업자 1번에게 전달해줘','안전모를 작업자에게 전달하지마','안전모를 작업자에게 전달 취소','R2 안전모를 작업자에게 전달해줘','R5가 안전모를 작업자에게 전달해줘','R10 안전모를 작업자에게 전달해줘'])assert.throws(()=>parseMission(s,text,'R1','h1','w1'));console.log('PASS ambiguous / conflicting / absent numbered / negative / conflicting robot instructions rejected');
for(const raw of [null,[],{...code,robotId:'R4'},{...code,workerId:'deleted'},{...code,helmetId:'w1'},{...code,action:'eval'},{...code,source:'console.log(1)'},{...code,baseRevision:999}])assert.throws(()=>validateMissionCode(s,raw));
const deleted=structuredClone(s);deleted.entities=deleted.entities.filter(e=>e.id!=='w2');assert.throws(()=>applyMission(deleted,code));const wrongFloor=structuredClone(s);wrongFloor.entities.find(e=>e.id==='w2').floor=2;assert.throws(()=>applyMission(wrongFloor,code),/층/);console.log('PASS invalid code / deleted entity / wrong kind / stale revision / floor rejected');
const one=applyMission(s,code);one.robots=one.robots.slice(0,1);const routes=planScene(one),route=routes[0];for(const [index,targetId] of [[route.pickup,'h2'],[route.deliver,'w2']]){const point=route.points[index],target=one.entities.find(e=>e.id===targetId),distance=targetDistance(point,target);assert.ok(distance>=.3199&&distance<=.3201,'selected exact-ID exterior approach');assert.equal(blocked(sceneWorld(one,point.floor,point,point),point),false);}
const poses=seed(one),locks=new Map(),lift={current:null};let picked=false,delivered=false,t=0;for(;t<600;t+=.02){stepSimulation(one,routes,.02,.8,poses,locks,lift,t);assert.equal(blocked(sceneWorld(one,poses.R1.floor,poses.R1,poses.R1),poses.R1),false,'robot must not enter any person/helmet body');if(poses.R1.payload)picked=true;if(picked&&!poses.R1.payload)delivered=true;if(poses.R1.phase==='임무 완료')break;}assert.ok(picked&&delivered&&t<600);console.log('PASS actual target route + pickup payload + delivery + charge completion',t.toFixed(2));
const orphan=structuredClone(one);orphan.entities=orphan.entities.filter(e=>e.id!=='h2');assert.throws(()=>planScene(orphan),/대상/);console.log('PASS target removal prevents execution rather than substituting first object');
const patch=generatePatch(s,'상자 1개 R2 전달',1);assert.equal(patch.robotMissions,undefined);assert.deepEqual(applyPatch(s,patch).robots,s.robots);console.log('PASS placement never silently changes missions');
console.log('All vibe mission checks passed.');

const base=initialScene();const wAdded=applyPatch(base,generatePatch(base,'작업자 1명',1));const setAdded=applyPatch(wAdded,generatePatch(wAdded,'작업자 1명, 안전모 1개',1));const staged=applyMission(setAdded,parseMission(setAdded,'작업자 1번이 안전모를 착용하지 않았으니 안전모를 픽업하여 작업자 1번에게 전달해줘','R2'));const stagedRoutes=planScene(staged);const ps=seed(staged),ls=new Map(),lt={current:null};let st=0;for(;st<600;st+=.02){stepSimulation(staged,stagedRoutes,.02,.8,ps,ls,lt,st);if(Object.values(ps).every(p=>p.phase==='임무 완료'))break;}assert.ok(st<600,'placement -> R2 delivery should complete '+JSON.stringify(ps));console.log('PASS ordinary automatic placement -> R2 mission -> multi execution',st.toFixed(2));

