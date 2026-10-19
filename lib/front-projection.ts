import {cameraPose} from './robot-customization.ts';
import {CAMERA_FOV} from './scene-sensor.ts';
import {visible,type Pose,type Scene} from './scene-local.ts';
import {runtimeEntities} from './scene-runtime.ts';
export type FrontObject={id:string;kind:string;name:string;x:number;y:number;w:number;h:number;depth:number};
/** CPU pinhole projection of the same map footprints. Heights are illustrative
 * category heights, not calibrated camera/CAD data. x/y/w/h are viewport ratios. */
export function projectFront(s:Scene,pose:Pose,selectedId:string,poses:Record<string,Pose>,fov=CAMERA_FOV,cameraId?:string):FrontObject[]{
 const selected=s.robots.find(r=>r.id===selectedId);const mounted=selected?cameraPose(selected,pose,cameraId):null;if(selected?.customization&&!mounted)return [];if(mounted){pose=mounted;fov=selected?.customization?mounted.fov:fov;}
 const objects=[...runtimeEntities(s,poses).filter(e=>visible(e,pose.floor)&&!['lock','queue'].includes(e.kind)&&!(e.owner?.kind==='robot'&&e.owner.robotId===selectedId)),...s.robots.filter(r=>r.id!==selectedId&&(poses[r.id]?.floor??r.floor)===pose.floor).map(r=>({id:r.id,kind:'robot',name:r.id,x:(poses[r.id]?.x??r.x)-(r.customization?.length??.44)/2,y:(poses[r.id]?.y??r.y)-(r.customization?.width??.36)/2,w:r.customization?.length??.44,h:r.customization?.width??.36,elevation:0,bodyHeight:r.customization?.height??.4}))];
 const forward={x:Math.cos(pose.yaw),y:Math.sin(pose.yaw)},right={x:-forward.y,y:forward.x},focal=1/(2*Math.tan(fov/2)),categoryHeight:Record<string,number>={worker:1.65,helmet:.28,rack:1.7,wall:2,box:.65,cone:.65,pallet:.2,charger:.15,lift:2.2,qr:.4,robot:.4},result:FrontObject[]=[];
 for(const e of objects){let polygon=[{x:e.x,y:e.y},{x:e.x+e.w,y:e.y},{x:e.x+e.w,y:e.y+e.h},{x:e.x,y:e.y+e.h}].map(p=>{const dx=p.x-pose.x,dy=p.y-pose.y;return {depth:dx*forward.x+dy*forward.y,lateral:dx*right.x+dy*right.y};});const clipped:typeof polygon=[];
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],ain=a.depth>=.08,bin=b.depth>=.08;if(ain)clipped.push(a);if(ain!==bin){const t=(.08-a.depth)/(b.depth-a.depth);clipped.push({depth:.08,lateral:a.lateral+(b.lateral-a.lateral)*t});}}polygon=clipped;if(!polygon.length)continue;
  const xs=polygon.map(p=>.5+focal*p.lateral/p.depth),left=Math.max(-4,Math.min(...xs)),rightEdge=Math.min(5,Math.max(...xs)),depth=Math.max(.08,polygon.reduce((sum,p)=>sum+p.depth,0)/polygon.length);if(rightEdge<=0||left>=1||depth>(selected?.customization?mounted!.range:18)||rightEdge-left<.001)continue;const worldHeight=('bodyHeight' in e?Number(e.bodyHeight):undefined)??categoryHeight[e.kind]??.7,base=.34+Math.tan(mounted?.pitch??0)*focal+((mounted?.z??.4)-(e.elevation??0))*focal/depth,top=base-worldHeight*focal/depth;
  result.push({id:e.id,kind:e.kind,name:e.name,x:left,y:top,w:rightEdge-left,h:base-top,depth});
 }return result.sort((a,b)=>b.depth-a.depth||a.id.localeCompare(b.id));
}


