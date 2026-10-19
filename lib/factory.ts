import {plan,validateWorld,blocked,type World,type Point} from "./planner.ts";
import {tickFleet,setFleetSpeed,fleetSpeed,addRobot,removeRobot,type Fleet,type FleetRobot} from "./fleet.ts";
export const defaultTraffic={x:2.1,y:1.6,w:3.8,h:.8};
export const defaultCharger={x:.25,y:2.9,w:.7,h:.7};
export const defaultChargeQueue=[{x:1.9,y:3.45},{x:1.9,y:2.9},{x:1.9,y:2.35}];
export const defaultEntries={left:{x:2.1,y:.7},right:{x:5.9,y:.7}};
export const factorySample:World={width:8,height:4,radius:.18,start:{x:1.1,y:.7},goal:{x:7.2,y:2.8},station:{x:.8,y:2.8},traffic:defaultTraffic,charger:defaultCharger,chargeQueue:defaultChargeQueue,entries:defaultEntries,obstacles:[{kind:"rack",name:"공장 랙 A",x:2.5,y:.25,w:3,h:1.35},{kind:"rack",name:"공장 랙 B",x:2.5,y:2.4,w:3,h:1.35}]};
export function gateFor(w:World,r:FleetRobot){const p=(w.entries??defaultEntries)[r.side===1?"left":"right"];return {x:p.x-r.side*.10437,y:p.y};}
// Left task staging is below the charger approach; queued vehicles leave its exit lane clear.
export function parkFor(w:World,r:FleetRobot){return r.side===1?{x:6.5,y:2.05+r.slot*.6}:{x:.6,y:1.1+r.slot*.6};}
export function chargerFor(w:World){const a=w.charger??defaultCharger;return{x:a.x+a.w/2,y:a.y+a.h/2};}
const reservedPoint=(p:Point)=>({x:p.x-.21,y:p.y-.21,w:.42,h:.42});
export function prepareFactory(f:Fleet,world:World){
 const w=validateWorld(structuredClone(world));if(w.width!==8||w.height!==4||w.radius!==.18)throw new Error("공장 모드는 8×4m, 안전 반경 0.18m입니다.");w.traffic??=structuredClone(defaultTraffic);w.charger??=structuredClone(defaultCharger);delete w.charging;w.station=chargerFor(w);w.entries??=structuredClone(defaultEntries);w.chargeQueue??=structuredClone(defaultChargeQueue);
 for(const [label,a,minW,minH] of [["통로 락",w.traffic,.4,.4],["단일 충전소",w.charger,.4,.4]] as const){if(!a||![a.x,a.y,a.w,a.h].every(Number.isFinite)||a.w<minW||a.h<minH||a.x<0||a.y<0||a.x+a.w>8||a.y+a.h>4)throw new Error(label+" 구역의 경계·크기를 확인하세요. 충전소는 전체 기체가 공유하는 1개 슬롯입니다.");}
 for(const p of [w.entries.left,w.entries.right])if(!p||![p.x,p.y].every(Number.isFinite)||p.x<.3||p.x>7.7||p.y<.3||p.y>3.7)throw new Error("진입선·대기 위치는 지도 안에 지정하세요.");
 if(!Array.isArray(w.chargeQueue)||w.chargeQueue.length!==3)throw new Error("충전소 앞 대기점 3개를 지정하세요. 최대 4대 중 충전 1대와 대기 3대를 구분합니다.");
 const fixed=[chargerFor(w),...f.robots.map(r=>parkFor(w,r))];
 for(const [i,p] of w.chargeQueue.entries()){
  if(!p||![p.x,p.y].every(Number.isFinite)||blocked(w,p)||p.x<.3||p.x>7.7||p.y<.3||p.y>3.7)throw new Error("충전 대기점 "+(i+1)+"의 지도 경계·장애물 여유 공간을 확인하세요.");
  if([...fixed,...w.chargeQueue.slice(0,i)].some(o=>Math.hypot(p.x-o.x,p.y-o.y)<.4))throw new Error("충전 대기점은 다른 대기점·충전소·작업 완료 위치에서 0.4m 이상 떨어뜨리세요.");
 }
 const routes=new Map<number,Point[]>(),approaches=new Map<number,Point[]>(),charges=new Map<number,Point[]>(),queues=new Map<number,Point[][]>(),fromQueues=new Map<number,Point[][]>();
 for(const r of f.robots){const gate=gateFor(w,r),exit=r.side===1?w.traffic.x+w.traffic.w:w.traffic.x,park=parkFor(w,r),middle=w.traffic.y+w.traffic.h/2;
  const reserved=f.robots.filter(o=>o.id!==r.id).flatMap(o=>[...(o.side!==r.side?[gateFor(w,o)]:[]),parkFor(w,o)]).map(reservedPoint);
  const routeWorld={...w,obstacles:[...w.obstacles,...reserved]},entrance=r.side===1?w.traffic.x:w.traffic.x+w.traffic.w,stops=[gate,{x:entrance,y:middle},{x:exit,y:middle},park];let points:Point[]=[];
  approaches.set(r.id,plan({...routeWorld,station:undefined,start:{x:r.x,y:r.y},goal:gate}).slice(1));
  for(let i=1;i<stops.length;i++)points.push(...plan({...routeWorld,station:undefined,start:stops[i-1],goal:stops[i]}).slice(1));routes.set(r.id,points);
  const otherParks=f.robots.filter(o=>o.id!==r.id).map(o=>parkFor(w,o));
  const chargingWorld={...w,station:undefined,obstacles:[...w.obstacles,...otherParks.map(reservedPoint)]};
  charges.set(r.id,plan({...chargingWorld,obstacles:[...chargingWorld.obstacles,...w.chargeQueue.map(reservedPoint)],start:park,goal:chargerFor(w)}));
  queues.set(r.id,w.chargeQueue.map((p,i)=>plan({...chargingWorld,obstacles:[...chargingWorld.obstacles,...w.chargeQueue!.filter((_,j)=>i!==j).map(reservedPoint),reservedPoint(chargerFor(w))],start:park,goal:p})));
  fromQueues.set(r.id,w.chargeQueue.map((p,i)=>plan({...chargingWorld,obstacles:[...chargingWorld.obstacles,...w.chargeQueue!.filter((_,j)=>i!==j).map(reservedPoint)],start:p,goal:chargerFor(w)})));
 }
 function assign(target:Fleet){target.chargingEnabled=true;target.chargerOwner=null;target.queueMoverOwner=null;for(const r of target.robots){r.chargeRoute=charges.get(r.id)!;r.chargeExitRoute=[...r.chargeRoute].reverse();r.queueRoutes=queues.get(r.id)!;r.queueChargeRoutes=fromQueues.get(r.id)!;r.prepared=routes.get(r.id)!;r.approachRoute=approaches.get(r.id)!;r.approachIndex=0;}}
 const candidate=structuredClone(f);setFleetSpeed(candidate,fleetSpeed(candidate));assign(candidate);candidate.paused=false;
 for(let i=0;i<100000&&!candidate.paused;i++)tickFleet(candidate,.01);
 if(!candidate.robots.every(r=>r.phase==="done"))throw new Error("기체 경로가 교착되거나 배터리가 부족합니다. 진입선·대기점·충전 구역과 이탈 경로를 더 떨어뜨려 배치하세요.");
 assign(f);return w;
}
// Initial speed edits validate the complete mission on a clone before publishing any change.
export function setFactorySpeed(f:Fleet,world:World,speed:number){
 const next=structuredClone(f);setFleetSpeed(next,speed);if(next.time===0)prepareFactory(next,world);Object.assign(f,next);
}
export function addFactoryRobot(f:Fleet,world:World){const next=structuredClone(f);addRobot(next);prepareFactory(next,world);Object.assign(f,next);}
export function removeFactoryRobot(f:Fleet,world:World,id:number){const next=structuredClone(f);removeRobot(next,id);prepareFactory(next,world);Object.assign(f,next);}
