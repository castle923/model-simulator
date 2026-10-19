# Industrial Factory Lab 독립 검토 사전 기준

작성: agent15 / 2026-10-14. 상태: PREPARATORY ONLY — 구현 소스 동결 전이므로 아래 시험은 모두 NOT RUN이다. 제품 작성자는 agent14(lib/industrial-*), agent16(UI/scene/CSS 통합)이다. agent15는 제품 파일을 수정하지 않으며 동결 후 반례·시험 증거를 제공한다. 실물 로봇·실제 MQTT·산업 안전 인증 검증을 의미하지 않는다.

## 판정 원칙

- P0 중 하나라도 반례가 있으면 승인하지 않는다. 단순 애니메이션상 안 부딪힘, 메시지 문구, 이상 경로를 가리는 world guard만으로 통과 판정하지 않는다.
- 각 시험은 초기 지도/4대 상태, 입력 명령, 장애 주입, random seed 또는 재현 순서, 시간별 pose/velocity/resource/message trace, 기대 결과, 실제 결과로 남긴다.
- 정상 시험의 safety-guard intervention은 0이어야 한다. 장애 시험에서 intervention이 발생하면 안전망이 막은 사실과 상위 주행/프로토콜 실패를 각각 기록한다. intervention 자체를 정상 통과 증거로 삼지 않는다.
- dispatcher의 belief(예약·점유 추정), network의 전송중 메시지, simulator의 world truth(실제 차체 위치·교차)는 독립 상태로 점검한다. 코디네이터가 world truth를 직접 조회해 통신 유실을 은밀히 보완하면 통신 모델 시험을 통과한 것으로 보지 않는다.
- 모델 제동·회전 반경·시간 지연은 가상 파라미터로 명시한다. nominal 외형 치수와 물리 성능을 혼동하지 않는다.

## P0 시험표

