import {segmentClear} from './planner.ts';
import {robotRadius,robotSpeed} from './robot-customization.ts';
import {updateNarrowLocks,lockBlocksMove} from './scene-locks.ts';
import {updateNavigation} from './scene-navigation.ts';
import type {SensorState} from './scene-sensor.ts';
import {center,editorEntities,visible,isSolidEntity,isForceExperiment,type Entity,type MissionRoute,type Pose,type Scene} from './scene-local.ts';
export type Runtime=Pose&{experimentCollisions?:number;experimentViolations?:string[];experimentContacts?:string[];index:number;phase:string;battery:number;liftUntil:number;progress:number;actionDone?:number;actionUntil?:number;payload?:boolean;payloadHelmetId?:string;missionError?:string;sensor?:SensorState;navigation?:string;replans?:number;failedPlans?:number;nextPlanAt?:number;lastReplanAt?:number;obstacleSignature?:string;slow?:boolean;rightOfWayHold?:boolean;blockedSince?:number};
export type HelmetOwner={kind:'ground'}|{kind:'robot';robotId:string}|{kind:'worker';workerId:string};
export type HelmetState=Record<string,HelmetOwner>;
const ownership=new WeakMap<object,HelmetState>();
export function helmetOwnership(s:Scene,poses:Record<string,Pose>):HelmetState{let state=ownership.get(poses);if(!state){state=Object.create(null) as HelmetState;ownership.set(poses,state);}const ids=new Set(s.entities.filter(e=>e.kind==='helmet').map(e=>e.id));for(const id of Object.keys(state))if(!ids.has(id))delete state[id];for(const id of ids){state[id]??={kind:'ground'};const owner=state[id];if(owner.kind==='robot'&&(!s.robots.some(r=>r.id===owner.robotId)||!poses[owner.robotId])||owner.kind==='worker'&&!s.entities.some(e=>e.id===owner.workerId&&e.kind==='worker'))state[id]={kind:'ground'};}for(const [robotId,pose] of Object.entries(poses)){if(!('progress' in pose))continue;const p=pose as Runtime,held=Object.entries(state).find(([,o])=>o.kind==='robot'&&o.robotId===robotId);p.payload=!!held;if(held)p.payloadHelmetId=held[0];else delete p.payloadHelmetId;}return state;}
export type RuntimeEntity=Entity&{owner?:HelmetOwner;elevation?:number};
/** Render attachments from ownership, without mutating the editable scene.
 * Attached icons are scaled symbols; physical swept carrying volume is not CAD. */
