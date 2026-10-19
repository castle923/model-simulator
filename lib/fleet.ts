type Point={x:number;y:number};
export type FleetRobot={id:number;x:number;y:number;side:number;slot:number;phase:"approach"|"waiting"|"crossing"|"chargeWaiting"|"toChargeQueue"|"chargeQueued"|"toCharger"|"charging"|"leavingCharger"|"done";arrival:number|null;route:Point[];index:number;approachRoute?:Point[];approachIndex?:number;battery?:number;chargeDistance?:number;chargeRequired?:number;decision?:string;chargeRoute?:Point[];chargeExitRoute?:Point[];queueRoutes?:Point[][];queueChargeRoutes?:Point[][];queueSlot?:number;queuePoint?:Point;prepared?:Point[]};
export type Fleet={robots:FleetRobot[];owner:number|null;time:number;events:string[];paused:boolean;speed?:number;chargerOwner?:number|null;queueMoverOwner?:number|null;chargingEnabled?:boolean};
export const DEFAULT_FLEET_SPEED=.35;
export function validateFleetSpeed(value:number){if(!Number.isFinite(value)||value<.1||value>.8||Math.abs(value*20-Math.round(value*20))>1e-8)throw new Error("웹 2D 주행 속도는 0.10~0.80m/s, 0.05m/s 단위로 지정하세요.");return value;}
export function fleetSpeed(f:Fleet){return f.speed??DEFAULT_FLEET_SPEED;}
export function setFleetSpeed(f:Fleet,value:number){f.speed=validateFleetSpeed(value);}
function initialRobot(id:number):FleetRobot{if(!Number.isInteger(id)||id<1||id>4)throw new Error("기체 ID는 R1~R4입니다.");const side=id%2===1?1:-1,slot=Math.floor((id-1)/2);return{id,x:side===1?1.1-slot*.5:6.9+slot*.5,y:.7,side,slot,battery:35-(id-1)*5,phase:"approach",arrival:null,route:[],index:0};}
export function addRobot(f:Fleet){if(f.robots.length>=4)throw new Error("현재 공장 데모는 최대 4대입니다.");if(f.time>0)throw new Error("초기화 후 기체를 추가하세요.");const id=[1,2,3,4].find(id=>!f.robots.some(r=>r.id===id))!;f.robots.push(initialRobot(id));f.robots.sort((a,b)=>a.id-b.id);}
export function removeRobot(f:Fleet,id:number){
 if(f.time>0)throw new Error("공장 초기화 후 기체를 삭제하세요.");
 if(!f.robots.some(r=>r.id===id))throw new Error("삭제할 기체가 현재 목록에 없습니다.");
 if(f.robots.length<=1)throw new Error("기체는 최소 1대를 유지해야 합니다.");
 f.robots=f.robots.filter(r=>r.id!==id);if(f.owner===id)f.owner=null;if(f.chargerOwner===id)f.chargerOwner=null;if(f.queueMoverOwner===id)f.queueMoverOwner=null;
}
export function createFleet(count=2):Fleet{const f:Fleet={robots:[],owner:null,time:0,events:[],paused:true,speed:DEFAULT_FLEET_SPEED};for(let i=0;i<count;i++)addRobot(f);return f;}
export function resetFleet(f:Fleet):Fleet{return{robots:f.robots.map(r=>initialRobot(r.id)),owner:null,chargerOwner:null,queueMoverOwner:null,time:0,events:[],paused:true,speed:fleetSpeed(f)};}
const clearance=.4;
function log(f:Fleet,s:string){f.events.push(f.time.toFixed(3)+"s · "+s);if(f.events.length>50)f.events.shift();}
function canTravel(f:Fleet,r:FleetRobot,distance:number){if(!f.chargingEnabled||distance<=0)return true;if((r.battery??0)>distance*.6+1e-8)return true;r.decision="배터리 고갈 위험 · 현재 위치에서 주행 중단";f.paused=true;log(f,"R"+r.id+" 배터리 부족 · 안전 정지");return false;}
export function routeLength(points:Point[]){return points.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):0),0);}
function remainingRoute(r:FleetRobot){return routeLength([r,...r.route.slice(r.index)]);}
function move(f:Fleet,r:FleetRobot,dt:number){const speed=fleetSpeed(f);
 const p=r.route[r.index];if(!p)return true;const d=Math.hypot(p.x-r.x,p.y-r.y),travel=Math.min(d,speed*dt),x=r.x+(d?(p.x-r.x)*travel/d:0),y=r.y+(d?(p.y-r.y)*travel/d:0);
 if(f.robots.some(o=>o.id!==r.id&&Math.hypot(o.x-x,o.y-y)<clearance-1e-8))return false;
 if(!canTravel(f,r,travel))return false;r.x=x;r.y=y;if(f.chargingEnabled)r.battery=Math.max(0,(r.battery??35)-travel*.6);
 if(d<=speed*dt+1e-9){r.x=p.x;r.y=p.y;r.index++;}return r.index>=r.route.length;
}
function energyOrder(a:FleetRobot,b:FleetRobot){return ((a.battery??35)-(a.chargeRequired??10))-((b.battery??35)-(b.chargeRequired??10))||(a.arrival??0)-(b.arrival??0)||a.id-b.id;}
function chargeWaitSeconds(f:Fleet){const speed=fleetSpeed(f);
 const c=f.robots.find(r=>r.id===f.chargerOwner);if(!c)return 0;
 const exit=routeLength(c.chargeExitRoute??[])/speed;
 if(c.phase==="leavingCharger")return remainingRoute(c)/speed;
 const queue=f.robots.find(r=>r.id===f.queueMoverOwner);
 const freeSlots=[0,1,2].filter(i=>!f.robots.some(r=>r.queueSlot===i));
 const pending=f.robots.filter(r=>r.phase==="chargeWaiting").sort(energyOrder);
 const queueTime=(queue?remainingRoute(queue)/speed:0)+pending.reduce((sum,r,i)=>sum+routeLength(r.queueRoutes?.[freeSlots[i]]??[])/speed,0);
 const charge=(100-(c.battery??0))/4;
 return (c.phase==="toCharger"?remainingRoute(c)/speed:0)+Math.max(charge,queueTime)+exit;
}
function chargeTick(f:Fleet,dt:number){
 const owner=f.robots.find(r=>r.id===f.chargerOwner);
 const wait=chargeWaitSeconds(f);
 for(const r of f.robots.filter(r=>["chargeWaiting","chargeQueued","toChargeQueue"].includes(r.phase))){
  const path=r.phase==="chargeWaiting"?r.chargeRoute:r.queueChargeRoutes?.[r.queueSlot??0];r.chargeDistance=routeLength(path??[])+(r.phase==="toChargeQueue"?remainingRoute(r):0);r.chargeRequired=r.chargeDistance*.6+10+wait*.015;
  r.decision=(r.battery??0)<r.chargeRequired?"거리·선행 충전 대기시간 고려 · 잔량 부족 위험":r.phase==="chargeQueued"?"충전소 앞 대기점에서 순서 대기":r.phase==="toChargeQueue"?"충전소 앞 대기열로 이동":"충전소 앞 대기열 이동 예약 대기";
 }
 // Charger ownership includes its complete departure. Queue motion has a separate reservation.
 if(owner?.phase==="charging"){
  owner.battery=Math.min(100,(owner.battery??0)+dt*4);
  if(owner.battery>=100&&f.queueMoverOwner==null&&!f.robots.some(r=>r.phase==="chargeWaiting")){owner.phase="leavingCharger";owner.route=(owner.chargeExitRoute??[]).slice(1);owner.index=0;owner.decision="충전 완료 · 대기열 이탈 통로 확보 후 복귀";log(f,"R"+owner.id+" 충전 100% · 이탈 시작");}
  else if(owner.battery>=100)owner.decision="충전 100% · 대기열 이동 종료 후 이탈";
 }
 const mover=f.robots.find(r=>r.id===f.queueMoverOwner);
 if(mover){if(move(f,mover,dt)){mover.phase="chargeQueued";mover.queuePoint={x:mover.x,y:mover.y};mover.decision="충전소 앞 대기점에서 순서 대기";f.queueMoverOwner=null;log(f,"R"+mover.id+" 충전 대기점 "+((mover.queueSlot??0)+1)+" 도착");}if(f.paused)return;}
 if(owner&&(owner.phase==="toCharger"||owner.phase==="leavingCharger")&&f.queueMoverOwner==null){
  if(move(f,owner,dt)){
   if(owner.phase==="toCharger"){owner.phase="charging";owner.decision="충전 중 · 단일 충전소 점유";log(f,"R"+owner.id+" 충전 시작");}
   else{owner.phase="done";owner.decision="충전 완료 후 작업 완료 위치 복귀";f.chargerOwner=null;log(f,"CHARGER 완전 이탈 R"+owner.id+" → 예약 해제");}
  }if(f.paused)return;
 }
 const tasksActive=f.robots.some(r=>["approach","waiting","crossing"].includes(r.phase));
 if(tasksActive)return;
 if(f.chargerOwner==null&&f.queueMoverOwner==null){
  const next=f.robots.filter(r=>r.phase==="chargeWaiting"||r.phase==="chargeQueued").sort(energyOrder)[0];
  if(next){const path=next.phase==="chargeQueued"?next.queueChargeRoutes?.[next.queueSlot??0]:next.chargeRoute;f.chargerOwner=next.id;next.phase="toCharger";next.route=(path??[]).slice(1);next.index=0;delete next.queueSlot;delete next.queuePoint;next.decision="충전소 예약 획득 · 이동";log(f,"CHARGER 예약 R"+next.id);}
 }
 const current=f.robots.find(r=>r.id===f.chargerOwner);
 if(current?.phase==="charging"&&f.queueMoverOwner==null){
  const next=f.robots.filter(r=>r.phase==="chargeWaiting").sort(energyOrder)[0];
  if(next){const used=new Set(f.robots.flatMap(r=>r.queueSlot===undefined?[]:[r.queueSlot]));const slot=(next.queueRoutes??[]).findIndex((_,i)=>!used.has(i));
   if(slot>=0){next.queueSlot=slot;next.phase="toChargeQueue";next.route=next.queueRoutes![slot].slice(1);next.index=0;f.queueMoverOwner=next.id;next.decision="충전 중인 기체와 별도로 대기열 이동";log(f,"QUEUE 이동 예약 R"+next.id+" → 대기점 "+(slot+1));}
  }
 }
}
// Continuous arrival timestamps within each 10ms step; ties use stable robot ID.
export function tickFleet(f:Fleet,dt:number){if(f.paused)return;dt=Math.min(Math.max(dt,0),.01);const now=f.time,speed=fleetSpeed(f);f.time+=dt;
 for(const r of f.robots)if(f.chargingEnabled&&r.phase!=="done"&&r.phase!=="charging")r.battery=Math.max(0,(r.battery??35)-dt*.015);
 for(const r of f.robots){if(r.phase!=="approach")continue;const gate=r.side===1?2.1-.10437:5.9+.10437,target=r.approachRoute?.[r.approachIndex??0]??{x:gate,y:r.y},dx=target.x-r.x,dy=target.y-r.y,dist=Math.hypot(dx,dy),travel=Math.min(dist,speed*dt),x=r.x+(dist?dx/dist*travel:0),y=r.y+(dist?dy/dist*travel:0);
  if(f.robots.some(o=>o.id!==r.id&&Math.hypot(o.x-x,o.y-y)<clearance-1e-8))continue;
  if(!canTravel(f,r,travel))return;if(f.chargingEnabled)r.battery=Math.max(0,(r.battery??35)-travel*.6);r.x=x;r.y=y;if(dist<=speed*dt+1e-9){r.x=target.x;r.y=target.y;if(r.approachRoute&&(r.approachIndex??0)<r.approachRoute.length-1){r.approachIndex=(r.approachIndex??0)+1;continue;}r.phase="waiting";r.arrival=now+dist/speed;log(f,"R"+r.id+" 진입선 도착");}}
 if(f.owner===null){const next=f.robots.filter(r=>r.phase==="waiting").sort((a,b)=>(a.arrival!-b.arrival!)||a.id-b.id)[0];if(next){f.owner=next.id;next.phase="crossing";const exit=next.side===1?5.9:2.1;next.route=next.prepared??[{x:next.x,y:2},{x:exit,y:2},{x:exit,y:2.8+next.slot*.5},{x:next.side===1?7.2:.8,y:2.8+next.slot*.5}];next.index=0;log(f,"LOCK 획득 R"+next.id);}}
 const r=f.robots.find(r=>r.id===f.owner);
 if(r&&move(f,r,dt)){
  r.phase=f.chargingEnabled?"chargeWaiting":"done";log(f,"R"+r.id+" 통로·출구 완전 이탈 → LOCK 해제");f.owner=null;
  if(f.chargingEnabled){r.chargeDistance=routeLength(r.chargeRoute??[]);r.chargeRequired=r.chargeDistance*.6+10;r.decision=(r.battery??35)<=r.chargeRequired?"잔량 부족 위험 · 우선 충전 요청":"충전소 앞 대기열 이동 예약 대기";if((r.battery??35)>=60){r.phase="done";r.decision="잔량 60% 이상 · 현재 위치 대기";}log(f,"R"+r.id+" "+r.decision);}
 }
 if(f.paused)return;if(f.chargingEnabled)chargeTick(f,dt);
 if(f.robots.every(r=>r.phase==="done"))f.paused=true;
}
