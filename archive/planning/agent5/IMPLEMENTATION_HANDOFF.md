# 5번째 담당 로컬 구현 인계

2026-10-14. 최신 사용자 승인에 따른 복사본 로컬 구현이다. 원본 `메카닉`, 운영 사이트, 운영 DB/API·카메라 연결기는 변경하거나 사용하지 않았다. 원격 push·배포·새 사이트 등록은 금지 상태다.

## 실제 구현과 한계

| 요구 | 복사본 구현 | 제한/다음 검증 |
|---|---|---|
| R1 정면 카메라 동기화 | 웹 Canvas의 동일 sceneRevision/robotId/simTime과 runtime pose로 정면 합성 미리보기, 타 기체 pose도 반영 | 실제 엔진 영상은 미연결. 웹 합성 영상이라고 표시 |
| R2 객체 조작 성능 | 공통 Canvas hit-test/Pointer Capture, 드래그 중 가벼운 초안, 최종 경로 Worker 검증·구버전 응답 무시 | 대상 PC 입력 지연 p95 벤치마크 미실시 |
| R3 세 엔진 연결 | Unity/CARLA/Gazebo 선택과 명시적 미연결 상태, 운영 엔진 호출 제거 | 엔진 handshake/telemetry/WebRTC 어댑터 미구현 |
| R4 바이브 객체 반영 | 규칙 ScenePatch, 자동 빈자리 배치, revision 검사·검증·Undo, R기체 안전모 전달 임무 설정 | 일반 자연어/임의 코드 실행/AI provider 없음 |
| R5 외부 영상 | 사용자 getDisplayMedia 창 선택·취소/종료 안내 | 선택만으로 엔진 실행·지도 자동 연동 아님 |
| R6 자유 기체 임무 | 지도 4~20m, 1~4대 stable ID, 각 기체 출발/yaw/goal/waypoint·목표 층·운동모델 편집 | 다수 동적 회피의 완전성 보장 없음. 복잡한 교착은 안전 대기할 수 있음 |
| R7 단일·다중 편집 통합 | 동일 editor/store/schema, 일시정지 후 편집, 경로·예약 초기화 | 실행중 편집 금지, 임의 순간이동 없음 |
| R8 산업형 주행 | 전진 arc lattice 경로, 연속 원호 장애물 판정, arc 보간 실행, 후진 없이 충전소 이탈 재계획 | 차량 footprint는 반경 .22m 원형/축정렬 팽창 근사, wheelbase/실물 반경 미확인 |
| R9 QR·엘리베이터 | 가상 QR 위치 방문·1초 식별, 단일 lift 예약·5초 이동·도착층 혼잡 대기, 복귀 충전 | 실제 QR 디코더/제조사 API/문센서 없음. 가상 표시 |
| R10 실행·작업 안내 | 실제 로컬 실행 개수·ID·지도 버전, 종료/재실행/편집 수명주기, 기존 팀 UI /legacy 보존 | 로컬 브라우저 실행 기록. 기존 UI는 별도 로컬 D1이며 운영 데이터 복사 안 함 |
| R11 지도 카메라·녹화 합성 | 지도 우측 상단 Canvas inset, 기체 선택·삭제 fallback·확대/접기, 동일 Canvas 녹화 | 외부 엔진 영상/팀 네트워크 방송 합성 미연결 |

## 모듈과 작성권

- 제품 코드 유일 작성자: 5번. 검증자 6번은 반례·보고만 작성. root는 브라우저·통합 검증.
- `mechanic-hub/lib/scene-local.ts`: Scene/Entity/Robot/MissionRoute/ScenePatch, 경계·참조 검증, 자동차 원호 경로 및 충전/가상 층간 임무.
- `mechanic-hub/lib/scene-runtime.ts`: 시뮬레이션 pose, 1cm 선행 진입시간 비교, 락·충전 대기·가상 배터리·층간 상태.
- `mechanic-hub/app/SceneLab.tsx`, `scene-local.css`, `scene.worker.ts`: 공통 로컬 화면·편집·카메라·Worker.
- `mechanic-hub/app/page.tsx`: 로컬 화면 진입. 원래 운영형 소스는 `LegacyPage.tsx`와 `/legacy/page.tsx`로 보존.
- `mechanic-hub/scripts/build-scene-worker.mjs`, `public/scene-worker.js`: Vinext import.meta Worker 변환 이슈를 피하는 로컬 bundle. `predev/prebuild` 자동 생성.
- `mechanic-hub/wrangler.local.json`: placeholder ID와 로컬 실행 전용 D1 설정. 명령에 반드시 `--local` 사용.
- 모든 브라우저 키는 신규 `mechanic2-...` 또는 기존 UI의 `mechanic2-legacy-member-v1`로 분리.

