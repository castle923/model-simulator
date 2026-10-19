import assert from 'node:assert/strict';
import {initialScene} from '../../lib/scene-local.ts';
import {parseExperiment,applyExperiment,experimentFor} from '../../lib/experiment-command.ts';
import {applyAdvancedMission,missionFor} from '../../lib/advanced-mission.ts';
const s=initialScene();s.robots[0].model='car';const original=JSON.stringify(s);
for(const text of ['충돌을 허용하지 않고 목표로 이동해줘','충돌을 허용하지 말고 목표로 직진해줘','오류를 무시하지 말고 목표로 이동해줘','R10 충돌을 허용하고 목표로 직진해줘','R2 충돌을 허용하고 목표로 직진해줘'])assert.throws(()=>parseExperiment(s,text,'R1'),text+' must not become selected robot force instruction');
const cmd=parseExperiment(s,'R1 충돌을 허용하고 목표로 직진해줘','R1');assert.equal(cmd.mode,'force-direct');const forced=applyExperiment(s,cmd).scene;assert.equal(forced.robots[0].experiment.originalModel,'car');assert.equal(forced.robots[0].model,'holonomic');assert.equal(forced.robots[0].after,'stay');assert.deepEqual(forced.robots[1],s.robots[1]);assert.equal(JSON.stringify(s),original);
const normal=applyExperiment(forced,parseExperiment(forced,'R1 자동 회피를 다시 켜줘','R1')).scene;assert.equal(normal.robots[0].experiment,undefined);assert.equal(normal.robots[0].model,'car');
const advanced=missionFor(forced,'R1');assert.equal(advanced.driveModel,'car');const applied=applyAdvancedMission(forced,advanced).scene;assert.equal(applied.robots[0].experiment,undefined);assert.equal(applied.robots[0].model,'car');
for(const mutate of [x=>x.baseRevision++,x=>x.mode='anything',x=>x.goal.x=NaN,x=>x.goal.x=40,x=>x.robotId='R10',x=>x.extra=1,x=>x.goal.z=0]){const raw=structuredClone(cmd);mutate(raw);assert.throws(()=>applyExperiment(s,raw));assert.equal(JSON.stringify(s),original);}
const repeated=applyExperiment(forced,experimentFor(forced,'R1')).scene;assert.equal(repeated.robots[0].experiment.originalModel,'car');
console.log(JSON.stringify({ok:true,cases:['negative/mismatched/unsupported IDs cannot request forced run','explicit positive selected-only force and normal restoration','advanced normal mission clears force and restores model','repeated force retains original model','invalid JSON atomic rejection']},null,2));
