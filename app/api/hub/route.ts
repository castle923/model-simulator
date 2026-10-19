import { env } from "cloudflare:workers";
import { validText, validSeconds, requireOwner, requireVersion } from "@/lib/policy";
export const dynamic = "force-dynamic";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const uid=()=>crypto.randomUUID();
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");}
const DB=()=>{if(!env.DB)throw new Error("저장소 연결 대기 중입니다.");return env.DB;};
type Row=Record<string,any>;
async function one(sql:string,...args:any[]):Promise<Row|null>{return DB().prepare(sql).bind(...args).first();}
async function all(sql:string,...args:any[]){return (await DB().prepare(sql).bind(...args).all()).results;}
async function exec(sql:string,...args:any[]){return DB().prepare(sql).bind(...args).run();}
async function member(req:Request){const token=req.headers.get("authorization")?.replace(/^Bearer /,"");if(!token||token.length>150)throw new Error("닉네임으로 입장해 주세요.");const m=await one("SELECT id,name FROM members WHERE token_hash=?",await hash(token));if(!m)throw new Error("입장 정보가 만료되었습니다.");return m;}
function origin(req:Request){const o=req.headers.get("origin");if(o&&o!==new URL(req.url).origin)throw new Error("다른 사이트의 요청은 허용하지 않습니다.");}
export async function GET(req:Request){try{
 const m=await member(req);const q=new URL(req.url).searchParams;const action=q.get("action");
 if(action==="signals")return json(await all("SELECT id,sender,payload FROM signals WHERE run_id=? AND recipient=? AND id>? AND created>? ORDER BY id LIMIT 100",q.get("run"),m.id,Number(q.get("after")||0),Date.now()-120000));
 if(action==="detail")return json({comments:await all("SELECT c.*,m.name FROM comments c JOIN members m ON m.id=c.owner WHERE c.target_id=? ORDER BY c.created",q.get("id")),files:await all("SELECT f.id,f.name,f.size,f.sha,f.created,m.name AS author FROM files f JOIN members m ON m.id=f.owner WHERE target_id=? ORDER BY f.created",q.get("id")),revisions:await all("SELECT version,title,body,created FROM revisions WHERE post_id=? ORDER BY version DESC",q.get("id"))});
 await exec("UPDATE runs SET status='interrupted',ended=? WHERE status='live' AND heartbeat<?",Date.now(),Date.now()-30000);
 return json({me:m,posts:await all("SELECT p.*,m.name FROM posts p JOIN members m ON m.id=p.owner ORDER BY updated DESC LIMIT 100"),runs:await all("SELECT r.*,m.name FROM runs r JOIN members m ON m.id=r.owner ORDER BY started DESC LIMIT 100"),people:await all("SELECT DISTINCT m.id,m.name FROM participants p JOIN members m ON m.id=p.member_id WHERE p.seen>?",Date.now()-15000)});
 }catch(e){return json({error:(e as Error).message},400);}}
