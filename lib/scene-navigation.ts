import {robotRadius} from './robot-customization.ts';
import {segmentClear} from './planner.ts';
import {routeLeg,sceneWorld,arcClear,isForceExperiment,type MissionRoute,type Pose,type Scene} from './scene-local.ts';
import {senseRobots,type RobotTrack} from './scene-sensor.ts';
import type {Runtime} from './scene-runtime.ts';

type NavigationClock={nextPlan:number};
const clocks=new WeakMap<object,NavigationClock>();
const distance=(a:Pose,b:Pose)=>Math.hypot(a.x-b.x,a.y-b.y);
function conflict(route:MissionRoute,p:Runtime,track:RobotTrack,clearance=.54){
 let length=0,last:Pose=p;
 for(let i=p.index+1;i<route.points.length;i++){const q=route.points[i];if(q.floor!==p.floor)break;length+=distance(last,q);if(length>2.4)break;
  const eta=Math.min(.6,length/.8),pred={...track,x:track.x+track.vx*eta,y:track.y+track.vy*eta};
  if(distance(q,track)<clearance||distance(q,pred)<clearance)return true;last=q;
 }return false;
}
/** Replace only the uncompleted mission suffix. Every task/waypoint/floor anchor
 * is replanned in order. Car joins start at the previous exact pose, never by
 * snapping a new approximate lattice endpoint onto the old trajectory. */
export function replanRemaining(s:Scene,route:MissionRoute,p:Runtime,tracks:RobotTrack[]){
 const robot=s.robots.find(r=>r.id===route.id)!;
 const anchors=[...new Set([...(route.checkpoints??[]),route.pickup,route.deliver,route.queue,route.charge,route.exit,route.liftStart,route.liftEnd,...route.qrIndices,route.points.length-1])].filter(i=>Number.isFinite(i)&&i>p.index&&i<route.points.length).sort((a,b)=>a-b);
 if(!anchors.length)return false;
 const circles=tracks.filter(t=>t.floor===p.floor).flatMap(t=>{const current={x:t.x,y:t.y,radius:robotRadius(s.robots.find(r=>r.id===t.id)!)+.14},future={x:t.x+t.vx*.4,y:t.y+t.vy*.4,radius:robotRadius(s.robots.find(r=>r.id===t.id)!)+.14};return Math.hypot(future.x-p.x,future.y-p.y)>.7?[current,future]:[current];});
 const budget={remaining:14000,deadline:performance.now()+55};
 const start:Pose={x:p.x,y:p.y,yaw:p.yaw,floor:p.floor},firstTarget=route.targets?.find(t=>t.index===anchors[0])?.pose??route.points[anchors[0]];
 const prefixes:Pose[][]=[[start]],physical={...sceneWorld(s,p.floor,p,firstTarget,robot),dynamicCircles:tracks.filter(t=>t.floor===p.floor).map(t=>({x:t.x,y:t.y,radius:robotRadius(s.robots.find(r=>r.id===t.id)!)+.0499}))};
 // If another robot moved inside the planning margin, connect out of it using a
 // continuously checked local motion. Physical clearance is never waived.
 if(robot.model==='holonomic'){
  const nearest=[...tracks].sort((a,b)=>distance(p,a)-distance(p,b))[0],away=nearest?Math.atan2(p.y-nearest.y,p.x-nearest.x):p.yaw;
  for(const length of [.18,.36,.6])for(const da of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]){const yaw=away+da,end={x:p.x+length*Math.cos(yaw),y:p.y+length*Math.sin(yaw),yaw,floor:p.floor};if(!segmentClear(physical,p,end))continue;const path=[start];for(let j=1;j<=Math.ceil(length/.08);j++){const f=j/Math.ceil(length/.08);path.push({...end,x:p.x+(end.x-p.x)*f,y:p.y+(end.y-p.y)*f});}prefixes.push(path);}
 }else for(const length of [.16,.32,.64])for(const k of [0,-1/robot.minRadius,1/robot.minRadius]){if(!arcClear(physical,p,k,length))continue;const path=[start];for(let d=.08;d<=length+.001;d+=.08){const yaw=p.yaw+k*d;path.push({x:k?p.x+(Math.sin(yaw)-Math.sin(p.yaw))/k:p.x+d*Math.cos(p.yaw),y:k?p.y+(-Math.cos(yaw)+Math.cos(p.yaw))/k:p.y+d*Math.sin(p.yaw),yaw,floor:p.floor});}prefixes.push(path);}
 let first:Pose[]|undefined;
 for(const prefix of prefixes){if(performance.now()>budget.deadline||budget.remaining<=0)break;try{const from=prefix.at(-1)!;first=firstTarget.floor!==p.floor?[start,{...start,floor:firstTarget.floor}]:[...prefix,...routeLeg(s,robot,from,{x:firstTarget.x,y:firstTarget.y,departure:robot.model==='car'&&anchors[0]!==route.exit},6500,circles,budget).slice(1)];break;}catch{}}
 if(!first)throw Error('우회/이탈 경로 없음 또는 탐색 한도');
 const prefix=route.points.slice(0,p.index+1);if(p.progress>1e-9)prefix.push(start);else prefix[p.index]=start;const newIndex=prefix.length-1;const points=[...prefix,...first.slice(1)];const remap=new Map<number,number>([[anchors[0],points.length-1]]);
 if(robot.model==='holonomic'){
  const delta=points.length-1-anchors[0];points.push(...route.points.slice(anchors[0]+1));for(const index of anchors.slice(1))remap.set(index,index+delta);
 }else for(const index of anchors.slice(1)){
  const target=route.targets?.find(t=>t.index===index)?.pose??route.points[index],from=points.at(-1)!;
  if(target.floor!==from.floor)points.push({...from,floor:target.floor});
  else {const leg=routeLeg(s,robot,from,{x:target.x,y:target.y,departure:index!==route.exit},6500,[],budget);points.push(...leg.slice(1));if(leg.length===1)points.push({...from});}
  remap.set(index,points.length-1);
 }
 const map=(index:number)=>remap.get(index)??index;
 const targets=route.targets??anchors.map(index=>({index,pose:{...route.points[index]}}));route.points=points;for(const key of ['pickup','deliver','queue','charge','exit','liftStart','liftEnd'] as const)route[key]=map(route[key]);
 route.targets=targets.map(t=>({...t,index:map(t.index)}));route.qrIndices=route.qrIndices.map(map);route.checkpoints=(route.checkpoints??anchors).map(map);delete route.reservation;
 if(p.actionDone!==undefined)p.actionDone=map(p.actionDone);
 p.index=newIndex;p.progress=0;route.revision=(route.revision??0)+1;p.replans=(p.replans??0)+1;return true;
}
/** Sensor update is cheap and bounded. At most one global plan per 0.35 s;
 * failed plans back off, and a changed observation re-enables attempts. */
