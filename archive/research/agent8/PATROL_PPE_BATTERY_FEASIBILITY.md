# 8번 — 자율순찰·PPE 전달·30% 충전 가능 여부 검토

조사일: 2026-10-14 KST. 조사·설계 브리핑이며 구현 결과가 아니다. 복사본의 보고서만 작성했다. 모델·자료 다운로드, 센서 실행, 코드·원본·DB·운영 사이트 변경 없음.

## 브리핑

요청한 **순찰 → 안전모 미착용 확인 → 안전모 확보·운반 → 작업자 보유 확인 → 순찰 재개 → 배터리 30% 이하 충전** 흐름은 웹 가상 시연과 ROS 2 기반 실물 시스템 모두 설계 가능하다. 그러나 현재 복사본에 이 전체 자동 순찰·PPE 인식·30% 충전 정책이 구현된 것은 아니다. 진행 중인 가상 운반·작업자 보유 표시를 실제 인식·잡기·착용 확인과 혼동하면 안 된다.

실물 구현은 학습된 PPE 분류, 깊이/위치 추정, 모터·팔 피드백, 전달 확인, 실측 배터리, 도킹 장치가 선행 조건이다. 실제 Raspbot V2의 encoder·배터리 API, 팔 종류·하중·reach, Pi5 동시 성능은 미확인이다. 기존 센서 조사 [SENSOR_TECH_REVIEW.md](./SENSOR_TECH_REVIEW.md) 조건을 따른다.

## 1. 단계별 가능 범위

| 단계 | 웹 가상 시연 | 실제 Pi5·Raspbot에 필요한 내용 | 판정 |
|---|---|---|---|
| 순찰 | 경유점 목록을 반복하고 순찰 index 저장 | Nav2 waypoint/navigation action, 위치 추정·장애물 센서·동적 재계획 | 가능, 통합 구현 필요 |
| PPE 미착용 감지 | 작업자 객체의 worn 상태로 이벤트 생성 | 사용자 데이터 기반 PPE detector/classifier, 머리-안전모 대응, 가림·역광 검증 | 기본 COCO 모델만으로는 부족 |
| 안전모 위치 파악 | 재고 객체 ID·좌표 참조 | 검출+depth/보정/TF, 실제 잡기 가능한 pose·재고 확인 | BBOX만으로 불가 |
| 재고·작업자 예약 | allocator가 helmetId/workerId/taskId를 원자적 예약 | 동일 이벤트 중복 병합·기체 선택·heartbeat·실물 점유 확인 | 다중 기체 필수 설계 |
| pickup | 가상 객체를 바닥→기체 적재 상태로 전환 | 팔 URDF/관절피드백/그리퍼/충돌 검사·잡힘 확인 | 실물 양팔 미정, 조건부 |
| 작업자에게 전달 | 기체 적재→작업자 보유 상태 전환 | 이동한 대상 재확인·정지 전달 위치·수령 증거·손 접촉 검토 | 보유와 착용을 분리 |
| 순찰 재개 | 중단 지점 또는 다음 경유점에서 재개 | 취소 완료 확인→새 임무→결과 판정→저장 context 복귀 | 가능, 단순 goToPose만으로 자동 아님 |
| 30% 충전 | 가상 battery<=30 조건·충전소 예약 | 실측 BatteryState·소모 추정·도킹/충전 확인 | 30%는 운영 정책, 귀환 보장 아님 |

