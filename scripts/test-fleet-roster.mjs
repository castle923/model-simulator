import assert from 'node:assert/strict';
import {createFleet,addRobot,removeRobot,resetFleet,setFleetSpeed,tickFleet} from '../lib/fleet.ts';
import {factorySample,prepareFactory,addFactoryRobot,removeFactoryRobot} from '../lib/factory.ts';

const ids=f=>f.robots.map(r=>r.id);
const full=createFleet(4);prepareFactory(full,factorySample);
full.robots[0].battery=44.44;const survivor=structuredClone(full.robots[0]);
removeFactoryRobot(full,factorySample,2);assert.deepEqual(ids(full),[1,3,4]);
for(const key of ['id','x','y','side','slot','phase','battery','arrival'])assert.equal(full.robots[0][key],survivor[key]);
assert(!JSON.stringify(full.robots).includes('"id":2'),'active battery/route/phase/queue data leaves with the removed robot');
addFactoryRobot(full,factorySample);assert.deepEqual(ids(full),[1,2,3,4]);assert.equal(full.robots[1].battery,30);assert.equal(full.robots[0].battery,44.44);
assert.throws(()=>addRobot(full));

removeFactoryRobot(full,factorySample,1);setFleetSpeed(full,.8);full.time=50;full.paused=false;full.owner=3;full.chargerOwner=2;full.queueMoverOwner=4;
Object.assign(full.robots[0],{x:1,y:3,battery:91.12,phase:'charging',queueSlot:2,queuePoint:{x:1,y:3}});
const original=structuredClone(full),reset=resetFleet(full);assert.deepEqual(full,original,'reset constructs a fresh state');assert.deepEqual(ids(reset),[2,3,4]);assert.equal(reset.speed,.8);assert.equal(reset.time,0);assert(reset.paused);assert.equal(reset.owner,null);assert.equal(reset.chargerOwner,null);assert.equal(reset.queueMoverOwner,null);
for(const r of reset.robots){assert.equal(r.battery,35-(r.id-1)*5);assert.equal(r.phase,'approach');assert.equal(r.queuePoint,undefined);assert.equal(r.queueSlot,undefined);assert.deepEqual(r.route,[]);}
prepareFactory(reset,factorySample);assert.deepEqual(ids(reset),[2,3,4],'validation never recreates removed IDs');

const stale=createFleet(3);stale.owner=2;stale.chargerOwner=2;stale.queueMoverOwner=2;removeRobot(stale,2);assert.equal(stale.owner,null);assert.equal(stale.chargerOwner,null);assert.equal(stale.queueMoverOwner,null);assert.deepEqual(ids(stale),[1,3]);
for(const [f,id] of [[createFleet(1),1],[createFleet(),9],[{...createFleet(),time:1},1]]){const before=structuredClone(f);assert.throws(()=>removeRobot(f,id));assert.deepEqual(f,before);}

const blocked=structuredClone(factorySample);blocked.obstacles.push({kind:'wall',x:1.7,y:0,w:.5,h:4});
for(const edit of [(f,w)=>addFactoryRobot(f,w),(f,w)=>removeFactoryRobot(f,w,2)]){const f=createFleet(),before=structuredClone(f);assert.throws(()=>edit(f,blocked));assert.deepEqual(f,before,'failed geometry validation preserves the complete original roster and state');}

// Every non-empty subset keeps stable physical slots and completes without ID collisions.
for(let mask=1;mask<16;mask++){
 let f=createFleet(4);for(const r of [...f.robots])if(!(mask&(1<<(r.id-1))))removeRobot(f,r.id);
 const expected=ids(f);f=resetFleet(f);prepareFactory(f,factorySample);assert.deepEqual(ids(f),expected);f.paused=false;
 for(let i=0;i<100000&&!f.paused;i++){tickFleet(f,.01);for(let a=0;a<f.robots.length;a++)for(let b=a+1;b<f.robots.length;b++)assert(Math.hypot(f.robots[a].x-f.robots[b].x,f.robots[a].y-f.robots[b].y)>=.4-1e-7);}
 assert(f.robots.every(r=>r.phase==='done'),'subset '+expected+' completes');
}
console.log('PASS: stable free-ID reuse, active robot data removal, survivor state and reset roster preservation, reservation cleanup, minimum-one/time/id guards, atomic add/delete validation and all 15 roster subsets complete with .4m separation');
