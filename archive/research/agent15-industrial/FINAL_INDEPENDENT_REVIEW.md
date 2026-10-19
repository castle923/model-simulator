# Industrial Factory Lab 독립 검토 및 수정본 재검증

검토일: 2026-10-14. 검토자: agent15. 대상: 복사본 mechanic-hub의 industrial 런타임·프로토콜·기하·UI 통합. 검토자는 제품 파일을 수정하지 않았다. 독립 시험과 보고 파일만 research/agent15-industrial, outputs/agent15-industrial에 작성했다.

## 최종 판정

**승인: 아래 해시의 로컬 웹 시뮬레이션 소스·런타임 검토 범위. 미해결 제품 BLOCK 없음.** 최초 독립 검토에서 발견한 경로 불가 무한 대기와 UI 지연 범위 불일치는 작성자 수정 후 재검증했다. 실제 MQTT, 실제 QR 인식, 물리 Raspbot 주행, 산업 안전 인증 또는 공개 사이트 반영을 검증한 판정은 아니다. 배포와 공개 URL 확인은 root 담당이며 이 보고서는 배포 완료를 뜻하지 않는다.

브라우저 동작은 root의 별도 UI QA 자료를 보조 증거로 사용했다. agent15가 직접 사용자 브라우저·storage를 읽거나 수정하지 않았다. 기존 사용자 편집지도 원문 before/after 해시, production에서의 탭 전환·새로고침 전 과정은 이번 독립 검토에서 미검증이며 아래에서 분리했다.

## 발견 → 수정 → 재검증

| 항목 | 최초 반례 | 작성자 수정 | 독립 재검증 |
|---|---|---|---|
| BLOCK P0-11 | 허용된 minRadius=.35에서 R1 charge가 60초 뒤에도 ACTIVE/WAIT. 정적 벽으로 통로를 막아도 두 작업이 ACTIVE/WAIT로 남음 | agent14: 다른 로봇을 제외한 정적 경로 검사와 bounded 탐색 실패를 구분·기록하고 TASK_ERROR. 미허가 요청만 제거하며 pose 유지 | .35 충전 ERROR, 정적 벽 두 작업 ERROR, 통로 점유0/oracle0. 정상 .12/.15/.20/.25 충전 완료. 점유된 목표의 WAIT와 hot departure 성공은 유지 |
| P2 UI | 지연 UI는 0~3초를 안내하지만 runtime은 .02~1초만 허용 | agent16: label, min/max/step, 조건, 오류문구를 .02~1초로 통일 | 최종 소스 확인 및 TypeScript/ESLint 통과 |

정적 탐색은 65ms 등의 제한이 있는 탐색이다. ERROR 메시지는 수학적으로 불가능하다고 단정하지 않고 경로를 못 찾았거나 탐색 한도에 도달했다고 정확히 표시한다.

## 직접 실행한 검증

시험 실행기: [run-final-verification.mjs](./run-final-verification.mjs). 전체 원문 stdout/stderr와 해시: [final-verification.json](../../outputs/agent15-industrial/final-verification.json). 모든 명령 exit 0, 시험 전후 대상 17개 파일 SHA-256 동일(stable=true).

| 시험 | 결과 | 핵심 증거 |
|---|---|---|
| scripts/test-industrial-runtime.mjs | PASS | 네 대 교차 101.28s, completed4/grants4/maxOccupancy1/oracle0. 반대 교환, hot departure, 유실/중복/지연, 충전, 안전모, .73s 외부 dt substep |
| scripts/test-industrial-protocol.mjs | PASS | 단절/조정기/로봇 재기동, stale berth/heartbeat, rotated corner, 후미 이탈 후 재기동, QR 대기 취소, 새 정적경로 오류 사례 |
| scripts/test-dynamic-navigation.mjs | PASS | 기존 동적 우회, 교차, 좁은 통로, 합성 센서, 전진 car, 100 entity 한정 탐색 회귀 |
| scripts/test-scene-local.mjs | PASS | 기존 주행, roster/sparse ID, 안전모, 충전, forward arc, corner, narrow lock 회귀 |
| independent-probes.mjs | PASS | 프로필별 경로, 세 속도 제동거리, enqueue 직전/직후 타로봇 전체 객체와 coordinator 동일, 정적 경로 오류 |
| independent-adversarial.mjs | PASS | 선택적 GRANT/ENTER/EXIT/BERTH_CLEAR 유실, 최대 지연+중복, 정지선·후미 해제, 진입전 재부팅/old messages, guard 기록 |
| TypeScript --noEmit --incremental false | PASS | 전체 타입 검사, 출력 파일 생성 없음 |
| scoped ESLint | PASS | 새 산업 UI 및 6개 industrial 모듈 |
| independent-gates.mjs (추가) | PASS | 양끝/같은방향 동일 tick 원자 예약 경쟁, 실제 exit berth 점유, heartbeat만 유실 |