| ID | 준비 및 자극 | 통과 조건 | BLOCK 반례 |
|---|---|---|---|
| P0-01 | 직선에서 현재 속도를 여러 값으로 설정, 정지선 앞에서 허가 미도착/실패 | 현재 v, 가상 a, 반응 지연/여유에 기반해 제동을 시작하고 차량 전단이 정지선 전에 정지; 속도 변화는 a·dt 범위 | 진입선에서 갑자기 v=0, pose를 선 뒤로 snap, 최근속도 무시한 고정 정지거리, 앞부분 선 초과 |
| P0-02 | 양끝 두 요청을 같은 tick에 접수, 순서를 반대로 반복; 같은방향 요청도 반복 | aisle과 출구 berth 모두 free/가용일 때 단 한 요청에 원자적 예약 commit 후 GRANT; 물리 점유<=1 | 양끝 별도 aisle ID, 두 GRANT, aisle만 선점 후 출구 기다림, 출구가 occupied인데 허가 |
| P0-03 | GRANT 저장과 전송 사이를 관찰; duplicate REQUEST 재전송 | commit이 먼저이고 동일 boot/requestId는 동일 허가 결과; 재전송이 새 소유권을 만들지 않음 | 메시지 먼저 보내고 상태 나중 저장, request retry로 순번/허가 중복 |
| P0-04 | 차량 앞쪽만 출구선 밖에 두고 뒤는 aisle 내부; 회전하며 빠져나오는 경우 포함 | 차체 전체와 설정 여유가 통로를 벗어난 뒤 EXIT와 aisle 해제; exit berth는 점유하는 동안 유지 | 중심점/앞 QR 통과 시 조기 release; 회전 후미 침범을 무시 |
| P0-05 | REQUEST, GRANT, ENTER, EXIT를 각각 지연·유실·중복·순서전도 | grant와 physical occupancy 상호배제 유지; 미확인 상태는 UNKNOWN/BLOCKED; 재시도는 idempotent | ENTER/EXIT 못 받았다는 timeout만으로 FREE/재발급; 지연 GRANT 후 재진입 |
| P0-06 | 통로 점유 중 heartbeat loss, 로봇 reboot, 중재자 reboot; 과거 epoch GRANT/EXIT 재생 | 신규 진입 중단, 기존 소유권·불확실성 복구; identity/boot/epoch/grant 검증, 안전한 명시적 reconciliation 전 자동 개방 금지 | 상태를 초기 FREE로 재생성, 새 epoch라며 통로 비었다고 간주, old EXIT로 새 예약 해제 |
| P0-07 | 통로가 비어도 출구 berth/회전 공간에 다른 로봇 배치; 양끝 대기줄 구성 | 허가 전에 필요한 출구 공간 확보; 기다리는 차량은 상대 출구와 회전 궤적을 막지 않음 | 한 대만 통로에 있는데 영원히 출구가 막힘, 입구 대기 로봇과 출구 로봇의 교착 |
| P0-08 | 진행 중 4대 중 한 로봇에 명령 추가; 선택 로봇 변경 후 다른 로봇에도 추가 | 4대 ID 유지, 다른 로봇 pose/속도/작업큐/예약 상태 보존; 목표 로봇도 진행 중 작업의 상태 연속성 보존 | enqueue 때 전체 scene reset, 기존 task 제거, resources 모두 free, 다른 로봇 순간 이동 |
| P0-09 | 공장 좌표/렌더/물리 외형을 대조; 0.24m 통로에 단일/두 차체 배치 | nominal 직사각형 0.20874m×0.16583m, 폭 0.24m가 동일 단위; 차체 전체를 이용한 점유 측정; 2대 중첩 진입 금지 | 중심점만 점유 검사, 렌더 크기와 collider 불일치, 화면상 좁지만 물리 통로 넓음 |
| P0-10 | 최소R의 90도/180도 전진 회전, dt를 늘린 corner traversal | v>=0, 측방 이동/제자리회전 없음; 움직이는 heading의 곡률이 가상 최소R 만족; 차체 swept footprint가 벽을 통과하지 않음 | 제자리 heading 변경, 후진, 대각선 wall tunneling, 원/점 collider로 사각형 corner 충돌 누락 |
| P0-11 | 회차공간/연결출구 없는 좁은 막다른 통로의 왕복 명령 | 기하적으로 불가능함을 계획 단계 또는 명확한 task ERROR로 노출, pose 연속성 유지 | teleport, 숨은 reverse/spin, 끊긴 경로를 도착 완료로 처리 |
| P0-12 | 실제 event/state trace와 UI QR/허가/입장/퇴장/진행률/완료 비교 | UI는 runtime event·task·route 진행에서 유도, 메시지 지연/차단도 UI에 반영 | 일정시간마다 문자열만 바뀜, 목표 미도달인데 100%, fake GRANT 표기 |
| P0-13 | 메시지 처리 코드 및 UI 설명 확인 | 단일 logical message simulation임을 명시; 코디네이터/broker 역할 구분, 실제 MQTT·실물 broadcast 연결 주장 없음 | 연결되지 않은 MQTT 상태를 connected로 표기, broadcast 성공을 실제 무선 증명처럼 표시 |
| P0-14 | 기존 userScene2 저장 데이터가 존재하는 환경에서 lab mount/enqueue/reload | old userScene2 store와 기존 편집지도 데이터 보존; 새로운 lab의 동작 때문에 자동 덮어쓰기/삭제/초기화 없음 | mount effect, migration, reset이 기존 사용자 지도를 변경 |
| P0-15 | 정상과 장애 시나리오에서 world safety guard 조건을 고의로 발생 | intervention count/reason/robot/resource/pose가 기록되고 일반 진행과 구분됨; belief와 truth를 별도 조회 가능 | 마지막 좌표를 조용히 클램프해 안전한 protocol인 것처럼 보임, 실제 점유수를 예약 수로 대신 계산 |

## 최소 관찰 데이터

