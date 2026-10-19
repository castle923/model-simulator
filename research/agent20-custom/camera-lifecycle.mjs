import assert from 'node:assert/strict';
import {createCameraBindingController} from '../../lib/camera-binding.ts';
const cases=[];
function stream(name){const tracks=[{stopped:0,onended:null,stop(){this.stopped++;}},{stopped:0,onended:null,stop(){this.stopped++;}}];return {name,tracks,getTracks:()=>tracks};}
function fixture(){const pending=[],attached=[],statuses=[];const c=createCameraBindingController({acquire:constraints=>new Promise((resolve,reject)=>pending.push({resolve,reject,constraints})),attach:s=>attached.push(s),status:s=>statuses.push(s)});return {c,pending,attached,statuses};}
{
 const f=fixture();assert.equal(await f.c.connect({video:true}),false);assert.equal(f.pending.length,0);f.c.setTarget('scene/R1/front');assert.equal(f.pending.length,0);cases.push('no automatic acquisition from create/setTarget');
 const p=f.c.connect({audio:false,video:{deviceId:{exact:'usb-1'}}});assert.deepEqual(f.pending[0].constraints,{audio:false,video:{deviceId:{exact:'usb-1'}}});f.c.setTarget('industrial/R1/front');const old=stream('old');f.pending[0].resolve(old);assert.equal(await p,false);assert.ok(old.tracks.every(t=>t.stopped===1));assert.ok(!f.attached.includes(old));cases.push('cross-context target change discards and stops late permission stream');
}
{
 const f=fixture();f.c.setTarget('scene/R1/front');const one=f.c.connect({video:true}),two=f.c.connect({video:true}),s1=stream('first'),s2=stream('second');f.pending[1].resolve(s2);assert.equal(await two,true);f.pending[0].resolve(s1);assert.equal(await one,false);assert.equal(f.attached.at(-1),s2);assert.ok(s1.tracks.every(t=>t.stopped===1));assert.ok(s2.tracks.every(t=>!t.stopped));f.c.disconnect();assert.ok(s2.tracks.every(t=>t.stopped===1&&t.onended===null));assert.equal(f.attached.at(-1),null);cases.push('out-of-order double connect retains newest only and disconnect stops all tracks');
}
for(const action of ['disconnect','dispose']){
 const f=fixture();f.c.setTarget('scene/R1/front');const p=f.c.connect({video:true});f.c[action]();const count=f.statuses.length,s=stream(action);f.pending[0].resolve(s);assert.equal(await p,false);assert.ok(s.tracks.every(t=>t.stopped===1));assert.equal(f.statuses.length,count);assert.ok(!f.attached.includes(s));cases.push(`${action} invalidates pending acquisition without late status or video`);
}
{
 const f=fixture();f.c.setTarget('scene/R1/front');const p=f.c.connect({video:true}),s=stream('camera');f.pending[0].resolve(s);assert.equal(await p,true);s.tracks[0].onended();assert.ok(s.tracks.every(t=>t.stopped===1));assert.equal(f.statuses.at(-1).state,'idle');assert.equal(f.attached.at(-1),null);cases.push('device ending disconnects every stream track and clears video');
}
{
 const f=fixture();f.c.setTarget('scene/R1/front');const p=f.c.connect({video:true});f.pending[0].reject({name:'NotAllowedError'});assert.equal(await p,false);assert.equal(f.statuses.at(-1).state,'error');assert.match(f.statuses.at(-1).message,/권한/);const old=f.c.connect({video:true});f.c.setTarget('scene/R2/front');const count=f.statuses.length;f.pending[1].reject({name:'NotFoundError'});assert.equal(await old,false);assert.equal(f.statuses.length,count);cases.push('permission rejection is explicit and old-target failure cannot overwrite new status');
}
console.log(JSON.stringify({ok:true,cases,limitation:'fake MediaStream tests; no physical webcam acquisition or image quality verified'},null,2));