## 검증 근거

- 타입 검사 `npx tsc --noEmit --incremental false` 통과.
- `node --experimental-strip-types scripts/test-scene-local.mjs` 통과: 2대 충전 대기/충전/전진 이탈, 안전모 집기·전달, 가상 QR·층간 왕복·충전, 자동차식 충전/전진 이탈, 연속 원호 코너 충돌 반례, 희소 ID, 1cm 먼저 진입 양 순서.
- 6번의 원호 사이 코너 충돌 반례는 표본 간격 축소 대신 원호/사각형 경계 교점·극값 판정으로 수정했다.
- root 브라우저 검증 중: Worker 작동, 바이브 5개 객체 실제 반영, 기체 드래그, 일시정지 pose 유지, R2 카메라 선택, 랙 크기 변경, `/legacy` 로컬 닉네임·게시물·댓글 저장/조회.
- 로컬 D1 migrations 0000/0001 초기화 성공. 첫 Wrangler 실행은 placeholder CF fetch 오류였고, `--import ./scripts/sites-env.mjs`로 CF_FETCH=false 적용 후 성공. 운영 DB 연결 없음.
- 빌드와 독립 재검증은 root 최종 보고에서 결과를 확정한다. 이 문서 작성 시 실행 중인 검증을 통과로 미리 표시하지 않는다.

## 최종 검증 추가

- 마지막 `npm run build`는 prebuild Worker 재생성을 포함해 exit 0으로 완료했다.
- 6번 독립 core 재검증: 1대 22.53 / 2대 41.61 / 3대 64.35 / 4대 113.92 / 희소 [R1,R2,R4] 64.48 시뮬레이션 초에 완료. 모든 예약 해제, 최소 분리 약 0.4901m. 원호 코너 충돌, ScenePatch 독립성, 1cm 선행 진입의 양 순서, 자동차식 곡률도 통과했다.
- 3/4대 출구 교착 반례를 수정했다. 기체별 staging gate를 통로 출구에서 떨어진 위치에 계획하고, 다른 기체의 gate·충전 대기점·최종 주차점을 예약 장애물로 취급한다. 새로운 다중 모드의 예약 범위는 staging gate부터 충전 대기점까지로 보수적으로 넓다. 기체가 먼저 gate에 도달한 순서로 예약하며, 고정 시연의 원래 랙 끝 기준 진입선 조작은 `/legacy`에 보존되어 있다. 새 공통 모드의 staging gate 직접 편집은 후속 보완 항목이다.
- Worker는 개별 경로 외에 0.8m/s, 최대 600초의 다중 실행을 검사한다. 교착 또는 한도 초과 시 주행 시작을 차단한다. 모든 속도와 임의 공간에 대해 교착이 없다는 수학적 보장은 아니다.
- 실제 엔진, 실물 센서, 실물 엘리베이터 API, 공용 지도 실시간 동기화, TURN 연결 검증은 완료하지 않았다.
- 10번의 새 `app/scene-appearance.ts`를 5번이 공통 지도에 통합했다. 객체 12종과 Raspbot 근사 외형(노란 바퀴 4개·기판·전면 렌즈)을 기존 hit/collision 사각형 안에 그린다. 제조사 CAD나 센서 정밀 모델이 아니다. 속도 라벨·현재값·전체 기체 적용 안내를 고대비로 표시하고 검증 실패는 `!`로 구분했다. 통합 후 타입 검사·11개 의미 체크·전체 빌드 exit 0을 다시 확인했다.

## 후속 주행·카메라 수정 (5번 재인계)

