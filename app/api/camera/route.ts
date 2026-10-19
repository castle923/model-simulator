import {env} from "cloudflare:workers";
import {gazeboWorld} from "@/lib/gazebo";
import type {RobotPose} from "@/lib/gazebo";
export const dynamic="force-dynamic";
const B=()=>{if(!env.BUCKET)throw new Error("영상 저장소 연결 대기");return env.BUCKET;};
const D=()=>{if(!env.DB)throw new Error("저장소 연결 대기");return env.DB;};
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");}
const valid=(s:string)=>/^[0-9a-f-]{36}$/.test(s);
type Scene={revision:string;sdf:string;topic:string;requested:number;cameraRobotId:number;width:number;height:number;robotIds:number[];geometryHash:string};
type PoseBatch={revision:string;sequence:number;robots:RobotPose[]};
async function currentScene(id:string){const obj=await B().get("camera/"+id+"/scene");return obj?await obj.json<Scene>():null;}
function checkPoseBatch(body:any,scene:Scene):asserts body is PoseBatch{
 if(!body||body.revision!==scene.revision||!Number.isSafeInteger(body.sequence)||body.sequence<1)throw new Error("현재 지도 버전·위치 번호를 확인하세요.");
 if(!Array.isArray(scene.robotIds)||!Number.isFinite(scene.width)||!Number.isFinite(scene.height))throw new Error("이전 지도입니다. 현재 지도를 다시 적용하세요.");
 if(!Array.isArray(body.robots)||body.robots.length!==scene.robotIds.length||body.robots.length>4)throw new Error("기체 수가 현재 지도와 다릅니다.");
 const ids=new Set<number>();for(const p of body.robots){if(!p||!Number.isSafeInteger(p.id)||!scene.robotIds.includes(p.id)||ids.has(p.id)||![p.x,p.y,p.yaw].every((n:unknown)=>typeof n==="number"&&Number.isFinite(n))||p.x<0||p.x>scene.width||p.y<0||p.y>scene.height||p.yaw<-Math.PI||p.yaw>Math.PI)throw new Error("기체 위치·방향이 현재 지도와 다릅니다.");ids.add(p.id);}
}
async function record(id:string){if(!valid(id))throw new Error("세션 ID 형식 오류");const obj=await B().get("camera/"+id+"/session");if(!obj)throw new Error("세션 없음");const data=await obj.json<any>();if(!data.enabled||data.expires<Date.now())throw new Error("종료·만료된 카메라 세션");return data;}
async function member(req:Request){const token=req.headers.get("authorization")?.replace(/^Bearer /,"")||"";if(!token||token.length>150)throw new Error("입장 필요");const m=await D().prepare("SELECT id FROM members WHERE token_hash=?").bind(await hash(token)).first<{id:string}>();if(!m)throw new Error("입장 정보 오류");return m;}
export async function POST(req:Request){try{const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)throw new Error("다른 사이트 요청 거부");const q=new URL(req.url).searchParams;
 if(q.get("action")==="create"){const m=await member(req);const id=crypto.randomUUID(),key=crypto.randomUUID()+crypto.randomUUID(),expires=Date.now()+7200000;await B().put("camera/"+id+"/session",JSON.stringify({owner:m.id,hash:await hash(key),expires,enabled:true}));return json({id,key,expires});}
 const id=q.get("session")||"",r=await record(id);
 if(q.get("action")==="stop"){const m=await member(req);if(m.id!==r.owner)throw new Error("본인 세션만 종료 가능");await B().put("camera/"+id+"/session",JSON.stringify({...r,enabled:false}));return json({ok:true});}
 if(q.get("action")==="scene"){
  const m=await member(req);if(m.id!==r.owner)throw new Error("본인 세션에만 지도를 적용할 수 있습니다.");
  const length=Number(req.headers.get("content-length"));if(!Number.isSafeInteger(length)||length<2||length>65536)throw new Error("지도 스냅샷은 64KB 이하로 보내세요.");
  const raw=await req.text();if(new TextEncoder().encode(raw).length!==length)throw new Error("지도 크기가 일치하지 않습니다.");
  const snapshot=JSON.parse(raw),world=snapshot.environment??snapshot,robots=snapshot.robots??[{id:1,x:world?.start?.x,y:world?.start?.y}];
  if(!Array.isArray(robots)||robots.length>4||robots.some((v:any)=>!v||!Number.isSafeInteger(v.id)||v.id<1||v.id>4))throw new Error("기체 ID·수를 확인하세요.");
  const cameraRobotId=snapshot.cameraRobotId??0,revision=crypto.randomUUID(),topic="/mechanic/camera/"+revision,sdf=gazeboWorld(world,robots,true,cameraRobotId,topic);
  const robotIds=robots.map((v:{id:number})=>v.id),geometryHash=await hash(JSON.stringify({environment:world,robotIds}));
  await Promise.all(["sceneAck","poses","poseAck"].map(name=>B().delete("camera/"+id+"/"+name)));
  await B().put("camera/"+id+"/scene",JSON.stringify({revision,sdf,topic,requested:Date.now(),cameraRobotId,width:world.width,height:world.height,robotIds,geometryHash}));
  await B().delete("camera/"+id+"/frame");
  return json({ok:true,revision,applied:false});
 }
 if(q.get("action")==="poses"){
  const m=await member(req);if(m.id!==r.owner)throw new Error("본인 세션의 기체 위치만 보낼 수 있습니다.");
  const length=Number(req.headers.get("content-length"));if(!Number.isSafeInteger(length)||length<2||length>2048)throw new Error("위치 메시지는 2KB 이하로 보내세요.");
  const raw=await req.text();if(new TextEncoder().encode(raw).length!==length)throw new Error("위치 메시지 크기가 일치하지 않습니다.");
  const scene=await currentScene(id);if(!scene)throw new Error("적용할 지도가 없습니다.");
  const ackObject=await B().get("camera/"+id+"/sceneAck"),ack=ackObject?await ackObject.json<{revision:string}>():null;
  if(ack?.revision!==scene.revision)throw new Error("Gazebo 지도 적용을 기다리세요.");
  const body=JSON.parse(raw);checkPoseBatch(body,scene);
  const previousObject=await B().get("camera/"+id+"/poses"),previous=previousObject?await previousObject.json<PoseBatch>():null;
  if(previous?.revision===scene.revision&&body.sequence<=previous.sequence)throw new Error("이전 위치 번호를 거부했습니다.");
  await B().put("camera/"+id+"/poses",JSON.stringify(body));return json({ok:true,revision:body.revision,sequence:body.sequence,queued:true});
 }
 if(q.get("action")==="poseAck"){
  if(await hash(req.headers.get("X-Camera-Key")||"")!==r.hash)throw new Error("카메라 연결 키 오류");
  const body=await req.json() as {revision?:string;sequence?:number};const scene=await currentScene(id),pendingObject=await B().get("camera/"+id+"/poses"),pending=pendingObject?await pendingObject.json<PoseBatch>():null;
  const sequence=body.sequence;
  if(!scene||!pending||body.revision!==scene.revision||pending.revision!==scene.revision||!Number.isSafeInteger(sequence)||sequence===undefined||sequence<1||sequence>pending.sequence)throw new Error("위치 적용 확인이 현재 지도·위치 번호와 다릅니다.");
  const priorObject=await B().get("camera/"+id+"/poseAck"),prior=priorObject?await priorObject.json<{revision:string;sequence:number}>():null;
  if(prior?.revision===scene.revision&&sequence<prior.sequence)throw new Error("이전 위치 적용 확인을 거부했습니다.");
  await B().put("camera/"+id+"/poseAck",JSON.stringify({revision:scene.revision,sequence,applied:Date.now()}));return json({ok:true});
 }
 if(q.get("action")==="sceneAck"){
  if(await hash(req.headers.get("X-Camera-Key")||"")!==r.hash)throw new Error("카메라 연결 키 오류");
  const body=await req.json() as {revision?:string};const desired=await B().get("camera/"+id+"/scene");const scene=desired?await desired.json<{revision:string}>():null;
  if(!scene||body.revision!==scene.revision)throw new Error("현재 지도 버전과 일치하지 않습니다.");
  await B().put("camera/"+id+"/sceneAck",JSON.stringify({revision:scene.revision,applied:Date.now()}));return json({ok:true});
 }
 if(await hash(req.headers.get("X-Camera-Key")||"")!==r.hash)throw new Error("영상 업로드 키 오류");
 const length=Number(req.headers.get("content-length"));if(!Number.isSafeInteger(length)||length<4||length>262144)throw new Error("JPEG는 256KB 이하입니다.");
 const sceneRevision=req.headers.get("X-Scene-Revision")||"",desiredScene=await currentScene(id);
 if(desiredScene&&sceneRevision!==desiredScene.revision)return json({error:"새 지도 영상 대기"},409);
 const seq=Number(req.headers.get("X-Frame-Sequence"));if(!Number.isSafeInteger(seq)||seq<1)throw new Error("프레임 번호 오류");const previous=await B().head("camera/"+id+"/frame");if(seq<=Number(previous?.customMetadata?.sequence||0))throw new Error("이전 프레임 거부");if(previous&&Date.now()-Number(previous.customMetadata?.received||0)<500)return json({error:"최대 2fps로 전송하세요."},429);
 const bytes=new Uint8Array(await req.arrayBuffer());if(bytes.length!==length||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error("JPEG 파일 형식 오류");
 const received=Date.now();if(sceneRevision&&!valid(sceneRevision))throw new Error("영상 지도 버전 오류");
 const poseSequence=Number(req.headers.get("X-Pose-Sequence")||"0");if(!Number.isSafeInteger(poseSequence)||poseSequence<0)throw new Error("영상 위치 번호 오류");
 if(poseSequence){const scene=await currentScene(id),ackObject=await B().get("camera/"+id+"/poseAck"),ack=ackObject?await ackObject.json<{revision:string;sequence:number}>():null;if(!scene||scene.revision!==sceneRevision)return json({error:"새 지도 영상 대기"},409);if(ack?.revision!==sceneRevision||poseSequence>ack.sequence)return json({error:"위치 적용 확인 대기"},409);}
 await B().put("camera/"+id+"/frame",bytes,{httpMetadata:{contentType:"image/jpeg"},customMetadata:{received:String(received),sequence:String(seq),source:req.headers.get("X-Frame-Source")==="test"?"test":"producer-reported-gazebo",sceneRevision,poseSequence:String(poseSequence)}});return json({ok:true,received,sequence:seq});
 }catch(e){return json({error:(e as Error).message},400);}}
