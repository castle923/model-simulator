import {robotRadius,validateCustomization,type RobotCustomization} from './robot-customization.ts';
import {MinHeap} from './min-heap.ts';
import {deliveryTargets} from './vibe-mission.ts';
import {plan,segmentClear,type Point,type World} from './planner.ts';
export type Kind='rack'|'box'|'wall'|'worker'|'helmet'|'cone'|'pallet'|'charger'|'lock'|'queue'|'lift'|'qr';
export type Entity={id:string;kind:Kind;name:string;x:number;y:number;w:number;h:number;floor:number;blocking:boolean};
export type Robot={experiment?:{mode:'force-direct';originalModel:'holonomic'|'car'};customization?:RobotCustomization;id:string;name:string;x:number;y:number;yaw:number;goal:Point;waypoints:Point[];floor:number;goalFloor:number;model:'holonomic'|'car';minRadius:number;after?:'charge'|'stay';mission?:'navigate'|'helmet';missionTargets?:{helmetId:string;workerId:string}};
export const isForceExperiment=(r:Robot)=>r.experiment?.mode==='force-direct';
export type Scene={schema:2;revision:number;width:number;height:number;floors:number;entities:Entity[];robots:Robot[]};
export type Pose=Point&{yaw:number;floor:number};
export type PlanningDiagnostic={robotId:string;leg:string;from:Pose;to:Point;cause:string;blockers:string[];suggestion:string};
export class PlanningError extends Error{diagnostic:PlanningDiagnostic;constructor(diagnostic:PlanningDiagnostic){super(`${diagnostic.robotId} · ${diagnostic.leg}: ${diagnostic.cause} 시작(${diagnostic.from.x.toFixed(2)}, ${diagnostic.from.y.toFixed(2)}, ${(diagnostic.from.yaw*180/Math.PI).toFixed(1)}°) → 목표(${diagnostic.to.x.toFixed(2)}, ${diagnostic.to.y.toFixed(2)}). ${diagnostic.blockers.length?'관련 객체: '+diagnostic.blockers.join(', ')+'. ':''}${diagnostic.suggestion}`);this.diagnostic=diagnostic;}}
export type ScenePatch={baseRevision:number;adds:Entity[];message:string};
export type EngineState={engine:'unity'|'carla'|'gazebo';status:'disconnected'|'connected';authority:'web'|'engine';runId:string|null;sceneRevision:number;robotId:string|null;simTime:number;frameSequence:number};
export const labels:Record<Kind,string>={rack:'랙',box:'상자',wall:'벽',worker:'작업자',helmet:'안전모',cone:'콘',pallet:'팔레트',charger:'충전소',lock:'통로 락',queue:'충전 대기점',lift:'엘리베이터',qr:'QR 표지'};
export function initialScene():Scene{return {schema:2,revision:1,width:10,height:6,floors:2,entities:[
 {id:'rack-a',kind:'rack',name:'랙 A',x:3,y:1,w:3,h:1,floor:1,blocking:true},
 {id:'rack-b',kind:'rack',name:'랙 B',x:3,y:4,w:3,h:1,floor:1,blocking:true},
 {id:'charge',kind:'charger',name:'공용 충전소',x:.3,y:4.7,w:.65,h:.65,floor:1,blocking:false},
 {id:'q1',kind:'queue',name:'대기 Q1',x:1.4,y:4.9,w:.4,h:.4,floor:1,blocking:false},
 {id:'q2',kind:'queue',name:'대기 Q2',x:2.1,y:4.9,w:.4,h:.4,floor:1,blocking:false},
 {id:'q3',kind:'queue',name:'대기 Q3',x:1.4,y:4.1,w:.4,h:.4,floor:1,blocking:false},
 {id:'q4',kind:'queue',name:'대기 Q4',x:2.1,y:4.1,w:.4,h:.4,floor:1,blocking:false},
 {id:'lock',kind:'lock',name:'통로 예약',x:2.7,y:2.4,w:3.6,h:1.2,floor:1,blocking:false},
 {id:'lift',kind:'lift',name:'가상 엘리베이터',x:8,y:4.5,w:1.2,h:1.2,floor:0,blocking:false},
 {id:'qr',kind:'qr',name:'L1 식별 QR (가상)',x:7.5,y:4.5,w:.3,h:.3,floor:0,blocking:false}],robots:[
 {id:'R1',name:'라즈봇 V2 · R1',x:1,y:3,yaw:0,goal:{x:8,y:3},waypoints:[],floor:1,goalFloor:1,model:'holonomic',minRadius:.65},
 {id:'R2',name:'라즈봇 V2 · R2',x:8,y:2.5,yaw:Math.PI,goal:{x:1,y:2.5},waypoints:[],floor:1,goalFloor:1,model:'holonomic',minRadius:.65}]};}
