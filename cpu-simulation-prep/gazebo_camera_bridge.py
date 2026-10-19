"""Gazebo Harmonic Image -> JPEG -> HTTPS latest-frame preview. No synthetic frames."""
import argparse, io, json, math, re, subprocess, threading, time, urllib.request, urllib.error
from xml.etree import ElementTree
from pathlib import Path

def encode_frame(msg):
    from PIL import Image
    modes={3:("RGB","RGB",3),4:("RGBA","RGBA",4),5:("RGBA","BGRA",4),8:("RGB","BGR",3)}
    if msg.pixel_format_type not in modes: raise ValueError("Unsupported Gazebo pixel format")
    mode,raw,channels=modes[msg.pixel_format_type]
    if not (0<msg.width<=1280 and 0<msg.height<=720): raise ValueError("Image size out of bounds")
    if msg.step<msg.width*channels or len(msg.data)!=msg.step*msg.height: raise ValueError("Image buffer mismatch")
    image=Image.frombytes(mode,(msg.width,msg.height),bytes(msg.data),"raw",raw,msg.step).convert("RGB")
    if (msg.width,msg.height)!=(640,480): raise ValueError("Expected 640x480 Gazebo camera image")
    out=io.BytesIO();image.save(out,format="JPEG",quality=85,optimize=True)
    if out.tell()>262144: raise ValueError("JPEG quality 85 exceeds 256KB upload limit")
    return out.getvalue()

def service(action, request, request_type):
    command=["gz","service","-s","/world/mechanic_factory/"+action+"/blocking","--reqtype",request_type,"--reptype","gz.msgs.Boolean","--timeout","5000","--req",request]
    result=subprocess.run(command,capture_output=True,text=True,timeout=8,check=False)
    return result.returncode==0 and "data: true" in result.stdout

def scene_names():
    command=["gz","service","-s","/world/mechanic_factory/scene/info","--reqtype","gz.msgs.Empty","--reptype","gz.msgs.Scene","--timeout","5000","--req",""]
    result=subprocess.run(command,capture_output=True,text=True,timeout=8,check=False)
    if result.returncode!=0: raise RuntimeError("Gazebo scene query unavailable")
    return set(re.findall(r'name: "(ground|object_\d+|raspbot_proxy_\d+|charging_station|overhead_camera)"',result.stdout))

def camera_http_policy(exc, previous=None):
    """Return (terminal, repeated auth failures); do not expose response content in logs."""
    try:
        error=json.loads(exc.read(1024)).get("error")
    except (ValueError, UnicodeDecodeError, AttributeError):
        error=None
    if error in {"세션 ID 형식 오류","세션 없음","종료·만료된 카메라 세션","카메라 연결 키 오류","영상 업로드 키 오류"}:
        return True,None
    if exc.code in (401,403):
        count=previous[1]+1 if previous and previous[0]==exc.code else 1
        return count>=3,(exc.code,count)
    return False,None

