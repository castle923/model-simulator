import {validateScene,type Scene} from './scene-local.ts';
export type AdvancedMission={schema:'advanced-mission-1';baseRevision:number;robotId:string;driveModel:'holonomic'|'car';turnRadius:number;goal:{x:number;y:number;floor:number};waypoints:{x:number;y:number}[];completion:'charge'|'stay'};
export function missionFor(s:Scene,id:string):AdvancedMission{const r=s.robots.find(r=>r.id===id);if(!r)throw Error('선택한 기체가 없습니다.');return {schema:'advanced-mission-1',baseRevision:s.revision,robotId:id,driveModel:r.experiment?.originalModel??r.model,turnRadius:r.minRadius,goal:{...r.goal,floor:r.goalFloor},waypoints:structuredClone(r.waypoints),completion:r.after??'charge'};}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const only=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const point=(p:unknown)=>object(p)&&only(p,['x','y'])&&Number.isFinite(p.x)&&Number.isFinite(p.y);
/** Versioned declarative instructions only; no eval, Python or network calls. */
export function applyAdvancedMission(s:Scene,raw:unknown):{scene:Scene;program:AdvancedMission}{
 if(!object(raw)||JSON.stringify(raw).length>32768||!only(raw,['schema','baseRevision','robotId','driveModel','turnRadius','goal','waypoints','completion']))throw Error('고급 임무는 지정된 항목만 가진 32KB 이하 JSON 객체여야 합니다.');
 const p=raw as unknown as AdvancedMission;
 if(p.schema!=='advanced-mission-1'||p.baseRevision!==s.revision)throw Error('지도 버전이 달라졌습니다. 초안은 유지됩니다. 현재 임무를 불러오거나 baseRevision을 갱신해 검증하세요.');
 if(typeof p.robotId!=='string'||!s.robots.some(r=>r.id===p.robotId)||!['holonomic','car'].includes(p.driveModel)||!Number.isFinite(p.turnRadius)||p.turnRadius<.3||p.turnRadius>3||!['charge','stay'].includes(p.completion)||!object(p.goal)||!only(p.goal,['x','y','floor'])||![p.goal.x,p.goal.y].every(Number.isFinite)||!Number.isInteger(p.goal.floor)||p.goal.floor<1||p.goal.floor>s.floors||!Array.isArray(p.waypoints)||p.waypoints.length>40||!p.waypoints.every(point))throw Error('기체 ID·운동 모델·회전 반경·목표·경유지·완료 행동을 확인하세요. 경유지는 최대 40개입니다.');
 const next=structuredClone(s),r=next.robots.find(r=>r.id===p.robotId)!;delete r.experiment;r.model=p.driveModel;r.minRadius=p.turnRadius;r.goal={x:p.goal.x,y:p.goal.y};r.goalFloor=p.goal.floor;r.waypoints=structuredClone(p.waypoints);r.after=p.completion;r.mission='navigate';delete r.missionTargets;validateScene(next);return {scene:next,program:structuredClone(p)};
}
