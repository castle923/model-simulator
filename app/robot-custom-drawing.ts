import type { RobotCustomization } from '../lib/robot-customization';
export type RobotDrawingRect = { x: number; y: number; width: number; height: number };
/** Rect and all glyph/stroke sizes use caller units (meters or pixels). Front is +X.
 * Procedural top views identify kinds; these are not CAD models or sensor hardware.
 */
export function drawCustomizedRobot(ctx: CanvasRenderingContext2D, rect: RobotDrawingRect, config: RobotCustomization, color = '#38bdf8', selected = false) {
 const {x,y,width:w,height:h}=rect;const sx=w/config.length,sy=h/config.width,unit=Math.min(w,h);const ellipse=config.bodyShape==='ellipse';
 const bodyPath=()=>{ctx.beginPath();if(ellipse)ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else ctx.rect(x,y,w,h);};
 ctx.save();ctx.lineWidth=unit*(selected?.025:.0125);ctx.strokeStyle=selected?'#f8fafc':'#0f172a';ctx.fillStyle=color;bodyPath();ctx.fill();ctx.stroke();
 // Keep mechanical styling inside the declared body footprint even for oval shells.
 ctx.save();bodyPath();ctx.clip();ctx.fillStyle='#111827';
 if(config.kind==='tracked'){ctx.fillRect(x,y,w,h*.16);ctx.fillRect(x,y+h*.84,w,h*.16);for(let i=0;i<7;i++){ctx.strokeStyle='#64748b';ctx.beginPath();ctx.moveTo(x+w*i/7,y);ctx.lineTo(x+w*i/7,y+h*.16);ctx.stroke();}}
 else if(config.kind==='turtlebot-burger'||config.kind==='turtlebot-waffle'||config.kind==='round-amr'){for(const wy of [.02,.80])ctx.fillRect(x+w*.32,y+h*wy,w*.36,h*.18);}
 else for(const wx of [.17,.73])for(const wy of [0,.82])ctx.fillRect(x+w*wx,y+h*wy,w*.19,h*.18);
 if(config.kind==='turtlebot-burger'){
   ctx.fillStyle='#172033';ctx.fillRect(x+w*.13,y+h*.2,w*.74,h*.6);ctx.strokeStyle='#cbd5e1';ctx.lineWidth=unit*.012;
   for(const dx of [.2,.8])for(const dy of [.25,.75]){ctx.beginPath();ctx.arc(x+w*dx,y+h*dy,unit*.035,0,Math.PI*2);ctx.fillStyle='#cbd5e1';ctx.fill();}
   ctx.fillStyle='#166534';ctx.fillRect(x+w*.3,y+h*.31,w*.36,h*.36);ctx.fillStyle='#fbbf24';for(let i=0;i<5;i++)ctx.fillRect(x+w*(.33+i*.058),y+h*.34,w*.024,h*.035);
   ctx.beginPath();ctx.ellipse(x+w*.56,y+h*.5,w*.18,h*.2,0,0,Math.PI*2);ctx.fillStyle='#0f172a';ctx.fill();ctx.strokeStyle='#d97706';ctx.lineWidth=unit*.035;ctx.stroke();ctx.beginPath();ctx.arc(x+w*.56,y+h*.5,unit*.055,0,Math.PI*2);ctx.fillStyle='#f97316';ctx.fill();
 }else if(config.kind==='turtlebot-waffle'){
   ctx.fillStyle='#283449';ctx.fillRect(x+w*.09,y+h*.12,w*.82,h*.76);ctx.fillStyle='#94a3b8';for(let ix=0;ix<6;ix++)for(let iy=0;iy<5;iy++){ctx.beginPath();ctx.arc(x+w*(.17+ix*.13),y+h*(.2+iy*.15),unit*.018,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#166534';ctx.fillRect(x+w*.27,y+h*.34,w*.24,h*.3);ctx.beginPath();ctx.arc(x+w*.62,y+h*.5,unit*.13,0,Math.PI*2);ctx.fillStyle='#0f172a';ctx.fill();ctx.strokeStyle='#f59e0b';ctx.lineWidth=unit*.035;ctx.stroke();
 }else if(config.kind==='round-amr'){
   ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w*.34,h*.34,0,0,Math.PI*2);ctx.fillStyle='#26364a';ctx.fill();ctx.strokeStyle='#67e8f9';ctx.lineWidth=unit*.025;ctx.stroke();ctx.fillStyle='#0f172a';ctx.fillRect(x+w*.37,y+h*.33,w*.22,h*.34);
 }else{ctx.fillStyle='rgba(15,23,42,.6)';ctx.fillRect(x+w*.22,y+h*.2,w*.44,h*.6);}
 if(config.kind==='forklift'){ctx.strokeStyle='#fbbf24';ctx.lineWidth=unit*.06;for(const fy of [.25,.75]){ctx.beginPath();ctx.moveTo(x+w*.68,y+h*fy);ctx.lineTo(x+w*.98,y+h*fy);ctx.stroke();}}
 ctx.restore();
 for(const camera of config.cameras.filter(c=>c.enabled)){const cx=x+w/2+camera.x*sx,cy=y+h/2+camera.y*sy;ctx.save();ctx.translate(cx,cy);ctx.rotate(camera.yawDeg*Math.PI/180);ctx.fillStyle='#f8fafc';ctx.fillRect(-w*.05,-h*.08,w*.1,h*.16);ctx.fillStyle='#06b6d4';ctx.beginPath();ctx.arc(w*.05,0,unit*.05,0,Math.PI*2);ctx.fill();ctx.restore();}
 for(const arm of config.manipulators.filter(a=>a.enabled)){const base={x:x+w*.55,y:y+h*(arm.side==='left'?.18:arm.side==='right'?.82:.5)};ctx.save();if(arm.stowed){bodyPath();ctx.clip();}ctx.strokeStyle='#fbbf24';ctx.lineWidth=unit*.07;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x,base.y);let px=base.x,py=base.y,angle=0;const joints=arm.joints.length?arm.joints:[{angleDeg:0}];for(const joint of joints){angle+=joint.angleDeg*Math.PI/180;const segment=(arm.stowed?Math.min(arm.reach,.08):arm.reach)/joints.length*sx;px+=Math.cos(angle)*segment;py+=Math.sin(angle)*segment;ctx.lineTo(px,py);}ctx.stroke();ctx.fillStyle='#fef3c7';ctx.beginPath();ctx.arc(px,py,unit*.06,0,Math.PI*2);ctx.fill();ctx.restore();}
 ctx.save();bodyPath();ctx.clip();ctx.fillStyle='#f8fafc';ctx.beginPath();ctx.moveTo(x+w*.87,y+h*.5);ctx.lineTo(x+w*.72,y+h*.35);ctx.lineTo(x+w*.72,y+h*.65);ctx.closePath();ctx.fill();ctx.restore();ctx.restore();
}