def sync_poses(endpoint, config, revision, robot_ids, last_sequence, scene_state, lock, latest):
    request=urllib.request.Request(endpoint+"?action=poses&session="+config["id"],headers={"X-Camera-Key":config["key"],"User-Agent":"MechanicGazeboBridge/1.0"})
    with urllib.request.urlopen(request,timeout=10) as response:
        if response.status==204: return last_sequence
        batch=json.load(response)
    if batch.get("revision")!=revision: return last_sequence
    sequence=batch.get("sequence")
    if not isinstance(sequence,int) or sequence<=last_sequence: return last_sequence
    robots=batch.get("robots")
    if not isinstance(robots,list) or sorted(r.get("id") for r in robots)!=sorted(robot_ids): raise ValueError("Pose robot IDs differ from scene")
    for robot_id in robot_ids:
        pose=next(r for r in robots if r["id"]==robot_id)
        x,y,yaw=(pose.get(k) for k in ("x","y","yaw"))
        if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (x,y,yaw)): raise ValueError("Invalid robot pose")
        if not -math.pi<=yaw<=math.pi: raise ValueError("Invalid robot heading")
        model_name="raspbot_proxy_"+str(robot_id-1)
        request=f'name: "{model_name}" position {{ x: {x} y: {y} z: 0.06 }} orientation {{ z: {math.sin(yaw/2)} w: {math.cos(yaw/2)} }}'
        if not service("set_pose",request,"gz.msgs.Pose"): raise RuntimeError("Gazebo set_pose failed: "+model_name)
    body=json.dumps({"revision":revision,"sequence":sequence}).encode()
    ack=urllib.request.Request(endpoint+"?action=poseAck&session="+config["id"],data=body,method="POST",headers={"X-Camera-Key":config["key"],"Content-Type":"application/json","User-Agent":"MechanicGazeboBridge/1.0"})
    with urllib.request.urlopen(ack,timeout=10) as response: response.read()
    with lock:
        if scene_state[0]!=revision: return last_sequence
        scene_state[1]=sequence;scene_state[2]=2;latest[0]=None
    print("Gazebo poses applied:",revision,"sequence:",sequence,"robots:",len(robots),flush=True)
    return sequence

