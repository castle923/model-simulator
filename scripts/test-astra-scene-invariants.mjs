import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialScene,validateScene,planScene,sceneWorld,arcClear} from '../lib/scene-local.ts';
import {segmentClear} from '../lib/planner.ts';
import {seed,stepSimulation,helmetOwnership,runtimeEntities} from '../lib/scene-runtime.ts';

// Imported IDs remain data, including property names inherited by ordinary objects.
for(const id of ['__proto__','constructor','toString']){
 const s=initialScene();s.entities=s.entities.filter(e=>!e.blocking);
 s.entities.push({id,kind:'helmet',name:'안전모',x:3,y:2.8,w:.3,h:.3,floor:1,blocking:true},{id:'worker-test',kind:'worker',name:'작업자',x:5,y:2.7,w:.4,h:.4,floor:1,blocking:true});
 s.robots=[{...s.robots[0],mission:'helmet',missionTargets:{helmetId:id,workerId:'worker-test'}}];
 validateScene(s);const poses=seed(s),routes=planScene(s),owners=new Map(),lift={current:null};
 assert.deepEqual(helmetOwnership(s,poses)[id],{kind:'ground'});
 assert.equal(runtimeEntities(s,poses).filter(e=>e.id===id).length,1);
 let t=0;for(;t<100;t+=.02){stepSimulation(s,routes,.02,.8,poses,owners,lift,t);runtimeEntities(s,poses);if(poses.R1.phase==='임무 완료')break;}
 assert.ok(t<100);assert.deepEqual(helmetOwnership(s,poses)[id],{kind:'worker',workerId:'worker-test'});
 console.log('PASS imported ID ownership and full delivery',id);
}

const fixturePath=process.argv[2];
const raw=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):null;
const fixture=raw?(raw.scene??raw):initialScene();
const fixtureLabel=fixturePath?'provided scene continuous safety':'generated two-robot scene continuous safety';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function verify(scene,label,speed=.8,dt=.02){
 const snapshot=JSON.stringify(scene),routes=planScene(scene);
 for(const route of routes){const robot=scene.robots.find(r=>r.id===route.id);
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],d=Math.hypot(b.x-a.x,b.y-a.y),da=wrap(b.yaw-a.yaw);
   if(a.floor!==b.floor){assert.ok(d<1e-9,'lift transition must preserve x/y');continue;}
   const world=sceneWorld(scene,a.floor,a,b);
   if(robot.model==='car'&&d>1e-9){
    const radius=Math.abs(da)>1e-8?d/(2*Math.sin(Math.abs(da)/2)):Infinity;
    assert.ok(radius>=robot.minRadius-1e-8,'configured minimum radius');
    const middle=a.yaw+da/2;
    assert.ok((b.x-a.x)*Math.cos(middle)+(b.y-a.y)*Math.sin(middle)>0,'forward displacement');
    const signedRadius=Math.abs(da)>1e-8?d/(2*Math.sin(da/2)):Infinity;
    const length=Math.abs(da)>1e-8?Math.abs(signedRadius*da):d;
    assert.ok(arcClear(world,a,1/signedRadius,length),'entire planned arc physically clear');
   }else{assert.ok(segmentClear(world,a,b),'entire planned line physically clear');if(robot.model==='car')assert.ok(Math.abs(da)<1e-8,'no in-place rotation');}
  }
 }
 const poses=seed(scene),owners=new Map(),lift={current:null};let t=0,min=Infinity;
 for(;t<1800;t+=dt){const prev=structuredClone(poses);stepSimulation(scene,routes,dt,speed,poses,owners,lift,t);
  for(const [id,p] of Object.entries(poses)){
   const d=Math.hypot(p.x-prev[id].x,p.y-prev[id].y);assert.ok(d<=speed*dt+1e-8,'no teleport');
   assert.ok(segmentClear(sceneWorld(scene,p.floor,p,p),p,p),'physical body stays outside solid geometry');
   const robot=scene.robots.find(r=>r.id===id),dyaw=Math.abs(wrap(p.yaw-prev[id].yaw));
   if(robot.model==='car'){assert.ok(dyaw<=speed*dt/robot.minRadius+1e-8,'runtime angular speed bound');if(d<1e-10)assert.ok(dyaw<1e-8,'runtime no in-place rotation');}
  }
  const ps=Object.values(poses);for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)if(ps[i].floor===ps[j].floor){const d=Math.hypot(ps[i].x-ps[j].x,ps[i].y-ps[j].y);min=Math.min(min,d);assert.ok(d>=.49-1e-8,'pair separation');}
  if(ps.every(p=>p.phase==='임무 완료'))break;
 }
 assert.ok(t<1800,'joint completion');assert.equal(owners.size,0,'all reservations released');assert.equal(lift.current,null);assert.equal(JSON.stringify(scene),snapshot,'no scene or obstacle mutation');
 console.log('PASS',label,JSON.stringify({speed,dt,seconds:+t.toFixed(2),minSeparation:Number.isFinite(min)?+min.toFixed(5):null}));
}
for(const [speed,dt] of [[.1,.05],[.35,.02],[.8,.05]])verify(structuredClone(fixture),fixtureLabel,speed,dt);
for(const radius of [.3,.65,1]){const s=initialScene();s.width=12;s.height=8;s.entities=s.entities.filter(e=>!e.blocking);Object.assign(s.entities.find(e=>e.kind==='charger'),{x:4.5,y:4});Object.assign(s.entities.find(e=>e.id==='q1'),{x:6,y:4});s.robots=[{...s.robots[0],x:1,y:1,goal:{x:8,y:1},model:'car',minRadius:radius}];verify(s,'configured virtual radius '+radius);}
console.log('All Astra scene invariants passed.');
