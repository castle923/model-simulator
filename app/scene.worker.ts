import {planScene,validateScene,PlanningError,type Scene} from '../lib/scene-local.ts';
// Only static mission feasibility gates Start. Dynamic encounters are sensed and
// resolved during execution; a fabricated 600 s schedule must not reject maps.
self.onmessage=(event:MessageEvent<{sequence:number;scene:Scene}>)=>{const {sequence,scene}=event.data;let stage='scene_validation';try{validateScene(scene);stage='route_planning';const routes=planScene(scene);self.postMessage({sequence,revision:scene.revision,routes});}catch(error){self.postMessage({sequence,revision:scene.revision,stage,error:(error as Error).message,diagnostic:error instanceof PlanningError?error.diagnostic:undefined});}};