기술 근거: [YOLOv8 공식](https://docs.ultralytics.com/models/yolov8/), [COCO 클래스](https://docs.ultralytics.com/datasets/detect/coco/), [Nav2 Jazzy Waypoint Follower](https://api.nav2.org/nav2-jazzy/html/md_nav2_waypoint_follower_README.html), [MoveIt Task Constructor](https://moveit.picknik.ai/main/doc/tutorials/pick_and_place_with_moveit_task_constructor/pick_and_place_with_moveit_task_constructor.html).

## 2. 인식·보유·착용을 구분해야 하는 이유

Ultralytics의 기본 COCO 80개 detection class에는 person은 있지만 산업용 안전모 착용/미착용 클래스는 없다. 강사 데이터에 `helmet/head/person/helmet_worn/no_helmet` 등 어떤 label이 있는지 확인하고, 데이터 구조에 맞는 검출·연관 규칙을 설계해야 한다. 표기된 클래스는 **제안 예**이며 반드시 모두 같은 모델의 클래스로 만들어야 한다는 뜻은 아니다. [COCO 공식 목록](https://docs.ultralytics.com/datasets/detect/coco/)

- 안전모를 손에 든 사람은 **보유=true, 착용=false**일 수 있다. 전달 완료로 착용=true를 자동 설정하면 안 된다.
- 전달 후 같은 사람에게 계속 중복 dispatch하지 않도록 `미착용·미보유 / 전달 중 / 보유·착용 대기 / 착용 확인 / 확인 불가` 상태를 분리한다.
- 보유 상태가 오랫동안 착용으로 바뀌지 않으면 추가 배달 대신 안내·재확인·팀원 알림 같은 정책을 정한다. 자동 산업 출입 승인으로 확대하지 않는다.
- tracking ID는 영상 내 추적 식별자다. 재진입·가림·카메라 전환에서 바뀔 수 있으며 실제 신원을 보장하지 않는다. `track_buffer`는 lost track을 유지하는 프레임 수이고 사람의 영구 ID나 장애물 안전 TTL이 아니다. [Ultralytics Tracking](https://docs.ultralytics.com/modes/track/)
- RGB BBOX는 픽셀 영역이며 metric 위치·집기 높이를 직접 주지 않는다. 깊이 센서/보정된 기하·TF가 필요하다. 미검출을 사람 사라짐 또는 공간 free로 간주하지 않는다. 관련 분석은 [GHOST_OBSTACLE_REVIEW.md](./GHOST_OBSTACLE_REVIEW.md).

## 3. 권장 임무 상태와 순찰 재개

제안 흐름: `PATROL → CONFIRM_PPE → RESERVE_TASK → RESERVE_HELMET → NAV_PICKUP → GRASP_VERIFY → REACQUIRE_PERSON → NAV_HANDOFF → HANDOFF_VERIFY → RESUME_PATROL`.

각 단계는 성공·실패·취소·timeout 결과가 있어야 한다. 임무 context에는 robotId, taskId, workerObservationId, helmetId, sceneRevision, lastSeenTime, patrolWaypointIndex, carriedItemId, retryCount를 기록한다. 이는 설계 제안이며 실제 코드·DB schema를 생성한 것이 아니다.

Nav2 Jazzy Simple Commander는 waypoint 이동, feedback/result 조회, `cancelTask()`를 제공한다. 순찰을 중단할 때 취소 요청만 보내고 바로 팔 임무를 시작하지 않고 취소·정지 완료를 확인해야 한다. 순찰 재개 위치도 저장한 context와 새 장애물 상황을 기준으로 다시 계획해야 한다. Nav2가 전체 PPE 업무를 자동 제공하는 것은 아니므로 상위 Behavior Tree 또는 명시적 상태기계가 필요하다. [Nav2 Jazzy Simple Commander](https://api.nav2.org/nav2-jazzy/html/md_nav2_simple_commander_README.html)

이동한 작업자를 마지막 관측 위치에서 기다린다고 가정하지 않는다. pickup 전후와 handoff 직전에 대상·보유 상태를 재확인하고, 오래된 관측은 제한된 재탐색 후 임무 보류로 전환한다. 사람을 무제한 추격하는 동작은 시연 요구에 포함시키지 않는 방향을 권한다.

## 4. 다중 기체 중복 방지·자원 소유권

| 자원 | 예약 키와 상태 제안 | 실패·복구 원칙 |
|---|---|---|
| 작업자 전달 | workerObservationId + PPE 필요 event의 taskId, 한 active owner | 추적 ID 변경만으로 새 배달 생성하지 않음. 재식별 불확실하면 확인 필요 |
| 안전모 재고 | helmetId: available→reserved→carried→workerHeld/returned/lost | 예약 만료가 물리적 반환을 뜻하지 않음. 이미 기체가 들고 있으면 확인 후 재배정 |
| 기체 | robotId: idle/patrol/busy/charging/fault | 이동거리만 아니라 배터리·팔·적재·장애 상태로 선택 |
| 통로·엘리베이터 | resourceId + owner + lease/heartbeat | 연결 끊김 때 자동 비었다고 처리하지 말고 현장 점유·대기 확인 |
| 충전소 | 단일 owner + 대기열 + staging pose | 충전 완료·안전 이탈을 확인한 후 다음 기체 진입 |

중앙 allocator 또는 분산 합의 가능한 owner가 한 임무·재고를 한 번만 배정해야 한다. command 재전송은 taskId 기반 idempotent 처리하고, abort/retry 때 예약과 실물 적재 상태를 함께 정리한다. 다른 기체의 카메라에서 같은 사람이 감지되는 경우 시간·좌표·연관 불확실성을 고려한 이벤트 병합이 필요하다. 웹 단일 상태에서는 가상 구현이 가능하지만, 실제 기체 간 공통 식별은 별도 검증 사항이다.

## 5. 배터리 30% 정책의 정확한 의미

사용자의 `battery <= 30%`는 정상 순찰을 중단하고 충전을 요청하는 기본 운영 조건으로 설계 가능하다. **30%까지 기다려도 충전소에 항상 도착한다는 뜻은 아니다.** 거리, 팔 구동, 적재 무게, 우회, 충전소 대기, 배터리 열화·추정 오차를 고려해야 한다.

ROS `sensor_msgs/BatteryState.percentage`는 **0~1**, 모르면 NaN이다. 따라서 화면의 30%는 메시지 기준 0.30이며 30을 그대로 넣으면 안 된다. 전압·전류·charging status도 별도로 있다. [ROS2 Jazzy BatteryState](https://raw.githubusercontent.com/ros2/common_interfaces/jazzy/sensor_msgs/msg/BatteryState.msg)

Nav2 Jazzy `IsBatteryLow`는 기본적으로 percentage, `is_voltage=true`일 때 전압을 검사한다. 문서는 ‘설정값보다 낮음’이라고 설명하므로 사용자가 요구한 **정확히 30.00%에서도 발동하는 <= 경계**는 선택한 plugin 버전 또는 상위 정책에서 별도 시험해야 한다. 상태값이 NaN·끊김·오래됨이면 정상 배터리로 간주하지 않는다. [Nav2 Jazzy IsBatteryLow](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/bt_plugins/conditions/IsBatteryLow/)

권장 정책은 `30% 충전 요청 OR 귀환·대기·도킹 예상 에너지 + reserve 부족`이다. 후자는 30%보다 높아도 조기 귀환을 허용한다. 충전 재개/종료 기준은 hysteresis를 둬 경계에서 순찰↔충전을 반복하지 않도록 한다. 예를 들어 재개 기준을 더 높은 별도 %로 두는 것은 가능하지만, 그 수치는 **팀 결정·실측 대상**이며 여기서 80/90/100% 등으로 임의 확정하지 않았다.

Nav2 Docking Framework는 staging pose, 접촉, charging 감지 등을 plugin으로 분리한다. 위치 도착만으로 실제 충전 성공을 처리하지 않고 전류/배터리 상태·도킹 피드백이 필요하다. [Nav2 Jazzy Docking API](https://api.nav2.org/nav2-jazzy/html/md_nav2_docking_README.html)

## 6. 예외와 우선순위

| 상황 | 권장 처리 |
|---|---|
| 재고 없음·모든 안전모 예약됨 | 재고 부족/대기 표시, 새 pickup 출발 금지. 기존 순찰 재개 여부는 운영 정책으로 결정 |
| 이미 안전모 보유 또는 착용 | 전달 요청 취소·중복 억제. carried 안전모는 반납/다른 미예약 임무로 명시적 재배정 |
| 두 기체가 같은 안전모/작업자 선택 | 예약 획득 성공한 한 기체만 수행. 다른 기체는 다른 작업 또는 순찰 |
| pickup 실패·낙하 | 성공 처리 금지. 제한 retry·낙하 위치/바닥 점유 갱신·운영자 확인 |
| 작업자가 이동·추적 소실 | 감속/대기·재확인. timeout 후 안전한 반납/보류, last seen 위치로 전달 완료 금지 |
| 전달 실패·수령 거부 | workerHeld로 전환하지 않고 carried 유지. retry 한도 후 반납/도움 요청 |
| 기체/allocator 연결 끊김 | 로컬 watchdog 정지, 임무 UNKNOWN. timeout만으로 적재물 available 전환 금지 |
| 순찰 중 <=30% | 순찰 context 저장·중단→충전 요청·대기열→도킹 |
| pickup 전 귀환 reserve 부족 | 임무 배정/집기 금지, 다른 기체 재배정 또는 충전 |
| 운반 중 30% 진입 | carry를 보존하고 안전 상태에서 preempt. 가까운 전달 완료/반납/충전 중 무엇이 feasible인지 에너지·팔 안정성으로 판단 |
| 충전소 점유 | 앞 staging queue로 이동 가능 에너지 확인. critical 기체 우선순위·기아 방지. 출구 점유 금지 |
| 충전소 경로 없음·도킹 실패·충전 전류 없음 | 충전 성공 금지. 제한 retry·reserve 유지·안전 대기·도움 요청 |
| 긴급 정지·센서/위치 유실 | PPE 전달·정상 충전보다 우선하는 보호 상태. 자동 추격·무작정 충전 이동 금지 |

전진 전용 차량형 기체라면 carry 상태·충전소 입출차·U턴까지 feasible해야 한다. 기존 reverse 경로를 그대로 사용하면 안 된다. ‘30% 발생 즉시 물체 삭제’ 또는 ‘모든 기체를 같은 충전소 좌표로 이동’은 부적합하다.

## 7. 단계별 도입과 통과 조건

1. **웹 상태 시연:** 작업자 PPE/보유와 안전모 재고·예약·기체 적재를 분리. 가상 순찰→전달→재개와 30% 충전을 구현하고 로그로 검증한다. 아직 본 보고서가 구현한 것은 아니다.
2. **녹화 데이터 인식:** 강사 자료 label 확인·훈련/검증 분리, 미착용·손보유·가림·다중 사람·재진입 오탐 시험. 모델 다운로드/학습은 이번 범위 밖이다.
3. **Gazebo/ROS 통합:** sensor+TF+clock+Nav2+상위 임무 manager, 가상 팔/도킹. 웹의 상태 전환과 엔진 action 결과를 일치시킨다.
4. **단일 실물:** Pi5 CPU 부하·지연·온도, LiDAR/깊이·odom·실측 배터리, 가벼운 모형·고정 전달 위치·실물 그리퍼 확인. 실물 미확인 사항을 먼저 해소한다.
5. **다중 실물:** 중복 감지·재고 경쟁·충전 대기열·통신 단절·재시작 복구·동적 작업자 위치 검증.

| Acceptance 시나리오 | 기대 결과 |
|---|---|
| 두 기체가 같은 미착용 작업자를 동시 발견 | active 전달 task 1개·helmet owner 1개 |
| 손보유 작업자와 착용 작업자, 손보유 후 착용 전환 | 보유/착용 구분·중복 배달 없음·재확인 상태 |
| 안전모 한 개/작업자 두 명 | 재고 초과 배정 없음·나머지 대기/부족 표시 |
| pickup 후 작업자 이동/실종 | 재확인·제한 retry·반납/보류, 잘못된 수령 완료 없음 |
| 임무 중단 후 순찰 복귀 | 저장 waypoint context 복구·현재 map에서 재계획 |
| 30.01 / 30.00 / 29.99% 경계 | 요구한 <=30 조건 일관 처리; 출력 소수점 반올림과 내부 판정 구분 |
| BatteryState NaN·stale·연결 단절 | 정상 배터리 오판 없음·진단/보호 상태 |
| 40%라도 먼 귀환·긴 대기 reserve 부족 | **시험 가정값**의 조기 귀환 조건 작동 |
| 운반 중 30%, 충전소 점유/실패 | item 소유 유지·preempt 정책·중복 진입 없음 |
| 도킹 좌표 도착했으나 전류 없음 | 실제 충전 완료로 기록하지 않음 |
| 재시작/중복 command | task 중복 실행·재고 복제·유령 owner 없음 |

성공률·인식 지연·안전 접근거리·retry/TTL·reserve·재개 충전량은 팀/강사와 실제 장비 측정으로 결정한다. 실제 성능이나 산업 안전 인증을 이번 조사로 보장하지 않았다.

## 작업 경계 기록

공식 문서 재확인과 보고서 작성만 수행. 제품 구현·모델/자료 다운로드·실제 센서/프로그램 실행·기존 웹사이트/원본/DB 변경 없음. 5번의 운반·보유 표시 작업과 이 전체 자동 순찰 정책의 완료 여부를 분리해 보고해야 한다.
