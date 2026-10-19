# Agent 14 — 동적 감지/우회 로컬 구현 인계

2026-10-14. **제품 소스 동결. 최종 타입 검사 및 전체 build 통과. 독립 Astra 13 검토와 root 브라우저 검증 대기.** commit/push/deploy/cloud API, 원본 폴더·운영 DB 변경, 사용자 브라우저 저장소 조작, 서버 중단을 하지 않았다. 시작 git status는 깨끗한 8d82d8acc35ed28c2d119307f8c6de52a3515f6b였다.

## 구현

- `scene-sensor.ts`: 카메라와 공유하는 수평 FOV 약66.7도, 3.6m 범위, 0.15초 주기. 같은 floor, solid 지도 및 다른 기체 원형 몸체에 대한 2D ray 가림. 위치/속도 관측과 1.2초 기억, 보이는 빈 과거 위치 즉시 제거. 실제 이미지/YOLO 아님.
- `scene-navigation.ts`: 현재/0.4초 예측 기체 위치를 동적 원형 장애물로 계획. 단순 대기가 아닌 실제 경로 배열 교체. 현재 pose 및 진행중 원호의 부분 구간을 보존한 접합. 모든 임무 체크포인트·목표 원좌표·actionDone 인덱스 갱신은 성공 후 원자 적용. holonomic은 다음 체크포인트만 교체하고 car는 남은 체크포인트를 전진 원호로 재연결. 안전한 국소 이탈 경로로 이미 접근한 두 기체 사이도 복구 가능하도록 했다.
- `scene-runtime.ts`: 관측 기반 감속/재계획과 별도의 전역 충돌 안전장치를 구분. 후자는 관측에 없는 기체도 포함하여 이동 segment 최소0.49m 및 car 원호 여유0.002m를 검사한다. ID 순서로 우회 상대를 정하되 상대가 재계획에 실패하면 고정 양보를 풀어 상호 정지를 줄인다. 순서 정렬로 routes 배열 순서를 뒤집어도 동일 실행. pickup/ownership/lift/charger 상태 유지.
- `scene-locks.ts`: 넓은 기본 lock은 강제 예약하지 않고, 물리 장애물 사이 차체중심 가로 이동폭이0.55m 미만인 lock에만 배타 예약. 세 단면을 검사한다. 연속 거리/속도로1cm 진입 선행권 유지. 대기는 입구 밴드 안에서만 통로끝1.1m 전, 소유권은 출구여유까지 유지. 미진입 reroute/done/error 소유권 해제. floor0 공통 도형은 층별 별도 폭판정/예약.
- `scene-local.ts`/`planner.ts`/`min-heap.ts`: stage 강제경유와 가짜 미래주차 장애물 제거. 실제 static geometry를 유지하면서 주차 후보를 제한 탐색. 원형 동적 장애물과 연속 원호/선분 검사, 격자 접합 후보, heap 기반 car 탐색.
- Worker는 정적 임무구간만 검증한다. 다중600초 실행 교착을 시작 차단 조건으로 사용하지 않는다. 사용자가 편집한 Scene schema2는 그대로다.
- SceneLab: 실행 경로 사본 분리, 즉시 경로 재그리기, 센서 부채꼴/관측·기억 원형표시, 감지ID·재계획횟수·대기이유 표시. 카메라 같은pose/FOV. 예시 지도 버튼은 클릭할 때만 변경한다. 새 실행은 원래 static 계획에서 다시 시작한다.

## 예산

전역0.35초당 최대1회, 기체별 최소0.9초/실패시 최대4초 backoff. 전체 재계획 시도 공유14,000노드/약55ms 예산. 같은 관측 상태에서6회 실패 후 재관측 변화까지 탐색 중단. car 각leg6,500노드 추가한도. static 주차 후보50개. 벽시계 확인64노드마다이므로55ms는 hard real-time 보장이 아니다.

## 최종 검사 로그

`outputs/agent14-dynamic/dynamic-tests.log`:

| 시나리오 | 완료 시뮬레이션 시간 | 최소 기체거리 | 경로 갱신 |
|---|---:|---:|---:|
| 정면 2대 +원목표/충전 |22.20s|0.6125m|2|
| 같은 입력 routes 역순 |22.20s|0.6125m|2|
| 교차/새 이동 기체 진입 |22.57s|0.6490m|3|
| 랙 사이4대 |39.15s|0.4911m|22|
| 정지 기체 우회 |21.50s|0.5877m|1|
| 단일 차선 추종 |35.50s|0.4954m|4|
| 양방향 단일통로 배타통과+출구우회 |33.50s|0.4907m|3|
| 자동차2대 동적조우 |34.32s|0.6310m|8|
| root 보관 사용자지도rev11 |32.80s|0.4921m|5|

각 완주 입력에서 원래 목표 방문, 충전, 모든 소유권 해제, 매tick 이동상한/물리 장애물/기체거리, car 전진/곡률, 편집 Scene 불변을 검사했다. 좁은 반대진입 입력은 동시에 두 몸체가 예약영역 안에 들어가지 않는 단언도 포함한다. 별도 sensor FOV/range/floor/가림/빈공간/TTL, 실패원자성, lock 입구밖 우회/미진입 예약해제, 100객체 공유탐색예산55.76ms 검사를 통과했다.

`scene-tests.log`: 기본1/2/3/4대, sparseID, 안전모임무, 가상층이동, car, 연속원호모서리, 넓은lock생략, 좁은lock1cm선행(양 배열순서) 통과.

추가 수행한 기존16개 로컬 검사: scene-local, dynamic-navigation, astra-scene-invariants, astra-editor-events, carried-helmet, front-projection, robot-spawn, vibe-mission, solid-delivery, single-snapshot, edited-driving, planner, mission, robot-code-export, code-export-safety, mission-negation 모두 통과했다. 그16개 묶음은 마지막 narrowlock 추가 전 실행했고, 변경후 dynamic/scene은 재실행했다. 사용자rev11 invariant는0.1/0.35/0.8m/s 모두 통과(마지막 narrowlock 추가전, 해당 지도의 defaultlock은 넓음). 최종 타입/build는 모든 제품변경후 재실행했다.

`typecheck.log`: npx tsc --noEmit --incremental false exit0.
`build.log`: npm run build exit0, prebuild Worker 재생성 포함. Vite/Vinext의 기존 route classification ? 안내 외 빌드 실패 없음.

최종 public/scene-worker.js SHA256: `1A1C6FC1BBC22490118C1D3AAA71D87319B72C5D8BF3D675762FD07B12E9906E`. UI Worker cachekey: `dynamic-sensing-v1`.

## 알려진 한계 및 검토 요청

임의지도/임의방향/모든 car 배치의 완전한 경로·무교착 보장은 없다. 실제 가능한 경로도55ms/14k노드 한도 또는 격자/heading 해상도로 실패할 수 있다. 좁은 lock 판정은 축정렬 직사각형의 세단면 근사이며 다른형태 통로/초기부터여러기체가단일통로내부인 배치의 완주보장은 아니다. 가상 센서는2D footprint occlusion이며 이미지식별·실센서안전이아니다. 물리Scene의 바닥안전모는 보수적으로 유지하고 실제센서ghost해결로표현하지 않는다.

Astra13은 독립반례/원래임무보존/연속곡률/우회실행/lock/TTL을 검토하고 root는 동결된 Worker 재로딩후 브라우저기능·실제경로변경·재시작을 확인해야 한다. 이 보고서는 그 승인이나 배포를 대신하지 않는다. 제품작성권은 수정요청 전까지 동결한다.