/** Opt-in demonstration; never applied automatically to a user's saved map. */
export function dynamicDemoScene():Scene{const s=initialScene();s.entities=s.entities.filter(e=>!e.blocking);s.robots=[{...s.robots[0],x:1,y:3,yaw:0,goal:{x:8,y:3}},{...s.robots[1],x:7,y:3,yaw:Math.PI,goal:{x:1,y:3}}];return s;}
export const center=(e:Entity)=>({x:e.x+e.w/2,y:e.y+e.h/2});
export const visible=(e:Entity,floor:number)=>e.floor===0||e.floor===floor;
export const editorEntities=(s:Scene)=>s.entities.filter(e=>s.robots.length>1||e.kind!=='lock');
// Legacy scenes used blocking:false for people and helmets to permit center
// delivery. They remain physical bodies even when that legacy flag is false.
export const isSolidEntity=(e:Entity)=>e.blocking||e.kind==='worker'||e.kind==='helmet';
export function sceneWorld(s:Scene,floor:number,start:Point,goal:Point,robot?:Robot):World{return {width:s.width,height:s.height,radius:robot?robotRadius(robot):.22,start,goal,obstacles:editorEntities(s).filter(e=>visible(e,floor)&&isSolidEntity(e)).map(e=>({x:e.x,y:e.y,w:e.w,h:e.h}))};}
export function validateScene(s:Scene){
 if(!s||s.schema!==2||!Number.isInteger(s.revision)||s.revision<1||!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<2||s.width>30||s.height<2||s.height>30||!Number.isInteger(s.floors)||s.floors<1||s.floors>4)throw Error('지도는 2~30m, 층은 1~4개로 지정하세요.');
 if(!Array.isArray(s.entities)||s.entities.length>100||!Array.isArray(s.robots)||s.robots.length<1||s.robots.length>8)throw Error('객체 최대 100개, 기체 1~8대가 필요합니다.');
 const ids=new Set<string>();for(const item of [...s.entities,...s.robots]){if(typeof item.id!=='string'||!item.id||item.id.length>128||/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(item.id)||ids.has(item.id))throw Error('객체/기체 ID는 제어문자 없이 1~128자이며 중복되지 않아야 합니다.');ids.add(item.id);}
 if(s.entities.filter(e=>e.kind==='charger').length!==1)throw Error('공용 충전소는 반드시 1개입니다.');
 for(const e of s.entities)if(!Object.hasOwn(labels,e.kind)||typeof e.name!=='string'||e.name.length>40||![e.x,e.y,e.w,e.h].every(Number.isFinite)||e.w<.15||e.h<.15||e.x<0||e.y<0||e.x+e.w>s.width+1e-8||e.y+e.h>s.height+1e-8||!Number.isInteger(e.floor)||e.floor<0||e.floor>s.floors||typeof e.blocking!=='boolean')throw Error('객체 종류·이름·크기·위치·층을 확인하세요.');
 for(const r of s.robots){if(r.experiment!==undefined&&(!r.experiment||typeof r.experiment!=='object'||Object.keys(r.experiment).length!==2||Object.keys(r.experiment).some(k=>!['mode','originalModel'].includes(k))||r.experiment.mode!=='force-direct'||!['holonomic','car'].includes(r.experiment.originalModel)||r.model!=='holonomic'||r.mission!=='navigate'||r.after!=='stay'||r.goalFloor!==r.floor))throw Error(`${r.id}: 강제 실험은 같은 층의 목표 주행·목표 대기·홀로노믹 조건으로만 명시적으로 실행하세요.`);if(r.customization!==undefined)validateCustomization(r.customization);const radius=robotRadius(r);if(r.after!==undefined&&!['charge','stay'].includes(r.after))throw Error(`${r.id}: 완료 후 동작은 charge 또는 stay입니다.`);if(r.mission==='helmet'&&r.after==='stay')throw Error(`${r.id}: 안전모 전달은 목표 방문 후 충전하는 기존 절차만 지원합니다.`);if(typeof r.name!=='string'||r.name.length>40||(r.mission!==undefined&&!['navigate','helmet'].includes(r.mission))||(r.missionTargets!==undefined&&(!r.missionTargets||typeof r.missionTargets.helmetId!=='string'||typeof r.missionTargets.workerId!=='string'))||![r.x,r.y,r.yaw,r.minRadius].every(Number.isFinite)||r.minRadius<.3||r.minRadius>3||!['car','holonomic'].includes(r.model)||!Number.isInteger(r.floor)||!Number.isInteger(r.goalFloor)||r.floor<1||r.floor>s.floors||r.goalFloor<1||r.goalFloor>s.floors||!Array.isArray(r.waypoints)||r.waypoints.length>40)throw Error(`${r.id}: 주행 설정 오류`);
  for(const [index,[p,floor]] of ([[r,r.floor],[r.goal,r.goalFloor],...r.waypoints.map(p=>[p,r.floor])] as [Point,number][]).entries()){if(!p||![p.x,p.y].every(Number.isFinite))throw Error(`${r.id}: 출발·목표·경유점 좌표를 확인하세요.`);if(!segmentClear({...sceneWorld(s,floor,p,p,r),...(isForceExperiment(r)?{obstacles:[]}: {})},p,p))throw new PlanningError({robotId:r.id,leg:index===0?'출발 위치':index===1?'임무 목표 방문':'경유점 '+(index-1),from:{x:r.x,y:r.y,yaw:r.yaw,floor:r.floor},to:{...p},cause:'지도 경계 또는 장애물 차체 여유 공간과 겹칩니다.',blockers:s.entities.filter(e=>visible(e,floor)&&isSolidEntity(e)&&p.x>=e.x-radius&&p.x<=e.x+e.w+radius&&p.y>=e.y-radius&&p.y<=e.y+e.h+radius).map(e=>e.name+' ['+e.id+']'),suggestion:`해당 위치를 객체 및 지도 경계에서 보수적 차체 반경 ${radius.toFixed(2)}m 이상 떨어뜨리세요.`});}}
 for(let i=0;i<s.robots.length;i++)for(let j=i+1;j<s.robots.length;j++)if(!isForceExperiment(s.robots[i])&&!isForceExperiment(s.robots[j])&&s.robots[i].floor===s.robots[j].floor&&Math.hypot(s.robots[i].x-s.robots[j].x,s.robots[i].y-s.robots[j].y)<robotRadius(s.robots[i])+robotRadius(s.robots[j])+.06)throw Error('출발 기체 사이를 차체 크기와 0.06m 여유 이상 띄우세요.');
 return s;
}
/** Select a valid free spawn rather than assuming the original demo positions
 * remain empty after the team edits the map. Does not mutate existing robots. */
