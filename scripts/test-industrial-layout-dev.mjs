import {industrialLayout} from '../lib/industrial-layout.ts';
import {NOMINAL_RASPBOT} from '../lib/industrial-model.ts';
import {forwardPath,joinPaths,pathClear} from '../lib/industrial-geometry.ts';
const l=industrialLayout(),p=NOMINAL_RASPBOT;
for(const s of l.stations){const wait=l.waiting[s.side],to=forwardPath(s,wait,p,l.width,l.height,l.obstacles),exit={x:s.side==='W'?.84:2.16,y:1,yaw:s.side==='W'?Math.PI:0},from=forwardPath(exit,s,p,l.width,l.height,l.obstacles);console.log(s.id,'toWait',to?.length.toFixed(2),'fromExit',from?.length.toFixed(2));}
for(const side of ['W','E']){const start=l.waiting[side],exit={x:side==='W'?2.16:.84,y:1,yaw:side==='W'?0:Math.PI};const paths=[forwardPath(start,{x:side==='W'?.95:2.05,y:1,yaw:side==='W'?0:Math.PI},p,l.width,l.height,l.obstacles),forwardPath({x:side==='W'?.95:2.05,y:1,yaw:side==='W'?0:Math.PI},exit,p,l.width,l.height,l.obstacles)];console.log(side,'cross',paths.map(p=>p?.length.toFixed(2)));}
