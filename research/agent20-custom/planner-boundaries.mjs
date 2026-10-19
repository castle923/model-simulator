import assert from 'node:assert/strict';
import {initialScene,planScene,routeLeg,sceneWorld} from '../../lib/scene-local.ts';
import {defaultCustomization,robotRadius} from '../../lib/robot-customization.ts';
import {seed,stepSimulation} from '../../lib/scene-runtime.ts';
import {plan,segmentClear} from '../../lib/planner.ts';
const cases=[];
function execute(s,label){const routes=planScene(s),poses=seed(s),locks=new Map(),lift={current:null};let time=0,frames=0;for(const r of s.robots){const route=routeLeg(s,r,{x:r.x,y:r.y,yaw:r.yaw,floor:r.floor},r.goal);assert.ok(route.length>1);for(let i=1;i<route.length;i++)assert.ok(segmentClear(sceneWorld(s,r.floor,route[i-1],route[i],r),route[i-1],route[i]));}
 while(time<800&&!routes.every(r=>poses[r.id].phase==='임무 완료')){const before=structuredClone(poses);time+=.05;frames++;stepSimulation(s,routes,.05,.8,poses,locks,lift,time);for(const r of s.robots){const p=poses[r.id];assert.ok(!p.missionError);assert.ok(segmentClear(sceneWorld(s,p.floor,before[r.id],p,r),before[r.id],p),`${label}: swept static collision`);}}
 assert.ok(routes.every(r=>poses[r.id].phase==='임무 완료'),`${label}: all test missions complete`);cases.push({label,time,frames,maxRadius:Math.max(...s.robots.map(robotRadius))});
}
{
 const s=initialScene();s.width=2;s.height=2;s.entities=[{id:'c',kind:'charger',name:'c',x:1.2,y:1.2,w:.2,h:.2,floor:1,blocking:false}];s.robots=[{...s.robots[0],x:.3,y:.3,goal:{x:1.6,y:.3},waypoints:Array.from({length:40},(_,i)=>({x:i%2?.6:1.3,y:.3})),after:'stay'}];execute(s,'2x2m, actual route/plan and 40-waypoint full execution');
}
{const s=initialScene();s.width=22;s.height=12;execute(s,'22x12m original two robots full legacy charging missions');}
{
 const s=initialScene();s.width=30;s.height=30;s.entities=[{id:'c',kind:'charger',name:'c',x:4,y:26,w:.3,h:.3,floor:1,blocking:false},{id:'wall',kind:'wall',name:'wall',x:12,y:0,w:1,h:20,floor:1,blocking:true}];const config=defaultCustomization('custom');config.length=2;config.width=1.5;config.height=2.5;config.maxSpeed=2;config.cameras=[];config.manipulators=[{id:'arm',label:'arm',side:'center',reach:1.5,payloadKg:0,enabled:true,stowed:false,joints:[]}];s.robots=[{...s.robots[0],x:5,y:5,goal:{x:25,y:25},waypoints:[],after:'stay',customization:config}];assert.ok(robotRadius(s.robots[0])>2.7);execute(s,'30x30m max body+extended arm, BFS detour and full stay execution');
}
{
 const w={width:30,height:30,radius:4,start:{x:5,y:5},goal:{x:25,y:25},obstacles:[]};assert.equal(plan(w).length,2);for(const mutate of [v=>v.width=30.01,v=>v.height=30.01,v=>v.radius=4.01,v=>v.start.x=3.99]){const v=structuredClone(w);mutate(v);assert.throws(()=>plan(v));}cases.push({label:'actual lower planner permits radius4 and rejects out-of-range geometry'});
}
console.log(JSON.stringify({ok:true,cases},null,2));
