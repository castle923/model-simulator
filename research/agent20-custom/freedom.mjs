import assert from 'node:assert/strict';
import {initialScene,validateScene,addSceneRobot,planScene} from '../../lib/scene-local.ts';
import {defaultCustomization,robotRadius} from '../../lib/robot-customization.ts';
import {seed,stepSimulation} from '../../lib/scene-runtime.ts';
import {currentRobotProgram,applyRobotProgram} from '../../lib/robot-code-export.ts';
import {applyMission} from '../../lib/vibe-mission.ts';
const cases=[];
{
 const s=initialScene();s.width=2;s.height=2;s.entities=[{id:'charger',kind:'charger',name:'charger',x:1.2,y:1.2,w:.2,h:.2,floor:1,blocking:false}];s.robots=[{...s.robots[0],x:.3,y:.3,goal:{x:1.6,y:.3},waypoints:[],after:'stay'}];validateScene(s);for(const n of [1.99,30.01])assert.throws(()=>validateScene({...s,width:n}));validateScene({...s,width:30,height:30});s.robots[0].waypoints=Array.from({length:40},()=>({x:1,y:.3}));validateScene(s);s.robots[0].waypoints.push({x:1,y:.3});assert.throws(()=>validateScene(s));cases.push('2..30m bounds and 40-waypoint bound');
}
{
 let s=initialScene();s.width=12;s.height=10;s.entities=s.entities.filter(e=>!e.blocking);while(s.robots.length<8){const before=JSON.stringify(s),result=addSceneRobot(s,1);assert.equal(JSON.stringify(s),before);s=result.scene;validateScene(s);}assert.equal(new Set(s.robots.map(r=>r.id)).size,8);assert.ok(s.entities.filter(e=>e.kind==='queue').length>=8);assert.equal(new Set(s.entities.map(e=>e.id)).size,s.entities.length);const before=JSON.stringify(s);assert.throws(()=>addSceneRobot(s,1));assert.equal(JSON.stringify(s),before);cases.push('8 unique robot IDs and queues with atomic rejected ninth add');
}
{
 const s=initialScene(),base=s.robots[0];s.width=10;s.height=10;s.entities=[{id:'charger',kind:'charger',name:'charger',x:5,y:9,w:.3,h:.3,floor:1,blocking:false}];const kinds=['raspbot','amr','forklift','tracked','custom','turtlebot-burger','turtlebot-waffle','round-amr'];s.robots=kinds.map((kind,i)=>{const config=defaultCustomization(kind);config.length=.2+i*.005;config.width=.15;config.cameras=[];config.maxSpeed=.1+i*.025;return {...structuredClone(base),id:`R${i+1}`,x:1,y:1+i*.9,goal:{x:8,y:1+i*.9},waypoints:[],after:'stay',customization:config};});const routes=planScene(s),p=seed(s),locks=new Map(),lift={current:null};assert.ok(routes.every(r=>r.queue>r.points.length&&r.charge>r.points.length));let t=0;while(t<150&&!routes.every(r=>p[r.id].phase==='임무 완료')){t+=.025;stepSimulation(s,routes,.025,.35,p,locks,lift,t);assert.ok(!locks.has('__charger'));for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(Math.hypot(p[s.robots[i].id].x-p[s.robots[j].id].x,p[s.robots[i].id].y-p[s.robots[j].id].y)>=robotRadius(s.robots[i])+robotRadius(s.robots[j])+.049);}
 assert.ok(routes.every(r=>p[r.id].phase==='임무 완료'));for(const r of s.robots){assert.ok(Math.hypot(p[r.id].x-r.goal.x,p[r.id].y-r.goal.y)<1e-8);assert.ok(p[r.id].battery<100);const program=currentRobotProgram(s,r.id);assert.equal(program.after,'stay');const applied=applyRobotProgram(s,program,r.id);assert.equal(applied.robots.find(q=>q.id===r.id).after,'stay');}cases.push(`8 mixed kinds complete stay at goals without charging in ${t.toFixed(3)}s`);
}
{
 const s=initialScene();assert.equal(currentRobotProgram(s,'R1').after,'charge');const routes=planScene(s);assert.ok(routes.every(r=>r.charge<r.points.length));s.robots[0].after='stay';s.entities.push({id:'h-test',kind:'helmet',name:'helmet',x:6,y:2,w:.2,h:.2,floor:1,blocking:true},{id:'w-test',kind:'worker',name:'worker',x:7,y:2,w:.2,h:.2,floor:1,blocking:true});const code={schema:1,baseRevision:s.revision,robotId:'R1',action:'deliver_helmet',helmetId:'h-test',workerId:'w-test',after:'goal_then_charge',basis:'user_instruction'};const next=applyMission(s,code);assert.equal(next.robots[0].after,'charge');validateScene(next);assert.equal(currentRobotProgram(next,'R1').after,'goal_then_charge');cases.push('legacy default charges and stay-to-helmet resets completion policy');
}
console.log(JSON.stringify({ok:true,cases},null,2));
