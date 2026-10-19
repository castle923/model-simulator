import assert from 'node:assert/strict';
import {build} from 'esbuild';
// Isolated lightweight hook harness: no browser, device, permission or network access.
const result=await build({entryPoints:['app/CameraSourcePanel.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'fake-react',setup(b){b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},a=>({path:a.path,namespace:'fake-react'}));b.onLoad({filter:/.*/,namespace:'fake-react'},a=>({contents:a.path==='react'?'export const useState=(...a)=>globalThis.__cameraHooks.useState(...a);export const useRef=(...a)=>globalThis.__cameraHooks.useRef(...a);export const useEffect=(...a)=>globalThis.__cameraHooks.useEffect(...a);export const useLayoutEffect=(...a)=>globalThis.__cameraHooks.useLayoutEffect(...a);':'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;'}));}}]});
const {default:Panel}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const slots=[];let cursor=0,effects=[],tree;
globalThis.__cameraHooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
globalThis.__cameraHooks.useLayoutEffect=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){const task=()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};};task.layout=true;effects.push(task);}};
const tracks=[{stopped:0,onended:null,stop(){this.stopped++;},getSettings:()=>({width:640,height:480,frameRate:30})}];const fakeStream={getTracks:()=>tracks,getVideoTracks:()=>tracks};let acquisitions=0;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{acquisitions++;return fakeStream;},enumerateDevices:async()=>{throw Error('device enumeration unavailable');}}}});
const fakeVideo={srcObject:null,play:async()=>{}};
function nodes(n){return n==null?[]:Array.isArray(n)?n.flatMap(nodes):typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function text(n){return n==null?'':Array.isArray(n)?n.map(text).join(''):typeof n==='object'?text(n.props?.children):String(n);}
const props={context:'Free Space',robotId:'R1',camera:{id:'front',label:'front',enabled:true,width:640,height:480},active:true};
function render(){cursor=0;effects=[];tree=Panel(props);for(const n of nodes(tree))if(n.type==='video'&&n.props.ref)n.props.ref.current=fakeVideo;const run=effects.sort((a,b)=>Number(!!b.layout)-Number(!!a.layout));effects=[];run.forEach(fn=>fn());}
render();render();assert.equal(acquisitions,0,'mount must not acquire camera');nodes(tree).find(n=>n.type==='button'&&text(n).includes('웹캠 연결')&&!text(n).includes('종료')).props.onClick();for(let i=0;i<12;i++)await Promise.resolve();render();
assert.equal(acquisitions,1,"connect after first mount must initialize selected target before acquisition");
const video=nodes(tree).find(n=>n.type==='video'),disconnect=nodes(tree).find(n=>n.type==='button'&&text(n).includes('연결 종료'));
assert.ok(tracks.every(t=>t.stopped>0)||(!video.props.hidden&&!disconnect.props.disabled),'enumeration failure must either stop tracks or keep live video visible and disconnect enabled');
if(!disconnect.props.disabled){disconnect.props.onClick();render();}assert.ok(tracks.every(t=>t.stopped>0));
console.log(JSON.stringify({ok:true,cases:['mount never requests physical camera','device enumeration failure cannot hide live stream while disabling disconnect','explicit disconnect stops tracks'],limitation:'React hook and MediaStream mocks, no real webcam or browser'},null,2));




