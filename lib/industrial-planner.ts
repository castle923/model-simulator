import {MinHeap} from './min-heap.ts';
import {advancePrimitive,angleWrap,forwardPath,joinPaths,makePath,pathClear} from './industrial-geometry.ts';
import type {IndustrialPath,IndustrialPose,IndustrialRect,RobotProfile} from './industrial-model.ts';
/** Bounded local forward-only fallback for occupied parking/turn pads. */
export function industrialPath(start:IndustrialPose,goal:IndustrialPose,profile:RobotProfile,width:number,height:number,obstacles:IndustrialRect[],others:Array<{pose:IndustrialPose;profile:RobotProfile;loaded?:boolean}>=[],loaded=false,maxMs=100):IndustrialPath|null{
 const direct=forwardPath(start,goal,profile,width,height,obstacles,others,loaded);if(direct)return direct;
 const deadline=performance.now()+maxMs,step=.035,key=(p:IndustrialPose)=>`${Math.round(p.x/.025)},${Math.round(p.y/.025)},${Math.round((angleWrap(p.yaw)+Math.PI)/(Math.PI/16))}`;
 type Node={pose:IndustrialPose;g:number;f:number;parent:Node|null;turn:number};const first:Node={pose:start,g:0,f:Math.hypot(goal.x-start.x,goal.y-start.y),parent:null,turn:0},open=new MinHeap<Node>(),cost=new Map([[key(start),0]]);open.push(first);
 for(let count=0;open.length&&count<18000;count++){if(count%32===0&&performance.now()>deadline)return null;const n=open.pop();if(count%8===0&&Math.hypot(n.pose.x-goal.x,n.pose.y-goal.y)<.8){const tail=forwardPath(n.pose,goal,profile,width,height,obstacles,others,loaded);if(tail){const chain:Node[]=[];for(let node:Node|null=n;node?.parent;node=node.parent)chain.push(node);chain.reverse();return joinPaths([...chain.map(node=>makePath(node.parent!.pose,[{curvature:node.turn,length:step}])),tail]);}}
  for(const curvature of [0,-1/profile.minRadius,1/profile.minRadius]){const p=advancePrimitive(n.pose,curvature,step),g=n.g+step+(curvature?.0005:0),k=key(p);if((cost.get(k)??Infinity)<=g)continue;const primitive=makePath(n.pose,[{curvature,length:step}]);if(!pathClear(primitive,profile,width,height,obstacles,others,loaded))continue;cost.set(k,g);open.push({pose:p,g,f:g+Math.hypot(p.x-goal.x,p.y-goal.y),parent:n,turn:curvature});}
 }return null;
}
