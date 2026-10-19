/** CPU Canvas symbols, not manufacturer CAD or sensor-accurate models.
 * Drawing is clipped to the existing hit/collision rectangle; no scene mutation.
 */
export type AppearanceRect={x:number;y:number;w:number;h:number};
export type AppearanceOptions={selected?:boolean;color?:string};
const palette:Record<string,string>={rack:'#6683a4',box:'#c79b62',wall:'#7f8998',worker:'#ffc857',helmet:'#ffe066',cone:'#ff913d',pallet:'#ba915e',charger:'#4ac5a5',lock:'#b39bf6',queue:'#65c9da',lift:'#a9b9cd',qr:'#edf4fc'};
function polygon(c:CanvasRenderingContext2D,points:number[][],fill:string){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();}
function line(c:CanvasRenderingContext2D,x:number,y:number,x2:number,y2:number,color:string,width=.025){c.beginPath();c.strokeStyle=color;c.lineWidth=width;c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){c.beginPath();c.fillStyle=color;c.arc(x,y,r,0,Math.PI*2);c.fill();}
function withRect(c:CanvasRenderingContext2D,r:AppearanceRect,draw:()=>void){if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0)return;c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.translate(r.x,r.y);c.scale(r.w,r.h);draw();c.restore();}
export function drawEntityAppearance(c:CanvasRenderingContext2D,e:{kind:string},r:AppearanceRect,o:AppearanceOptions={}){
 const col=o.color??palette[e.kind]??'#8aa5bf';
 withRect(c,r,()=>{
  c.fillStyle=e.kind==='lock'?'#77649d35':e.kind==='queue'?'#1a566b80':'#152232';c.fillRect(0,0,1,1);
  switch(e.kind){
   case 'rack':
    c.fillStyle='#32465e';c.fillRect(.04,.08,.92,.84);
    for(const y of [.15,.47,.79]){c.fillStyle=col;c.fillRect(.03,y,.94,.055);for(let i=0;i<4;i++){c.fillStyle=i%2?'#d5aa6c':'#9ab6cb';c.fillRect(.1+i*.21,y+.09,.16,.17);}}
    c.fillStyle='#b9cee0';for(const x of [.025,.945])c.fillRect(x,.035,.03,.93);break;
   case 'box':
    c.fillStyle=col;c.fillRect(.05,.06,.9,.88);polygon(c,[[.05,.06],[.5,.22],[.95,.06],[.5,.015]],'#e2bd86');line(c,.5,.22,.5,.92,'#f6ddb0',.09);line(c,.06,.35,.94,.35,'#986c3d',.018);c.fillStyle='#f8e9ca';c.fillRect(.65,.62,.2,.14);break;
   case 'wall':
    c.fillStyle=col;c.fillRect(.02,.03,.96,.94);for(let row=0;row<4;row++){const y=.04+row*.235;line(c,.02,y,.98,y,'#455364',.018);for(let i=0;i<4;i++){const x=(i+(row%2)*.5)*.28;line(c,x,y,x,y+.235,'#455364',.018);}}break;
   case 'pallet':
    c.fillStyle='#76552f';for(const y of [.16,.73])c.fillRect(.04,y,.92,.12);for(let i=0;i<5;i++){const x=.045+i*.19;c.fillStyle=i%2?'#d2ad77':col;c.fillRect(x,.04,.14,.92);circle(c,x+.035,.18,.012,'#584329');circle(c,x+.035,.79,.012,'#584329');}break;
   case 'cone':
    c.fillStyle='#575766';c.fillRect(.08,.83,.84,.12);polygon(c,[[.5,.04],[.19,.85],[.81,.85]],col);polygon(c,[[.375,.37],[.625,.37],[.68,.52],[.32,.52]],'#fff2db');polygon(c,[[.27,.65],[.73,.65],[.78,.78],[.22,.78]],'#fff2db');break;
   case 'worker':
    circle(c,.5,.19,.13,'#f0c6a1');polygon(c,[[.34,.36],[.66,.36],[.73,.68],[.27,.68]],col);line(c,.37,.39,.15,.64,'#f0c6a1',.09);line(c,.63,.39,.85,.64,'#f0c6a1',.09);line(c,.41,.67,.35,.94,'#a7c9eb',.11);line(c,.59,.67,.65,.94,'#a7c9eb',.11);line(c,.4,.39,.46,.66,'#fff3b4',.035);line(c,.6,.39,.54,.66,'#fff3b4',.035);break;
   case 'helmet':
    c.beginPath();c.fillStyle=col;c.arc(.5,.68,.35,Math.PI,Math.PI*2);c.fill();c.fillRect(.09,.65,.82,.12);line(c,.5,.36,.5,.65,'#fff7af',.055);line(c,.28,.44,.24,.62,'#d0a633',.025);break;
   case 'charger':
    c.fillStyle='#2b746a';c.fillRect(.04,.05,.92,.9);c.strokeStyle=col;c.lineWidth=.045;c.strokeRect(.08,.1,.84,.8);c.fillStyle='#112b34';c.fillRect(.21,.16,.58,.15);polygon(c,[[.55,.35],[.3,.64],[.48,.64],[.4,.88],[.73,.53],[.55,.53]],'#ffdf70');for(const x of [.12,.8]){c.fillStyle='#d6f5e8';c.fillRect(x,.71,.08,.2);}break;
   case 'lock':
    for(let i=-3;i<9;i++)line(c,i*.2,0,i*.2+.4,1,'#bca2f155',.035);c.strokeStyle=col;c.lineWidth=.025;c.setLineDash([.09,.065]);c.strokeRect(.025,.025,.95,.95);c.setLineDash([]);break;
   case 'queue':
    c.strokeStyle=col;c.lineWidth=.045;c.strokeRect(.055,.055,.89,.89);line(c,.25,.7,.25,.3,col,.08);line(c,.75,.7,.75,.3,col,.08);line(c,.25,.7,.75,.7,col,.08);break;
   case 'lift':
    c.fillStyle='#55667e';c.fillRect(.035,.04,.93,.92);for(const x of [.13,.51]){c.fillStyle=col;c.fillRect(x,.18,.36,.7);line(c,x+.08,.22,x+.08,.84,'#e6eff7',.018);}c.fillStyle='#1b2b41';c.fillRect(.26,.065,.48,.09);polygon(c,[[.35,.14],[.4,.08],[.45,.14]],'#81f0cb');polygon(c,[[.55,.08],[.6,.14],[.65,.08]],'#ffcc81');break;
   case 'qr':
    c.fillStyle='#edf4fc';c.fillRect(.04,.04,.92,.92);for(let y=0;y<9;y++)for(let x=0;x<9;x++)if((x*7+y*11+x*y)%5<2){c.fillStyle='#152232';c.fillRect(.12+x*.084,.12+y*.084,.075,.075);}for(const [x,y] of [[.1,.1],[.65,.1],[.1,.65]]){c.fillStyle='#152232';c.fillRect(x,y,.25,.25);c.fillStyle='#edf4fc';c.fillRect(x+.045,y+.045,.16,.16);c.fillStyle='#152232';c.fillRect(x+.085,y+.085,.08,.08);}break;
   default:c.fillStyle=col;c.fillRect(.04,.04,.92,.92);
  }
 });
 c.save();c.strokeStyle=o.selected?'#ffffff':col;c.lineWidth=o.selected?3:1.5;c.strokeRect(r.x+1,r.y+1,Math.max(0,r.w-2),Math.max(0,r.h-2));c.restore();
}
/** Local +X is the robot front. Call inside caller's pose rotation. */
export function drawRobotAppearance(c:CanvasRenderingContext2D,r:AppearanceRect,o:AppearanceOptions={}){
 withRect(c,r,()=>{
  for(const x of [.04,.67])for(const y of [.015,.74]){c.fillStyle='#f7c74d';c.fillRect(x,y,.27,.245);for(let j=0;j<3;j++)line(c,x+.03+j*.075,y+.025,x+.105+j*.075,y+.215,'#544b35',.035);}
  c.fillStyle='#17342f';c.fillRect(.13,.22,.74,.56);c.strokeStyle=o.selected?'#ffffff':o.color??'#72c9ff';c.lineWidth=.045;c.strokeRect(.13,.22,.74,.56);
  c.fillStyle='#368b62';c.fillRect(.22,.29,.4,.42);c.fillStyle='#212d39';c.fillRect(.26,.37,.19,.23);for(const x of [.22,.56])for(const y of [.28,.68])circle(c,x,y,.023,'#e6dcaa');
  c.fillStyle='#c1ced8';c.fillRect(.67,.36,.18,.28);circle(c,.83,.5,.115,'#233b52');circle(c,.86,.5,.065,'#8de2fb');circle(c,.88,.48,.022,'#eafaff');
  polygon(c,[[.99,.5],[.91,.39],[.91,.61]],o.color??'#72c9ff');
 });
}
/** Projected front symbols, not physical 3D meshes. Caller supplies the full
 * projected rectangle and clips visible ray columns for depth/occlusion.
 * Never derive size from clipped columns: partially hidden objects retain scale.
 */