export async function GET(req:Request){try{
 const q=new URL(req.url).searchParams,id=q.get("session")||"";
 if(q.get("action")==="live"){
  await member(req);const list=await B().list({prefix:"camera/",limit:1000});const streams=[];
  for(const o of list.objects.filter(o=>o.key.endsWith("/frame"))){const sid=o.key.split("/")[1];try{await record(sid);const frame=await B().head(o.key);const received=Number(frame?.customMetadata?.received||0);if(Date.now()-received<5000)streams.push({id:sid,received});}catch{}}
  return json(streams.sort((a,b)=>b.received-a.received));
 }
 const r=await record(id);
 if(q.get("action")==="scene"){
  if(await hash(req.headers.get("X-Camera-Key")||"")!==r.hash)throw new Error("카메라 연결 키 오류");
  const scene=await B().get("camera/"+id+"/scene");return scene?json(await scene.json()):new Response(null,{status:204,headers});
 }
 if(q.get("action")==="poses"){
  if(await hash(req.headers.get("X-Camera-Key")||"")!==r.hash)throw new Error("카메라 연결 키 오류");
  const scene=await currentScene(id),posesObject=await B().get("camera/"+id+"/poses"),poses=posesObject?await posesObject.json<PoseBatch>():null;
  return scene&&poses?.revision===scene.revision?json(poses):new Response(null,{status:204,headers});
 }
 const object=await B().get("camera/"+id+"/frame");
 if(q.get("meta")==="1"){
  let isOwner=false;if(req.headers.get("authorization"))try{isOwner=(await member(req)).id===r.owner;}catch{}
  const desired=await B().get("camera/"+id+"/scene"),ack=await B().get("camera/"+id+"/sceneAck");
  const scene=desired?await desired.json<Scene>():null,applied=ack?await ack.json<{revision:string;applied:number}>():null;
  const pendingObject=await B().get("camera/"+id+"/poses"),poseAckObject=await B().get("camera/"+id+"/poseAck"),pending=pendingObject?await pendingObject.json<PoseBatch>():null,poseAck=poseAckObject?await poseAckObject.json<{revision:string;sequence:number;applied:number}>():null;
   return json({received:Number(object?.customMetadata?.received||0),sequence:Number(object?.customMetadata?.sequence||0),source:object?.customMetadata?.source==="test"?"테스트 프레임 · Gazebo 영상 아님":"Gazebo 연결기 보고",stale:!object||Date.now()-Number(object.customMetadata?.received||0)>5000,isOwner,sceneRequested:scene?.revision??null,sceneApplied:applied?.revision===scene?.revision?applied?.revision:null,geometryHash:scene?.geometryHash??null,cameraRobotId:scene?.cameraRobotId??0,frameSceneRevision:object?.customMetadata?.sceneRevision||null,poseRequested:pending?.revision===scene?.revision?pending?.sequence??0:0,poseApplied:poseAck?.revision===scene?.revision?poseAck?.sequence??0:0,framePoseSequence:object?.customMetadata?.sceneRevision===scene?.revision?Number(object?.customMetadata?.poseSequence||0):0});
 }
 if(!object)return json({error:"아직 영상 없음"},404);
 const desiredScene=await currentScene(id);if(desiredScene&&object.customMetadata?.sceneRevision!==desiredScene.revision)return json({error:"새 지도 영상 대기"},404);
 return new Response(object.body,{headers:{...headers,"Content-Type":"image/jpeg","X-Frame-Sequence":object.customMetadata?.sequence||"0","X-Received-At":object.customMetadata?.received||"0","X-Scene-Revision":object.customMetadata?.sceneRevision||"","X-Pose-Sequence":object.customMetadata?.poseSequence||"0"}});
}catch(e){return json({error:(e as Error).message},404);}}
