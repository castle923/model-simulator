import {validateScene,type Scene} from './scene-local.ts';
export type ExperimentCommand={schema:'web-experiment-1';baseRevision:number;robotId:string;mode:'normal'|'force-direct';goal:{x:number;y:number}};
export function experimentFor(s:Scene,id:string,mode:ExperimentCommand['mode']='force-direct'):ExperimentCommand{const r=s.robots.find(r=>r.id===id);if(!r)throw Error('기체를 선택하세요.');return {schema:'web-experiment-1',baseRevision:s.revision,robotId:id,mode,goal:{...r.goal}};}
/** Deliberately bounded Korean command grammar. This is not an LLM or arbitrary code executor. */
export function parseExperiment(s:Scene,text:string,id:string):ExperimentCommand{const ids=text.match(/R\d+/gi)??[];if(ids.some(x=>x.toUpperCase()!==id))throw Error('명령의 기체 ID와 선택 기체가 다릅니다.');if(/하지|금지|안\s*(해|하고|되)|않|말[고아]|없[이음]/.test(text))throw Error('부정 명령은 지원하지 않습니다. 정상 복귀 버튼을 사용하세요.');if(/정상.*복귀|자동\s*회피.*(켜|복원)|실험.*해제/.test(text))return experimentFor(s,id,'normal');if(/(오류.*무시|충돌.*허용|강제\s*실험)/.test(text)&&/(직진|이동|실행)/.test(text))return experimentFor(s,id);throw Error('예: R1 충돌을 허용하고 목표로 직진해줘 / R1 자동 회피를 다시 켜줘. 그 밖의 목표·경유점은 고급 임무 JSON에서 설정하세요.');}
export function applyExperiment(s:Scene,raw:unknown):{scene:Scene;program:ExperimentCommand}{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||JSON.stringify(raw).length>32768)throw Error('32KB 이하 실험 JSON 객체가 필요합니다.');const p=raw as ExperimentCommand,keys=['schema','baseRevision','robotId','mode','goal'];
 if(Object.keys(p).length!==keys.length||Object.keys(p).some(k=>!keys.includes(k))||p.schema!=='web-experiment-1'||p.baseRevision!==s.revision)throw Error('실험 형식 또는 지도 버전이 다릅니다. 현재 명령을 다시 생성하세요.');
 if(!['normal','force-direct'].includes(p.mode)||!p.goal||typeof p.goal!=='object'||Array.isArray(p.goal)||Object.keys(p.goal).sort().join(',')!=='x,y'||![p.goal.x,p.goal.y].every(Number.isFinite)||!s.robots.some(r=>r.id===p.robotId))throw Error('기체·실험 모드·목표 좌표를 확인하세요.');
 const next=structuredClone(s),r=next.robots.find(r=>r.id===p.robotId)!;
 if(p.mode==='force-direct'){r.experiment={mode:'force-direct',originalModel:r.experiment?.originalModel??r.model};r.model='holonomic';r.mission='navigate';r.after='stay';r.goalFloor=r.floor;r.goal={...p.goal};r.waypoints=[];delete r.missionTargets;}else{r.model=r.experiment?.originalModel??r.model;delete r.experiment;r.goal={...p.goal};}
 validateScene(next);return {scene:next,program:structuredClone(p)};
}
