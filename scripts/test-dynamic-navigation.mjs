import {narrowLockZones,updateNarrowLocks,lockBlocksMove,insideLock} from '../lib/scene-locks.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialScene,dynamicDemoScene,planScene,sceneWorld,arcClear} from '../lib/scene-local.ts';
import {segmentClear} from '../lib/planner.ts';
import {seed,stepSimulation,helmetOwnership} from '../lib/scene-runtime.ts';
import {senseRobots,SENSOR} from '../lib/scene-sensor.ts';
import {replanRemaining} from '../lib/scene-navigation.ts';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function run(s,label,{limit=200,reverse=false,freezeId,hook}={}){
 const before=JSON.stringify(s),routes=planScene(s);if(reverse)routes.reverse();const poses=seed(s),owners=new Map(),lift={current:null};
 const visited=new Set(),charged=new Set(),revisions=new Map(routes.map(r=>[r.id,0]));let min=Infinity,maxTick=0,geometryChanges=0,t=0;
 if(freezeId)poses[freezeId].phase='임무 완료';
 for(;t<limit;t+=.025){hook?.({t,poses,routes});const old=structuredClone(poses),start=performance.now();stepSimulation(s,routes,.025,.8,poses,owners,lift,t);maxTick=Math.max(maxTick,performance.now()-start);
  for(const r of s.robots){const p=poses[r.id],q=old[r.id],d=Math.hypot(p.x-q.x,p.y-q.y);assert.ok(d<=.020001,label+' teleport');assert.ok(segmentClear(sceneWorld(s,p.floor,p,p),p,p),label+' static contact');
   if(r.model==='car'){const a=wrap(p.yaw-q.yaw);assert.ok(Math.abs(a)<=.8*.025/r.minRadius+1e-7,'car angular speed');if(d>1e-8)assert.ok((p.x-q.x)*Math.cos(q.yaw+a/2)+(p.y-q.y)*Math.sin(q.yaw+a/2)>0,'car forward');else assert.ok(Math.abs(a)<1e-8,'car stationary turn');}
   if(p.floor===r.goalFloor&&Math.hypot(p.x-r.goal.x,p.y-r.goal.y)<(r.model==='car'?.18:.08))visited.add(r.id);if(p.phase==='충전 중 · 가상')charged.add(r.id);
  }
  if(label.startsWith('opposing single'))for(const zone of narrowLockZones(s))assert.ok(Object.values(poses).filter(p=>insideLock(zone,p)).length<=1,'narrow region exclusive occupancy');
  for(let i=0;i<s.robots.length;i++)for(let j=i+1;j<s.robots.length;j++){const a=poses[s.robots[i].id],b=poses[s.robots[j].id];if(a.floor===b.floor)min=Math.min(min,Math.hypot(a.x-b.x,a.y-b.y));}
  for(const route of routes){if((route.revision??0)>revisions.get(route.id)){geometryChanges++;revisions.set(route.id,route.revision);const robot=s.robots.find(r=>r.id===route.id);if(robot.model==='car')for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];if(a.floor!==b.floor)continue;const d=Math.hypot(a.x-b.x,a.y-b.y),da=wrap(b.yaw-a.yaw);if(d<1e-9)continue;const radius=Math.abs(da)>1e-9?d/(2*Math.sin(Math.abs(da)/2)):Infinity;assert.ok(radius>=robot.minRadius-1e-6,'replanned car curvature');assert.ok((b.x-a.x)*Math.cos(a.yaw+da/2)+(b.y-a.y)*Math.sin(a.yaw+da/2)>0,'replanned car joins forward');}}
  }
  if(Object.values(poses).every(p=>p.phase==='임무 완료'))break;
 }
 assert.ok(t<limit,label+' timeout '+JSON.stringify(Object.fromEntries(Object.entries(poses).map(([id,p])=>[id,{x:p.x,y:p.y,phase:p.phase,nav:p.navigation,replans:p.replans}]))));assert.ok(min>=.48999,label+' robot collision');
 for(const r of s.robots.filter(r=>r.id!==freezeId)){assert.ok(visited.has(r.id),label+' original goal '+r.id);assert.ok(charged.has(r.id),label+' charge '+r.id);}
 assert.equal(JSON.stringify(s),before,'editable scene mutation');assert.equal(owners.size,0,'resource ownership released');assert.ok(maxTick<200,'bounded runtime tick '+maxTick);
 console.log('PASS',label,JSON.stringify({seconds:+t.toFixed(2),min:+min.toFixed(4),geometryChanges,maxTickMs:+maxTick.toFixed(2)}));return {poses,routes,geometryChanges};
}
const open=dynamicDemoScene();assert.ok(run(open,'head-on bypass + goal + charging').geometryChanges>0);
assert.ok(run(open,'reversed route order',{reverse:true}).geometryChanges>0);
const crossing=dynamicDemoScene();Object.assign(crossing.robots[1],{x:4,y:1,yaw:Math.PI/2,goal:{x:4,y:5}});run(crossing,'crossing moving robots');
const four=initialScene();for(let i=2;i<4;i++)four.robots.push({...structuredClone(four.robots[0]),id:'R'+(i+1),x:.65,y:.6+i*.65,goal:{x:9,y:.8+i*.6}});run(four,'four robots in rack aisles');
const stopped=dynamicDemoScene();Object.assign(stopped.robots[1],{x:4,y:3});const stationary=run(stopped,'stationary sensed robot bypass',{freezeId:'R2'});assert.ok(stationary.poses.R1.replans>0);
// Moving into an already running route: the second robot starts laterally, then
// follows its own route into the first robot's front cone (no pose teleport).
const moving=dynamicDemoScene();Object.assign(moving.robots[1],{x:4,y:1,yaw:Math.PI/2,goal:{x:4,y:5}});assert.ok(run(moving,'newly moving robot enters path').geometryChanges>0);
const corridor=dynamicDemoScene();corridor.entities.push({id:'top',kind:'wall',name:'top',x:2,y:0,w:6,h:2.65,floor:1,blocking:true},{id:'bottom',kind:'wall',name:'bottom',x:2,y:3.35,w:6,h:1.1,floor:1,blocking:true});Object.assign(corridor.robots[0],{x:2.5,y:3,goal:{x:9,y:3}});Object.assign(corridor.robots[1],{x:4,y:3,yaw:0,goal:{x:9,y:4}});run(corridor,'single-lane following waits then proceeds');
const opposing=dynamicDemoScene();opposing.entities=opposing.entities.filter(e=>e.kind!=='lock');opposing.entities.push({id:'narrow-lock',kind:'lock',name:'one lane',x:3,y:2.65,w:4,h:.7,floor:1,blocking:false},{id:'upper',kind:'wall',name:'upper',x:3,y:0,w:4,h:2.65,floor:1,blocking:true},{id:'lower',kind:'wall',name:'lower',x:3,y:3.35,w:4,h:2.65,floor:1,blocking:true});Object.assign(opposing.robots[1],{x:9,y:3});Object.assign(opposing.robots[0],{goal:{x:9,y:3}});run(opposing,'opposing single lane exclusive passage + exit bypass',{limit:300});
const nz=narrowLockZones(opposing)[0],nlPoses=seed(opposing),nlOwners=new Map([[nz.id,'R1']]);assert.equal(lockBlocksMove([nz],'R2',{x:8,y:5,yaw:Math.PI,floor:1},{x:7.9,y:5,yaw:Math.PI,floor:1},nlOwners),false,'outside mouth bypass unblocked');
const nlRoutes=planScene(opposing);Object.assign(nlPoses.R1,{x:2,y:3});nlRoutes.find(r=>r.id==='R1').points=[{...nlPoses.R1},{...nlPoses.R1,x:3}];updateNarrowLocks(opposing,nlRoutes,nlPoses,new Map(),.8);const acquired=new Map();updateNarrowLocks(opposing,nlRoutes,nlPoses,acquired,.8);assert.equal(acquired.get(nz.id),'R1');nlRoutes.find(r=>r.id==='R1').points=[{...nlPoses.R1},{...nlPoses.R1,x:1}];updateNarrowLocks(opposing,nlRoutes,nlPoses,acquired,.8);assert.notEqual(acquired.get(nz.id),'R1','unentered rerouted owner releases');console.log('PASS narrow lock bypass band and abandoned entry release');
// Occlusion/range/floor/FOV and ghost clearing are observations, never mutation
// of solid map entities or of the independent physical safety envelope.
const sensed=dynamicDemoScene(),sp=seed(sensed);sp.R1.x=1;sp.R1.y=3;sp.R1.yaw=0;sp.R2.x=3;sp.R2.y=3;
let obs=senseRobots(sensed,'R1',sp,0);assert.deepEqual(obs.observed,['R2']);sp.R2.y=1;obs=senseRobots(sensed,'R1',sp,.2,obs);assert.equal(obs.tracks.length,0,'visible empty prior location clears');
sp.R2.y=3;obs=senseRobots(sensed,'R1',sp,.4,obs);sp.R1.yaw=Math.PI;obs=senseRobots(sensed,'R1',sp,.6,obs);assert.equal(obs.tracks[0].visible,false);obs=senseRobots(sensed,'R1',sp,1.7,obs);assert.equal(obs.tracks.length,0,'ghost TTL');
sp.R1.yaw=0;sp.R2.x=1+SENSOR.range+.1;assert.equal(senseRobots(sensed,'R1',sp,2).observed.length,0,'range');sp.R2.x=3;sp.R2.floor=2;assert.equal(senseRobots(sensed,'R1',sp,3).observed.length,0,'floor');sp.R2.floor=1;sensed.entities.push({id:'occluder',kind:'wall',name:'occluder',x:2,y:2,w:.3,h:2,floor:1,blocking:true});assert.equal(senseRobots(sensed,'R1',sp,4).observed.length,0,'wall occlusion');console.log('PASS sensor FOV/range/floor/occlusion/empty-space/TTL');
const fail=dynamicDemoScene(),fr=planScene(fail)[0],fp=seed(fail).R1,beforeFail=JSON.stringify(fr);assert.throws(()=>replanRemaining(fail,fr,fp,[{id:'R2',x:fp.x,y:fp.y,yaw:0,floor:1,seenAt:0,visible:true,vx:0,vy:0}]));assert.equal(JSON.stringify(fr),beforeFail,'failed replan atomic');console.log('PASS unreachable replan fail-safe and atomic task retention');
const car=dynamicDemoScene();car.width=12;car.height=8;car.entities=car.entities.filter(e=>e.kind!=='lock');Object.assign(car.entities.find(e=>e.kind==='charger'),{x:8,y:6});car.entities.filter(e=>e.kind==='queue').forEach((e,i)=>Object.assign(e,{x:6+i*.7,y:6}));car.robots.forEach(r=>{r.model='car';});run(car,'car forward dynamic encounter',{limit:300});
// Worst allowed entity count: runtime search still has one shared work budget.
const stress=dynamicDemoScene();stress.width=20;stress.height=20;stress.entities=stress.entities.filter(e=>e.kind!=='lock');for(let i=stress.entities.length;i<100;i++)stress.entities.push({id:'stress-'+i,kind:'box',name:'stress',x:3+(i%10)*1.4,y:.5+Math.floor(i/10)*1.7,w:.4,h:.5,floor:1,blocking:true});const stressPose={...seed(stress).R1,x:1,y:10},stressRoute={id:'R1',points:[{x:1,y:10,yaw:0,floor:1},{x:19,y:10,yaw:0,floor:1}],checkpoints:[1],pickup:-1,deliver:-1,queue:999,charge:1000,exit:1,liftStart:-1,liftEnd:-1,qrIndices:[]};const wallStart=performance.now();try{replanRemaining(stress,stressRoute,stressPose,[{id:'R2',x:10,y:10,yaw:0,floor:1,seenAt:0,vx:0,vy:0,visible:true}]);}catch{}const wallMs=performance.now()-wallStart;assert.ok(wallMs<200,'100-entity total search budget');console.log('PASS 100 entities bounded replan wall time',wallMs.toFixed(2)+'ms');
if(process.argv[2])run(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),'private user map regression');
console.log('All dynamic navigation checks passed.');
