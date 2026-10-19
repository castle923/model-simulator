"use client";
import {useEffect,useRef,useState} from "react";
import type {Member} from "@/lib/live";
import {cameraRobotAfterRosterChange,robotYaw,type GazeboRobot,type RobotPose} from "@/lib/gazebo";

type CameraMeta={error?:string;sceneRequested:string|null;sceneApplied:string|null;frameSceneRevision:string|null;geometryHash:string|null;cameraRobotId:number;sequence:number;stale:boolean;received:number;source:string;isOwner:boolean;poseRequested:number;poseApplied:number;framePoseSequence:number};
async function geometryHash(data:any){const input=JSON.stringify({environment:data.environment??data,robotIds:(data.robots??[]).map((r:GazeboRobot)=>r.id)}),digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}

export default function GazeboCamera({me,snapshot}:{me:Member|null;snapshot:()=>string|undefined}){
 const [session,setSession]=useState(""),[active,setActive]=useState(""),[config,setConfig]=useState<any>(null);
 const [status,setStatus]=useState("Gazebo 카메라 연결 대기"),[sceneStatus,setSceneStatus]=useState("적용한 지도 없음"),[url,setUrl]=useState("");
 const [retry,setRetry]=useState(0),[streams,setStreams]=useState<any[]>([]),[cameraRobotId,setCameraRobotId]=useState(0),[liveRobotId,setLiveRobotId]=useState(0),[applying,setApplying]=useState(false),[follow,setFollow]=useState(true),[poseStatus,setPoseStatus]=useState("주행 위치 동기화 대기"),[isOwner,setIsOwner]=useState(false),[robots,setRobots]=useState<{id:number}[]>([]);
 const metaRef=useRef<CameraMeta|null>(null),applyingRef=useRef(false),pendingRevisionRef=useRef<string|null>(null),sentRef=useRef({revision:"",signature:"",sequence:0}),changeRef=useRef({hash:"",since:0}),headingRef=useRef(new Map<number,{x:number;y:number;yaw:number}>()),headingEpochRef=useRef({kind:"",time:0,distance:0});
 const snapshotRef=useRef(snapshot);snapshotRef.current=snapshot;
 function currentPoses(data:any):RobotPose[]{const robots=data.robots as GazeboRobot[]|undefined;if(!Array.isArray(robots))return [];if(headingEpochRef.current.kind!==data.kind||Number.isFinite(data.time)&&data.time<headingEpochRef.current.time||data.kind==="single-robot"&&Number.isFinite(data.distance)&&data.distance<headingEpochRef.current.distance||data.kind==="single-robot"&&!data.running&&robots.every(r=>!r.route?.length))headingRef.current.clear();headingEpochRef.current={kind:data.kind??"",time:Number.isFinite(data.time)?data.time:0,distance:Number.isFinite(data.distance)?data.distance:0};const ids=new Set(robots.map(r=>r.id));for(const id of headingRef.current.keys())if(!ids.has(id))headingRef.current.delete(id);return robots.map(r=>{const old=headingRef.current.get(r.id),dx=old?r.x-old.x:0,dy=old?r.y-old.y:0,yaw=old?(Math.hypot(dx,dy)>.005?Math.atan2(dy,dx):old.yaw):robotYaw(r);headingRef.current.set(r.id,{x:r.x,y:r.y,yaw});return {id:r.id,x:r.x,y:r.y,yaw};});}
 useEffect(()=>{try{const saved=localStorage.getItem("mechanic-camera-session");if(saved&&/^[0-9a-f-]{36}$/.test(saved)){setSession(saved);setActive(saved);}}catch{}},[]);
 useEffect(()=>{if(active)try{localStorage.setItem("mechanic-camera-session",active);}catch{}},[active]);
 useEffect(()=>{metaRef.current=null;sentRef.current={revision:"",signature:"",sequence:0};changeRef.current={hash:"",since:0};headingRef.current.clear();headingEpochRef.current={kind:"",time:0,distance:0};setIsOwner(false);setRobots([]);},[active]);
 useEffect(()=>{if(!applying)return;const timer=setTimeout(()=>{setApplying(false);applyingRef.current=false;pendingRevisionRef.current=null;},15000);return()=>clearTimeout(timer);},[applying]);
 useEffect(()=>{
  if(!active)return;let closed=false,busy=false,current="";const abort=new AbortController();
  async function tick(){
   if(busy||closed)return;busy=true;
   try{
    const endpoint="/api/camera?session="+encodeURIComponent(active),m=await fetch(endpoint+"&meta=1",{signal:abort.signal,headers:me?{Authorization:"Bearer "+me.token}:{}}).then(r=>r.json()) as CameraMeta;
    if(m.error)throw new Error(m.error);
    metaRef.current=m;setIsOwner(m.isOwner);
    setLiveRobotId(m.cameraRobotId??0);
    if(!applyingRef.current)setCameraRobotId(m.cameraRobotId??0);
    const raw=snapshotRef.current();if(raw){try{const data=JSON.parse(raw),roster=Array.isArray(data.robots)?data.robots.filter((r:any)=>Number.isSafeInteger(r.id)&&r.id>0&&r.id<=4):[];setRobots(old=>JSON.stringify(old.map(r=>r.id))===JSON.stringify(roster.map((r:GazeboRobot)=>r.id))?old:roster.map((r:GazeboRobot)=>({id:r.id})));
      if(m.isOwner&&m.sceneRequested&&Array.isArray(data.robots)){const actual=await geometryHash(data),fallback=cameraRobotAfterRosterChange(m.cameraRobotId,roster),selectedDeleted=fallback!==m.cameraRobotId;
       if(selectedDeleted)setCameraRobotId(fallback);
       const replaceAllowed=!applyingRef.current||pendingRevisionRef.current===m.sceneRequested;
       if(actual!==m.geometryHash&&replaceAllowed&&(selectedDeleted||m.sceneApplied===m.sceneRequested)){if(changeRef.current.hash!==actual)changeRef.current={hash:actual,since:Date.now()};else if(Date.now()-changeRef.current.since>700){changeRef.current={hash:"",since:0};setCameraRobotId(fallback);applyScene(fallback);return;}}
      else changeRef.current={hash:"",since:0};}
    }catch{}}
    const currentScene=!m.sceneRequested||m.sceneApplied===m.sceneRequested&&m.frameSceneRevision===m.sceneRequested;
    if(m.sceneRequested&&currentScene&&pendingRevisionRef.current===m.sceneRequested){setApplying(false);applyingRef.current=false;pendingRevisionRef.current=null;}
    setSceneStatus(m.sceneRequested?(currentScene?"현재 지도 · Gazebo 적용 및 새 영상 확인":"지도/시점 전환 중 · 새 영상 대기"):"적용한 지도 없음");
    if(!m.isOwner)setPoseStatus("관찰 전용 · 위치 전송은 세션 작성자만 가능");
    else if(!follow)setPoseStatus("위치 동기화 꺼짐");
    else if(!m.sceneRequested||m.sceneApplied!==m.sceneRequested)setPoseStatus("지도 적용 대기");
    else if(m.cameraRobotId===0)setPoseStatus("상부 시점 · 정면 추종을 보려면 R기체를 선택하세요");
    else if(!m.poseRequested)setPoseStatus("웹 주행 위치 전송 대기");
    else if(m.poseApplied<m.poseRequested)setPoseStatus("위치 "+m.poseRequested+" · Gazebo 적용 대기");
    else if(m.stale||m.framePoseSequence<m.poseRequested)setPoseStatus("위치 "+m.poseRequested+" · 적용 확인, 새 영상 대기");
    else setPoseStatus("주행 위치 동기화 확인 · Gazebo 적용 및 새 영상 "+m.poseRequested);
    if(!currentScene){if(current)URL.revokeObjectURL(current);current="";setUrl("");return;}
    if(m.stale){if(m.sequence&&!current){const old=await fetch(endpoint,{signal:abort.signal});if(old.ok&&(!m.sceneRequested||old.headers.get("X-Scene-Revision")===m.sceneRequested)){const next=URL.createObjectURL(await old.blob());if(closed)URL.revokeObjectURL(next);else{current=next;setUrl(current);}}}if(!closed)setStatus(m.sequence?"영상 중단 · 마지막 프레임 (5초 이상 갱신 없음)":"이 세션에 연결된 실행기가 없습니다. ‘수신 중인 카메라 찾기’를 사용하거나 새 설정으로 Ubuntu 연결기를 재시작하세요.");return;}
    const r=await fetch(endpoint+"&frame="+m.sequence,{signal:abort.signal});if(!r.ok)throw new Error("영상 읽기 실패");
    if(m.sceneRequested&&r.headers.get("X-Scene-Revision")!==m.sceneRequested)return;
    const next=URL.createObjectURL(await r.blob());if(closed){URL.revokeObjectURL(next);return;}if(current)URL.revokeObjectURL(current);current=next;setUrl(next);
    setStatus(m.source+" · 카메라 수신 · 프레임 "+m.sequence+" · 서버 수신 "+new Date(m.received).toLocaleTimeString());
   }catch(e){if(!closed)setStatus((e as Error).message);}finally{busy=false;}
  }
  tick();const timer=setInterval(tick,600);
  return()=>{closed=true;abort.abort();clearInterval(timer);if(current)URL.revokeObjectURL(current);setUrl("");};
 },[active,retry,me,follow]);
 useEffect(()=>{
  if(!active||!me||!follow)return;let closed=false,busy=false;const token=me.token;
  async function sendPose(){
   if(closed||busy||applyingRef.current)return;
   const m=metaRef.current;if(!m?.isOwner||!m.sceneRequested||m.sceneApplied!==m.sceneRequested||m.cameraRobotId===0)return;
   const raw=snapshotRef.current();if(!raw)return;
   busy=true;try{
    const data=JSON.parse(raw),robots=data.robots as GazeboRobot[]|undefined,world=data.environment??data;
    if(!Array.isArray(robots)||!robots.length||robots.length>4||!Number.isFinite(world?.width)||!Number.isFinite(world?.height))return;
    if(await geometryHash(data)!==m.geometryHash)return;
    const poses=currentPoses(data);
    if(poses.some(p=>!Number.isSafeInteger(p.id)||![p.x,p.y,p.yaw].every(Number.isFinite)))return;
    const signature=JSON.stringify(poses),prior=sentRef.current;
    if(prior.revision===m.sceneRequested&&prior.signature===signature)return;
    const sequence=Math.max(Date.now(),prior.sequence+1),body=JSON.stringify({revision:m.sceneRequested,sequence,robots:poses});
    const r=await fetch("/api/camera?action=poses&session="+encodeURIComponent(active),{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body});const result:any=await r.json();
    if(!r.ok)throw new Error(result.error||"위치 전송 실패");
    sentRef.current={revision:m.sceneRequested,signature,sequence};
   }catch(e){if(!closed)setPoseStatus((e as Error).message);}finally{busy=false;}
  }
  sendPose();const timer=setInterval(sendPose,850);return()=>{closed=true;clearInterval(timer);};
 },[active,me,follow]);
 async function discover(){try{const r=await fetch("/api/camera?action=live",{headers:{Authorization:"Bearer "+me?.token}});const list:any=await r.json();if(!r.ok)throw new Error(list.error);setStreams(list);setStatus(list.length?"수신 중인 세션을 선택하세요.":"최근 5초 안에 수신된 영상이 없습니다. Ubuntu 실행기를 확인하세요.");}catch(e){setStatus((e as Error).message);}}
 async function create(){try{const r=await fetch("/api/camera?action=create",{method:"POST",headers:{Authorization:"Bearer "+me?.token}});const c:any=await r.json();if(!r.ok)throw new Error(c.error);setConfig({...c,endpoint:location.origin+"/api/camera",topic:"/mechanic/camera",fps:2});if(!active){setSession(c.id);setActive(c.id);}setStatus("새 세션 설정을 만들었습니다. 설정 파일을 내려받고 Ubuntu 연결기를 재시작해야 새 세션으로 영상이 들어옵니다.");}catch(e){setStatus((e as Error).message);}}
 async function applyScene(robotId=cameraRobotId){try{setApplying(true);applyingRef.current=true;pendingRevisionRef.current=null;metaRef.current=null;const raw=snapshotRef.current();if(!raw)throw new Error("지도가 준비된 후 적용하세요.");if(!active)throw new Error("카메라 세션을 먼저 선택하세요.");const data=JSON.parse(raw),poses=currentPoses(data),body=JSON.stringify({...data,robots:Array.isArray(data.robots)?data.robots.map((r:GazeboRobot)=>({...r,yaw:poses.find(p=>p.id===r.id)?.yaw})):undefined,cameraRobotId:robotId});const r=await fetch("/api/camera?action=scene&session="+encodeURIComponent(active),{method:"POST",headers:{Authorization:"Bearer "+me?.token,"Content-Type":"application/json"},body});const result:any=await r.json();if(!r.ok)throw new Error(result.error);pendingRevisionRef.current=result.revision;setUrl("");sentRef.current={revision:"",signature:"",sequence:sentRef.current.sequence};setRetry(n=>n+1);setSceneStatus("지도/시점 전환 중 · 새 영상 대기");setStatus("현재 지도를 Gazebo에 보냈습니다. 연결기의 적용 확인을 기다립니다.");}catch(e){setApplying(false);applyingRef.current=false;pendingRevisionRef.current=null;setCameraRobotId(liveRobotId);setStatus((e as Error).message);}}
 function download(){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:"application/json"}));a.href=u;a.download="gazebo-camera-connection.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 return <section className="panel gazeboCamera"><div className="panelHead"><h2>Gazebo 카메라 · 실시간 수신</h2><span className="pill">저속 이미지 스트림 · 최대 2fps</span></div><div className="cameraBody">
  <p>Gazebo 이미지 토픽을 연결기가 JPEG로 전송하면 이곳에 표시됩니다. 영상 생성은 Ubuntu의 Gazebo에서 수행합니다.</p>
  <div className="vibeActions"><button disabled={!me} onClick={discover}>수신 중인 카메라 찾기</button><button disabled={!me} onClick={create}>카메라 수신 세션 만들기</button><button disabled={!isOwner||!active||applying} onClick={()=>applyScene()}>현재 지도 → 카메라에 적용</button>{config&&<><button className="ghost" onClick={download}>연결 설정 내려받기</button><button className="ghost" onClick={async()=>{const r=await fetch("/api/camera?action=stop&session="+config.id,{method:"POST",headers:{Authorization:"Bearer "+me?.token}});if(r.ok){setActive("");setConfig(null);localStorage.removeItem("mechanic-camera-session");setStatus("카메라 세션 종료");}}}>내 세션 종료</button></>}</div>
  <label>카메라 시점<select aria-label="카메라 시점" value={cameraRobotId} disabled={!isOwner||!active||applying} onChange={e=>{const id=Number(e.target.value);setCameraRobotId(id);applyScene(id);}}><option value={0}>공장 상부 시점</option>{robots.map(r=><option key={r.id} value={r.id}>R{r.id} 정면 시점</option>)}</select></label><p role="status">현재 수신 시점: {liveRobotId===0?"공장 상부":"R"+liveRobotId+" 정면"} · 시점 변경은 세션 작성자만 할 수 있습니다.</p>
  <label className="checkLabel"><input type="checkbox" checked={follow} disabled={!isOwner||!active} onChange={e=>setFollow(e.target.checked)}/> 선택 기체의 웹 주행 위치를 Gazebo 카메라에 동기화</label>
  <p role="status">{poseStatus}</p><p>작성자가 지도를 적용하면 이후 기체 추가·삭제와 물체 배치 변경도 Gazebo 장면에 반영합니다. 선택 기체를 삭제하면 남은 첫 기체 시점으로 전환합니다. 위치 전송은 약 1초 간격이며 정면 카메라는 Gazebo의 프록시 모델을 따라갑니다.</p>
  {streams.map(s=><button key={s.id} className="ghost" onClick={()=>{setSession(s.id);setActive(s.id);setRetry(n=>n+1);}}>연결 {s.id.slice(0,8)} · 수신 중</button>)}
  <label>관찰할 카메라 세션 ID<input value={session} onChange={e=>setSession(e.target.value)} placeholder="발표자가 공유한 세션 ID"/></label>
  <button className="ghost" onClick={()=>{if(!/^[0-9a-f-]{36}$/.test(session.trim())){setStatus("올바른 세션 ID를 입력하거나 수신 중인 카메라를 찾아 선택하세요.");return;}setActive(session.trim());setRetry(n=>n+1);}}>카메라 관찰</button>
  <p role="status">{status}</p><p role="status">{sceneStatus}</p>
  {url?<img src={url} alt="Gazebo 연결기가 전송한 최신 카메라 프레임"/>:<div className="cameraEmpty">새 카메라 영상 대기 중</div>}
  <p>세션은 2시간 후 만료됩니다. 설정 파일에는 업로드 키가 있어 발표자 PC에만 보관하고, 팀원에게는 세션 ID만 공유하세요. 사이트는 공개이며 세션 ID를 아는 사람은 영상을 볼 수 있습니다. 현재 경로는 낮은 프레임 속도의 미리보기이며 제어 피드백으로 사용하지 않습니다.</p>
 </div></section>;
}
