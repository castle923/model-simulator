import assert from 'node:assert/strict';
import {createFleet,tickFleet} from '../lib/fleet.ts';
import {factorySample,prepareFactory,parkFor,chargerFor} from '../lib/factory.ts';

const world=structuredClone(factorySample);
world.traffic={x:2,y:1.65,w:4,h:.7};
world.entries={left:{x:1.8,y:1},right:{x:6.2,y:1}};
world.charger={x:.25,y:2.9,w:.7,h:.7};
world.obstacles.push({kind:'pallet',x:3.5,y:1.75,w:.25,h:.25});
for(const count of [2,4]){
 const fleet=createFleet(count);prepareFactory(fleet,world);fleet.paused=false;
 let sawCharge=false,sawWaiting=false,lastOwner=null;
 for(let i=0;i<100000&&!fleet.paused;i++){
  tickFleet(fleet,.01);
  const occupied=fleet.robots.filter(r=>['toCharger','charging','leavingCharger'].includes(r.phase));
  assert(occupied.length<=1,'one shared charging slot');
  assert.equal(fleet.chargerOwner,occupied[0]?.id??null);
  assert(fleet.robots.filter(r=>r.phase==='crossing').length<=1);
  for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)assert(Math.hypot(fleet.robots[a].x-fleet.robots[b].x,fleet.robots[a].y-fleet.robots[b].y)>=.4-1e-7);
  if(occupied[0]?.phase==='charging'){sawCharge=true;assert(Math.hypot(occupied[0].x-chargerFor(world).x,occupied[0].y-chargerFor(world).y)<.001);}
  for(const r of fleet.robots)if(r.phase==='chargeQueued'){sawWaiting=true;const q=world.chargeQueue[r.queueSlot];assert(Math.hypot(r.x-q.x,r.y-q.y)<.001,'other robots wait at charger queue points');}
  if(lastOwner!==null&&fleet.chargerOwner!==lastOwner){const old=fleet.robots.find(r=>r.id===lastOwner);assert.equal(old.phase,'done','charger ownership releases after previous robot leaves');}
  lastOwner=fleet.chargerOwner;
 }
 assert(sawCharge&&sawWaiting);assert(fleet.robots.every(r=>r.phase==='done'));
 for(const r of fleet.robots)assert(Math.hypot(r.x-parkFor(world,r).x,r.y-parkFor(world,r).y)<.001);
}
for(const winner of [1,2]){const f=createFleet();f.robots[winner-1].x+=f.robots[winner-1].side*.01;prepareFactory(f,factorySample);f.paused=false;while(f.owner===null)tickFleet(f,.01);assert.equal(f.owner,winner);}
const high=createFleet();high.robots[0].battery=95;prepareFactory(high,factorySample);high.paused=false;for(let i=0;i<100000&&!high.paused;i++)tickFleet(high,.01);assert.equal(high.robots[0].decision,'잔량 60% 이상 · 현재 위치 대기');
const bad=structuredClone(world);bad.charger.w=.1;const untouched=createFleet();assert.throws(()=>prepareFactory(untouched,bad));assert(untouched.robots.every(r=>!r.prepared));
const low=createFleet();low.robots[0].battery=.01;assert.throws(()=>prepareFactory(low,world),/교착|잔량|경로/);assert(low.robots.every(r=>!r.prepared));
console.log('PASS: movable entries, one charger, queue in front of charger, exclusive full-charge exit, battery, 2/4 separation and invalid layout rejection');
