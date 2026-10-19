# Astra 13 — 동적 기체 감지·우회 독립 검토 인수 기준

2026-10-14. 사전 설계/반례 체크리스트이며 구현 PASS 보고서가 아니다. 복사본 mechanic-hub의 현재 baseline만 읽었다. 제품 작성자는 Astra 14이며, 실제 독립 실행은 동결 후 진행한다. 원본·현재 배포 model simulator·원격 Git·클라우드·사용자 브라우저는 조작하지 않는다.

## 관찰한 baseline 위험 구조

- scene-runtime.ts의 stepSimulation은 다른 기체의 모든 실제 poses를 검사해 다음 위치가 0.49m 미만이면 `다른 기체 안전 대기`로 멈춘다. 현재 감지 관측 모델·우회 재계획 구현 증거는 없다.
- MissionRoute는 points 인덱스로 pickup/deliver/queue/charge/exit/liftStart/liftEnd/qrIndices/reservation.start/end를 표현한다. Runtime의 index/progress/actionDone/actionUntil도 같은 points에 의존한다. 단순 points.splice만 하면 잘못된 위치에서 집기·전달·충전·층 이동을 수행할 수 있다.
- safety는 순차적으로 pose를 갱신한다. 대칭 회피에서 두 기체가 같은 측면을 고르거나 계속 경로를 바꾸는 livelock, 배열 순서 의존 가능성을 별도 검사해야 한다.
- scene-local.ts는 미래 gate/park/queue 예약을 계획 장애물로 넣는다. 동적 detour가 이를 무시하면 이전에 해결한 주차/통로 교착이 재발할 수 있다.
- front-projection.ts의 projectFront는 동일 장면을 pinhole로 투영하고 far→near 정렬한다. 이는 실제 시선 가림 검사나 검출기가 아니므로 반환 목록을 곧바로 카메라 감지 목록으로 사용하면 벽 뒤 기체를 감지했다고 잘못 표시할 수 있다.
- scene.worker.ts는 원래 Scene 계획과 최대 600초 사전 모의를 수행한다. 런타임 routes가 변경된다면 Worker와 live 런타임의 상태 공유/복제 경계, sequence 및 sceneRevision stale 보호를 명시해야 한다.

## 우선순위 P0 — 통과해야 하는 동작

| ID | 반례/시험 조건 | 통과 기준 |
|---|---|---|
| D01 실제 우회 | 넓은 열린 공간에서 목표 직선 위에 다른 기체를 정지시키고, 감지 전/후 관측·경로·pose 기록 | 감지 event 후 실제 경로 형상 또는 활성 경로가 변경되고, 정지 기체가 비킬 때까지 기다리지 않고 측면을 돌아 원래 목표를 방문. 목표 방문과 전체 임무 완료를 분리해 검증 |
| D02 안전 대기와 구분 | 통과 불가능한 좁은 통로와 가능한 넓은 통로를 동일 장애 배치로 비교 | 좁은 통로는 이유 있는 안전 대기/제한 실패, 넓은 통로는 실우회. 상태 문구/카운터 증가만으로 우회 PASS 금지 |
| D03 감지 범위 | 다른 기체가 전방 FOV 안/밖, range 안/밖, 뒤쪽, 다른 층, 경계 바로 안팎 | 명시된 관측 조건에 맞는 ID만 감지. 전역 진실 기반 안전 정지는 별도 상태로 설명. 숨은 진실을 camera detection으로 승격하지 않음 |
| D04 가림 | 같은 전방 ray에서 wall/rack 뒤 완전 가림, 부분 가림, 장애물 끝으로 진입 | 완전 가림은 미검출, 공개된 부분 가림 규칙대로 처리. 카메라 투영 목록이 있다는 이유로 검출하지 않음. 평면 모델이 물체 높이를 고려하지 않으면 그 제한 명시 |
| D05 이동 지속성 | 경로 segment 중간(progress>0)에서 replan; car 직선/원호 각각 | 새 경로 시작이 현재 x/y/yaw/floor와 일치. pose/battery/time/payload 초기화 없음. 매 tick 이동≤speed*dt, 회전≤speed*dt/minRadius, 정지회전·후진·횡이동 없음 |
| D06 접합 연속성 | 우회 route가 기존 route의 중간에 재합류 | 양 끝 position/heading 연속, car 곡률 준수. 단순 endpoint 좌표 연결로 꺾이거나 원호를 직선으로 건너뛰지 않음. 새 직선·원호 전체 물리 여유 검사 |
| D07 임무 이벤트 정합 | pickup 전/운반 중/deliver 후/queue 전/charge 후에서 각각 재계획 유발 | 대상 ID·순서·횟수 유지. 집기·전달·충전 이벤트는 정확한 해당 지점에서 1회. actionDone/actionUntil와 변경 인덱스 정합. 운반 중 같은 poses 소유권 유지 |
| D08 층·QR 정합 | QR 접근 또는 lift 전후 경로에 우회 발생 | QR/lift 인덱스 및 층 transition 유지. 동일 x/y의 명시적 lift 단계 이외 층 teleport 없음. 다른 층 장애기체 미회피 |
| D09 예약 상호배제 | 통로/충전 대기·진입·충전·이탈 중 교차 기체 발생 | lock/charger 단일 owner, 비소유 기체 접근 억제, owner의 전진 이탈 여유 유지. detour 후 stale owner/유실/무조건 해제 없음. 종료·reset·기체 삭제 cleanup |
| D10 2대 대칭 수렴 | 열린 공간의 정면 마주보기, 같은 목표 방향 추월, 수직 교차; route 배열 양 순서 | 결정된 우선/양보 정책으로 안전하게 수렴. 프레임마다 양쪽이 같은 측면으로 바꾸는 oscillation 없음. 가능한 fixture는 목표 도달/완료 |
| D11 4대 수렴 | 4방향 교차 및 충전소로 모이는 4대, 희소 ID/순서 역전 | 최소 간격 및 전원 목표/임무 완료를 제한 시간 내 확인. 완전 무교착 보장 대신 테스트한 feasible 입력과 실패 조건 기록 |
| D12 실제 충돌 안전 | 최대 속도 및 irregular dt에서 두 기체가 교차; 장애기체가 관측 범위 밖에서 접근 | 감지 누락이 실제 충돌 허용으로 이어지지 않음. 연속 이동 구간/closest approach도 확인해 tick endpoint만 안전한 사이 관통 배제. omniscient safety guard는 센서 감지와 별도 표시 |
| D13 실패 원자성 | 탐색 실패·한도 도달·예외·stale worker 응답 | 실패한 부분 route/인덱스를 적용하지 않음. 계속 이동할 수 없는 구간은 안전 정지하고 이유 표시. 오래된 결과로 새 Scene/기체/층/임무를 덮지 않음 |
| D14 계산 한도 | 장애물 100개·기체 4대, 반복 감지/가림 변동, 경로 없는 입력 | 재시도 빈도·탐색 expansion/시간·총 retry 상한 또는 backoff 명시. 실패 시 매 frame 무거운 동기 탐색 금지. 최악 입력에서도 취소/편집/UI 이벤트 처리 가능. 측정 wall time과 호출 수 기록 |

