import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createIndustrialWorld as create,enqueueIndustrialCommand as enqueue,stepIndustrialWorld as step,industrialOccupants as occupants,injectIndustrialMessage as inject,restartIndustrialRobot as reboot,setIndustrialNetwork as net} from '../../mechanic-hub/lib/industrial-runtime.ts';
import {footprint,polygonsOverlap,rectPolygon,angleWrap} from '../../mechanic-hub/lib/industrial-geometry.ts';
import {processIndustrialMessages} from '../../mechanic-hub/lib/industrial-protocol.ts';
const results=[];
const pair=w=>{enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});enqueue(w,{robotId:'R2',kind:'navigate',stationId:'A'});};
function tick(w,drop=[]){w.network.pending=w.network.pending.filter(m=>!drop.includes(m.type));step(w,.02);assert(occupants(w).length<=1);assert.equal(w.metrics.oracleStops,0);}
for(const type of ['GRANT','ENTER','EXIT','BERTH_CLEAR']){
 const w=create();pair(w);let dropped=0;
 for(let i=0;i<2250;i++){dropped+=w.network.pending.filter(m=>m.type===type).length;tick(w,[type]);}
 assert(dropped>0,type+' not exercised');
 if(type==='GRANT'){assert.equal(occupants(w).length,0);assert.equal(w.metrics.grants,1);assert.equal(w.metrics.completed,0);assert.equal(w.coordinator.state,'RESERVED');}
 if(type==='EXIT'){assert(w.coordinator.grant);assert.equal(w.metrics.grants,1);}
 if(type==='BERTH_CLEAR'){assert(Object.values(w.coordinator.berths).some(Boolean));}
 const during={time:w.time,state:w.coordinator.state,completed:w.metrics.completed,grants:w.metrics.grants,berths:{...w.coordinator.berths},occupancy:occupants(w)};
 for(let i=0;i<8000&&(w.metrics.completed<2||Object.values(w.coordinator.berths).some(Boolean)||w.coordinator.grant);i++)tick(w);
 assert.equal(w.metrics.completed,2,type+' failed after restored delivery');assert(!Object.values(w.coordinator.berths).some(Boolean));assert.equal(w.coordinator.grant,undefined);
 results.push({case:'selective '+type+' loss',dropped,during,recoveredAt:w.time});
}
{
 const w=create({network:{delay:1,duplicate:1,loss:.05}});for(const [robotId,stationId] of [['R1','B'],['R2','A'],['R3','D'],['R4','C']])enqueue(w,{robotId,stationId,kind:'navigate'});
 let grantChecks=0,rearChecks=0,maxDistance=0;
 for(let i=0;i<14000&&w.metrics.completed<4;i++){
  const poses=w.robots.map(r=>({id:r.id,x:r.x,y:r.y,yaw:r.yaw,v:r.v})),prior=w.coordinator.grant;
  tick(w);if(prior&&!w.coordinator.grant){const r=w.robots.find(r=>r.id===prior.robotId),poly=footprint(r,r.profile,true);assert(prior.direction==='W>E'?poly.every(p=>p.x>w.aisle.x+w.aisle.w):poly.every(p=>p.x<w.aisle.x));rearChecks++;}
  if(w.coordinator.grant){const t=w.coordinator.grant;assert.equal(w.coordinator.berths[t.exitBerth],t.robotId);grantChecks++;}
  for(const r of w.robots){const p=poses.find(p=>p.id===r.id),ds=Math.hypot(r.x-p.x,r.y-p.y),da=Math.abs(angleWrap(r.yaw-p.yaw));assert(ds<=r.profile.maxSpeed*.02+1e-8);assert(r.v>=0);assert(da<=ds/r.profile.minRadius*1.0001+1e-6);maxDistance=Math.max(maxDistance,ds);if(!r.token)for(const line of w.aisle.stopLines)assert(!polygonsOverlap(footprint(r,r.profile,r.payload,0),rectPolygon(line)),'ungranted footprint crossed stop line');}
 }
 assert.equal(w.metrics.completed,4);results.push({case:'maximum allowed delay + duplication + loss; stop lines, rear clear and atomic berth checks',time:w.time,metrics:w.metrics,grantChecks,rearChecks,maxDistance});
}
{
 const w=create();pair(w);while(!w.coordinator.grant)tick(w);const old=structuredClone(w.coordinator.grant),owner=w.robots.find(r=>r.id===old.robotId);while(owner.v<.10)tick(w);reboot(w,owner.id);for(let i=0;i<1000;i++)tick(w);assert.equal(w.coordinator.state,'UNKNOWN');assert.equal(w.coordinator.grant.grantSequence,old.grantSequence);assert.equal(w.metrics.grants,1);const held=structuredClone(w.coordinator);inject(w,{type:'GRANT',from:'coordinator',to:owner.id,robotId:owner.id,token:old});inject(w,{type:'EXIT',from:owner.id,to:'coordinator',token:old,pose:{x:2.8,y:1,yaw:0}});processIndustrialMessages(w);assert.equal(w.coordinator.state,'UNKNOWN');assert.deepEqual(w.coordinator.berths,held.berths);assert.equal(owner.token,undefined);results.push({case:'reboot before aisle entry, delayed old grant and exit',time:w.time,ownerPose:{x:owner.x,y:owner.y,v:owner.v},occupants:occupants(w),state:w.coordinator.state});
}
{
 const w=create();enqueue(w,{robotId:'R1',kind:'charge'});while(w.robots[0].v<.1)tick(w);const r=w.robots[0];w.obstacles.push({id:'injected-block',label:'oracle proof',x:r.x-.01,y:r.y-.01,w:.02,h:.02});step(w,.02);assert(w.metrics.oracleStops>0);assert(w.events.some(e=>e.type==='ORACLE_STOP'));assert.equal(w.coordinator.state,'UNKNOWN');results.push({case:'truth-only obstacle guard is exposed as intervention',metrics:w.metrics,lastEvents:w.events.slice(-2)});
}
mkdirSync(new URL('../../outputs/agent15-industrial/',import.meta.url),{recursive:true});writeFileSync(new URL('../../outputs/agent15-industrial/independent-adversarial.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify({PASS:results},null,2));

