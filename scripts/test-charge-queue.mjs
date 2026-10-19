import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFleet,tickFleet,routeLength} from '../lib/fleet.ts';
import {factorySample,prepareFactory,parkFor,chargerFor} from '../lib/factory.ts';
import {segmentClear} from '../lib/planner.ts';

for(const count of [2,4]){
 const f=createFleet(count),w=prepareFactory(f,factorySample);f.paused=false;
 let chargingMovement=false,queueStops=0,maxQueued=0,previousOwner=null;
 const arrived=new Set();
 for(const r of f.robots){
  for(const path of [r.chargeRoute,r.chargeExitRoute,...r.queueRoutes,...r.queueChargeRoutes])for(let i=1;i<path.length;i++)assert(segmentClear(w,path[i-1],path[i]));
 }
 for(let i=0;i<100000&&!f.paused;i++){
  const before=structuredClone(f);tickFleet(f,.01);
  const occupants=f.robots.filter(r=>['toCharger','charging','leavingCharger'].includes(r.phase));
  assert(occupants.length<=1,'single shared charger reservation');
  assert.equal(f.chargerOwner,occupants[0]?.id??null);
  assert(f.robots.filter(r=>r.phase==='toChargeQueue').length<=1,'one queue transit reservation');
  assert.equal(f.queueMoverOwner,f.robots.find(r=>r.phase==='toChargeQueue')?.id??null);
  const c=f.robots.find(r=>r.id===before.chargerOwner);
  if(before.robots.find(r=>r.id===before.chargerOwner)?.phase==='charging'){
   for(const r of f.robots.filter(r=>r.id!==c?.id)){
    const old=before.robots.find(o=>o.id===r.id);
    if(Math.hypot(r.x-old.x,r.y-old.y)>0)chargingMovement=true;
   }
  }
  const queued=f.robots.filter(r=>r.phase==='chargeQueued');maxQueued=Math.max(maxQueued,queued.length);
  for(const r of queued){
   const q=w.chargeQueue[r.queueSlot];assert(Math.hypot(r.x-q.x,r.y-q.y)<1e-8);
   assert(Math.hypot(r.x-chargerFor(w).x,r.y-chargerFor(w).y)>=.4);
   const old=before.robots.find(o=>o.id===r.id);
   if(old.phase==='chargeQueued'){assert.equal(r.x,old.x);assert.equal(r.y,old.y);queueStops++;}
   arrived.add(r.id);
   assert(r.chargeRequired>=routeLength(r.queueChargeRoutes[r.queueSlot])*.6+10);
  }
  for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)assert(Math.hypot(f.robots[a].x-f.robots[b].x,f.robots[a].y-f.robots[b].y)>=.4-1e-7,'queue never overlaps vehicles or departure lane');
  if(previousOwner!==null&&f.chargerOwner!==previousOwner){
   const old=f.robots.find(r=>r.id===previousOwner),park=parkFor(w,old);assert.equal(old.phase,'done');assert(Math.hypot(old.x-park.x,old.y-park.y)<1e-8,'release only after full return');
  }
  previousOwner=f.chargerOwner;
 }
 assert(f.robots.every(r=>r.phase==='done'));assert(chargingMovement);assert(queueStops>0);assert.equal(arrived.size,count-1);assert.equal(maxQueued,count-1);
 assert.equal(f.chargerOwner,null);assert.equal(f.queueMoverOwner,null);
}

// Higher battery can still win when the longer charger path leaves less energy margin.
const priority=createFleet();priority.chargingEnabled=true;priority.chargerOwner=null;priority.paused=false;
for(const [i,r] of priority.robots.entries()){
 r.phase='chargeWaiting';r.battery=i?29:30;r.chargeRoute=[{x:r.x,y:r.y},{x:r.x+(i?1:10),y:r.y}];r.chargeExitRoute=[...r.chargeRoute].reverse();
}
tickFleet(priority,.01);assert.equal(priority.chargerOwner,1,'distance changes energy priority');

// A zero battery stops actual motion in each driven fleet phase.
for(const phase of ['approach','crossing','toCharger','toChargeQueue','leavingCharger']){
 const f=createFleet(1),r=f.robots[0];r.phase=phase;r.battery=0;r.route=[{x:r.x+.2,y:r.y}];r.index=0;f.chargingEnabled=true;f.chargerOwner=['toCharger','leavingCharger'].includes(phase)?r.id:null;f.queueMoverOwner=phase==='toChargeQueue'?r.id:null;f.owner=phase==='crossing'?r.id:null;f.paused=false;
 const p={x:r.x,y:r.y};tickFleet(f,.01);assert.equal(r.x,p.x);assert.equal(r.y,p.y);assert(f.paused,'energy depleted phase must safely pause');
}

for(const mutate of [w=>w.chargeQueue[1]={...w.chargeQueue[0]},w=>w.chargeQueue[0]={...chargerFor(w)},w=>w.chargeQueue[2]={x:3,y:3},w=>w.chargeQueue[0]={x:7.9,y:3.4},w=>w.chargeQueue.pop()]){
 const w=structuredClone(factorySample);mutate(w);const f=createFleet(4),before=structuredClone(f);assert.throws(()=>prepareFactory(f,w));assert.deepEqual(f,before,'invalid queue edit is atomic');
}
const moved=structuredClone(factorySample);moved.chargeQueue=moved.chargeQueue.map(p=>({x:p.x-.1,y:p.y}));prepareFactory(createFleet(4),moved);
const ui=readFileSync(new URL('../app/FleetLab.tsx',import.meta.url),'utf8');assert(ui.includes('value={(r.battery??35).toFixed(2)}'));assert(ui.includes('r.chargeRequired?.toFixed(2)'));assert(!ui.includes('toFixed(1)'));
console.log('PASS: 2/4 charger queue arrival and stops, 3 simultaneous wait points, charging-time queue transit, .4m collision clearance, full-departure release, distance energy priority, zero battery stop, editable points, atomic rejection and 2-decimal battery UI');
