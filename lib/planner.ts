export type Point={x:number;y:number};
export type Obstacle=Point&{w:number;h:number;kind?:"box"|"cone"|"worker"|"helmet"|"rack"|"wall"|"pallet";name?:string;blocking?:boolean;helmetWorn?:boolean};
export type World={width:number;height:number;start:Point;goal:Point;station?:Point;radius:number;dynamicCircles?:Array<Point&{radius:number}>;obstacles:Obstacle[];traffic?:{x:number;y:number;w:number;h:number};charging?:{left:Obstacle;right:Obstacle};charger?:Obstacle;chargeQueue?:Point[];entries?:{left:Point;right:Point}};
export const sample:World={width:6,height:4,start:{x:.6,y:2},goal:{x:5.3,y:2},station:{x:.6,y:.6},radius:.18,obstacles:[{x:2,y:1.4,w:.7,h:1.3},{x:3.8,y:.4,w:.6,h:1.2}]};
export function validateWorld(v:any):World{
 const n=(x:any)=>typeof x==="number"&&Number.isFinite(x);
 if(!v||![v.width,v.height,v.radius].every(n)||v.width<1||v.width>30||v.height<1||v.height>30||v.radius<=0||v.radius>4||!Array.isArray(v.obstacles)||v.obstacles.length>100)throw new Error("맵 크기 1~30m, 반경 0~4m, 장애물 100개 이하가 필요합니다.");
 for(const p of [v.start,v.goal,...(v.station===undefined?[]:[v.station])])if(!p||!n(p.x)||!n(p.y)||p.x<v.radius||p.y<v.radius||p.x>v.width-v.radius||p.y>v.height-v.radius)throw new Error("출발점·목적지·충전소가 맵 경계를 벗어납니다.");
 for(const o of v.obstacles){if(!o||![o.x,o.y,o.w,o.h].every(n)||o.w<=0||o.h<=0||o.x<0||o.y<0||o.x+o.w>v.width+1e-8||o.y+o.h>v.height+1e-8)throw new Error("장애물 위치·크기를 확인해 주세요.");if(o.kind!==undefined&&!["box","cone","worker","helmet","rack","wall","pallet"].includes(o.kind))throw new Error("지원하지 않는 물체 종류입니다.");if(o.name!==undefined&&(typeof o.name!=="string"||o.name.length>40))throw new Error("물체 이름은 40자 이하입니다.");if(o.helmetWorn!==undefined&&typeof o.helmetWorn!=="boolean")throw new Error("착용 여부는 true/false여야 합니다.");if(o.blocking!==undefined&&typeof o.blocking!=="boolean")throw new Error("충돌 여부는 true/false여야 합니다.");}
 if(blocked(v,v.start)||blocked(v,v.goal)||(v.station!==undefined&&blocked(v,v.station)))throw new Error("출발점·목적지·충전소가 장애물 여유 공간과 겹칩니다.");return v;
}
export function blocked(w:World,p:Point){const r=w.radius;return p.x<r||p.y<r||p.x>w.width-r||p.y>w.height-r||(w.dynamicCircles??[]).some(o=>Math.hypot(p.x-o.x,p.y-o.y)<=w.radius+o.radius)||w.obstacles.some(o=>o.blocking!==false&&p.x>=o.x-r&&p.x<=o.x+o.w+r&&p.y>=o.y-r&&p.y<=o.y+o.h+r);}
export function segmentClear(w:World,a:Point,b:Point){
 if(![a.x,a.y,b.x,b.y].every(Number.isFinite)||blocked(w,a)||blocked(w,b))return false;
 for(const o of w.dynamicCircles??[]){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.y-a.y)*dy)/d)):0;if(Math.hypot(a.x+t*dx-o.x,a.y+t*dy-o.y)<=w.radius+o.radius)return false;}
 // Continuous slab intersection against inflated rectangles. Sampling at a
 // fixed step can miss even a very short corner cut between clear samples.
 for(const o of w.obstacles){if(o.blocking===false)continue;let enter=0,leave=1;for(const [origin,delta,min,max] of [[a.x,b.x-a.x,o.x-w.radius,o.x+o.w+w.radius],[a.y,b.y-a.y,o.y-w.radius,o.y+o.h+w.radius]]){if(Math.abs(delta)<1e-14){if(origin<min||origin>max){enter=Infinity;break;}}else{const p=(min-origin)/delta,q=(max-origin)/delta;enter=Math.max(enter,Math.min(p,q));leave=Math.min(leave,Math.max(p,q));}}if(enter<=leave+1e-12&&enter<=1&&leave>=0)return false;
 }return true;
}
// Grid BFS with conservative inflated rectangular obstacles; no wheel dynamics.
export function plan(w:World,budget?:{remaining:number;deadline:number}):Point[]{
 validateWorld(w);if(segmentClear(w,w.start,w.goal))return [{...w.start},{...w.goal}];const cell=.1,cols=Math.ceil(w.width/cell)+1,rows=Math.ceil(w.height/cell)+1;
 const key=(p:Point)=>Math.round(p.y/cell)*cols+Math.round(p.x/cell);
 const point=(k:number)=>({x:(k%cols)*cell,y:Math.floor(k/cols)*cell});
 const connect=(p:Point)=>{const near=key(p),choices:number[]=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const k=near+dy*cols+dx;if(k>=0&&k<cols*rows&&segmentClear(w,p,point(k)))choices.push(k);}choices.sort((a,b)=>Math.hypot(point(a).x-p.x,point(a).y-p.y)-Math.hypot(point(b).x-p.x,point(b).y-p.y));if(!choices.length)throw Error("격자와 시작·목표 연결이 불가합니다.");return choices[0];};
 const start=connect(w.start),goal=connect(w.goal),parent=new Map<number,number>([[start,-1]]),queue=[start];let head=0;
 while(head<queue.length&&!parent.has(goal)){if(budget&&(budget.remaining--<=0||head%64===0&&performance.now()>budget.deadline))throw Error('실시간 재계획 탐색 한도');const k=queue[head++],p=point(k);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=k%cols+dx,y=Math.floor(k/cols)+dy;if(x<0||y<0||x>=cols||y>=rows)continue;const j=y*cols+x;if(parent.has(j)||!segmentClear(w,p,point(j)))continue;parent.set(j,k);queue.push(j);}}
 if(!parent.has(goal))throw new Error("경로 없음: 장애물 또는 여유 공간을 조정해 주세요.");
 const path:Point[]=[];for(let k=goal;k!==-1;k=parent.get(k)!)path.push(point(k));path.reverse();path.unshift(w.start);path.push(w.goal);
 const smooth=[path[0]];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!segmentClear(w,path[i],path[j]))j--;smooth.push(path[j]);i=j;}return smooth;
}

