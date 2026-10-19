export const exampleCommand="출발 위치에서 안전모를 착용하지 않은 작업자에게 안전모를 잡아서 전달한 후 요청을 완료하면 충전소로 돌아가 대기를 해줘.";
export function compileMission(text:string){
 if(text.length>1500)throw new Error("명령은 1,500자 이하로 입력하세요.");
 if(!/안전모/.test(text)||!/(미착용|착용하지|안 쓴|쓰지 않은)/.test(text)||!/(전달|가져다|배달)/.test(text)||!/(충전소)/.test(text)||!/(대기|복귀|돌아)/.test(text))throw new Error("현재 지원 명령: 안전모 미착용 작업자에게 안전모 전달 후 충전소 복귀·대기. 예시를 참고하세요.");
 return {kind:"helmet-delivery" as const,code:`// 규칙 기반 명령 변환 · 2D 시뮬레이션 전용
// 집기·전달은 상태 전환이며 실제 로봇 명령이 아닙니다.
const mission = {
  start: "configured_start",
  object: { kind: "helmet" },
  recipient: { kind: "worker", helmetWorn: false },
  steps: ["move_to_helmet", "pickup_symbolic",
          "move_to_worker", "deliver_symbolic",
          "return_to_station", "wait"],
  finish: "configured_station"
};
simulator.execute(mission);`};
}
