import assert from 'node:assert/strict';
import {fitViewport,clampViewport,zoomAt,worldFromCanvas,focusViewport} from '../lib/map-viewport.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const scene=Object.freeze({width:10,height:6}),fit=fitViewport(scene);
assert.deepEqual(fit,{zoom:1,centerX:5,centerY:3});assert.deepEqual(worldFromCanvas(fit,scene,0,0),{x:0,y:0});assert.deepEqual(worldFromCanvas(fit,scene,1,1),{x:10,y:6});
assert.deepEqual(clampViewport({zoom:1,centerX:-10,centerY:90},scene),fit);
const zoomed=zoomAt(fit,scene,2,{u:.65,v:.4}),before=worldFromCanvas(fit,scene,.65,.4),after=worldFromCanvas(zoomed,scene,.65,.4);near(before.x,after.x);near(before.y,after.y);
const roundtrip=zoomAt(zoomed,scene,.5,{u:.65,v:.4});assert.deepEqual(roundtrip,fit);
for(const zoom of [-100,0,1,1.1,3,6,99,Infinity,NaN])for(const centerX of [-100,0,5,10,100,NaN])for(const centerY of [-100,0,3,6,100,NaN]){const view=clampViewport({zoom,centerX,centerY},scene);assert.ok(view.zoom>=1&&view.zoom<=6);const tl=worldFromCanvas(view,scene,0,0),br=worldFromCanvas(view,scene,1,1);assert.ok(tl.x>=-1e-9&&tl.y>=-1e-9&&br.x<=scene.width+1e-9&&br.y<=scene.height+1e-9);}
const edge=zoomAt(fit,scene,6,{u:0,v:0});assert.equal(edge.zoom,6);near(worldFromCanvas(edge,scene,0,0).x,0);near(worldFromCanvas(edge,scene,0,0).y,0);
const focused=focusViewport(fit,scene,8,4,4);assert.equal(focused.zoom,4);assert.deepEqual(worldFromCanvas(focused,scene,.5,.5),{x:8,y:4});const corner=focusViewport(fit,scene,10,6,6);assert.ok(corner.centerX<10&&corner.centerY<6);assert.deepEqual(focusViewport(fit,scene,0,0,1),fit);
assert.throws(()=>fitViewport({width:0,height:2}));assert.throws(()=>fitViewport({width:Infinity,height:2}));assert.throws(()=>zoomAt(fit,scene,0));assert.throws(()=>worldFromCanvas(fit,scene,NaN,1));assert.throws(()=>focusViewport(fit,scene,Infinity,0));
assert.deepEqual(scene,{width:10,height:6});assert.deepEqual(fit,{zoom:1,centerX:5,centerY:3});console.log('PASS map viewport fit, cursor anchor, edge clamp, 324 bound cases, focus, inverse coordinates, invalid input and immutability');

