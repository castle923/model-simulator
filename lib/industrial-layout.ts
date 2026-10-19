import {NOMINAL_RASPBOT,type IndustrialWorld,type RobotProfile} from './industrial-model.ts';
import {poseClear} from './industrial-geometry.ts';
export function industrialLayout(profile:RobotProfile={...NOMINAL_RASPBOT}){
 const width=3,height=2,obstacles=[{id:'rack-n',label:'랙 북쪽',x:1.1,y:.16,w:.8,h:.72,kind:'rack'},{id:'rack-s',label:'랙 남쪽',x:1.1,y:1.12,w:.8,h:.72,kind:'rack'}];
 const stations:IndustrialWorld['stations']=[
  {id:'P1',label:'R1 주차',x:.48,y:.28,yaw:0,side:'W',kind:'parking'},
  {id:'P2',label:'R2 주차',x:2.52,y:1.72,yaw:Math.PI,side:'E',kind:'parking'},
  {id:'P3',label:'R3 주차',x:.48,y:1.72,yaw:0,side:'W',kind:'parking'},
  {id:'P4',label:'R4 주차',x:2.52,y:.28,yaw:Math.PI,side:'E',kind:'parking'},
  {id:'A',label:'작업장 A / P1',x:.48,y:.28,yaw:0,side:'W',kind:'work'},
  {id:'B',label:'작업장 B / P2',x:2.52,y:1.72,yaw:Math.PI,side:'E',kind:'work'},
  {id:'C',label:'작업장 C / P3',x:.48,y:1.72,yaw:0,side:'W',kind:'pickup'},
  {id:'D',label:'작업장 D / P4',x:2.52,y:.28,yaw:Math.PI,side:'E',kind:'delivery'},
  {id:'CHARGE',label:'공용 충전소',x:.3,y:1,yaw:Math.PI/2,side:'W',kind:'charger'},
 ];
 const waiting:IndustrialWorld['waiting']={W:{x:.72,y:.74,yaw:Math.PI/2},E:{x:2.28,y:1.26,yaw:-Math.PI/2}};
 const aisle:IndustrialWorld['aisle']={id:'AISLE-1',label:'한 대 전용 0.24m 통로',x:1.1,y:.88,w:.8,h:.24,qr:[{id:'QR-W',aisleId:'AISLE-1',direction:'W>E',x:.72,y:.84,yaw:Math.PI/2},{id:'QR-E',aisleId:'AISLE-1',direction:'E>W',x:2.28,y:1.16,yaw:-Math.PI/2}],stopLines:[{id:'STOP-W',label:'진입선 W',x:1.065,y:.88,w:.005,h:.24},{id:'STOP-E',label:'진입선 E',x:1.93,y:.88,w:.005,h:.24}]};
 const berths=[{id:'EXIT-W',label:'서쪽 출구 berth',x:.70,y:.88,w:.29,h:.24},{id:'EXIT-E',label:'동쪽 출구 berth',x:2.01,y:.88,w:.29,h:.24}];
 for(const p of [...stations,...Object.values(waiting)])if(!poseClear(p,profile,width,height,obstacles))throw Error('프로필 크기/여유가 소형 공장 정차 위치에 맞지 않습니다.');
 if(Math.max(profile.width,profile.loadWidth)+2*(profile.margin+.004)>.24)throw Error('적재 포함 폭과 여유가 0.24m 통로보다 큽니다.');
 return {width,height,obstacles,stations,waiting,aisle,berths};
}
