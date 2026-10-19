import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialScene} from '../../lib/scene-local.ts';
import {seed} from '../../lib/scene-runtime.ts';
import {applyExperiment,experimentFor} from '../../lib/experiment-command.ts';
Error.stackTraceLimit=0;
const b=await build({entryPoints:['app/RobotCodeWorkspace.tsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'mock-hooks',setup(b){b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},a=>({path:a.path,namespace:'hooks'}));b.onLoad({filter:/.*/,namespace:'hooks'},a=>({contents:a.path==='react'?'export const useState=(...a)=>globalThis.__codeHooks.useState(...a);export const useEffect=(...a)=>globalThis.__codeHooks.useEffect(...a);export const useRef=(...a)=>globalThis.__codeHooks.useRef(...a);export const useId=()=>"mock-id";':'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";'}));}}]});
const {default:Panel}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const slots=[];let cursor=0,effects=[],tree,dirty=true,downloads=0,applied;
globalThis.document={createElement(){downloads++;return{click(){}};}};
globalThis.__codeHooks={useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],x=>{slots[i]=typeof x==='function'?x(slots[i]):x;dirty=true;}];},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((x,j)=>x!==slots[i][j])){slots[i]=deps;effects.push(fn);}}};
const s=initialScene(),forced=applyExperiment(s,experimentFor(s,'R1')).scene,props={scene:forced,selectedRobotId:'R1',poses:seed(forced),locked:false,onApply(next){applied=next;return{ok:true};}};
function nodes(n){return n==null?[]:Array.isArray(n)?n.flatMap(nodes):typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function text(n){return n==null?'':Array.isArray(n)?n.map(text).join(''):typeof n==='object'?text(n.props?.children):String(n);}
function render(){let count=0;do{dirty=false;cursor=0;effects=[];tree=Panel(props);effects.forEach(f=>f());assert.ok(++count<10);}while(dirty);}
function click(label){const n=nodes(tree).find(n=>n.type==='button'&&text(n)===label);assert.ok(n);n.props.onClick();render();}
render();assert.ok(text(tree).includes('강제 실험 모드 해제'));const command={schema:1,baseRevision:forced.revision,robotId:'R1',action:'navigate',goal:{x:8,y:3,floor:1},after:'stay',basis:'user_instruction'};nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:JSON.stringify(command)}});render();click('기체 코드 검증');assert.equal(nodes(tree).some(n=>n.props?.['aria-label']==='교육용 Python 주석 코드'),false,'force mode hides normal Python preview');click('선택 형식으로 코드 다운로드');assert.equal(downloads,0);assert.ok(text(tree).includes('강제 실험 중에는'));click('선택 기체에 코드 적용');assert.equal(applied.robots[0].experiment,undefined);assert.equal(applied.robots[0].model,s.robots[0].model);
console.log(JSON.stringify({ok:true,cases:['forced scene renders helpful refusal without crashing','normal Python preview hidden while forced','forced code download produces no file','ordinary validated code application exits force mode'],limitation:'React/document mocks only'},null,2));
