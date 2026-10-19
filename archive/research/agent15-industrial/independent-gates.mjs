import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {createIndustrialWorld as create,enqueueIndustrialCommand as enqueue,stepIndustrialWorld as step,industrialOccupants as occupants} from '../../mechanic-hub/lib/industrial-runtime.ts';
import {commitIndustrialGrant} from '../../mechanic-hub/lib/industrial-protocol.ts';
const results=[];
for(const sameDirection of [false,true]){
 const w=create(),request=(id,direction,exitBerth)=>({robotId:id,bootId:1,requestId:'req-'+id,coordinatorEpoch:1,direction,exitBerth,sequence:1,receivedAt:0});
 const a=commitIndustrialGrant(w,request('R1','W>E','EXIT-E')),b=commitIndustrialGrant(w,sameDirection?request('R3','W>E','EXIT-E'):request('R2','E>W','EXIT-W'));
 assert(a);assert.equal(b,null);assert.equal(w.metrics.grants,1);assert.equal(w.coordinator.journal.length,1);assert.equal(w.coordinator.berths['EXIT-E'],'R1');results.push({case:'same tick committed claims',sameDirection,grants:w.metrics.grants});
}
{
 const w=create();Object.assign(w.robots[1],{x:2.16,y:1,yaw:0});enqueue(w,{robotId:'R1',kind:'navigate',stationId:'B'});
 for(let i=0;i<1000;i++)step(w,.02);assert(w.robots[0].requestId);assert.equal(w.metrics.grants,0);assert.equal(occupants(w).length,0);assert.equal(w.metrics.oracleStops,0);results.push({case:'physically occupied exit berth with empty destination',time:w.time,grants:w.metrics.grants,status:w.robots[0].status});
}
{
 const w=create();for(const [robotId,stationId]of [['R1','B'],['R2','A']])enqueue(w,{robotId,kind:'navigate',stationId});while(!occupants(w).length&&w.time<40)step(w,.02);assert.equal(occupants(w).length,1);const grant=structuredClone(w.coordinator.grant);for(let i=0;i<600;i++){w.network.pending=w.network.pending.filter(m=>m.type!=='HEARTBEAT');step(w,.02);}assert.equal(w.coordinator.state,'UNKNOWN');assert.equal(w.coordinator.grant.grantSequence,grant.grantSequence);assert.equal(w.metrics.grants,1);assert(w.robots.every(r=>r.v===0));assert.equal(w.metrics.oracleStops,0);results.push({case:'heartbeat only loss keeps occupied claim after timeout',time:w.time,state:w.coordinator.state,occupants:occupants(w),grants:w.metrics.grants});
}
writeFileSync(new URL('../../outputs/agent15-industrial/independent-gates.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify({PASS:results},null,2));