추가 독립 시험 결과: [independent-adversarial.json](../../outputs/agent15-industrial/independent-adversarial.json), [independent-gates.json](../../outputs/agent15-industrial/independent-gates.json). 실행기는 표준 script를 직접 자식 node 프로세스로 실행했고, writer의 PASS 설명만 인용하지 않았다.

## P0 체크리스트 최종 상태

| ID | 상태 | 검증 근거와 적용 범위 |
|---|---|---|
| 01 현재 속도 제동/정지선 | PASS — 가상 모델 | fault 시작 v=.054/.144/.270m/s에서 이동량 .00486/.03456/.12150m로 v²/(2a) 일치. 정상 진입전 QR 대기 구간은 trapezoid 가감속으로 정지. 매tick 무허가 사각 footprint의 정지선 교차 없음. reactionTime 필드는 운동에 적용되지 않음 |
| 02 통로+exit berth 원자 예약 | PASS | 동기 commit 안에 journal/grant/berth/yard 기록 후 send. 같은 tick 반대방향/같은방향 두 claim 중 정확히 하나만 성공 |
| 03 요청/허가 중복 | PASS | 중복100% 시험 및 재요청, journal/token 식별 검토. 프로세스 내부 메모리 commit이며 디스크 내구성 검증 아님 |
| 04 후미 이탈 | PASS | 실제 차체/적재 직사각형이 출구 경계를 완전히 벗어날 때 release. 최대지연 시험에서 4회 release 순간 footprint 검사 |
| 05 선택적 유실/재전송 | PASS | GRANT 유실45s에 grant1/RESERVED/점유0/완료0. EXIT 유실45s에 OCCUPIED/기존 grant 유지. 전송 복원 후 완료 및 berth 모두 해제 |
| 06 heartbeat/epoch/reboot | PASS — 재기동 시뮬레이션 | 소유자 heartbeat만 유실해도 UNKNOWN·기존 grant 유지, 물리 감속. 진입전 reboot+old GRANT/EXIT 거부. 제공 시험의 epoch/boot 재기동도 재실행 |
| 07 출구 막힘 | PASS | 목표 bay는 비우고 R2를 exit berth에 둔 독립 시험20s 동안 R1 WAIT, grant0, 점유0. 기본 지도 대기칸·회전공간 검토. 임의 다중 통로 지도 전체의 deadlock-free 증명은 아님 |
| 08 네 대 hot enqueue | PASS | 실행중 R3 명령 추가 직후 다른3대 전체 상태 및 coordinator deepEqual, 시계 동일. 기존 hot departure도 완료 |
| 09 실축척 사각 외형 | PASS — nominal 모델 | length .20874, width .16583m, 지도3×2m, aisle .24m. 회전 사각형 SAT 및 render 동일 단위 확인. 실물 측정 없음 |
| 10 전진/곡률/sweep | PASS | forward Dubins/한정 탐색, 최소R, rotated rectangle, footprint corner sample bound+inflation 검토. 정상 시험 reverse/spin/teleport/가감속 위반0, 큰 dt substep |
| 11 전진 경로 불가 | PASS after fix | .35 충전 및 정적 막다른 통로가 TASK_ERROR, 순간이동/점유/guard 개입 없음. 오류에 탐색 한도 가능성 명시 |
| 12 실제 runtime UI | STATIC PASS + root 보조 QA | worldRef step, runtime tasks/events, 거리 기반 구간 progress, 완료 카운터 직접 연결. root UI export도 completed4/maxOccupancy1/oracle0 |
| 13 통신 표기 | STATIC PASS | logical QR·가상 메시지 버스·실제 MQTT/기체 미연결을 UI가 명시. 브라우저 내부 실제 메시지 객체의 지연/유실/중복 시험 |
| 14 기존 저장공간/상태 보존 | STATIC PASS / 기존 사용자 데이터 live hash 미검증 | 신규 config/unfinished/rejected key만 사용. industrial은 persistent wrapper이며 탭 전환 시 시계 pause. 기존 userScene2 원문·5174 사용자 origin을 독립 검토에서 읽거나 수정하지 않음 |
| 15 belief/world truth 구분 | PASS | coordinator reports는 수신 telemetry, physical pose SAT guard는 별도. truth-only 장애물 주입시 oracleStops1+ORACLE_STOP+UNKNOWN 기록. 정상 사례 oracle0 |