## 관측 수명과 ghost 기준

- observation별 source ID, sensed/lastSeen time, pose/floor, 유효기간 또는 invalidation 이유를 검증 가능하게 한다. 설정 수치는 구현자가 정하되 테스트와 UI 설명에서 일치시킨다.
- 관측된 기체가 움직였을 때 이전 위치와 새 위치를 중복 물체로 누적하지 않는다. 삭제·다른 층 이동·reset·Scene 교체·새 run 후 낡은 관측과 replan 결과가 남지 않는다.
- TTL 만료는 관측 캐시 정리다. 원래 Scene의 실제 solid 객체를 삭제하거나 실제 점유 공간의 충돌 검사를 해제하는 근거가 되어서는 안 된다.
- 시야 밖으로 사라진 기체는 즉시 사라진 사실을 안다고 주장할 수 없다. 마지막 관측을 TTL 동안 보수적으로 유지하는지, free-space 재관측으로 해제하는지 정책을 명시한다.
- time 기준(simTime 또는 monotonic wall time)을 하나로 정한다. pause/resume 및 dt 변동에서 의도대로 만료되고 NaN/음수/거꾸로 간 time에 안전해야 한다.
- 시야 안에서 blocker가 없어졌을 때 재시도/재계획으로 막힘이 풀리는 사례를 확인한다. TTL만 줄여 충돌할 수 있게 만들거나 ghost가 영구 남아 완료 불가인 구현은 거부한다.
- 이번 범위는 웹 가상 기체 관측/TTL이다. 실제 카메라/YOLO/ROS LiDAR/하드웨어 센서 ghost 해결 완료로 표현하지 않는다.

## 증거 형식 및 baseline 회귀

최소 재현 fixture에는 Scene, 초기 pose 및 의도적 장애기체 상태, speed/dt, seed가 필요한 경우 seed, 관측/재계획 event, route 변경 전후, 원래 목표 통과 시각, 최종 pose/임무 phase, min separation, replan count, 탐색 비용, 종료/오류 이유를 남긴다. 디버그 정보가 실제 UI 주기와 다른 mock 전용 경로를 실행하지 않도록 한다.

기본 1~4대/희소 ID/기체 추가삭제, 단일 lock 생략, 편집 rev149, car 반경 0.3/0.65/1.0, helmet 특수 ID/중복/삭제, vibe 부정문과 export, Worker 오류 routes 제거를 동결 후 관련 범위에서 다시 확인한다. 모든 종전 검사를 무작정 반복하기보다 변경된 상태 경로와 인덱스 회귀를 우선한다.

구현 전 체크리스트 전달만 완료했다. 아직 동적 기능 실행·성능·완료를 검증하지 않았으며 PASS/BLOCK 판정은 freeze 이후에 작성한다. 배포 여부는 로컬 독립 검토 이후 사용자가 별도로 결정한다.
