import assert from 'node:assert/strict';
import {initialScene,validateScene} from '../../lib/scene-local.ts';
import {defaultCustomization,validateCustomization,robotRadius,cameraPose} from '../../lib/robot-customization.ts';
import {seed,stepSimulation} from '../../lib/scene-runtime.ts';
import {senseRobots} from '../../lib/scene-sensor.ts';
import {createIndustrialWorld,applyIndustrialCustomizations} from '../../lib/industrial-runtime.ts';
import {drawCustomizedRobot} from '../../app/robot-custom-drawing.ts';

const cases=[];
function check(name,fn){fn();cases.push(name);}
check('validator rejects malformed nested counts and names',()=>{
 for(const mutate of [c=>c.cameras=Array.from({length:5},(_,i)=>({...c.cameras[0],id:'c'+i})),c=>c.manipulators=[null],c=>c.cameras[0].range=Infinity,c=>c.cameras[0].height=120.5,c=>c.schema=2,c=>c.label='bad\u0000',c=>c.cameras[0].id='__proto__.x']){const c=defaultCustomization();mutate(c);assert.throws(()=>validateCustomization(c));}
});
check('new body shapes preserve schema1 compatibility and preset roundtrip',()=>{
 for(const kind of ['turtlebot-burger','turtlebot-waffle','round-amr']){const c=defaultCustomization(kind);assert.deepEqual(validateCustomization(JSON.parse(JSON.stringify(c))),c);assert.ok(robotRadius({customization:c})>=Math.max(c.length,c.width)/2);}
 const legacy=defaultCustomization();delete legacy.bodyShape;assert.deepEqual(validateCustomization(legacy),legacy);const bad=structuredClone(legacy);bad.bodyShape='triangle';assert.throws(()=>validateCustomization(bad));assert.equal(defaultCustomization('turtlebot-burger').cameras.length,0);assert.equal(defaultCustomization('round-amr').bodyShape,'ellipse');
});
check('industrial multi-target invalid tail is atomic and config is detached',()=>{
 const w=createIndustrialWorld(),before=JSON.stringify(w),c=defaultCustomization();assert.equal(applyIndustrialCustomizations(w,{R1:c,R5:c}).ok,false);assert.equal(JSON.stringify(w),before);assert.equal(applyIndustrialCustomizations(w,{R1:c}).ok,true);c.maxSpeed=2;assert.equal(w.robots[0].customization.maxSpeed,.16);
});
check('lift landing respects heterogeneous footprints',()=>{
 const s=initialScene();s.floors=2;s.entities=s.entities.filter(e=>!e.blocking);const c=defaultCustomization('amr');c.length=.9;c.width=.7;c.cameras=[];s.robots.forEach(r=>r.customization=structuredClone(c));Object.assign(s.robots[0],{x:3,y:3,floor:1});Object.assign(s.robots[1],{x:3.8,y:3,floor:2});const p=seed(s);p.R1.liftUntil=1;const route={id:'R1',points:[{x:3,y:3,yaw:0,floor:1},{x:3,y:3,yaw:0,floor:2}],pickup:-1,deliver:-1,queue:99,charge:100,exit:101,qrIndices:[],liftStart:0,liftEnd:1};stepSimulation(s,[route],.05,.3,p,new Map(),{current:'R1'},2);assert.equal(p.R1.floor,1,'must wait while destination floor body is within combined radii');assert.match(p.R1.phase,/대기/);
});
check('protruding camera envelope is included in scene validation',()=>{
 const s=initialScene();s.entities=s.entities.filter(e=>!e.blocking);s.robots=[s.robots[0]];const r=s.robots[0];r.x=.3;r.y=2;r.goal={x:4,y:2};r.customization=defaultCustomization();r.customization.cameras[0].x=-1.5;assert.ok(robotRadius(r)>=1.5);assert.throws(()=>validateScene(s));
 const large=defaultCustomization();large.length=2;large.width=1.5;large.cameras[0].x=1.5;const lensExtent=1.5+large.length*.05+Math.min(large.length,large.width)*.05;assert.ok(robotRadius({customization:large})>=lensExtent,'largest-body camera lens must fit inside conservative envelope');
});
check('camera union sees front and rear, disabled views clear after reset',()=>{
 const s=initialScene();s.entities=s.entities.filter(e=>!e.blocking);s.robots.push({...structuredClone(s.robots[1]),id:'R3'});Object.assign(s.robots[0],{x:3,y:3,yaw:0});Object.assign(s.robots[1],{x:4,y:3});Object.assign(s.robots[2],{x:2,y:3});const c=defaultCustomization();c.cameras[0].x=0;c.cameras.push({...c.cameras[0],id:'rear',yawDeg:180});s.robots[0].customization=c;assert.deepEqual(senseRobots(s,'R1',seed(s),1).observed,['R2','R3']);c.cameras.forEach(cam=>cam.enabled=false);assert.deepEqual(senseRobots(s,'R1',seed(s),2).observed,[]);assert.equal(cameraPose(s.robots[0],s.robots[0]),null);
});
check('drawing geometry scales identically in meter and pixel callers',()=>{
 function capture(c,scale){const calls=[];const ctx=new Proxy({},{get:(target,key)=>target[key]??((...args)=>{if(['arc','ellipse','rect','fillRect','strokeRect','moveTo','lineTo','translate'].includes(key))calls.push([key,...args]);}),set:(target,key,value)=>{if(key==='lineWidth')calls.push([key,value]);target[key]=value;return true;}});drawCustomizedRobot(ctx,{x:-c.length*scale/2,y:-c.width*scale/2,width:c.length*scale,height:c.width*scale},c,'#fff',true);return calls;}
 for(const kind of ['raspbot','tracked','forklift','turtlebot-burger','turtlebot-waffle','round-amr'])for(const bodyShape of ['rectangle','ellipse']){const c=defaultCustomization(kind);c.bodyShape=bodyShape;c.manipulators=[{id:'a',label:'arm',side:'left',reach:.15,payloadKg:1,stowed:false,enabled:true,joints:[]}];const a=capture(c,1),b=capture(c,100);assert.equal(a.length,b.length);if(bodyShape==='ellipse')assert.ok(a.some(row=>row[0]==='ellipse'));a.forEach((row,i)=>{assert.equal(row[0],b[i][0]);const end=row[0]==='arc'?4:row[0]==='ellipse'?5:row.length;for(let j=1;j<end;j++)assert.ok(Math.abs(row[j]*100-b[i][j])<1e-8,`${kind} ${bodyShape} ${row[0]} argument ${j} is not scale invariant`);});}
});
console.log(JSON.stringify({ok:true,cases},null,2));
