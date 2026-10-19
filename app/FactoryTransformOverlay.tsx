"use client";
import {useEffect,useRef,useState} from "react";
import type {PointerEvent,KeyboardEvent} from "react";
import type {World,Obstacle} from "@/lib/planner";

type Corner="nw"|"ne"|"sw"|"se";
type Mode="move"|Corner;
type Draft={index:number;rect:Obstacle};
type Drag={pointerId:number;index:number;mode:Mode;start:{x:number;y:number};original:Obstacle};
type Props={world:World;onApply:(world:World)=>void;onSelect:(index:number)=>void;selection:number;locked:boolean;onError:(message:string)=>void};
const scale=105,originX=60,originY=70;
const round=(n:number)=>Math.round(n*100)/100;
const screen=(o:Obstacle)=>({x:originX+o.x*scale,y:originY+(4-o.y-o.h)*scale,w:o.w*scale,h:o.h*scale});

export default function FactoryTransformOverlay({world,onApply,onSelect,selection,locked,onError}:Props){
 const svg=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null);
 const [preview,setPreview]=useState<Draft|null>(null);
 useEffect(()=>{drag.current=null;setPreview(null);},[world]);
 function point(e:{clientX:number;clientY:number}){const b=svg.current!.getBoundingClientRect();return{x:((e.clientX-b.left)*960/b.width-originX)/scale,y:4-((e.clientY-b.top)*600/b.height-originY)/scale};}
 function transformed(original:Obstacle,mode:Mode,start:{x:number;y:number},p:{x:number;y:number}):Obstacle{
  if(mode==="move")return {...original,x:round(original.x+p.x-start.x),y:round(original.y+p.y-start.y)};
  const left=original.x,right=original.x+original.w,bottom=original.y,top=original.y+original.h;
  const x=mode.endsWith("w")?Math.min(p.x,right-.05):Math.max(p.x,left+.05);
  const y=mode.startsWith("n")?Math.max(p.y,bottom+.05):Math.min(p.y,top-.05);
  const nextLeft=mode.endsWith("w")?x:left,nextRight=mode.endsWith("e")?x:right;
  const nextBottom=mode.startsWith("s")?y:bottom,nextTop=mode.startsWith("n")?y:top;
  return {...original,x:round(nextLeft),y:round(nextBottom),w:round(nextRight-nextLeft),h:round(nextTop-nextBottom)};
 }
 function begin(e:PointerEvent<SVGRectElement>,index:number,mode:Mode){
  if(locked||e.button!==0)return;
  e.preventDefault();e.stopPropagation();onSelect(index);
  const original={...world.obstacles[index]};
  drag.current={pointerId:e.pointerId,index,mode,start:point(e),original};
  svg.current?.setPointerCapture(e.pointerId);
 }
 function move(e:PointerEvent<SVGSVGElement>){const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;setPreview({index:d.index,rect:transformed(d.original,d.mode,d.start,point(e))});}
 function finish(e:PointerEvent<SVGSVGElement>){const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;const rect=transformed(d.original,d.mode,d.start,point(e));drag.current=null;setPreview(null);if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);
  if(!Object.keys(rect).some(key=>(rect as any)[key]!== (d.original as any)[key]))return;
  const next=structuredClone(world);next.obstacles[d.index]=rect;
  try{onApply(next);onError("물체 이동·크기 변경을 경로 검증 후 적용했습니다.");}catch(error){onError("물체 변경 취소 · "+(error as Error).message);}
 }
 function keyChange(e:KeyboardEvent<SVGRectElement>,index:number,mode:Mode){if(locked||!e.key.startsWith("Arrow"))return;const delta={x:e.key==="ArrowRight"?.05:e.key==="ArrowLeft"?-.05:0,y:e.key==="ArrowUp"?.05:e.key==="ArrowDown"?-.05:0};e.preventDefault();const original=world.obstacles[index],start={x:mode.endsWith("e")?original.x+original.w:original.x,y:mode.startsWith("n")?original.y+original.h:original.y};const rect=transformed(original,mode,start,{x:start.x+delta.x,y:start.y+delta.y});const next=structuredClone(world);next.obstacles[index]=rect;onSelect(index);try{onApply(next);onError("물체 위치·크기를 적용했습니다.");}catch(error){onError("물체 변경 취소 · "+(error as Error).message);}}
 const selected=world.obstacles[selection],display=preview?.index===selection?preview.rect:selected;
 const b=display?screen(display):null;
 const handles=b?([...["nw","ne","sw","se"]] as Corner[]).map(c=>({corner:c,x:c.endsWith("w")?b.x:b.x+b.w,y:c.startsWith("n")?b.y:b.y+b.h})):[];
 return <svg ref={svg} className="factoryTransformOverlay" viewBox="0 0 960 600" preserveAspectRatio="none" aria-label="공장 물체 위치와 크기 편집" onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{drag.current=null;setPreview(null);}}>
  {world.obstacles.map((o,i)=>{const box=screen(o);return <rect key={i} className="factoryTransformHit" x={box.x} y={box.y} width={box.w} height={box.h} role="button" tabIndex={locked?-1:0} aria-label={(o.name||"물체 "+(i+1))+" 이동"} onPointerDown={e=>begin(e,i,"move")} onKeyDown={e=>keyChange(e,i,"move")}/>;})}
  {b&&<rect className={preview?"factoryTransformPreview":"factoryTransformSelection"} x={b.x} y={b.y} width={b.w} height={b.h} />}
  {!locked&&handles.map(h=><rect key={h.corner} className="factoryTransformHandle" x={h.x-7} y={h.y-7} width={14} height={14} rx={2} role="button" tabIndex={0} aria-label={(selected.name||"선택 물체")+" "+({nw:"왼쪽 위",ne:"오른쪽 위",sw:"왼쪽 아래",se:"오른쪽 아래"})[h.corner]+" 크기 조절"} onPointerDown={e=>begin(e,selection,h.corner)} onKeyDown={e=>keyChange(e,selection,h.corner)}/>)}
 </svg>;
}