export function drawFrontAppearance(c:CanvasRenderingContext2D,kind:string,r:AppearanceRect,color?:string){
 const col=color??palette[kind]??'#8aa5bf';
 withRect(c,r,()=>{
  switch(kind){
   case 'worker':
    // The unpainted margins preserve the surrounding camera view.
    circle(c,.5,.16,.105,'#f0c6a1');c.fillStyle='#58432e';c.fillRect(.405,.07,.19,.045);
    polygon(c,[[.34,.3],[.66,.3],[.7,.62],[.3,.62]],col);
    line(c,.36,.33,.2,.57,'#efc09a',.075);line(c,.64,.33,.8,.57,'#efc09a',.075);
    line(c,.41,.62,.38,.94,'#5381a7',.105);line(c,.59,.62,.62,.94,'#5381a7',.105);
    line(c,.3,.96,.43,.96,'#203143',.055);line(c,.57,.96,.7,.96,'#203143',.055);
    line(c,.39,.32,.42,.6,'#fff3ad',.025);line(c,.61,.32,.58,.6,'#fff3ad',.025);line(c,.32,.52,.68,.52,'#fff3ad',.028);break;
   case 'helmet':
    c.beginPath();c.fillStyle=col;c.ellipse(.5,.66,.37,.42,0,Math.PI,Math.PI*2);c.fill();
    c.fillStyle=col;c.fillRect(.08,.65,.84,.12);line(c,.5,.28,.5,.65,'#fff6b9',.055);line(c,.25,.4,.21,.61,'#cba22f',.025);line(c,.75,.4,.79,.61,'#cba22f',.025);break;
   case 'cone':
    c.fillStyle='#414d58';c.fillRect(.06,.87,.88,.09);polygon(c,[[.5,.035],[.2,.87],[.8,.87]],col);
    polygon(c,[[.4,.32],[.6,.32],[.65,.47],[.35,.47]],'#fff5df');polygon(c,[[.29,.65],[.71,.65],[.76,.79],[.24,.79]],'#fff5df');break;
   case 'robot':
    // Facing-camera approximation, deliberately separate from map top view.
    for(const x of [.05,.77]){c.fillStyle='#efc047';c.fillRect(x,.56,.18,.36);for(let j=0;j<4;j++)line(c,x+.025,.6+j*.07,x+.15,.64+j*.07,'#61523a',.023);}
    c.fillStyle='#183b36';c.fillRect(.16,.46,.68,.35);c.strokeStyle=col;c.lineWidth=.025;c.strokeRect(.16,.46,.68,.35);
    c.fillStyle='#348f67';c.fillRect(.22,.42,.56,.12);for(let j=0;j<5;j++){c.fillStyle='#d7dda9';c.fillRect(.3+j*.08,.43,.028,.06);}
    c.fillStyle='#a6b7c7';c.fillRect(.46,.28,.08,.18);c.fillStyle='#263d52';c.fillRect(.31,.08,.38,.25);circle(c,.5,.205,.092,'#172633');circle(c,.5,.205,.065,'#78cce5');circle(c,.52,.18,.024,'#e5fbff');
    for(const x of [.27,.65]){c.fillStyle='#252e3b';c.fillRect(x,.62,.08,.055);circle(c,x+.04,.645,.019,'#9ce9f4');}break;
   case 'rack':
    c.fillStyle='#283c51';c.fillRect(.02,.03,.96,.94);
    for(let row=0;row<3;row++){const y=.13+row*.29;for(let j=0;j<4;j++){const x=.09+j*.215;c.fillStyle=(row+j)%2?'#c49b66':'#8eb2c8';c.fillRect(x,y,.16,.19);c.fillStyle='#efd4a2';c.fillRect(x+.067,y,.027,.19);}c.fillStyle=col;c.fillRect(.03,y+.2,.94,.04);}
    for(const x of [.025,.947]){c.fillStyle='#b9cee0';c.fillRect(x,.02,.028,.96);}line(c,.06,.96,.94,.03,'#849bb766',.015);break;
   case 'box':
    c.fillStyle=col;c.fillRect(.035,.04,.93,.92);c.fillStyle='#edcca0';c.fillRect(.455,.04,.09,.92);line(c,.04,.14,.96,.14,'#936739',.02);
    c.fillStyle='#f8eed8';c.fillRect(.64,.62,.22,.16);line(c,.67,.67,.82,.67,'#947b5a',.012);line(c,.67,.72,.77,.72,'#947b5a',.012);break;
   case 'pallet':
    for(const y of [.16,.48,.79]){c.fillStyle='#75502f';c.fillRect(.06,y,.88,.14);}for(const x of [.07,.43,.79]){c.fillStyle=col;c.fillRect(x,.1,.14,.85);}
    c.fillStyle='#d8b17c';c.fillRect(.025,.08,.95,.1);c.fillRect(.025,.9,.95,.075);break;
   case 'charger':
    c.fillStyle='#235c5b';c.fillRect(.08,.03,.84,.94);c.strokeStyle=col;c.lineWidth=.035;c.strokeRect(.08,.03,.84,.94);
    c.fillStyle='#152f3d';c.fillRect(.23,.14,.54,.19);line(c,.3,.23,.62,.23,'#8ee6ce',.03);
    polygon(c,[[.56,.41],[.32,.67],[.48,.67],[.43,.88],[.72,.58],[.55,.58]],'#ffe07e');for(const x of [.13,.79]){c.fillStyle='#e0f4e7';c.fillRect(x,.8,.08,.13);}break;
   case 'lift':
    c.fillStyle='#4b5e75';c.fillRect(.025,.02,.95,.96);for(const x of [.12,.51]){c.fillStyle=col;c.fillRect(x,.22,.37,.71);line(c,x+.055,.25,x+.055,.89,'#dde7ef',.018);}line(c,.5,.22,.5,.93,'#34465a',.018);
    c.fillStyle='#1b2d41';c.fillRect(.32,.075,.36,.09);polygon(c,[[.36,.145],[.4,.085],[.44,.145]],'#81f0cb');polygon(c,[[.56,.085],[.6,.145],[.64,.085]],'#ffcc81');break;
   case 'wall':
    c.fillStyle=col;c.fillRect(0,0,1,1);for(let row=0;row<5;row++){const y=row*.2;line(c,0,y,1,y,'#3b4b5b',.012);for(let j=0;j<5;j++){const x=(j+(row%2)*.5)*.25;line(c,x,y,x,y+.2,'#3b4b5b',.012);}}break;
   // The QR-like pattern is a fictional sign, never a decodable QR payload.
   case 'qr':
    c.fillStyle='#edf4fc';c.fillRect(.04,.04,.92,.92);for(let y=0;y<9;y++)for(let x=0;x<9;x++)if((x*7+y*11+x*y)%5<2){c.fillStyle='#152232';c.fillRect(.12+x*.084,.12+y*.084,.075,.075);}for(const [x,y] of [[.1,.1],[.65,.1],[.1,.65]]){c.fillStyle='#152232';c.fillRect(x,y,.25,.25);c.fillStyle='#edf4fc';c.fillRect(x+.045,y+.045,.16,.16);c.fillStyle='#152232';c.fillRect(x+.085,y+.085,.08,.08);}break;
   case 'queue':case 'lock':break;
   default:c.fillStyle=col;c.fillRect(0,0,1,1);
  }
 });
}