def sync_scene(endpoint, config, stop, scene_state, lock, latest, node, image_type, callback_for, callbacks):
    applied=None;old_topic=None;auth_failures=None;pose_sequence=0;robot_ids=[]
    while not stop.wait(1):
        try:
            request=urllib.request.Request(endpoint+"?action=scene&session="+config["id"],headers={"X-Camera-Key":config["key"],"User-Agent":"MechanicGazeboBridge/1.0"})
            with urllib.request.urlopen(request,timeout=10) as response:
                auth_failures=None
                if response.status==204: continue
                scene=json.load(response)
            revision=scene["revision"]
            if revision==applied:
                pose_sequence=sync_poses(endpoint,config,revision,robot_ids,pose_sequence,scene_state,lock,latest)
                continue
            if not re.fullmatch(r"/mechanic/camera/[0-9a-f-]{36}",scene["topic"]): raise ValueError("Invalid camera topic")
            root=ElementTree.fromstring(scene["sdf"])
            models={m.attrib["name"]:ElementTree.tostring(m,encoding="unicode") for m in root.findall("./world/model") if m.attrib.get("name","").startswith(("object_","raspbot_proxy_")) or m.attrib.get("name") in ("ground","charging_station","overhead_camera")}
            if len(models)>105: raise ValueError("Too many scene models")
            robot_ids=scene.get("robotIds",[])
            if not isinstance(robot_ids,list) or len(robot_ids)>4 or len(robot_ids)!=len([n for n in models if n.startswith("raspbot_proxy_")]): raise ValueError("Invalid robot scene mapping")
            with lock: scene_state[0]="switching";scene_state[1]=0;scene_state[2]=0;latest[0]=None
            for name in scene_names():
                if not service("remove","name: "+json.dumps(name)+" type: MODEL","gz.msgs.Entity"): raise RuntimeError("Gazebo remove failed: "+name)
            if scene_names(): raise RuntimeError("Gazebo old scene removal incomplete")
            for name,sdf in models.items():
                if not service("create","sdf: "+json.dumps('<sdf version="1.9">'+sdf+'</sdf>'),"gz.msgs.EntityFactory"): raise RuntimeError("Gazebo create failed: "+name)
            for _ in range(5):
                if scene_names()==set(models): break
                time.sleep(.4)
            else: raise RuntimeError("Gazebo scene verification failed")
            if scene["topic"] not in callbacks:
                callback=callback_for(revision)
                if not node.subscribe(image_type,scene["topic"],callback): raise RuntimeError("Gazebo camera subscription failed")
                callbacks[scene["topic"]]=callback
            body=json.dumps({"revision":revision}).encode()
            ack=urllib.request.Request(endpoint+"?action=sceneAck&session="+config["id"],data=body,method="POST",headers={"X-Camera-Key":config["key"],"Content-Type":"application/json","User-Agent":"MechanicGazeboBridge/1.0"})
            with urllib.request.urlopen(ack,timeout=10) as response: response.read()
            applied=revision;pose_sequence=0
            with lock: scene_state[0]=revision;scene_state[1]=0;scene_state[2]=2;latest[0]=None
            if old_topic and old_topic!=scene["topic"]:
                node.unsubscribe(old_topic);callbacks.pop(old_topic,None)
            old_topic=scene["topic"]
            print("Gazebo scene applied:",revision,"models:",len(models),flush=True)
        except urllib.error.HTTPError as exc:
            terminal,auth_failures=camera_http_policy(exc,auth_failures)
            print("Scene sync HTTP status:",exc.code,"stopping" if terminal else "retrying",flush=True)
            if terminal: return
        except Exception as exc: print("Scene sync failed:",type(exc).__name__,str(exc)[:120],flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--config",required=True,type=Path);args=parser.parse_args()
    config=json.loads(args.config.read_text());endpoint=config["endpoint"]
    if not endpoint.startswith("https://") and not endpoint.startswith("http://127.0.0.1:"): raise SystemExit("HTTPS endpoint required")
    from gz.transport13 import Node
    from gz.msgs10.image_pb2 import Image as GzImage
    node=Node();lock=threading.Lock();latest=[None,0,None,0];scene_state=[None,0,0];stop=threading.Event()
    def callback_for(revision):
        def callback(msg):
            with lock:
                if scene_state[0]!=revision: return
                if scene_state[2]>0: scene_state[2]-=1;return
                pose_sequence=scene_state[1]
            try: jpeg=encode_frame(msg)
            except Exception as exc: print("Frame rejected:",type(exc).__name__,flush=True);return
            with lock:
                if scene_state[0]==revision and scene_state[1]==pose_sequence: latest[0]=jpeg;latest[1]+=1;latest[2]=revision;latest[3]=pose_sequence
        return callback
    base_topic=config.get("topic","/mechanic/camera");callbacks={base_topic:callback_for(None)}
    if not node.subscribe(GzImage,base_topic,callbacks[base_topic]): raise SystemExit("Gazebo subscription failed")
    threading.Thread(target=sync_scene,args=(endpoint,config,stop,scene_state,lock,latest,node,GzImage,callback_for,callbacks),daemon=True).start()
    print("Subscribed to Gazebo. Waiting for real Image messages; maximum 2 uploads/s.",flush=True)
    seen=0;sequence=int(time.time()*1000);auth_failures=None
    try:
        while not stop.wait(.5):
            with lock: jpeg,version,revision,pose_sequence=latest
            if jpeg is None or version==seen: continue
            seen=version;sequence+=1
            headers={"User-Agent":"MechanicGazeboBridge/1.0","Content-Type":"image/jpeg","X-Camera-Key":config["key"],"X-Frame-Sequence":str(sequence),"X-Frame-Source":"gazebo"}
            if revision: headers["X-Scene-Revision"]=revision
            if pose_sequence: headers["X-Pose-Sequence"]=str(pose_sequence)
            req=urllib.request.Request(endpoint+"?session="+config["id"],data=jpeg,method="POST",headers=headers)
            try:
                with urllib.request.urlopen(req,timeout=10) as response: response.read()
                auth_failures=None
                print("Gazebo frame uploaded:",version,"JPEG bytes:",len(jpeg),flush=True)
            except urllib.error.HTTPError as exc:
                terminal,auth_failures=camera_http_policy(exc,auth_failures)
                if exc.code==400: terminal=True
                print("Upload HTTP status:",exc.code,"stopping" if terminal else "retrying",flush=True)
                if terminal: break
            except Exception as exc: print("Upload failed:",type(exc).__name__,flush=True)
    except KeyboardInterrupt: pass
if __name__=="__main__": main()
