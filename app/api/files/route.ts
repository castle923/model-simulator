import { env } from "cloudflare:workers";
export const dynamic="force-dynamic";
const limit=80*1024*1024;
async function sha(data:BufferSource){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data))).map(x=>x.toString(16).padStart(2,"0")).join("");}
export async function POST(req:Request){try{
 if(req.headers.get("origin")&&req.headers.get("origin")!==new URL(req.url).origin)throw new Error("다른 사이트 요청 거부");
 if(!env.DB||!env.BUCKET)throw new Error("파일 저장소 연결 대기");
 if(Number(req.headers.get("content-length")||0)>limit+20000)throw new Error("파일은 80MB 이하로 올려 주세요.");
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 const m=await env.DB.prepare("SELECT id FROM members WHERE token_hash=?").bind(await sha(new TextEncoder().encode(token))).first<{id:string}>();if(!m)throw new Error("닉네임으로 입장해 주세요.");
 const target=new URL(req.url).searchParams.get("target")||"";
 const name=decodeURIComponent(req.headers.get("X-File-Name")||"upload.bin").slice(0,180);
 const type=req.headers.get("X-File-Type")||"";
 if(!req.body)throw new Error("빈 파일입니다.");
 const item=await env.DB.prepare("SELECT owner FROM posts WHERE id=? UNION ALL SELECT owner FROM runs WHERE id=?").bind(target,target).first<{owner:string}>();if(!item||item.owner!==m.id)throw new Error("본인의 작업·실행에만 파일을 추가할 수 있습니다.");
 const id=crypto.randomUUID();const mime=/^video\/(webm|mp4|ogg)$/.test(type)?type:"application/octet-stream";
 let size=0;const counted=req.body.pipeThrough(new TransformStream({transform(chunk,controller){size+=chunk.byteLength;if(size>limit)throw new Error("파일은 80MB 이하로 올려 주세요.");controller.enqueue(chunk);}}));
 const declared=Number(req.headers.get("content-length"));if(!Number.isSafeInteger(declared)||declared<=0||declared>limit)throw new Error("파일 길이가 필요하며 80MB 이하여야 합니다.");
 const [storage,digest]=counted.tee();const digestStream=new (crypto as any).DigestStream("SHA-256");const fixed=new FixedLengthStream(declared);
 try{await Promise.all([env.BUCKET.put(id,fixed.readable,{httpMetadata:{contentType:mime}}),storage.pipeTo(fixed.writable),digest.pipeTo(digestStream)]);if(!size)throw new Error("빈 파일입니다.");}catch(e){await env.BUCKET.delete(id);throw e;}
 const checksum=Array.from(new Uint8Array(await digestStream.digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
 try{await env.DB.prepare("INSERT INTO files VALUES(?,?,?,?,?,?,?,?)").bind(id,m.id,name,size,mime,checksum,target,Date.now()).run();}catch(e){await env.BUCKET.delete(id);throw e;}
 return Response.json({id,sha:checksum});
 }catch(e){return Response.json({error:(e as Error).message},{status:400});}}
export async function GET(req:Request){
 if(!env.DB||!env.BUCKET)return new Response("Unavailable",{status:503});const id=new URL(req.url).searchParams.get("id");
 const f=await env.DB.prepare("SELECT name,mime FROM files WHERE id=?").bind(id).first<{name:string,mime:string}>();if(!f)return new Response("Not found",{status:404});
 const object=await env.BUCKET.get(id!,{range:req.headers});if(!object)return new Response("Not found",{status:404});
 const headers=new Headers({"Content-Type":f.mime,"X-Content-Type-Options":"nosniff","Cache-Control":"private, max-age=120","Accept-Ranges":"bytes"});
 headers.set("Content-Disposition",`${f.mime.startsWith("video/")?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
 let status=200;if(object.range&&"offset" in object.range&&object.range.offset!==undefined&&object.range.length!==undefined){const {offset,length}=object.range;status=206;headers.set("Content-Range",`bytes ${offset}-${offset+length-1}/${object.size}`);headers.set("Content-Length",String(length));}else if(object.range&&"suffix" in object.range){const length=Math.min(object.range.suffix,object.size);status=206;headers.set("Content-Range",`bytes ${object.size-length}-${object.size-1}/${object.size}`);headers.set("Content-Length",String(length));}else headers.set("Content-Length",String(object.size));
 return new Response(object.body,{headers,status});
}