현재 robotId/bootId, pose(x,y,heading), 실제 적용 속도, taskId와 queue, resourceId 및 direction, coordinator epoch/grant sequence/requestId, 예약된 exit berth, 메시지 발신·수신·drop 시간, 실제 차체의 aisle 교차 여부, intervention reason/count를 확인할 수 있어야 한다. 디버그 정보는 개발자 검증 수단으로 제공할 수 있으며 일반 사용자 화면을 기술 필드로 가득 채울 필요는 없다.

측정 좌표에서는 '실제 점유'를 로봇 중심의 구간 포함 여부가 아니라 회전된 직사각형과 통로 영역의 교차로 정의한다. 시간 간격이 큰 이동은 시작점/끝점만 검사하지 않고 회전과 전진을 포함한 연속 구간 또는 보수적으로 충분한 substep으로 확인한다. 최소R는 정지 상태의 yaw 변경으로 우회하지 못하도록 한다.

stopline은 차량 기준점이 아니라 통로에 가장 가까운 차체 전단과 필요한 여유에 적용한다. 장애를 발견한 시점에 모델의 물리적 제동거리 자체가 부족하면, 이를 정상 정지 성공으로 수정하지 말고 intervention/실패로 남겨 배치·속도·정지선 설계를 고치도록 한다.

exit berth 예약은 berth가 실제 free인지뿐 아니라 차량 길이와 U턴 swept footprint를 수용하는지도 포함한다. 이미 점유 중인 자원을 무조건 해제한 뒤 새 명령을 처리하면 hot enqueue 또는 회복 기능에서 상호배제가 깨진다.

## 동결 이후 실행 순서

1. 작성자들에게 freeze 대상 파일과 실행/테스트 진입점을 받는다. 동결 전 WIP는 PASS/BLOCK 최종 판정하지 않는다.
2. source diff 읽기로 이벤트 commit 순서, timeout 경로, 기존 store 쓰기, collider 치수와 좌표 단위를 확인한다.
3. 재현 가능한 독립 런타임 시험으로 P0-01~11, 15를 검증한다. 보고서와 시험 산출물은 research/agent15-industrial 및 outputs/agent15-industrial 아래에만 둔다.
4. UI가 기존 런타임 이벤트를 실제로 소비하는지 소스와 제공된 검증 증거로 P0-12~14를 확인한다. 브라우저·제품파일·클라우드는 독립 검토 범위에서 변경하지 않는다.
5. 실패하면 writer14/16에게 최소 반례와 기대 동작을 전달한다. 작성자가 수정한 새 freeze에서 해당 시험과 영향 범위 회귀를 재검증한다. 마지막 변경까지 증거가 있을 때만 승인한다.

## 연구 근거와 범위

상호배제와 안전 인증은 별개다. VDA5050 3.0.0의 §2는 traffic management logic 및 safety requirements를 제외하고, §4.1은 broker 연결 단절 후에도 마지막 released node까지 기존 명령을 수행하는 동작을 설명한다. 따라서 연결/lease 만료 자체는 물리적 빈 통로의 증거가 아니다. [VDA5050 3.0.0 공식 고정본](https://raw.githubusercontent.com/VDA5050/VDA5050/3.0.0/VDA5050_EN.md)

MQTT QoS는 메시지 전달 성질이며 실물 통로 예약의 atomicity를 제공하지 않는다. 이번 최소 프로젝트는 논리 메시지 모델만으로 이 문제를 시험하며 실제 네트워크 성능을 검증했다고 주장하지 않는다. [OASIS MQTT 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

위 요구는 사용자 조건에 맞춘 프로젝트 검토 기준이다. Open-RMF의 일반 동작 보장을 복사한 기준이 아니며, 특히 확인한 upstream mutex supervisor의 timeout 기반 claim 제거와는 다르다. [Open-RMF mutex supervisor 원본](https://raw.githubusercontent.com/open-rmf/rmf_ros2/main/rmf_fleet_adapter/src/mutex_group_supervisor/main.cpp)