export function updateNavigation(s:Scene,routes:MissionRoute[],poses:Record<string,Runtime>,time:number,priorityIds=new Set<string>()){
 let clock=clocks.get(poses);if(!clock){clock={nextPlan:0};clocks.set(poses,clock);}
 for(const r of [...routes].sort((a,b)=>a.id.localeCompare(b.id))){const p=poses[r.id];if(!p)continue;p.sensor=senseRobots(s,r.id,poses,time,p.sensor);p.slow=false;p.rightOfWayHold=false;if(isForceExperiment(s.robots.find(robot=>robot.id===r.id)!)){p.navigation='명시적 강제 직선 실험 · 회피/통로 예약 비활성';continue;}
  if(p.phase==='임무 완료'||p.missionError||p.liftUntil||p.actionUntil&&p.actionUntil>time||p.index===r.charge&&p.battery<100)continue;
  const threats=p.sensor.tracks.filter(t=>conflict(r,p,t,robotRadius(s.robots.find(robot=>robot.id===r.id)!)+robotRadius(s.robots.find(robot=>robot.id===t.id)!)+.10));if(!threats.length){p.navigation='전방 경로 유지';p.failedPlans=0;continue;}
  p.slow=true;const signature=threats.map(t=>t.id+':'+Math.round(t.x*3)+','+Math.round(t.y*3)).join('|');if(p.obstacleSignature!==signature){p.obstacleSignature=signature;p.failedPlans=0;}
  // Stable right of way: the higher ID takes the detour. A stationary robot,
  // including one at a charger/goal, never gets permanent priority over traffic.
  const yielding=threats.some(t=>t.id.localeCompare(r.id)<0);
  if(!yielding&&!priorityIds.has(r.id)&&!threats.some(t=>(poses[t.id]?.failedPlans??0)>0)&&threats.some(t=>distance(p,t)<1.4&&poses[t.id]?.phase!=='임무 완료'&&!poses[t.id]?.missionError&&poses[t.id]?.index!==routes.find(r=>r.id===t.id)?.charge)){
   p.rightOfWayHold=true;p.navigation='감지 '+threats.map(t=>t.id).join(', ')+' · 상대 우회 공간 확보';continue;
  }
  if((p.failedPlans??0)>=6){p.navigation='우회 탐색 6회 소진 · 관측 변화까지 안전 대기';continue;}
  if(time<(p.nextPlanAt??0)||time<clock.nextPlan)continue;
  clock.nextPlan=time+.35;p.nextPlanAt=time+Math.min(4,.9+(p.failedPlans??0)*.7);
  try{if(replanRemaining(s,r,p,p.sensor.tracks)){p.navigation='감지 '+threats.map(t=>t.id).join(', ')+' → 우회 경로 갱신 #'+p.replans;p.lastReplanAt=time;p.failedPlans=0;}}
  catch{p.failedPlans=(p.failedPlans??0)+1;p.navigation='우회 공간 없음/탐색 한도 · 안전 대기 후 재확인';}
 }
}
