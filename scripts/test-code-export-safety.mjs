import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {initialScene,validateScene} from '../lib/scene-local.ts';
import {currentRobotProgram,pythonForProgram,notebookForProgram,robotProgramBasename} from '../lib/robot-code-export.ts';
const base=currentRobotProgram(initialScene(),'R1'),dir=fileURLToPath(new URL('../../outputs/agent5/export-safety/',import.meta.url));mkdirSync(dir,{recursive:true});
const samples=['R1\nraise RuntimeError("HEADER_ONLY_AST_TEST")\n#','R1\rraise RuntimeError("CR_ONLY_AST_TEST")\r#','R1\u0085\u2028\u2029','coding: unicode_escape','../CON\\name\nfile'];
for(const [i,id] of samples.entries()){const p={...base,robotId:id},py=pythonForProgram(p,{phase:'任務\nraise RuntimeError("SNAPSHOT_AST_TEST")',robotId:id}),nb=notebookForProgram(p);writeFileSync(dir+'sample-'+i+'.py',py,'utf8');writeFileSync(dir+'sample-'+i+'.ipynb',JSON.stringify(nb),'utf8');assert.match(robotProgramBasename(id),/^[A-Za-z0-9_-]+$/);assert.ok(!py.split('\n').slice(0,2).join('\n').includes(id),'first two Python comments must be constant');}
const checked=spawnSync('python',['-c','import ast,json,pathlib,sys\np=pathlib.Path(sys.argv[1])\nfor f in p.glob("sample-*.py"):\n t=ast.parse(f.read_text(encoding="utf-8")); assert not any(isinstance(n,ast.Raise) for n in t.body), f.name\nfor f in p.glob("sample-*.ipynb"):\n d=json.loads(f.read_text(encoding="utf-8")); t=ast.parse("".join(d["cells"][1]["source"])); assert not any(isinstance(n,ast.Raise) for n in t.body), f.name\nprint("PASS untrusted labels remain comments/data; AST only, never executed")',dir],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);console.log(checked.stdout.trim());
for(const id of samples.filter(s=>/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(s))){const scene=initialScene();scene.robots[0].id=id;assert.throws(()=>validateScene(scene),/제어문자/);}console.log('PASS scene IDs with control characters rejected + safe filenames');
