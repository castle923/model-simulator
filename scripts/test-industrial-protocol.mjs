import assert from 'node:assert/strict';
import {createIndustrialWorld as create,enqueueIndustrialCommand as enqueue,stepIndustrialWorld as step,setIndustrialNetwork as net,restartIndustrialCoordinator as restart,restartIndustrialRobot as reboot,reconcileIndustrial as reconcile,industrialOccupants,injectIndustrialMessage as inject,cancelIndustrialTask as cancel} from '../lib/industrial-runtime.ts';
import {processIndustrialMessages,commitIndustrialGrant,sameToken} from '../lib/industrial-protocol.ts';
import {footprint,polygonsOverlap,rectPolygon,poseClear,pathClear,makePath,advancePrimitive} from '../lib/industrial-geometry.ts';
import {NOMINAL_RASPBOT as p} from '../lib/industrial-model.ts';
const passed=[];const tick=(w,n)=>{for(let i=0;i<n;i++)step(w,.02);};const pair=w=>{enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});enqueue(w,{robotId:'R2',kind:'navigate',stationId:'A'});};
for(const mode of ['disconnect','coordinator','robot']){
 const w=create();pair(w);while(!industrialOccupants(w).length&&w.time<30)step(w,.02);assert.equal(industrialOccupants(w).length,1);const old={...w.coordinator.grant},owner=w.robots.find(r=>r.id===old.robotId),start=owner.distance,speed=owner.v;
 if(mode==='disconnect')net(w,{connected:false});else if(mode==='coordinator')restart(w);else reboot(w,owner.id);
 let prev=owner.v;for(let i=0;i<200;i++){step(w,.02);assert(prev-owner.v<=owner.profile.decel*.02+1e-8);prev=owner.v;}assert.equal(owner.v,0);assert(Math.abs(owner.distance-start-speed*speed/(2*p.decel))<1e-8);assert.equal(w.coordinator.state,'UNKNOWN');assert(w.coordinator.grant);assert(w.coordinator.berths[old.exitBerth]);assert.equal(w.metrics.oracleStops,0);
 net(w,{connected:true});assert(reconcile(w).ok);inject(w,{type:'EXIT',from:old.robotId,to:'coordinator',token:old,pose:{x:2.9,y:1,yaw:0}});if(mode!=='disconnect'){processIndustrialMessages(w);assert(w.coordinator.grant,'old epoch/boot EXIT released');}
 while(w.metrics.completed<2&&w.time<160){step(w,.02);assert.equal(w.metrics.oracleStops,0);assert(industrialOccupants(w).length<=1);}assert.equal(w.metrics.completed,2,mode);passed.push(mode+' retains occupancy, brakes and explicit recovery completes');
}
{
 const w=create();pair(w);net(w,{loss:1});tick(w,1500);assert.equal(w.metrics.grants,0);assert.equal(industrialOccupants(w).length,0);assert(w.robots.every(r=>r.v===0));passed.push('all message loss: no permission and no entry');
}
{
 const w=create();const q={robotId:'R1',bootId:1,requestId:'a',coordinatorEpoch:1,direction:'W>E',exitBerth:'EXIT-E',sequence:1,receivedAt:0};const old=commitIndustrialGrant(w,q);w.coordinator.grant=undefined;w.coordinator.state='FREE';w.coordinator.berths['EXIT-E']=null;const newer=commitIndustrialGrant(w,{...q,requestId:'b'});inject(w,{type:'BERTH_CLEAR',from:'R1',to:'coordinator',token:old,pose:{x:2.8,y:1.7,yaw:0}});processIndustrialMessages(w);assert(sameToken(w.coordinator.berthTokens['EXIT-E'],newer));assert.equal(w.coordinator.berths['EXIT-E'],'R1');passed.push('delayed old berth clear cannot release newer same-robot reservation');
}
{
 const w=create(),r=w.robots[0];w.time=10;w.coordinator.reports.R1={pose:{x:.5,y:.5,yaw:0},v:0,status:'IDLE',bootId:1,at:9,messageId:90};w.network.pending.push({id:80,type:'HEARTBEAT',from:'R1',to:'ALL',robotId:'R1',bootId:1,v:0,status:'IDLE',pose:{x:2,y:1,yaw:0},sentAt:8,deliverAt:10});processIndustrialMessages(w);assert.equal(w.coordinator.reports.R1.at,9);assert.equal(w.coordinator.reports.R1.pose.x,.5);passed.push('out-of-order heartbeat cannot refresh stale pose');
}
{
 const rotated={x:1,y:1,yaw:Math.PI/4},corner=footprint(rotated,p,false,0)[0],box={id:'corner',label:'corner',x:corner.x-.002,y:corner.y-.002,w:.004,h:.004};assert(Math.hypot(corner.x-1,corner.y-1)>p.width/2);assert(!poseClear(rotated,p,3,2,[box]));const big={...p,loadLength:.4,loadWidth:.22,minRadius:.12},path=makePath({x:1,y:1,yaw:0},[{curvature:1/.12,length:.18}]),mid=advancePrimitive({x:1,y:1,yaw:0},1/.12,.09),c=footprint(mid,big,true)[0];assert(!pathClear(path,big,3,2,[{id:'g',label:'graze',x:c.x-.001,y:c.y-.001,w:.002,h:.002}],[],true));assert.throws(()=>create({profile:{loadWidth:.24}}));passed.push('rotated corner and large-load tight-radius swept grazing rejected');
}
{
 const w=create();pair(w);while(!(w.coordinator.state==='FREE'&&Object.values(w.coordinator.berths).some(Boolean))&&w.time<40)step(w,.02);assert(Object.values(w.coordinator.berths).some(Boolean));restart(w);tick(w,100);assert(reconcile(w).ok);while(w.metrics.completed<2&&w.time<140)step(w,.02);assert.equal(w.metrics.completed,2);assert.equal(w.metrics.oracleStops,0);passed.push('restart after aisle exit preserves and renews uncleared berth');
}
{
 const w=create();const task=enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});tick(w,400);assert(w.robots[0].requestId);cancel(w,'R1',task.taskId);tick(w,20);assert.equal(w.tasks[0].status,'CANCELLED');assert(!w.robots[0].requestId);assert.equal(w.coordinator.grant,undefined);passed.push('cancel at ungranted QR safe stop invalidates pending request');
}
{
 const w=create({profile:{minRadius:.35}}),before=w.robots.map(r=>[r.x,r.y,r.yaw]);enqueue(w,{robotId:'R1',kind:'charge'});tick(w,300);assert.equal(w.tasks[0].status,'ERROR');assert.match(w.tasks[0].error,/정적.*탐색 한도/);assert.deepEqual(w.robots.map(r=>[r.x,r.y,r.yaw]),before);assert.equal(w.metrics.grants,0);passed.push('P0-11 unsupported static leg fails explicitly without moving actors');
}
{
 const w=create();w.obstacles.push({id:'deadend',label:'closed aisle',x:1.5,y:.88,w:.1,h:.24});pair(w);tick(w,600);assert(w.tasks.every(t=>t.status==='ERROR'));assert.equal(industrialOccupants(w).length,0);assert.equal(w.metrics.grants,0);assert.equal(w.metrics.oracleStops,0);passed.push('P0-11 static aisle wall becomes task ERROR instead of permanent WAIT');
}
console.log(JSON.stringify({PASS:passed},null,2));