export function addSceneRobot(s:Scene,floor:number):{scene:Scene;robotId:string}{
 validateScene(s);if(!Number.isInteger(floor)||floor<1||floor>s.floors)throw Error('추가할 기체의 층을 확인하세요.');const id=Array.from({length:8},(_,i)=>'R'+(i+1)).find(id=>!s.robots.some(r=>r.id===id));if(!id||s.robots.length>=8)throw Error('기체는 최대 8대입니다.');
 const template=s.robots[0],spawnRadius=robotRadius(template);const opposite=s.robots.length===1,spawnRight=opposite&&s.robots[0].x<s.width/2,preferred=opposite?(spawnRight?{x:s.width-2,y:s.height*.4+.1}:{x:1,y:s.height*.5}):{x:.65,y:.6+s.robots.length*.65},preferredGoal=opposite?(spawnRight?{x:1,y:s.height*.4+.1}:{x:s.width-2,y:s.height*.5}):{x:s.width-1,y:.8+s.robots.length*.6},candidates:Point[]=[];for(let y=.3;y<=s.height-.3;y+=.25)for(let x=.3;x<=s.width-.3;x+=.25)candidates.push({x:Number(x.toFixed(3)),y:Number(y.toFixed(3))});
 const free=(p:Point)=>segmentClear(sceneWorld(s,floor,p,p,template),p,p)&&s.robots.every(r=>r.floor!==floor||Math.hypot(r.x-p.x,r.y-p.y)>=robotRadius(r)+spawnRadius+.12);
 const byDistance=(a:Point,b:Point,origin:Point)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y);
 const start=[preferred,...[...candidates].sort((a,b)=>byDistance(a,b,preferred))].find(free);if(!start)throw Error('다중 기체 전환 불가: 장애물과 기존 기체에서 떨어진 출발 공간이 없습니다. 지도를 넓히거나 객체를 이동하세요.');
 const freeGoal=(p:Point)=>segmentClear(sceneWorld(s,floor,p,p,template),p,p)&&s.robots.every(r=>r.floor!==floor||Math.hypot(r.x-p.x,r.y-p.y)>=robotRadius(r)+spawnRadius+.05);const goal=[preferredGoal,...[...candidates].sort((a,b)=>byDistance(a,b,preferredGoal))].find(p=>freeGoal(p)&&Math.hypot(p.x-start.x,p.y-start.y)>=.6&&s.robots.every(r=>r.goalFloor!==floor||Math.hypot(r.goal.x-p.x,r.goal.y-p.y)>=robotRadius(r)+spawnRadius+.12));if(!goal)throw Error('다중 기체 전환 불가: 새 기체의 안전한 목표 위치가 없습니다. 목표·장애물을 이동하세요.');
 const robot:Robot={...structuredClone(s.robots[0]),id,name:'라즈봇 V2 · '+id,x:start.x,y:start.y,yaw:spawnRight?Math.PI:0,goal,waypoints:[],floor,goalFloor:floor,mission:'navigate',missionTargets:undefined,experiment:undefined,model:template.experiment?.originalModel??template.model};const result=structuredClone(s);result.robots.push(robot);
 // Add distinct physical queue markers atomically; never change the caller map.
 const charger=result.entities.find(e=>e.kind==='charger')!,chargeFloor=charger.floor||1,queueSize=.35;
 while(result.entities.filter(e=>e.kind==='queue'&&visible(e,chargeFloor)).length<result.robots.length){
  if(result.entities.length>=100)throw Error('충전 대기점을 추가할 객체 한도(100개)가 부족합니다.');
  const possible:Point[]=[];for(let y=.3;y<=result.height-queueSize-.3;y+=.45)for(let x=.3;x<=result.width-queueSize-.3;x+=.45)possible.push({x,y});
  possible.sort((a,b)=>Math.hypot(a.x-charger.x,a.y-charger.y)-Math.hypot(b.x-charger.x,b.y-charger.y));
  const pos=possible.find(p=>{const c={x:p.x+queueSize/2,y:p.y+queueSize/2};return segmentClear(sceneWorld(result,chargeFloor,c,c,template),c,c)&&!result.entities.filter(e=>visible(e,chargeFloor)).some(e=>p.x<e.x+e.w+.15&&p.x+queueSize+.15>e.x&&p.y<e.y+e.h+.15&&p.y+queueSize+.15>e.y)&&result.robots.every(r=>(r.floor!==chargeFloor||Math.hypot(r.x-c.x,r.y-c.y)>=robotRadius(r)+spawnRadius+.15)&&(r.goalFloor!==chargeFloor||Math.hypot(r.goal.x-c.x,r.goal.y-c.y)>=robotRadius(r)+spawnRadius+.15));});
  if(!pos)throw Error('안전한 충전 대기점 공간이 부족합니다. 지도 크기 또는 객체 배치를 조정하세요. 기존 지도는 보존됩니다.');
  let n=1;while(result.entities.some(e=>e.id==='auto-queue-'+n))n++;result.entities.push({id:'auto-queue-'+n,kind:'queue',name:'충전 대기 '+n,...pos,w:queueSize,h:queueSize,floor:chargeFloor,blocking:false});
 }
 return {scene:validateScene(result),robotId:id};
}
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
// Exact arc vs inflated axis-aligned rectangles. Checking only sampled arc
// points can miss a tangent corner between samples, so test boundary crossings.
export function arcClear(w:World,start:Pose,curvature:number,length:number){
 if(Math.abs(curvature)<1e-10)return segmentClear(w,start,{x:start.x+length*Math.cos(start.yaw),y:start.y+length*Math.sin(start.yaw)});
 const sweep=length*curvature,cx=start.x-Math.sin(start.yaw)/curvature,cy=start.y+Math.cos(start.yaw)/curvature;
 const contains=(angle:number)=>{const d=wrap(angle-start.yaw);return sweep>0?d>=-1e-10&&d<=sweep+1e-10:d<=1e-10&&d>=sweep-1e-10;};
 const point=(a:number)=>({x:cx+Math.sin(a)/curvature,y:cy-Math.cos(a)/curvature});
 for(const a of [start.yaw,start.yaw+sweep,0,Math.PI/2,Math.PI,-Math.PI/2])if(contains(a)){const p=point(a);if(p.x<w.radius-1e-9||p.y<w.radius-1e-9||p.x>w.width-w.radius+1e-9||p.y>w.height-w.radius+1e-9)return false;}
 for(const o of w.dynamicCircles??[]){const a=Math.atan2(curvature*(o.x-cx),-curvature*(o.y-cy)),angles=[start.yaw,start.yaw+sweep,...(contains(a)?[a]:[])];if(angles.some(a=>Math.hypot(point(a).x-o.x,point(a).y-o.y)<=w.radius+o.radius))return false;}
 for(const o of w.obstacles.filter(o=>o.blocking!==false)){const left=o.x-w.radius,right=o.x+o.w+w.radius,top=o.y-w.radius,bottom=o.y+o.h+w.radius,inRect=(p:Point)=>p.x>=left-1e-9&&p.x<=right+1e-9&&p.y>=top-1e-9&&p.y<=bottom+1e-9;
  if(inRect(start)||inRect(point(start.yaw+sweep)))return false;
  for(const x of [left,right]){const v=curvature*(x-cx);if(Math.abs(v)>1+1e-10)continue;const a=Math.asin(Math.max(-1,Math.min(1,v)));for(const angle of [a,Math.PI-a])if(contains(angle)&&inRect(point(angle)))return false;}
  for(const y of [top,bottom]){const v=curvature*(cy-y);if(Math.abs(v)>1+1e-10)continue;const a=Math.acos(Math.max(-1,Math.min(1,v)));for(const angle of [a,-a])if(contains(angle)&&inRect(point(angle)))return false;}
 }return true;
}
export function routeLeg(s:Scene,r:Robot,start:Pose,goal:Point&{yaw?:number;departure?:boolean},maxNodes=35000,dynamicCircles:World['dynamicCircles']=[],budget?:{remaining:number;deadline:number}):Pose[]{
 const w={...sceneWorld(s,start.floor,start,goal,r),dynamicCircles};
 if(isForceExperiment(r)){
  if(![start.x,start.y,start.yaw,goal.x,goal.y].every(Number.isFinite)||[start,goal].some(p=>p.x<w.radius||p.y<w.radius||p.x>w.width-w.radius||p.y>w.height-w.radius))throw Error('강제 실험에서도 차체가 지도 경계를 벗어날 수 없습니다.');
  const length=Math.hypot(goal.x-start.x,goal.y-start.y),count=Math.max(1,Math.ceil(length/.08)),yaw=length?Math.atan2(goal.y-start.y,goal.x-start.x):start.yaw;return [start,...Array.from({length:count},(_,i)=>({x:start.x+(goal.x-start.x)*(i+1)/count,y:start.y+(goal.y-start.y)*(i+1)/count,yaw,floor:start.floor}))];
 }
 if(!segmentClear(w,start,start))throw Error('출발 차체 여유 공간이 장애물 또는 지도 경계와 겹칩니다.');if(!segmentClear(w,goal,goal))throw Error('도착 차체 여유 공간이 장애물 또는 지도 경계와 겹칩니다.');
 if(r.model==='holonomic'){const p=plan(w,budget),out:Pose[]=[start];for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.08)),yaw=Math.atan2(b.y-a.y,b.x-a.x);for(let j=1;j<=n;j++)out.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n,yaw,floor:start.floor});}return out;}
 // Forward-only lattice search: heading is part of state. Each primitive is an arc
 // with curvature 0 or ±1/minRadius; no reversing or in-place rotation primitive.
 type Node=Pose&{g:number;f:number;parent:Node|null};const step=.16,key=(p:Pose)=>`${Math.round(p.x/.13)},${Math.round(p.y/.13)},${Math.round((wrap(p.yaw)+Math.PI)/(Math.PI/16))}`;
 const first:Node={...start,g:0,f:Math.hypot(start.x-goal.x,start.y-goal.y),parent:null},open=new MinHeap<Node>(),cost=new Map([[key(first),0]]);let end:Node|null=null;open.push(first);
 for(let count=0;open.length&&count<maxNodes;count++){if(budget&&(budget.remaining--<=0||count%64===0&&performance.now()>budget.deadline))throw Error('실시간 재계획 탐색 한도');const n=open.pop();if(Math.hypot(n.x-goal.x,n.y-goal.y)<.16&&(goal.yaw===undefined||Math.abs(wrap(n.yaw-goal.yaw))<Math.PI/12)&&(goal.departure!==true||[0,-1/r.minRadius,1/r.minRadius].some(k=>arcClear(w,n,k,.32)))){end=n;break;}
  for(const turn of [0,-1,1]){const curvature=turn/r.minRadius,da=step*curvature,yaw=wrap(n.yaw+da),x=turn?n.x+(Math.sin(n.yaw+da)-Math.sin(n.yaw))/curvature:n.x+step*Math.cos(n.yaw),y=turn?n.y+(-Math.cos(n.yaw+da)+Math.cos(n.yaw))/curvature:n.y+step*Math.sin(n.yaw);const p={x,y,yaw,floor:n.floor};if(!arcClear(w,n,curvature,step))continue;
   const g=n.g+step+(turn?.005:0),k=key(p);if((cost.get(k)??Infinity)<=g)continue;cost.set(k,g);open.push({...p,g,f:g+Math.hypot(x-goal.x,y-goal.y),parent:n});}}
 if(!end)throw Error(`전진 전용 최소 반경 ${r.minRadius.toFixed(2)}m 경로를 현재 탐색 해상도/한도에서 찾지 못했습니다. U턴 공간·출발 방향을 확인하세요.`);const result:Pose[]=[];for(let p:Node|null=end;p;p=p.parent)result.push({x:p.x,y:p.y,yaw:p.yaw,floor:p.floor});return result.reverse();
}
export function approachLeg(s:Scene,r:Robot,start:Pose,target:Entity):Pose[]{
 const gap=robotRadius(r)+.10,candidates:Point[]=[];for(const fraction of [.5,.25,.75]){candidates.push({x:target.x-gap,y:target.y+target.h*fraction},{x:target.x+target.w+gap,y:target.y+target.h*fraction},{x:target.x+target.w*fraction,y:target.y-gap},{x:target.x+target.w*fraction,y:target.y+target.h+gap});}
 let best:Pose[]|null=null,cost=Infinity;for(const goal of candidates){try{const route=routeLeg(s,r,start,goal),length=route.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y):sum,0);if(length<cost){best=route;cost=length;}}catch{}}
 if(!best)throw Error(`${r.id}: ${target.name} 몸체 밖에 안전하게 접근할 공간이 없습니다. 대상 주위에 설정된 차체 반경 ${robotRadius(r).toFixed(2)}m와 접근 여유 0.10m를 확보하세요.`);return best;
}
export type MissionRoute={id:string;points:Pose[];liftStart:number;liftEnd:number;pickup:number;deliver:number;queue:number;charge:number;exit:number;qrIndices:number[];checkpoints?:number[];targets?:Array<{index:number;pose:Pose}>;revision?:number;helmetId?:string;workerId?:string;reservation?:{zoneId:string;start:number;end:number}};
export function planScene(s:Scene):MissionRoute[]{validateScene(s);const helmetClaims=new Map<string,string>(),workerClaims=new Map<string,string>();for(const r of s.robots.filter(r=>r.mission==='helmet')){const {helmet,worker}=deliveryTargets(s,r);if(helmetClaims.has(helmet.id))throw Error('같은 안전모를 두 기체가 집을 수 없습니다: '+helmetClaims.get(helmet.id)+' / '+r.id);if(workerClaims.has(worker.id))throw Error('같은 작업자에게 중복 전달할 수 없습니다: '+workerClaims.get(worker.id)+' / '+r.id);helmetClaims.set(helmet.id,r.id);workerClaims.set(worker.id,r.id);}const charger=s.entities.find(e=>e.kind==='charger')!,queues=s.entities.filter(e=>e.kind==='queue'&&visible(e,charger.floor||1)),chargingRobots=s.robots.filter(r=>r.after!=='stay');if(queues.length<chargingRobots.length)throw Error('충전 후 완료 기체마다 충전소와 같은 층에 대기점이 필요합니다. 기체 추가 시 안전한 대기점을 자동 생성합니다.');const parking:(Point&{radius:number})[]=[];return s.robots.map((r,robotIndex)=>{const radius=robotRadius(r);const points:Pose[]=[{x:r.x,y:r.y,yaw:r.yaw,floor:r.floor}],qrIndices:number[]=[];let liftStart=-1,liftEnd=-1,pickup=-1,deliver=-1,helmetId:string|undefined,workerId:string|undefined,reservation:MissionRoute['reservation'];const checkpoints:number[]=[],targets:Array<{index:number;pose:Pose}>=[];const legScene=(_from:Pose)=>s;const append=(goal:Point&{yaw?:number;departure?:boolean},label='경유 구간')=>{const from=points.at(-1)!;const planned=legScene(from);try{points.push(...routeLeg(planned,r,from,{...goal,departure:r.model==="car"&&label!=="충전소 이탈/완료 주차"&&!(r.after==='stay'&&label==='임무 목표 방문')}).slice(1));checkpoints.push(points.length-1);targets.push({index:points.length-1,pose:{...points.at(-1)!,x:goal.x,y:goal.y}});}catch(error){const blockers=planned.entities.filter(e=>visible(e,from.floor)&&isSolidEntity(e)&&((from.x>=e.x-radius&&from.x<=e.x+e.w+radius&&from.y>=e.y-radius&&from.y<=e.y+e.h+radius)||(goal.x>=e.x-radius&&goal.x<=e.x+e.w+radius&&goal.y>=e.y-radius&&goal.y<=e.y+e.h+radius))).map(e=>e.name+' ['+e.id+']');throw new PlanningError({robotId:r.id,leg:label,from:{...from},to:{...goal},cause:(error as Error).message,blockers,suggestion:r.model==='car'?'해당 기체를 선택해 출발 방향·최소 회전 반경·해당 도착점 주위 회전 공간을 조정하세요.':'해당 기체와 관련 객체/도착점을 떨어뜨려 배치하세요.'});}};
 const changeFloor=(floor:number)=>{if(points.at(-1)!.floor===floor)return;const lift=s.entities.find(e=>e.kind==='lift'&&e.floor===0),qr=s.entities.find(e=>e.kind==='qr'&&e.floor===0);if(!lift||!qr)throw Error('층간 이동에는 공용 가상 엘리베이터와 QR 표지가 필요합니다.');append(center(qr),"QR 접근");qrIndices.push(points.length-1);append(center(lift),"엘리베이터 탑승 접근");liftStart=points.length-1;points.push({...points.at(-1)!,floor});liftEnd=points.length-1;checkpoints.push(liftEnd);};
 for(const [i,p] of r.waypoints.entries())append(p,"경유점 "+(i+1));if(r.mission==='helmet'){const {helmet,worker}=deliveryTargets(s,r);helmetId=helmet.id;workerId=worker.id;points.push(...approachLeg(legScene(points.at(-1)!),r,points.at(-1)!,helmet).slice(1));pickup=points.length-1;checkpoints.push(pickup);points.push(...approachLeg(legScene(points.at(-1)!),r,points.at(-1)!,worker).slice(1));if(points.length-1===pickup)points.push({...points.at(-1)!});deliver=points.length-1;checkpoints.push(deliver);}
 changeFloor(r.goalFloor);append(r.goal,"임무 목표 방문");if(r.after==='stay'){const beyond=points.length+1;return {id:r.id,points,liftStart,liftEnd,pickup,deliver,queue:beyond,charge:beyond+1,exit:points.length-1,qrIndices,checkpoints,targets:checkpoints.map(index=>targets.find(t=>t.index===index)??{index,pose:{...points[index]}}),revision:0,helmetId,workerId};}const chargeFloor=charger.floor||1;changeFloor(chargeFloor);const q=queues[chargingRobots.findIndex(robot=>robot.id===r.id)];if(!visible(q,chargeFloor))throw Error('충전 대기점은 충전소와 같은 층에 배치하세요.');append(center(q),"충전 앞 대기점 "+q.name);const queue=points.length-1;append(center(charger),"충전소 진입");const charge=points.length-1;
 // Exit uses a newly planned forward path, never a reversed charging path.
 // Parking is selected from reachable free space; it is never inserted as a
 // mandatory obstacle into another robot's mission. Runtime senses occupants.
 const preferred={x:.55+robotIndex*.65,y:Math.max(.35,charger.y-1)},candidates:Point[]=[preferred];
 for(let y=.4;y<s.height-.3;y+=.55)for(let x=.4;x<s.width-.3;x+=.55)candidates.push({x,y});
 candidates.sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
 let parked=false;for(const goal of candidates.slice(0,50)){if(parking.some(p=>Math.hypot(p.x-goal.x,p.y-goal.y)<p.radius+radius+.21)||Math.hypot(goal.x-center(charger).x,goal.y-center(charger).y)<.85||queues.some(q=>Math.hypot(goal.x-center(q).x,goal.y-center(q).y)<.65))continue;try{append(goal,"충전소 이탈/완료 주차");parking.push({...points.at(-1)!,radius});parked=true;break;}catch{}}
 if(!parked)throw Error(r.id+': 충전소에서 이탈할 안전한 주차 경로가 없습니다.');return {id:r.id,points,liftStart,liftEnd,pickup,deliver,queue,charge,exit:points.length-1,qrIndices,checkpoints,targets:checkpoints.map(index=>targets.find(t=>t.index===index)??{index,pose:{...points[index]}}),revision:0,helmetId,workerId,reservation};});}
