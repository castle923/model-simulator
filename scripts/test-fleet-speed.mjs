import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFleet,tickFleet,setFleetSpeed,fleetSpeed} from '../lib/fleet.ts';
import {factorySample,prepareFactory,setFactorySpeed} from '../lib/factory.ts';

const durations=new Map();
for(const count of [2,4])for(const speed of [.1,.8]){
 const f=createFleet(count);setFactorySpeed(f,factorySample,speed);f.paused=false;
 let queueMovingDuringCharge=false;
 for(let i=0;i<100000&&!f.paused;i++){
  const before=structuredClone(f);tickFleet(f,.01);
  assert(f.robots.filter(r=>r.phase==='crossing').length<=1);
  assert(f.robots.filter(r=>['toCharger','charging','leavingCharger'].includes(r.phase)).length<=1);
  for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)assert(Math.hypot(f.robots[a].x-f.robots[b].x,f.robots[a].y-f.robots[b].y)>=.4-1e-7);
  if(before.robots.some(r=>r.phase==='charging'))for(const r of f.robots.filter(r=>r.phase==='toChargeQueue')){const old=before.robots.find(o=>o.id===r.id);if(Math.hypot(r.x-old.x,r.y-old.y)>0)queueMovingDuringCharge=true;}
 }
 assert(f.robots.every(r=>r.phase==='done'));assert(queueMovingDuringCharge);durations.set(count+':'+speed,f.time);
}
for(const count of [2,4])assert(durations.get(count+':0.1')>durations.get(count+':0.8')*2);

for(const speed of [.1,.8])for(const winner of [1,2]){
 const f=createFleet();setFleetSpeed(f,speed);f.robots[winner-1].x+=f.robots[winner-1].side*.01;prepareFactory(f,factorySample);f.paused=false;
 while(f.owner===null&&f.time<20)tickFleet(f,.01);assert.equal(f.owner,winner,'1cm priority holds at each speed');
 while(f.robots.some(r=>r.arrival===null)&&f.time<20)tickFleet(f,.01);
 assert(Math.abs(Math.abs(f.robots[0].arrival-f.robots[1].arrival)-.01/speed)<1e-7,'continuous arrival delta uses selected speed');
}

const live=createFleet(4);prepareFactory(live,factorySample);live.paused=false;
while(live.owner===null)tickFleet(live,.01);
let before=structuredClone(live);setFactorySpeed(live,factorySample,.8);const changed=structuredClone(live);changed.speed=before.speed;assert.deepEqual(changed,before,'live speed change preserves position, time, ownership and routes');
live.paused=true;before=structuredClone(live);setFactorySpeed(live,factorySample,.1);assert(live.paused);tickFleet(live,.01);assert.equal(live.time,before.time);assert.deepEqual(live.robots,before.robots);
live.paused=false;for(let i=0;i<100000&&!live.paused;i++)tickFleet(live,.01);assert(live.robots.every(r=>r.phase==='done'));

for(const invalid of [NaN,0,Infinity,-Infinity,.09,.81,.123]){
 const f=createFleet(),original=structuredClone(f);assert.throws(()=>setFleetSpeed(f,invalid));assert.deepEqual(f,original);
}
const bad=structuredClone(factorySample);bad.chargeQueue[0]=bad.chargeQueue[1];const atomic=createFleet(),original=structuredClone(atomic);assert.throws(()=>setFactorySpeed(atomic,bad,.8));assert.deepEqual(atomic,original,'initial speed plus mission validation is atomic');
const legacy=createFleet();delete legacy.speed;assert.equal(fleetSpeed(legacy),.35);legacy.paused=false;const x=legacy.robots[0].x;tickFleet(legacy,.01);assert(Math.abs(legacy.robots[0].x-x-.0035)<1e-10);

// Slower travel increases the idle energy expected before the current charger owner exits.
function waitingNeed(speed){const f=createFleet();setFleetSpeed(f,speed);f.chargingEnabled=true;f.chargerOwner=1;f.paused=false;Object.assign(f.robots[0],{phase:'leavingCharger',route:[{x:7.5,y:.7}],index:0,battery:100});Object.assign(f.robots[1],{phase:'chargeWaiting',chargeRoute:[{x:6.9,y:.7},{x:6.9,y:1.7}],battery:30});tickFleet(f,.01);return f.robots[1].chargeRequired;}
assert(waitingNeed(.1)>waitingNeed(.8),'speed affects assumed waiting consumption');
for(const [file,id] of [['FleetLab.tsx','factory-speed'],['Simulator.tsx','single-speed']]){const ui=readFileSync(new URL('../app/'+file,import.meta.url),'utf8');assert(ui.includes('id="'+id+'"'));assert(ui.includes('min="0.10" max="0.80" step="0.05"'));assert(ui.includes('disabled={controlLocked} onChange={e=>changeSpeed('));assert(ui.includes('실제 Pi5/Gazebo 속도와 별개'));}
console.log('PASS: speed 0.10/0.80m/s, 2/4 complete and separated, queue motion during charging, 1cm arrival priority, live and paused non-destructive updates, initial atomic validation, invalid speeds rejected, legacy default and waiting energy consistency');
