import {cameraPose,robotRadius} from './robot-customization.ts';
import {isSolidEntity,visible,type Pose,type Scene} from './scene-local.ts';
import {segmentClear} from './planner.ts';

/** Shared horizontal camera angle. Detection uses synthetic map rays, not pixels
 * or YOLO. The camera can draw farther than the configured sensing range. */
export const CAMERA_FOV=Math.PI/2.7;
export const SENSOR={fov:CAMERA_FOV,range:3.6,period:.15,ttl:1.2};
export type RobotTrack=Pose&{id:string;seenAt:number;vx:number;vy:number;visible:boolean};
export type SensorState={sampleAt:number;tracks:RobotTrack[];observed:string[]};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export function inSensorView(s:Scene,observer:Pose,target:Pose,occluders:(Pose&{radius?:number})[]=[],options={range:SENSOR.range,fov:SENSOR.fov}){
 if(observer.floor!==target.floor||Math.hypot(target.x-observer.x,target.y-observer.y)>options.range||Math.abs(wrap(Math.atan2(target.y-observer.y,target.x-observer.x)-observer.yaw))>options.fov/2)return false;
 return segmentClear({width:s.width,height:s.height,radius:0,start:observer,goal:target,dynamicCircles:occluders.filter(p=>p.floor===observer.floor).map(p=>({x:p.x,y:p.y,radius:p.radius??.22})),obstacles:s.entities.filter(e=>visible(e,observer.floor)&&isSolidEntity(e)).map(e=>({x:e.x,y:e.y,w:e.w,h:e.h}))},observer,target);
}
export function senseRobots(s:Scene,id:string,poses:Record<string,Pose>,time:number,previous?:SensorState):SensorState{
 const p=poses[id];if(previous&&time-previous.sampleAt<SENSOR.period)return previous;
 const robot=s.robots.find(r=>r.id===id)!;const views=robot.customization?robot.customization.cameras.filter(c=>c.enabled).map(c=>cameraPose(robot,p,c.id)!):[{...p,range:SENSOR.range,fov:SENSOR.fov}];const tracks:RobotTrack[]=[],observed:string[]=[];
 for(const r of s.robots){if(r.id===id)continue;const occluders=s.robots.filter(o=>o.id!==id&&o.id!==r.id).flatMap(o=>poses[o.id]?[{...poses[o.id],radius:robotRadius(o)}]:[]),other=poses[r.id],old=previous?.tracks.find(t=>t.id===r.id);if(!other)continue;
  // Same floor, range, cone and static occlusion are all required for observation.
  if(views.some(view=>inSensorView(s,view,other,occluders,view))){const elapsed=old?time-old.seenAt:0;tracks.push({x:other.x,y:other.y,yaw:other.yaw,floor:other.floor,id:r.id,seenAt:time,vx:elapsed>0?(other.x-old!.x)/elapsed:0,vy:elapsed>0?(other.y-old!.y)/elapsed:0,visible:true});observed.push(r.id);}
  else if(old&&old.floor===p.floor&&time-old.seenAt<=SENSOR.ttl&&!views.some(view=>inSensorView(s,view,old,occluders,view)))tracks.push({...old,visible:false});
  // A visible empty old position clears immediately; occluded tracks expire.
 }return {sampleAt:time,tracks,observed};
}
