"use client";
import {useState} from "react";
import {compileMission,exampleCommand} from "@/lib/mission";
export default function VibeWorkspace({locked,onExecute}:{locked:boolean;onExecute:()=>void}){
 const [text,setText]=useState(exampleCommand),[code,setCode]=useState(""),[error,setError]=useState("");
 return <section className="vibeWorkspace"><h3>✦ 바이브 명령 작업 공간</h3><p>자연어 → 임무 코드 → 시뮬레이션. 현재는 안전모 전달 시나리오를 지원하는 규칙 기반 변환입니다.</p><label>로봇에게 요청할 작업<textarea rows={6} maxLength={1500} value={text} disabled={locked} onChange={e=>{setText(e.target.value);setCode("");setError("");}}/></label><div className="vibeActions"><button disabled={locked} onClick={()=>{try{setCode(compileMission(text).code);setError("");}catch(e){setCode("");setError((e as Error).message);}}}>명령 해석 · 코드 생성</button><button className="ghost" disabled={locked||!code} onClick={onExecute}>가상 임무 실행</button></div>{error&&<p role="alert" className="error">{error}</p>}{code&&<><h4>생성 코드 · 읽기 전용</h4><pre aria-label="생성된 임무 코드"><code>{code}</code></pre></>}<p>환경 편집에서 안전모 1개와 ‘안전모 미착용’ 작업자 1개를 배치하세요. 집기·전달은 가상 상태이며 영상 인식·팔 제어·실제 충전은 연결되지 않았습니다. 임의 코드는 실행하지 않습니다.</p></section>;
}