- 단일 기체는 staging gate와 통로 락 소유권 제어를 생략한다. Worker도 단일에는 600초 다중 교착 검사를 적용하지 않는다. 경계·장애물 경로 검사와 충전·가상 배터리·엘리베이터 기본 조건은 유지한다.
- 사람·안전모는 과거 `blocking:false`여도 몸체를 가진 장애물이다. `isSolidEntity`가 충돌체 여부를 통일하고 새 배치 기본값은 true다. 해당 두 종류의 UI 충돌 토글은 체크·비활성 및 이유 표시로 일관성을 유지한다.
- 정확한 ID로 선택한 안전모/작업자에 대해 `approachLeg`가 사각형 외곽 12개 후보 중 가능한 짧은 경로를 고른다. 차체 반경 0.22m + 여유 0.10m 접근점이며 실제 팔·센서 검증이 아니다. 자동차 경로의 실제 도착 오차가 있어도 최종 pose가 몸체+반경 밖인지 검사한다.
- payload는 가상 집기/전달 상태다. 지도 안전모 객체를 실제로 이동하거나 삭제하지 않는다. 센서 ghost 장애물 자동 소거는 미연결이며 수동 삭제는 정지 편집 정책을 따른다.
- 충돌 의미가 바뀌어 과거 저장 지도가 검증 실패하면 원문을 `mechanic2-scene-rejected-backup`에 보존하고 복구 JSON 다운로드 버튼을 제공한다. 새 기본 지도만 조용히 덮어써 복구 불가하게 만들지 않는다.
- `lib/front-projection.ts`는 같은 기체 pose·객체 footprint를 pinhole로 투영하고 far→near 정렬한다. 10번 정면 helper의 사람/안전모/랙/상자 등 디테일을 표시한다. 종류별 높이·평균 깊이 정렬·가림은 교육용 근사이며 정밀 깊이센서·실제 엔진 영상이 아니다.
- 추가 검증: `test-solid-delivery.mjs` (legacy true/false 외곽 접근·전 tick 비관통·단일 락 없음·car 끝점·single Worker 생략), `test-front-projection.mjs` (크기·타기체 pose·삭제·방향·층·정렬), 업데이트된 `test-vibe-mission.mjs` (정확 ID 외곽 접근·비관통·payload·R2 자동 배치 전달) 통과. 기존 1~4대/희소/1cm/원호 회귀 유지. 최신 통합 타입 검사와 전체 빌드 exit 0.
- 6번이 기존 직선 `segmentClear`의 0.015m 샘플 사이에서 약 0.00065m 코너 침범을 찾아 추가 수정했다. 복사본 `lib/planner.ts`는 이제 팽창 사각형에 대한 연속 slab 교차 판정을 사용한다. 해당 회귀와 기존 planner·mission·factory·15개 fleet roster 검사를 통과했다. 원본 파일은 수정하지 않았다.

## 좌표 정의

현재 schema 2의 좌표 단위는 미터, 시간은 초, yaw는 라디안이다. 원점은 지도 좌측 상단이며 +x는 화면 오른쪽, +y는 화면 아래다. yaw 0은 오른쪽, 양의 yaw는 화면 시계방향이다. 층은 1부터 시작하며 Entity.floor=0은 모든 층에서 보이는 공용 표지다.

ROS/Gazebo ENU(+y 위, yaw 반시계)로 그대로 전달하면 방향이 뒤집힌다. 후속 어댑터가 지도 높이 H에 대해 `x_engine=x_web`, `y_engine=H-y_web`, `yaw_engine=-yaw_web`를 기본 평면 변환으로 적용하고 엔진 원점·기체 전방축·층별 z까지 명시적으로 맞춰야 한다. Unity/CARLA는 각 엔진 좌표 handedness와 카메라 축에 맞는 별도 어댑터가 필요하다. 실제 연결 승인 시 schema에 frame/unit/axisConvention을 명시하여 라운드트립 테스트한다.

## 후속 운영 규칙

1. 팀원 변경이 최우선. 변경 전 실제 파일/diff 확인, 한 파일 한 작성자, reset/clean/강제 push 금지.
2. 현재 복사본은 로컬 전용. 원본·사이트·DB·저장소·카메라 세션 변경이나 배포는 별도 승인 없이 수행하지 않는다.
3. 실제 엔진 어댑터는 공통 runId/sceneRevision/robotId/simTime 및 pose/frame sequence 계약을 따라야 한다. 위치 권위자는 웹 또는 엔진 중 하나만 지정한다.
4. 웹 합성 카메라·가상 QR/배터리·프록시 엔진·실물 Raspbot/Pi5 결과를 분리해서 보고한다.
5. 새 기능은 구현→반례 검토→수정→재검증 순서. 라이브 서비스와 독립된 로컬 증거만 생산한다.

공식 자료: `research/agent4/RESEARCH_HANDOFF.md`와 manifest. 자료 조사 결과는 엔진 설치나 실물 연결의 완료 증거가 아니다.

