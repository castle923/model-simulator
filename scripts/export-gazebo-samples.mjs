import {mkdir,writeFile} from 'node:fs/promises';
import {factorySample} from '../lib/factory.ts';
import {gazeboWorld} from '../lib/gazebo.ts';
await mkdir('cpu-simulation-prep',{recursive:true});const robots=[{id:1,x:1.1,y:.7},{id:2,x:6.9,y:.7}];
await writeFile('cpu-simulation-prep/mechanic-factory.sdf',gazeboWorld(factorySample,robots));await writeFile('cpu-simulation-prep/mechanic-camera.sdf',gazeboWorld(factorySample,robots,true));
console.log('Generated physics-only and camera SDF samples');
