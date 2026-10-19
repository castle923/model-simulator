import assert from 'node:assert/strict';
import {initialScene,planScene,sceneWorld} from '../../lib/scene-local.ts';
import {defaultCustomization,robotRadius} from '../../lib/robot-customization.ts';
import {seed,stepSimulation} from '../../lib/scene-runtime.ts';
import {segmentClear} from '../../lib/planner.ts';
const scene=initialScene(),small=defaultCustomization();
small.maxSpeed=.12;
small.cameras.push({...small.cameras[0],id:'rear',yawDeg:180});
small.manipulators=['left','right'].map(side=>({id:side,label:side,side,reach:.15,payloadKg:.1,stowed:true,enabled:true,joints:[{name:'shoulder',minDeg:-90,maxDeg:90,angleDeg:0},{name:'elbow',minDeg:-120,maxDeg:120,angleDeg:45}]}));
scene.robots[0].customization=small;
scene.robots[1].customization=defaultCustomization('amr');
scene.robots[1].customization.maxSpeed=.28;
const routes=planScene(scene),poses=seed(scene),owners=new Map(),lift={current:null};
let time=0,minSeparation=Infinity,frames=0;
while(time<600&&!routes.every(r=>poses[r.id].phase==='임무 완료')){
 const before=structuredClone(poses);time+=.02;frames++;
 stepSimulation(scene,routes,.02,.35,poses,owners,lift,time);
 const separation=Math.hypot(poses.R1.x-poses.R2.x,poses.R1.y-poses.R2.y);
 minSeparation=Math.min(minSeparation,separation);
 assert.ok(separation>=robotRadius(scene.robots[0])+robotRadius(scene.robots[1])+.049);
 for(const r of scene.robots){const p=poses[r.id];assert.ok(!p.missionError);assert.ok(segmentClear(sceneWorld(scene,p.floor,before[r.id],p,r),before[r.id],p),`${r.id} swept static clearance at ${time}`);assert.ok(Math.hypot(p.x-before[r.id].x,p.y-before[r.id].y)<=r.customization.maxSpeed*.02+1e-8);}
}
assert.ok(routes.every(r=>poses[r.id].phase==='임무 완료'),'both missions, charging and forward exit must finish');
console.log(JSON.stringify({ok:true,case:'initial scene: nominal R1 0.12m/s two cameras two stowed arms + AMR R2 0.28m/s',time,frames,minSeparation,radii:scene.robots.map(robotRadius),states:Object.fromEntries(Object.entries(poses).map(([id,p])=>[id,{phase:p.phase,battery:p.battery,replans:p.replans}]))},null,2));
for(const [first,second] of [['turtlebot-burger','round-amr'],['turtlebot-waffle','amr']]){
 const s=initialScene();s.robots[0].customization=defaultCustomization(first);s.robots[1].customization=defaultCustomization(second);const rs=planScene(s),ps=seed(s),locks=new Map(),elevator={current:null};let t=0,min=Infinity;
 while(t<600&&!rs.every(r=>ps[r.id].phase==='임무 완료')){const old=structuredClone(ps);t+=.02;stepSimulation(s,rs,.02,.35,ps,locks,elevator,t);const d=Math.hypot(ps.R1.x-ps.R2.x,ps.R1.y-ps.R2.y);min=Math.min(min,d);assert.ok(d>=robotRadius(s.robots[0])+robotRadius(s.robots[1])+.049);for(const r of s.robots){const p=ps[r.id];assert.ok(!p.missionError);assert.ok(segmentClear(sceneWorld(s,p.floor,old[r.id],p,r),old[r.id],p));assert.ok(Math.hypot(p.x-old[r.id].x,p.y-old[r.id].y)<=r.customization.maxSpeed*.02+1e-8);}}
 assert.ok(rs.every(r=>ps[r.id].phase==='임무 완료'),`${first}/${second} full run`);console.log(JSON.stringify({ok:true,case:[first,second],time:t,minSeparation:min}));
}
