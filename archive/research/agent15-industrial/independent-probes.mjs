import assert from 'node:assert/strict';
import {createIndustrialWorld as create, enqueueIndustrialCommand as enqueue,stepIndustrialWorld as step,setIndustrialNetwork as net,industrialOccupants as occupants} from '../../mechanic-hub/lib/industrial-runtime.ts';
import {footprint,polygonsOverlap,rectPolygon} from '../../mechanic-hub/lib/industrial-geometry.ts';
const results=[];
for(const radius of [.12,.15,.2,.25,.3,.35]){
 let w;try{w=create({profile:{minRadius:radius}});}catch(e){results.push({case:'profile',radius,rejected:e.message});continue;}
 enqueue(w,{robotId:'R1',kind:'charge'});
 while(w.time<60&&w.metrics.completed<1&&!w.pausedFault)step(w,.1);
 if(radius===.35)assert.equal(w.tasks[0].status,'ERROR');else assert.equal(w.metrics.completed,1);
 results.push({case:'profile local charge',radius,completed:w.metrics.completed,robot:w.robots[0].status,reason:w.robots[0].reason,task:w.tasks[0].status,oracle:w.metrics.oracleStops});
}
for(const speed of [.06,.16,.30]){
 const w=create({profile:{maxSpeed:speed}});enqueue(w,{robotId:'R1',kind:'charge'});
 while(w.robots[0].v<speed*.9&&w.time<10)step(w,.01);
 const r=w.robots[0],v=r.v,start=r.distance;net(w,{connected:false});
 for(let i=0;i<200;i++)step(w,.01);
 assert(Math.abs(r.distance-start-v*v/(2*r.profile.decel))<1e-8);
 results.push({case:'physical braking',speed,actualSpeed:v,expected:v*v/(2*r.profile.decel),actual:r.distance-start});
}
{
 const w=create();enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});enqueue(w,{robotId:'R2',kind:'navigate',stationId:'A'});
 while(!w.coordinator.grant&&w.time<30)step(w,.02);
 const before=structuredClone(w),r1=w.robots[0];enqueue(w,{robotId:'R3',kind:'charge'});
 for(const r of w.robots.filter(r=>r.id!=='R3'))assert.deepEqual(r,before.robots.find(b=>b.id===r.id));
 assert.deepEqual(w.coordinator,before.coordinator);assert.equal(w.time,before.time);
 results.push({case:'hot enqueue exact untouched robots and resources',pass:true,grant:w.coordinator.grant});
}
{
 const w=create();w.obstacles.push({id:'forward-deadend',label:'closed aisle end',x:1.5,y:.88,w:.1,h:.24});
 enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});enqueue(w,{robotId:'R2',kind:'navigate',stationId:'A'});
 for(let i=0;i<600;i++)step(w,.1);
 assert(w.tasks.every(t=>t.status==='ERROR'));assert.equal(w.metrics.oracleStops,0);assert.equal(occupants(w).length,0);
 results.push({case:'static no forward path',time:w.time,tasks:w.tasks.map(t=>({id:t.id,status:t.status,error:t.error})),robots:w.robots.slice(0,2).map(r=>({id:r.id,reason:r.reason,status:r.status})),oracle:w.metrics.oracleStops,occupancy:occupants(w)});
}
console.log(JSON.stringify(results,null,2));

