import assert from 'node:assert/strict';
import {createCameraBindingController} from '../lib/camera-binding.ts';
const streams=[];function fake(){const track={stopped:false,onended:null,stop(){this.stopped=true;}};const s={track,getTracks:()=>[track]};streams.push(s);return s;}
let resolve,attached=null;const states=[];
const c=createCameraBindingController({acquire:()=>new Promise(r=>resolve=r),attach:s=>attached=s,status:s=>states.push(s)});
c.setTarget('scene:R1:front');const pending=c.connect({video:true});c.setTarget('industrial:R1:front');const stale=fake();resolve(stale);assert.equal(await pending,false);assert(stale.track.stopped);assert.equal(attached,null);
const next=c.connect({video:true});const live=fake();resolve(live);assert.equal(await next,true);assert.equal(attached,live);c.setTarget('industrial:R2:front');assert(live.track.stopped);assert.equal(attached,null);
const cancel=c.connect({video:true});c.disconnect();const late=fake();resolve(late);assert.equal(await cancel,false);assert(late.track.stopped);
const afterUnmount=c.connect({video:true});c.dispose();const unmounted=fake();resolve(unmounted);assert.equal(await afterUnmount,false);assert(unmounted.track.stopped);
const ended=createCameraBindingController({acquire:async()=>fake(),attach:s=>attached=s,status:s=>states.push(s)});ended.setTarget('scene:R3:rear');assert(await ended.connect({video:true}));const s=attached;s.track.onended();assert(s.track.stopped);assert.equal(attached,null);ended.dispose();
console.log('PASS camera target/context ownership, delayed permission race, disconnect, unmount, track-ended cleanup; no physical camera started');
