import {robotRadius,robotSpeed} from './robot-customization.ts';
import {center,sceneWorld,visible,type Entity,type MissionRoute,type Pose,type Scene} from './scene-local.ts';
import {segmentClear} from './planner.ts';
import type {Runtime} from './scene-runtime.ts';
const cache=new WeakMap<Scene,Entity[]>();
const entered=new WeakMap<Map<string,string>,Map<string,{robot:string;entered:boolean}>>();
export function narrowLockZones(s:Scene){
 let result=cache.get(s);if(result)return result;
 result=s.robots.length===1?[]:s.entities.flatMap(e=>e.kind==='lock'&&e.floor===0?Array.from({length:s.floors},(_,i)=>({...e,id:'__floor_lock:'+JSON.stringify([e.id,i+1]),floor:i+1})):[e]).filter(e=>{if(e.kind!=='lock')return false;const horizontal=e.w>=e.h,c=center(e),floor=e.floor||1;
  // Measure free centre-to-centre width across three corridor cross sections.
  // Two 0.44 m bodies need at least 0.50 m of lateral centre separation.
  return [.25,.5,.75].some(f=>{const p={x:horizontal?e.x+e.w*f:c.x,y:horizontal?c.y:e.y+e.h*f},w=sceneWorld(s,floor,p,p,s.robots.reduce((a,b)=>robotRadius(a)>robotRadius(b)?a:b));if(!segmentClear(w,p,p))return false;let width=0;for(const sign of [-1,1])for(let d=.025;d<1;d+=.025){const q={x:p.x+(horizontal?0:d*sign),y:p.y+(horizontal?d*sign:0)};if(!segmentClear(w,p,q))break;width+=.025;}return width<Math.max(...s.robots.map(r=>robotRadius(r)*2))+.11;});
 });cache.set(s,result);return result;
}
export function insideLock(e:Entity,p:Pose,margin=.26){return visible(e,p.floor)&&p.x>e.x-margin&&p.x<e.x+e.w+margin&&p.y>e.y-margin&&p.y<e.y+e.h+margin;}
function entryFraction(e:Entity,a:Pose,b:Pose,margin=.26){let enter=0,leave=1;for(const [o,d,min,max] of [[a.x,b.x-a.x,e.x-margin,e.x+e.w+margin],[a.y,b.y-a.y,e.y-margin,e.y+e.h+margin]]){if(Math.abs(d)<1e-12){if(o<=min||o>=max)return Infinity;}else{const x=(min-o)/d,y=(max-o)/d;enter=Math.max(enter,Math.min(x,y));leave=Math.min(leave,Math.max(x,y));}}return enter<=leave?enter:Infinity;}
export function updateNarrowLocks(s:Scene,routes:MissionRoute[],poses:Record<string,Runtime>,owners:Map<string,string>,speed:number){
 const marginFor=(id:string)=>robotRadius(s.robots.find(r=>r.id===id)!)+.04;const zones=narrowLockZones(s);let state=entered.get(owners);if(!state){state=new Map();entered.set(owners,state);}
 for(const [key,id] of owners){if(key==='__charger')continue;const zone=zones.find(z=>z.id===key),p=poses[id],old=state.get(key);if(!zone||!p||p.phase==='임무 완료'||p.missionError){owners.delete(key);state.delete(key);continue;}if(old&&!old.entered&&!routes.find(r=>r.id===id)?.points.slice(p.index+1).some(q=>insideLock(zone,q,marginFor(id)))){owners.delete(key);state.delete(key);continue;}if(insideLock(zone,p,marginFor(id)))state.set(key,{robot:id,entered:true});else if(old?.robot===id&&old.entered&&!insideLock(zone,p,Math.max(1.1,marginFor(id)+.5))){owners.delete(key);state.delete(key);}}
 for(const zone of zones){if(owners.has(zone.id))continue;const candidates:{id:string;arrival:number}[]=[];
  for(const route of routes){const p=poses[route.id];if(!p||p.phase==='임무 완료'||p.missionError||!visible(zone,p.floor))continue;let a:Pose=p,length=0;for(let i=p.index+1;i<route.points.length&&length<1;i++){const b=route.points[i];if(b.floor!==p.floor)break;const d=Math.hypot(b.x-a.x,b.y-a.y),f=entryFraction(zone,a,b,marginFor(route.id));if(Number.isFinite(f)){if(length+d*f<1)candidates.push({id:route.id,arrival:(length+d*f)/robotSpeed(s.robots.find(r=>r.id===route.id)!,speed)});break;}length+=d;a=b;}
  }candidates.sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id));if(candidates[0]){const id=candidates[0].id;owners.set(zone.id,id);state.set(zone.id,{robot:id,entered:insideLock(zone,poses[id],marginFor(id))});}
 }return zones;
}
/** Keep a waiting robot away from the outgoing body at the opposite mouth.
 * This is a runtime stop boundary, never a mandatory planned stage waypoint. */
export function lockBlocksMove(zones:Entity[],id:string,p:Pose,q:Pose,owners:Map<string,string>,s?:Scene){const margin=s?robotRadius(s.robots.find(r=>r.id===id)!)+.04:.26;return zones.some(z=>{const owner=owners.get(z.id);if(!owner||owner===id||!visible(z,p.floor))return false;const horizontal=z.w>=z.h,entry=insideLock(z,q,margin);const approaching=horizontal?(q.y>z.y-margin&&q.y<z.y+z.h+margin&&(p.x<z.x&&q.x>p.x&&q.x>z.x-1.1||p.x>z.x+z.w&&q.x<p.x&&q.x<z.x+z.w+1.1)):(q.x>z.x-margin&&q.x<z.x+z.w+margin&&(p.y<z.y&&q.y>p.y&&q.y>z.y-1.1||p.y>z.y+z.h&&q.y<p.y&&q.y<z.y+z.h+1.1));return entry||approaching;});}