export function planMission(w:World){const outbound=plan(w);const station=w.station??w.start;const inbound=plan({...w,start:w.goal,goal:station});return {outbound,inbound,station};}

export function planDelivery(w:World){
 validateWorld(w);const helmets=w.obstacles.filter(o=>o.kind==="helmet"),workers=w.obstacles.filter(o=>o.kind==="worker"&&o.helmetWorn===false);
 if(helmets.length!==1||workers.length!==1)throw new Error("안전모 1개와 미착용 작업자 1개를 지정하세요. 여러 대상은 아직 지원하지 않습니다.");
 function approach(o:Obstacle,from:Point){const gap=w.radius+.12;const targets=[{x:o.x-gap,y:o.y+o.h/2},{x:o.x+o.w+gap,y:o.y+o.h/2},{x:o.x+o.w/2,y:o.y-gap},{x:o.x+o.w/2,y:o.y+o.h+gap}];for(const goal of targets)try{return plan({...w,start:from,goal});}catch{}throw new Error("물체에 안전하게 접근할 경로가 없습니다.");}
 const pickup=approach(helmets[0],w.start),deliver=approach(workers[0],pickup.at(-1)!);const home=plan({...w,start:deliver.at(-1)!,goal:w.station??w.start});return [{path:pickup,phase:"안전모로 이동",action:"안전모 집기 · 가상 상태"},{path:deliver,phase:"미착용 작업자에게 이동",action:"안전모 전달 완료 · 가상 상태"},{path:home,phase:"충전소 복귀",action:"충전소 도착 · 대기"}];
}