export async function POST(req:Request){try{
 origin(req);if(Number(req.headers.get("content-length")||0)>150000)throw new Error("요청이 너무 큽니다.");const b=await req.json() as Row; const now=Date.now();
 if(b.action==="join"){
  const name=validText(b.name,24,"닉네임");const id=uid();const token=uid()+uid();await exec("INSERT INTO members(id,token_hash,name,created) VALUES(?,?,?,?)",id,await hash(token),name,now);return json({id,name,token});
 }
 const m=await member(req);
 if(b.action==="post"){
  const title=validText(b.title,120,"제목"), body=validText(b.body,12000,"내용"), tag=validText(b.tag,30,"분류"); const link=validText(b.link||"",500,"링크",true);
  if(link && !/^https:\/\//.test(link))throw new Error("링크는 https 주소만 가능합니다.");
  if(b.id){const p=await one("SELECT * FROM posts WHERE id=?",b.id);if(!p)throw new Error("작업을 찾을 수 없습니다.");requireOwner(p.owner,m.id);requireVersion(p.version,b.version);
   // Optimistic update and revision insert in one transactional batch.
   const result=await DB().batch([DB().prepare("INSERT INTO revisions(id,post_id,version,title,body,created) SELECT ?,id,version,title,body,? FROM posts WHERE id=? AND version=?").bind(uid(),now,b.id,b.version),DB().prepare("UPDATE posts SET title=?,body=?,tag=?,link=?,version=version+1,updated=? WHERE id=? AND owner=? AND version=?").bind(title,body,tag,link,now,b.id,m.id,b.version)]);
   if(result[1].meta.changes!==1)throw new Error("변경 충돌: 새로고침 후 다시 확인해 주세요.");return json({id:b.id});
  } const id=uid();await exec("INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?)",id,m.id,title,body,tag,link,1,now,now);return json({id});
 }
 if(b.action==="start"){
  const id=uid();const title=validText(b.title,120,"실행 제목");const dataset=validText(b.dataset||"미지정",160,"데이터 버전"),commit=validText(b.commit||"미지정",160,"코드 버전");
  await exec("UPDATE runs SET status='interrupted',ended=? WHERE status='live' AND heartbeat<?",now,now-30000);
  // UNIQUE partial index guarantees only one active presenter, including concurrent requests.
  try{await exec("INSERT INTO runs(id,owner,title,status,started,heartbeat,dataset,commit_ref,recording) VALUES(?,?,?,'live',?,?,?,?,?)",id,m.id,title,now,now,dataset,commit,b.recording?1:0);}catch{throw new Error("다른 발표자가 실행 중입니다. 종료 후 다시 시작해 주세요.");}return json({id});
 }
 if(b.action==="presence"){
  const r=await one("SELECT * FROM runs WHERE id=?",b.run);if(!r)throw new Error("실행 없음");
  await exec("INSERT INTO participants(id,run_id,member_id,seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen",b.run+":"+m.id,b.run,m.id,now);
  if(r.owner===m.id&&r.status==="live")await exec("UPDATE runs SET heartbeat=? WHERE id=?",now,b.run);
  return json({viewers:await all("SELECT p.member_id,m.name FROM participants p JOIN members m ON m.id=p.member_id WHERE run_id=? AND seen>? AND member_id<>?",b.run,now-15000,r.owner)});
 }
 if(b.action==="signal"){
  const r=await one("SELECT * FROM runs WHERE id=? AND status='live'",b.run);if(!r)throw new Error("종료된 실행입니다.");const target=validText(b.recipient,80,"수신자");
  if(m.id!==r.owner && target!==r.owner)throw new Error("발표자에게만 연결할 수 있습니다.");
  if(m.id===r.owner&&!await one("SELECT id FROM participants WHERE run_id=? AND member_id=? AND seen>?",b.run,target,now-30000))throw new Error("관찰자가 입장하지 않았습니다.");
  const payload=JSON.stringify(b.payload);if(payload.length>60000)throw new Error("연결 정보가 너무 큽니다.");
  await exec("DELETE FROM signals WHERE created<?",now-120000);await exec("INSERT INTO signals(run_id,sender,recipient,payload,created) VALUES(?,?,?,?,?)",b.run,m.id,target,payload,now);return json({ok:true});
 }
 if(b.action==="finish"||b.action==="attachVideo"){
  const r=await one("SELECT * FROM runs WHERE id=?",b.run);if(!r)throw new Error("실행 없음");requireOwner(r.owner,m.id);
  if(b.action==="finish")await exec("UPDATE runs SET status='ended',ended=?,duration=? WHERE id=?",now,validSeconds(b.duration),b.run);
  else {if(r.video_id)throw new Error("기존 녹화는 덮어쓸 수 없습니다.");const f=await one("SELECT * FROM files WHERE id=? AND owner=? AND target_id=?",b.file,m.id,b.run);if(!f||!f.mime.startsWith("video/"))throw new Error("실행에 연결된 영상 파일이 필요합니다.");await exec("UPDATE runs SET video_id=? WHERE id=? AND video_id IS NULL",b.file,b.run);}
  return json({ok:true});
 }
 if(b.action==="comment"){
  const type=b.type==="run"?"run":"post";const target=await one(type==="run"?"SELECT id,duration FROM runs WHERE id=?":"SELECT id FROM posts WHERE id=?",b.target);if(!target)throw new Error("댓글 대상 없음");
  const seconds=type==="run"?validSeconds(b.seconds):null;if(seconds!==null&&target.duration!==null&&seconds>target.duration+1)throw new Error("영상 길이를 벗어난 시간입니다.");
  await exec("INSERT INTO comments VALUES(?,?,?,?,?,?,?)",uid(),m.id,b.target,type,seconds,validText(b.body,3000,"댓글"),now);return json({ok:true});
 }
 throw new Error("지원하지 않는 요청");
 }catch(e){return json({error:(e as Error).message},400);}}