## 독립 장애 시험 수치

- delay1s + duplicate100% + loss5%: 네 작업108.92s 완료, maxOccupancy1, oracleStops0, grants4. 2,355 tick에서 commit된 통로/berth 관계를 확인했고 네 release의 실제 후미 위치를 검사했다.
- GRANT 선택적 유실:45s 동안 RESERVED와 EXIT-E=R1 유지, 통로 실제 점유0. 전송 복원 후81.80s에 두 작업 완료.
- EXIT 선택적 유실:45s에 실제 통로는 비었어도 coordinator는 OCCUPIED·grant1 보존. 복원 후62.86s에 두 작업 완료. timeout으로 통로를 연 것이 아니다.
- BERTH_CLEAR 선택적 유실: 두 작업이 도착했어도 각 berth 장부는 보유자를 유지. 복원 후 명시적 clear 메시지를 받아 해제되는 것까지 추가 확인했다.
- heartbeat만 유실:19.78s 시점 UNKNOWN, 실제 R1 통로 점유, grants1, 전 기체v0, oracle0. 새 진입 없음.
- ground truth에만 장애물을 추가한 시험: guard1회와 ORACLE_STOP 이벤트를 확인했다. 이 사례를 정상 주행 성공으로 계산하지 않았다.

## root UI 자료 확인과 남은 한계

[local-four-robots.json](../../outputs/root-industrial/local-four-robots.json)을 읽어 t126.8774s, completed4, grants4, maxOccupancy1, oracle0 및 최종4대 pose를 확인했다. 이 파일은 root가 별도 localhost5175에서 수집한 자료이며 agent15의 브라우저 조작 결과가 아니다. root는 실행중 enqueue와 같은 pose의 floor/camera를 관찰했다고 전달했지만, clean production의 탭 전환/재로딩 확인은 별도 수행 예정이라고 밝혔다. 따라서 그 부분의 production 검증 완료를 이 보고서가 선행 선언하지 않는다.

고정3×2m 단일 통로·네 대의 웹 실험이다. 실제 분산 장비/네트워크/브로커, 모든 지도와 모든 장애의 안전성·공정성 증명은 범위 밖이다. coordinator journal과 reboot는 메모리 안에서 모델링되며 브라우저 reload로 실행 snapshot을 복원하지 않는다. UI는 config 저장과 미완료 marker를 사용해 명시적인 새 실험 시작을 요구한다.

reactionTime=.15는 profile 메타데이터로 존재하지만 운동 코드에 소비되지 않는다. fault를 처리한 tick부터 v/decel로 감속하는 모델이며 물리 센서·제어 반응시간을 포함한 산업 정지거리 모델로 해석하지 않는다. 정상 정지선 안전성은 실제 반응시간 없이 계획된 QR 대기점 정지에 기반한다. world guard는 별도 안전망이며 정상 알고리즘 성공의 대체물이 아니다.

## 승인 대상 SHA-256

- lib/industrial-runtime.ts: e3703c69d73f3777ebb4a7bd7790cbdb621005c10a494570d4f6d8b2ee280f5a
- lib/industrial-protocol.ts: 28baa747c327a58a0aa1790b3c9bc8120e84284c1e4a0c6229ab807c29caae0f
- lib/industrial-geometry.ts: c5e041758810fab9d2fa42ece1b1b0d702ae4687f1fe3c73b9abfcfdbe0bb756
- app/IndustrialFactoryLab.tsx: 188ebc37acc2ddb3df27b20aa82116054c5722ae934966ec794c80f0427783fe
- app/industrial-factory.css: 53d13a873524fc2477d3066df06c135734c9b80341415a9cb84519ce5480f3b4
- app/SceneLab.tsx: 34d1df7ab35bf37990c9ada8af372ad901aab23b718087b374b0dcdee8567714

전체17개 파일 해시는 final-verification.json에 기록했다. 이 해시 이후 제품 변경이 있으면 해당 변경의 영향 범위 재검증이 필요하다.
