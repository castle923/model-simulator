import {validateScene,type Entity,type Robot,type Scene} from './scene-local.ts';

export type MissionCode={schema:1;baseRevision:number;robotId:string;action:'deliver_helmet';helmetId:string;workerId:string;after:'goal_then_charge';basis:'user_instruction'};
export function deliveryTargets(s:Scene,r:Robot){
 const choose=(kind:'helmet'|'worker',id:string|undefined)=>{const list=s.entities.filter(e=>e.kind===kind&&(e.floor===0||e.floor===r.floor));const e=id?s.entities.find(e=>e.id===id):list.length===1?list[0]:undefined;if(!e||e.kind!==kind)throw Error(`${r.id}: ${kind==='helmet'?'안전모':'작업자'} 대상이 없거나 여러 개입니다. 바이브 임무에서 ID를 선택하세요.`);if(e.floor!==0&&e.floor!==r.floor)throw Error(`${r.id}: 전달 대상과 기체의 출발 층이 다릅니다.`);return e;};
 return {helmet:choose('helmet',r.missionTargets?.helmetId),worker:choose('worker',r.missionTargets?.workerId)};
}
export function validateMissionCode(s:Scene,raw:unknown):MissionCode{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('임무 코드는 JSON 객체여야 합니다.');
 const c=raw as MissionCode;const keys=['schema','baseRevision','robotId','action','helmetId','workerId','after','basis'];
 if(Object.keys(c).length!==keys.length||Object.keys(c).some(k=>!keys.includes(k))||c.schema!==1||!Number.isInteger(c.baseRevision)||c.action!=='deliver_helmet'||c.after!=='goal_then_charge'||c.basis!=='user_instruction'||[c.robotId,c.helmetId,c.workerId].some(v=>typeof v!=='string'||!v))throw Error('지원하는 구조화 임무 코드 형식이 아닙니다. 임의 프로그램은 실행하지 않습니다.');
 if(c.baseRevision!==s.revision)throw Error('지도가 변경되었습니다. 자연어 코드를 다시 생성하거나 baseRevision을 현재 지도 버전으로 고친 후 검증하세요.');
 const r=s.robots.find(r=>r.id===c.robotId);if(!r)throw Error('적용 기체가 삭제되었거나 존재하지 않습니다.');
 deliveryTargets(s,{...r,missionTargets:{helmetId:c.helmetId,workerId:c.workerId}});return structuredClone(c);
}
export function parseMission(s:Scene,text:string,robotId:string,helmetChoice='',workerChoice=''):MissionCode{
 // This is a bounded command grammar, not general Korean intent understanding.
 // Scope negation to actions: "착용하지 않은 작업자" describes the target.
 const compact=text.normalize('NFKC').replace(/\s+/g,'');
 const action='(?:전달|배달|픽업|집기|집어|수행|실행)';
 const modifiers='(?:(?:을|를|은|는|도|만)|절대로?|아예|아직|지금|굳이|다시는)*';
 const negativeAction=new RegExp(`(?:안|못)${action}|${action}${modifiers}(?:하|해)?(?:지(?:는|도|만)?(?:마|말|않|못)|안|못|않|말고|말아|말라|말자|마세요|마라)`);
 if(/취소|금지|중단/.test(compact)||negativeAction.test(compact))throw Error('부정·취소 명령은 이 임무 생성기에서 지원하지 않습니다. 수행할 전달 명령 하나만 작성하세요.');
 // Require one explicit affirmative delivery at the end. Merely mentioning
 // delivery, a question, or an unsupported negative inflection cannot opt in.
 if(!/안전모/.test(compact)||(compact.match(/전달|배달/g)??[]).length!==1||!/(?:전달|배달)(?:해줘|해주세요|해주십시오|해|하라|하세요|하자)[.!。]*$/.test(compact))throw Error('지원하는 긍정 전달 명령 하나로 끝내세요. 예: 안전모를 작업자에게 전달해줘. 일반 자연어 전체를 해석하지 않으며 생성 후 대상 미리보기를 확인해야 합니다.');
 const robotNumbers=[...new Set((text.match(/\bR\d+\b/gi)??[]).map(v=>v.toUpperCase()))];if(robotNumbers.some(id=>!s.robots.some(r=>r.id===id))||robotNumbers.length>1||(robotNumbers.length===1&&robotNumbers[0]!==robotId))throw Error('문장의 기체 ID가 없거나 적용 기체 선택과 다릅니다. 한 기체만 지정하세요.');
 const r=s.robots.find(r=>r.id===robotId);if(!r)throw Error('먼저 적용 기체를 선택하세요.');
 const choose=(kind:'worker'|'helmet',choice:string)=>{const list=s.entities.filter(e=>e.kind===kind);const word=kind==='worker'?'작업자':'안전모';const numbers=[...new Set([...text.matchAll(new RegExp(word+'\\s*(\\d+)\\s*번','g'))].map(m=>Number(m[1])))];if(numbers.length>1)throw Error(`${word} 번호가 여러 개입니다. 한 기체에 한 전달 대상만 지정하세요.`);const number=text.match(new RegExp(word+'\\s*(\\d+)\\s*번'));let e:Entity|undefined;
  if(number){e=list[Number(number[1])-1];if(!e)throw Error(`${word} ${number[1]}번을 찾거나 구분할 수 없습니다. 객체 목록의 번호와 이름을 확인하세요.`);if(choice&&choice!==e.id)throw Error(`문장의 ${word} 번호와 직접 선택한 대상이 다릅니다. 문장 또는 선택을 맞추세요.`);}else e=choice?list.find(e=>e.id===choice):list.length===1?list[0]:undefined;
  if(!e)throw Error(`${word} 대상이 없거나 여러 개입니다. 대상을 추가하거나 아래 목록에서 선택하세요.`);return e.id;};
 return validateMissionCode(s,{schema:1,baseRevision:s.revision,robotId,action:'deliver_helmet',helmetId:choose('helmet',helmetChoice),workerId:choose('worker',workerChoice),after:'goal_then_charge',basis:'user_instruction'});
}
export function applyMission(s:Scene,raw:unknown):Scene{const c=validateMissionCode(s,raw);return validateScene({...structuredClone(s),revision:s.revision+1,robots:s.robots.map(r=>r.id===c.robotId?{...structuredClone(r),experiment:undefined,model:r.experiment?.originalModel??r.model,mission:'helmet',after:'charge',missionTargets:{helmetId:c.helmetId,workerId:c.workerId}}:structuredClone(r))});}
