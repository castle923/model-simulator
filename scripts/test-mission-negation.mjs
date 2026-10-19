import assert from 'node:assert/strict';
import {initialScene} from '../lib/scene-local.ts';
import {parseMission,applyMission} from '../lib/vibe-mission.ts';
const s=initialScene();s.entities.push({id:'h',kind:'helmet',name:'안전모',x:2,y:1,w:.3,h:.3,floor:1,blocking:true},{id:'w',kind:'worker',name:'작업자',x:7,y:1,w:.3,h:.3,floor:1,blocking:true});
const snapshot=JSON.stringify(s);
const negative=[
 '안전모를 작업자에게 배달 안 해줘', '안전모를 작업자에게 전달하지는 마',
 ...['전달','배달'].flatMap(verb=>[
  `안전모를 작업자에게 ${verb}하지 마`, `안전모를 작업자에게 ${verb}하지도 마`,
  `안전모를 작업자에게 ${verb}하지는 말아줘`, `안전모를 작업자에게 ${verb} 안 해`,
  `안전모를 작업자에게 안 ${verb}해줘`, `안전모를 작업자에게 ${verb}하지 않도록 해줘`,
  `안전모를 작업자에게 ${verb}를 하지 마`, `안전모를 작업자에게 ${verb}은 절대 하지 마`,
  `안전모를 작업자에게 ${verb} 말고 대기해`, `안전모를 작업자에게 ${verb}해주지 마`,
  `안전모를 작업자에게 ${verb} 취소`, `안전모를 작업자에게 ${verb} 금지`,
  `안전모를 작업자에게 ${verb} 중단`, `안전모를 작업자에게 못 ${verb}해줘`,
 ]),
 '안전모를 픽업하지는 말고 작업자에게 전달해줘',
 '안전모를 픽업하지도 마. 작업자에게 전달해줘',
 '안전모를 안 픽업하고 작업자에게 전달해줘',
 '안전모를 픽업은 절대 하지 말고 작업자에게 전달해줘',
 '안전모를 전달 말고 작업자에게 배달해줘',
 '안전모를 작업자에게 배달할 필요가 없어',
 '안전모를 작업자에게 전달할까?',
 '안전모를 작업자에게 전달해줘라는 명령을 실행하지 마',
];
for(const text of negative){let applied=false;assert.throws(()=>{const code=parseMission(s,text,'R1','h','w');applyMission(s,code);applied=true;},/부정|긍정/);assert.equal(applied,false,text);assert.equal(JSON.stringify(s),snapshot);}
console.log('PASS',negative.length,'negative/unsupported commands rejected before an applicable mission is generated');
const positive=[
 '안전모를 작업자에게 전달해줘', '안전모를 작업자에게 배달해줘',
 '안전모를 작업자에게 전달해 주세요.', '안전모를 작업자에게 배달해주십시오',
 '안전모를 착용하지 않은 작업자에게 전달해줘',
 '안전모를 착용하지는 않은 작업자에게 전달해줘',
 '안전모를 안 쓴 작업자에게 배달해줘',
 '작업자 1번이 안전모를 착용하지 않았으니 안전모를 픽업하여 보호장구를 착용하지 않은 작업자 1번에게 전달해줘',
];
for(const text of positive){const code=parseMission(s,text,'R1','h','w');assert.equal(code.action,'deliver_helmet');assert.equal(code.basis,'user_instruction');assert.equal(applyMission(s,code).robots[0].mission,'helmet');assert.equal(JSON.stringify(s),snapshot);}
console.log('PASS',positive.length,'affirmative commands including target PPE negation; source scene unchanged');