export function runtimeEntities(s:Scene,poses:Record<string,Pose>):RuntimeEntity[]{const state=helmetOwnership(s,poses);return editorEntities(s).map(e=>{if(e.kind!=='helmet')return e;const owner=state[e.id];if(!owner||owner.kind==='ground')return {...e,owner};const w=Math.min(.20,e.w),h=Math.min(.20,e.h);if(owner.kind==='robot'){const p=poses[owner.robotId];return {...e,x:p.x+.09*Math.cos(p.yaw)-w/2,y:p.y+.09*Math.sin(p.yaw)-h/2,w,h,floor:p.floor,name:e.name+' · '+owner.robotId+' 운반',owner,elevation:.42};}const worker=s.entities.find(w=>w.id===owner.workerId)!;return {...e,x:worker.x+worker.w-.04,y:worker.y+worker.h*.5-h/2,w,h,floor:worker.floor,name:e.name+' · 작업자 손에 보유 (미착용)',owner,elevation:.95};});}
export const seed=(s:Scene):Record<string,Runtime>=>Object.fromEntries(s.robots.map(r=>[r.id,{x:r.x,y:r.y,yaw:r.yaw,floor:r.floor,index:0,phase:'대기',battery:100,liftUntil:0,progress:0}]));
export function stepSimulation(s:Scene,routes:MissionRoute[],dt:number,speed:number,poses:Record<string,Runtime>,owners:Map<string,string>,lift:{current:string|null},time:number){
 const helmets=helmetOwnership(s,poses);
 dt=Math.min(.05,Math.max(0,dt));
 const narrowZones=updateNarrowLocks(s,routes.filter(route=>!isForceExperiment(s.robots.find(r=>r.id===route.id)!)),poses,owners,speed);
 updateNavigation(s,routes,poses,time,new Set(narrowZones.map(z=>owners.get(z.id)).filter((id):id is string=>!!id)));
 for(const route of [...routes].sort((a,b)=>a.id.localeCompare(b.id))){const p=poses[route.id];if(!p||p.phase==='임무 완료'||p.missionError)continue;const forced=isForceExperiment(s.robots.find(r=>r.id===route.id)!);const next=route.points[p.index+1];if(!next){p.phase='임무 완료';continue;}
  if(next.floor!==p.floor){if(lift.current&&lift.current!==route.id){p.phase='엘리베이터 예약 대기';continue;}lift.current=route.id;if(!p.liftUntil){p.liftUntil=time+5;p.phase='가상 QR 식별 → 문 확인 → 층 이동';}if(time<p.liftUntil)continue;if(Object.entries(poses).some(([id,o])=>id!==route.id&&o.floor===next.floor&&Math.hypot(o.x-p.x,o.y-p.y)<robotRadius(s.robots.find(r=>r.id===route.id)!)+robotRadius(s.robots.find(r=>r.id===id)!)+.06)){p.phase='도착 층 하차 공간 대기';continue;}p.floor=next.floor;p.index++;p.liftUntil=0;lift.current=null;p.phase='하차';continue;}
  if(p.rightOfWayHold&&!narrowZones.some(z=>owners.get(z.id)===route.id)){p.phase='감지 기체 우회 중 양보 대기';continue;}
  if(p.battery<=.2){p.phase='배터리 안전 정지 · 가상';continue;}
  if((p.index===route.pickup||p.index===route.deliver||route.qrIndices.includes(p.index))&&p.actionDone!==p.index){if(!p.actionUntil)p.actionUntil=time+1;if(time<p.actionUntil){p.phase=p.index===route.pickup?'안전모 집기 · 가상':p.index===route.deliver?'안전모 전달 · 가상':'가상 QR 표지 식별';continue;}if(p.index===route.pickup){const hid=route.helmetId,owner=hid?helmets[hid]:undefined;if(!hid||!owner||owner.kind!=='ground'){p.missionError='안전모가 이미 집혔거나 대상이 없습니다.';p.phase='임무 오류: '+p.missionError;continue;}helmets[hid]={kind:'robot',robotId:route.id};p.payload=true;p.payloadHelmetId=hid;}if(p.index===route.deliver){const hid=route.helmetId,wid=route.workerId,owner=hid?helmets[hid]:undefined;if(!hid||!wid||owner?.kind!=='robot'||owner.robotId!==route.id||!s.entities.some(e=>e.id===wid&&e.kind==='worker')||Object.entries(helmets).some(([id,o])=>id!==hid&&o.kind==='worker'&&o.workerId===wid)){p.missionError='운반 소유권이 없거나 작업자가 이미 안전모를 받았습니다.';p.phase='임무 오류: '+p.missionError;continue;}helmets[hid]={kind:'worker',workerId:wid};p.payload=false;delete p.payloadHelmetId;}p.actionDone=p.index;p.actionUntil=0;}
  const charger=s.entities.find(e=>e.kind==='charger')!,cp=center(charger);if(p.index>=route.queue&&p.index<route.charge){const owner=owners.get('__charger');if(owner&&owner!==route.id){p.phase='충전소 앞 대기 · 잔량/거리 확인';continue;}owners.set('__charger',route.id);}
  if(p.index===route.pickup)p.phase='안전모 집기 · 가상';if(p.index===route.deliver)p.phase='안전모 전달 · 가상';
  if(p.index===route.charge&&p.battery<100){p.phase='충전 중 · 가상';p.battery=Math.min(100,p.battery+dt*2);continue;}
  if(p.index>route.charge&&owners.get('__charger')===route.id&&Math.hypot(p.x-cp.x,p.y-cp.y)>.7)owners.delete('__charger');
  const prev=route.points[p.index],car=s.robots.find(r=>r.id===route.id)?.model==='car',da=Math.atan2(Math.sin(next.yaw-prev.yaw),Math.cos(next.yaw-prev.yaw)),chord=Math.hypot(next.x-prev.x,next.y-prev.y),length=car&&Math.abs(da)>1e-7?chord*Math.abs(da)/(2*Math.sin(Math.abs(da)/2)):chord,travel=Math.min(Math.max(0,length-p.progress),dt*robotSpeed(s.robots.find(r=>r.id===route.id)!,speed)*(p.slow?.55:1)),progress=p.progress+travel,fraction=length?progress/length:1;
  let q={x:prev.x+(next.x-prev.x)*fraction,y:prev.y+(next.y-prev.y)*fraction},yaw=next.yaw;if(car){yaw=prev.yaw+da*fraction;if(Math.abs(da)>1e-7){const radius=length/da;q={x:prev.x+radius*(Math.sin(yaw)-Math.sin(prev.yaw)),y:prev.y+radius*(-Math.cos(yaw)+Math.cos(prev.yaw))};}}
  if(!forced&&lockBlocksMove(narrowZones,route.id,p,{...p,...q},owners,s)){p.phase='좁은 통로 선행 기체 대기 · 출구 여유 확보';continue;}
  // Global simulation safety envelope, independent of camera observations.
  // Swept segment clearance (plus conservative arc sagitta) prevents tunnelling.
  const dx=q.x-p.x,dy=q.y-p.y,den=dx*dx+dy*dy;
  const blocker=Object.entries(poses).find(([id,o])=>{if(id===route.id||o.floor!==p.floor)return false;const f=den?Math.max(0,Math.min(1,((o.x-p.x)*dx+(o.y-p.y)*dy)/den)):0;return Math.hypot(p.x+f*dx-o.x,p.y+f*dy-o.y)<robotRadius(s.robots.find(r=>r.id===route.id)!)+robotRadius(s.robots.find(r=>r.id===id)!)+.05+(car?.002:0);});
  if(blocker&&!forced){p.blockedSince??=time;p.phase='전역 안전 정지 · '+blocker[0];if(!car&&!p.sensor?.observed.includes(blocker[0])&&time-p.blockedSince>.3){p.yaw=Math.atan2(blocker[1].y-p.y,blocker[1].x-p.x);p.navigation='전역 안전장치 정지 → 전방 센서 확인';}continue;}
  if(forced){const self=s.robots.find(r=>r.id===route.id)!,radius=robotRadius(self),hits:string[]=[];for(const e of editorEntities(s).filter(e=>visible(e,p.floor)&&isSolidEntity(e))){if(!segmentClear({width:s.width,height:s.height,radius,start:p,goal:q,obstacles:[{x:e.x,y:e.y,w:e.w,h:e.h}]},p,q))hits.push('객체:'+e.id);}for(const [id,o] of Object.entries(poses)){if(id===route.id||o.floor!==p.floor)continue;const f=den?Math.max(0,Math.min(1,((o.x-p.x)*dx+(o.y-p.y)*dy)/den)):0;if(Math.hypot(p.x+f*dx-o.x,p.y+f*dy-o.y)<radius+robotRadius(s.robots.find(r=>r.id===id)!)+.05)hits.push('기체:'+id);}p.experimentContacts??=[];p.experimentViolations??=[];p.experimentCollisions??=0;for(const hit of hits){if(p.experimentContacts.includes(hit)||p.experimentContacts.length>=32)continue;p.experimentContacts.push(hit);p.experimentViolations.push('충돌 허용 실험 접촉 · '+hit);p.experimentCollisions++;}}
  delete p.blockedSince;
  p.x=q.x;p.y=q.y;p.yaw=yaw;p.battery=Math.max(0,p.battery-travel*.12);p.phase=forced?'실험 충돌 허용 · 강제 직선 주행':p.index>=route.charge?'충전소 이탈':p.index>=route.queue?'충전소 진입':'주행';if(progress>=length-1e-8){p.index++;p.progress=0;}else p.progress=progress;
 }
}




