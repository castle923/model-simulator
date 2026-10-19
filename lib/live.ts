export type Member={id:string;name:string;token:string};
export async function api(m:Member|null,body?:any,query=""){
 const r=await fetch("/api/hub"+query,{method:body?"POST":"GET",headers:{...(m?{Authorization:"Bearer "+m.token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});const data:any=await r.json();if(!r.ok)throw new Error(data.error||"서버 요청 실패");return data;
}
export async function upload(m:Member,target:string,file:File){
 const r=await fetch("/api/files?target="+encodeURIComponent(target),{method:"POST",headers:{Authorization:"Bearer "+m.token,"Content-Type":"application/octet-stream","X-File-Name":encodeURIComponent(file.name),"X-File-Type":file.type},body:file});
 const text=await r.text();let data:any;try{data=JSON.parse(text);}catch{throw new Error(r.status===413?"파일이 서버 허용 크기를 초과했습니다.":"파일 저장 서버 오류 ("+r.status+")");}if(!r.ok)throw new Error(data.error||"파일 저장 실패");return data;
}
export class LiveRoom{
 peers=new Map<string,RTCPeerConnection>(); sessions=new Map<string,string>(); pending=new Set<string>(); timer:ReturnType<typeof setInterval>|null=null; cursor=0; closed=false; busy=false;
 constructor(public me:Member,public run:any,public stream:MediaStream|null,public video:HTMLVideoElement,public notify:(s:string)=>void){}
 async signal(recipient:string,payload:any){if(!this.closed)await api(this.me,{action:"signal",run:this.run.id,recipient,payload});}
 peer(id:string){const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun.cloudflare.com:3478"}]});
 pc.ontrack=e=>{this.video.srcObject=e.streams[0];this.video.play().catch(()=>this.notify("영상을 눌러 재생해 주세요."));};
 pc.onconnectionstatechange=()=>{if(pc.connectionState==="connected")this.notify("실시간 영상 연결됨");if(pc.connectionState==="failed")this.notify("네트워크 연결 실패 · TURN 중계 서버가 필요할 수 있습니다. 녹화 업로드로 공유할 수 있습니다.");};
 if(this.stream)for(const track of this.stream.getTracks())pc.addTrack(track,this.stream);this.peers.set(id,pc);return pc;}
 async gather(pc:RTCPeerConnection){if(pc.iceGatheringState==="complete")return;await new Promise<void>(resolve=>{const done=()=>{if(pc.iceGatheringState==="complete"){pc.removeEventListener("icegatheringstatechange",done);clearTimeout(t);resolve();}};const t=setTimeout(()=>{pc.removeEventListener("icegatheringstatechange",done);resolve();},7000);pc.addEventListener("icegatheringstatechange",done);});}
 async tick(){if(this.closed||this.busy)return;this.busy=true;try{
  const p=await api(this.me,{action:"presence",run:this.run.id});
  const events=await api(this.me,undefined,`?action=signals&run=${encodeURIComponent(this.run.id)}&after=${this.cursor}`);
  for(const e of events){this.cursor=Math.max(this.cursor,e.id);const msg=JSON.parse(e.payload);
   if(msg.type==="request"&&this.stream){this.peers.get(e.sender)?.close();this.peers.delete(e.sender);this.sessions.delete(e.sender);}
   if(msg.type==="offer"&&!this.stream&&e.sender===this.run.owner){this.peers.get(e.sender)?.close();const pc=this.peer(e.sender);await pc.setRemoteDescription(msg.sdp);await pc.setLocalDescription(await pc.createAnswer());await this.gather(pc);await this.signal(e.sender,{type:"answer",sdp:pc.localDescription,session:msg.session});}
   if(msg.type==="answer"&&this.stream){const pc=this.peers.get(e.sender);if(pc?.signalingState==="have-local-offer"&&msg.session===this.sessions.get(e.sender))await pc.setRemoteDescription(msg.sdp);}
  }
  if(this.stream){const ids=new Set(p.viewers.map((v:any)=>v.member_id));for(const [id,pc] of this.peers)if(!ids.has(id)){pc.close();this.peers.delete(id);}
   for(const v of p.viewers){const id=v.member_id;if(this.peers.has(id)||this.pending.has(id))continue;this.pending.add(id);try{const session=crypto.randomUUID();this.sessions.set(id,session);const pc=this.peer(id);await pc.setLocalDescription(await pc.createOffer());await this.gather(pc);await this.signal(id,{type:"offer",sdp:pc.localDescription,session});}finally{this.pending.delete(id);}}
  }
 }catch(e){this.notify((e as Error).message);}finally{this.busy=false;}}
 start(){if(!this.stream)api(this.me,{action:"presence",run:this.run.id}).then(()=>this.signal(this.run.owner,{type:"request"})).catch(e=>this.notify(e.message));this.tick();this.timer=setInterval(()=>this.tick(),2000);}
 close(){this.closed=true;if(this.timer)clearInterval(this.timer);for(const pc of this.peers.values())pc.close();this.peers.clear();}
}
