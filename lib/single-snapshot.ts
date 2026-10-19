import type {World,Point} from "./planner.ts";
export type SingleSnapshotState={pos:Point;path:Point[];index:number;running:boolean;phase:string;distance:number};
export function singleRobotSnapshot(world:World,state:SingleSnapshotState,speed:number){
 return structuredClone({kind:"single-robot",width:world.width,height:world.height,environment:world,robots:[{id:1,x:state.pos.x,y:state.pos.y,side:1,phase:state.phase,route:state.path,index:state.index}],running:state.running,speed,distance:state.distance});
}
