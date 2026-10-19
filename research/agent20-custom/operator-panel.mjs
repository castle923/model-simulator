import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialScene} from '../../lib/scene-local.ts';
import {seed} from '../../lib/scene-runtime.ts';
Error.stackTraceLimit=0;
const b=await build({entryPoints:['app/OperatorExperimentWorkspace.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'mock-hooks',setup(b){b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},a=>({path:a.path,namespace:'hooks'}));b.onLoad({filter:/.*/,namespace:'hooks'},a=>({contents:a.path==='react'?'export const useState=(...a)=>globalThis.__operatorHooks.useState(...a);export const useEffect=(...a)=>globalThis.__operatorHooks.useEffect(...a);':'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;'}));}}]});
const {default:Panel}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const slots=[],store=new Map();let cursor=0,effects=[],tree,dirty=true,deny=false,calls=0;
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
globalThis.__operatorHooks={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],x=>{slots[i]=typeof x==='function'?x(slots[i]):x;dirty=true;}];},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((x,j)=>x!==slots[i][j])){slots[i]=deps;effects.push(fn);}}};
const props={scene:initialScene(),poses:{},locked:false,onApply(next){calls++;if(deny)return{ok:false,error:'review denied'};props.scene={...next,revision:next.revision+1};props.poses=seed(props.scene);return{ok:true};}};props.poses=seed(props.scene);
function nodes(n){return n==null?[]:Array.isArray(n)?n.flatMap(nodes):typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function text(n){return n==null?'':Array.isArray(n)?n.map(text).join(''):typeof n==='object'?text(n.props?.children):String(n);}
function render(){let count=0;do{dirty=false;cursor=0;effects=[];tree=Panel(props);effects.forEach(f=>f());assert.ok(++count<10);}while(dirty);}
function click(label){const n=nodes(tree).find(n=>n.type==='button'&&text(n)===label);assert.ok(n);n.props.onClick();render();}
render();assert.equal(calls,0);click('실험 명령 코드 생성');assert.equal(calls,0);click('선택 기체에 웹 실험 적용');assert.equal(props.scene.robots[0].experiment.mode,'force-direct');click('정상 회피 모드로 복귀');assert.equal(props.scene.robots[0].experiment,undefined);const attempts=JSON.parse(store.get('model-simulator-experiments-v1'));assert.equal(JSON.parse(attempts[0].command).mode,'normal','restoration history must record the actual normal command, not previous force JSON');
deny=true;click('실험 명령 코드 생성');click('선택 기체에 웹 실험 적용');assert.equal(props.scene.robots[0].experiment,undefined);assert.ok(text(tree).includes('review denied'));
console.log(JSON.stringify({ok:true,cases:['generating code never applies','explicit force and normal application','history records actual normal restoration command','false commit acknowledgement retained as failed attempt'],limitation:'React/localStorage mocks only'},null,2));
