import assert from 'node:assert/strict';
import {createIndustrialWorld as create,enqueueIndustrialCommand as enqueue,stepIndustrialWorld as step,setIndustrialNetwork as net,restartIndustrialCoordinator as restart,restartIndustrialRobot as reboot,reconcileIndustrial as reconcile,industrialOccupants,injectIndustrialMessage} from '../lib/industrial-runtime.ts';
import {angleWrap,footprint,polygonsOverlap,rectPolygon,poseClear,pathClear,makePath} from '../lib/industrial-geometry.ts';
import {processIndustrialMessages,commitIndustrialGrant} from '../lib/industrial-protocol.ts';
const cases=[];
function run(w,until,limit=180,dt=.02){const start=w.time;while(!until(w)&&w.time-start<limit){const before=w.robots.map(r=>({...r}));step(w,dt);for(let i=0;i<w.robots.length;i++){const r=w.robots[i],p=before[i],d=Math.hypot(r.x-p.x,r.y-p.y),a=angleWrap(r.yaw-p.yaw);assert(r.v>=-1e-10);assert(d<=r.profile.maxSpeed*dt+1e-7,'teleport');if(d>1e-8){assert((r.x-p.x)*Math.cos(p.yaw)+(r.y-p.y)*Math.sin(p.yaw)>=-1e-7,'reverse');assert(Math.abs(a)<=2*Math.asin(Math.min(1,d/(2*r.profile.minRadius)))*1.002+1e-6,'curvature');}else assert(Math.abs(a)<1e-8,'inplace yaw');assert(r.v-p.v<=r.profile.accel*dt+1e-7,'accel');assert(p.v-r.v<=r.profile.decel*dt+1e-7,'decel '+JSON.stringify({id:r.id,t:w.time,prev:p.v,next:r.v,reason:r.reason,oracle:w.metrics.oracleStops}));}assert(industrialOccupants(w).length<=1);assert.equal(w.metrics.oracleStops,0);assert(!w.pausedFault,'unexpected fault');}assert(until(w),'timeout '+JSON.stringify(w.robots.map(r=>[r.id,r.status,r.reason])));}
function swaps(w){for(const [robotId,stationId]of [['R1','B'],['R2','A'],['R3','D'],['R4','C']])assert(enqueue(w,{robotId,stationId,kind:'navigate'}).ok);}
{
 const w=create();swaps(w);run(w,w=>w.metrics.completed===4);assert.equal(w.metrics.grants,4);assert(w.metrics.maxOccupancy===1);for(const [i,id]of ['B','A','D','C'].entries()){const t=w.stations.find(s=>s.id===id),r=w.robots[i];assert(Math.hypot(r.x-t.x,r.y-t.y)<1e-8);}cases.push(['four simultaneous swaps',w.time,{...w.metrics}]);
 for(const [robotId,stationId]of [['R1','A'],['R2','B'],['R3','C'],['R4','D']])enqueue(w,{robotId,stationId,kind:'navigate'});run(w,w=>w.metrics.completed===8,240);cases.push(['repeat reverse swaps',w.time]);
}
{
 const w=create();enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});for(let i=0;i<600;i++)step(w,.02);assert.equal(w.metrics.completed,0);assert.equal(w.coordinator.grant,undefined);const before=w.robots.map(r=>[r.x,r.y,r.yaw]),time=w.time;enqueue(w,{robotId:'R2',kind:'navigate',stationId:'A'});assert.deepEqual(w.robots.map(r=>[r.x,r.y,r.yaw]),before);assert.equal(w.time,time);run(w,w=>w.metrics.completed===2);cases.push(['hot departure unblocks occupied destination',w.time]);
}
{
 const w=create({network:{loss:.15,duplicate:.6,delay:.25}});swaps(w);run(w,w=>w.metrics.completed===4,220,.031);assert(w.network.dropped>0&&w.network.duplicates>0);cases.push(['delayed lost duplicated messages',w.time,w.network.dropped]);
}
{
 const w=create();enqueue(w,{robotId:'R1',kind:'charge'});w.robots[0].battery=98;run(w,w=>w.metrics.completed===1,80);assert.equal(w.robots[0].battery,100);enqueue(w,{robotId:'R2',kind:'charge'});for(let i=0;i<300;i++)step(w,.02);assert.equal(w.metrics.completed,1);enqueue(w,{robotId:'R1',kind:'navigate',stationId:'A'});run(w,w=>w.metrics.completed===3,150);cases.push(['charger occupied wait then hot departure',w.time]);
}
{
 const w=create();enqueue(w,{robotId:'R3',kind:'charge'});enqueue(w,{robotId:'R4',kind:'navigate',stationId:'A'});enqueue(w,{robotId:'R1',kind:'deliverHelmet'});run(w,w=>w.metrics.completed===3,180);assert.equal(w.helmet.owner,'worker');assert.equal(w.events.filter(e=>e.type==='DELIVER').length,1);cases.push(['helmet pickup and delivery ownership',w.time]);
}
{
 const w=create();swaps(w);run(w,w=>w.metrics.completed===4,180,.73);cases.push(['large dt substepping',w.time]);
}
console.log(JSON.stringify({PASS:cases},null,2));