export function generatePatch(s:Scene,text:string,floor:number):ScenePatch{
 if(!text.trim())throw Error('배치할 객체와 개수를 입력하세요.');const adds:Entity[]=[];for(const [kind,word] of [['box','상자'],['rack','랙'],['worker','작업자'],['helmet','안전모'],['cone','콘'],['pallet','팔레트']] as [Kind,string][]){const match=text.match(new RegExp(word+'\\s*(\\d+)?\\s*(?:개|명)?'));if(!match)continue;const count=Number(match[1]??1);if(count<1||count>10)throw Error('종류별 1~10개를 요청하세요.');for(let i=0;i<count;i++){const size=kind==='rack'?.8:kind==='helmet'?.25:.4;let found:Entity|null=null;for(let y=.4;y<s.height-size-.3&&!found;y+=.65)for(let x=.4;x<s.width-size-.3&&!found;x+=.65){const e:Entity={id:globalThis.crypto?.randomUUID?.()??`obj-${Date.now()}-${adds.length}`,kind,name:labels[kind],x,y,w:size,h:size,floor,blocking:true};if([...s.entities,...adds].filter(o=>visible(o,floor)).some(o=>x<o.x+o.w+.25&&x+size+.25>o.x&&y<o.y+o.h+.25&&y+size+.25>o.y)||s.robots.some(r=>r.floor===floor&&Math.hypot(r.x-x-size/2,r.y-y-size/2)<.7))continue;found=e;}if(!found)throw Error('자동 배치 공간이 부족합니다.');adds.push(found);}}
 if(!adds.length)throw Error('규칙 모드는 상자/랙/작업자/안전모/콘/팔레트 배치를 지원합니다. 예: 상자 3개, 작업자 1명, 안전모 1개');return {baseRevision:s.revision,adds,message:`${adds.length}개 객체 추가 초안 · 임의 코드 실행 없음`};
}
export function applyPatch(s:Scene,p:ScenePatch):Scene{if(p.baseRevision!==s.revision)throw Error('지도 버전이 달라졌습니다. 코드 생성/미리보기를 다시 실행하세요.');return validateScene(structuredClone({...s,revision:s.revision+1,entities:[...s.entities,...p.adds],robots:s.robots}));}















