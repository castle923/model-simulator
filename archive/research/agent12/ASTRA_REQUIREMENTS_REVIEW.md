# Astra 12 통합 요구사항·반례·재수정 검토

2026-10-14. 대상은 복사본 `mechanic-hub`만이다. 원본 폴더·기존 사이트·운영 DB·사용자 편집 탭은 조작하지 않았다. 배포·원격 push·새 서버 API 검증은 root 담당이다. 본 검토는 제품 소스 및 직접 실행한 로컬 검사 기준이며, root UI 확인과 독립 Astra 재검토를 다음 게이트로 남긴다.

## 판정

**수정한 제품 소스의 로컬 검사·타입·빌드 통과. 조건부 릴리스 준비 상태.** 전체 요구가 외부 연결만 남았다는 판정은 부정확하다. 웹 영역에도 메인 화면 공동 지도 동기화/직접 영상 전송은 미연결이며, 무한 순찰·PPE 자동 판정·재고 업무·순찰 복귀·30% 충전은 조사/설계 단계다. 임의 편집 지도에 대한 완전한 경로·무교착 보장도 없다. 이 내용을 공개 가능한 `mechanic-hub/docs/REQUIREMENTS_STATUS.md`의 요구사항 추적표에 명시했다.

## 직접 발견·수정한 반례

| 번호 | 재현·영향 | 수정 | 재검증 |
|---|---|---|---|
| A12-01 | 유효 ID `__proto__`, `constructor`, `toString` 안전모를 가져오면 HelmetState의 상속값을 소유권으로 오인. runtimeEntities에서 `Cannot read properties of undefined (reading 'x')` | `helmetOwnership` 최초 상태를 null-prototype 사전으로 생성 | 3종 모두 ground→robot→worker 완전 임무 실행 및 render 변환 반복 통과 |
| A12-02 | 목표층 2, 출발층 1일 때 목표는 2층에 그려지지만 pointer hit-test는 출발층 조건 안에 있어 드래그 불가; 출발층에서 보이지 않는 goal handle이 잡힐 가능성 | yaw는 현재 pose층, goal은 goalFloor, waypoint는 출발층으로 handle 분리. 일시정지 후 pose 기반 drag는 현재층도 보존 | 실제 TSX pointer 함수 추출·실행 검사: 2층 goal drag→(7,2), 1층 숨은 goal 제외, 이동 후 2층 yaw 편집 모두 통과. 실제 브라우저 QA root 담당 |
| A12-03 | 새 Scene의 Worker 생성이 동기 예외를 던지면 catch에서 checking=false가 되지만 이전 routes가 남아 Start 활성화 가능 | 새 검증 시작 및 Worker 생성 실패에서 routes 비움 | 코드 경로 재검토·타입·빌드 통과. 강제 Worker 실패 브라우저 fault injection은 미실시 |
| A12-04 | 새 사이트에서도 로컬 전용/DB 미연결이라는 전역 표현이 /legacy 전용 서버 DB와 혼동됨 | 메인 localStorage, /legacy 서버 저장소, 원본 운영 DB 분리 설명. 메타 title·팀 UI 명칭도 model simulator로 일치 | 소스 확인·타입·빌드 통과. 배포 후 metadata/root/legacy UI root 확인 필요 |
| A12-05 | /legacy의 팀 링크 복사가 location.origin만 복사하여 관찰자가 직접 방송과 미연결인 새 메인으로 들어감 | 팀 링크를 origin+'/legacy'로 변경 | 소스 확인·타입·빌드 통과. Clipboard/새 브라우저 흐름 root 확인 필요 |

초기 의심한 최소 반경 0.3m 허용은 버그로 채택하지 않았다. root의 요구 범위 정정에 따라 0.65m는 기본 가상값이며 사용자의 반경 조절 요구를 유지한다. UI 0.3~3m 범위는 유지하고 가상 설정임을 표시했다. 실제 trajectory가 설정한 반경을 준수하는지 검사했다.

## 직접 실행한 증거

| 검사 | 결과 | 증거 |
|---|---|---|
| 기존 핵심 13개 회귀 | 모두 PASS | `outputs/agent12/regression-tests.log` |
| 개인 편집 rev149 추가 독립 불변식 | 0.1m/s 419.95s, 0.35m/s 121.72s, 0.8m/s 53.75s 완주. 최소 기체거리 0.73480m | `outputs/agent12/astra-scene-invariants.log` |
| 내장 2대 생성 지도의 독립 불변식 | 0.1/0.35/0.8m/s 모두 완료, 최소 거리 0.53852m | `outputs/agent12/astra-generated-invariants.log` |
| 자동차 가상 반경 0.3/0.65/1.0m | 넓은 12×8m 지도에서 모두 설정 곡률·전진·완주 통과 | 위 invariant 로그 |
| 실제 pointer handler | 층별 goal·숨은 handle·현재 pose층 보존 통과 | `outputs/agent12/editor-events.log` |
| TypeScript | `npx tsc --noEmit --incremental false` exit 0 | `outputs/agent12/typecheck.log` (진단 없음) |
| 전체 build | `npm run build` exit 0, prebuild Worker 생성 포함 | `outputs/agent12/build.log` |

13개 회귀: scene-local, solid-delivery, carried-helmet, vibe-mission, robot-spawn, code-export-safety, robot-code-export, front-projection, edited-driving, planner, mission, factory, fleet-roster. 초기 읽기 검증에서는 single-snapshot도 PASS. 기존 edited-driving은 rev149 53.72초, 추가 상자 22.54초, 기체 drag 22.76초를 재확인했다. 시간 차이는 tick 간격 .02와 .05 차이이며 완료 여부·안전 조건은 일치한다.

독립 invariant는 각 계획 segment에 대해 물리 Scene만 사용한 연속 원호/직선 판정, car 전진 내적·설정 곡률, floor 이동 시 x/y 유지, 매 tick 이동거리 상한·각속도·정지회전 없음, 차체 장애물 비관통, 기체 분리, 종료 시 모든 예약 해제, 원본 Scene JSON 불변을 검사했다. 따라서 실제 편집 지도 수정이 장애물을 제거하거나 순간이동해서 통과했다는 반례는 이 입력들에서 발견하지 않았다. 미래 가상 예약의 초기 구간 유예는 물리 장애물 목록을 제거하지 않으며 runtime 기체 간격 판정도 유지한다. 임의 모든 장면의 완전성 증명은 아니다.

처음 10×6m 반경 1.0m 예시는 오른쪽 목표 후 회전 여유가 부족해 `충전 앞 대기점` PlanningError로 거부됐다. 검사를 무시하지 않았고 해당 결과를 안전한 탐색 실패로 판정했다. 곡률 준수 자체의 검사는 12×8m 회전 여유를 제공한 지도로 분리했다.

## 공개 소스와 입력 분리

새 `scripts/test-astra-scene-invariants.mjs`는 인수 없이 내장 생성 지도만으로 통과한다. 첫 CLI 인수에 사용자가 선택한 Scene JSON을 지정하면 추가 입력을 검사한다. 공개 소스에 개인 fixture 내용·경로를 하드코딩하지 않았다. 개인 입력 재현 명령은 이 로컬 보고에만 기록한다:

```powershell
node --experimental-strip-types scripts/test-astra-scene-invariants.mjs ../outputs/root/edited-driving-repro-scene.json
node --experimental-strip-types scripts/test-astra-editor-events.mjs
```

원래 존재하던 `test-edited-driving.mjs`는 기존과 같이 copyroot fixture에 의존한다. 공개 배포의 기본 npm build에는 테스트/개인 fixture가 필요하지 않으며 이 파일 자체의 이동·삭제는 하지 않았다.

## 남은 정확한 범위

- **웹 구현**: 공통 편집, 1~4대, 단일 lock 생략, 예약/충전, 명시 임무, 안전모 소유, 합성 카메라, 교육 코드 export, 로컬 실행 기록. p95 편집 지연 벤치마크는 미실시.
- **가상 시연**: 배터리·충전·QR·엘리베이터·집기/전달. 실제 센서 및 팔/차체 CAD 검증 아님.
- **외부 미연결**: Unity/CARLA/Gazebo 실행기, 실 Pi5/카메라/모터/팔/QR decoder/제조사 API, 실제 YOLO PPE→지도 신원 연결.
- **웹에서 아직 없음**: 메인 화면의 다중 PC 동일 실행 직접 전송 및 공동 지도 동기화. 팀원 관찰은 현재 회의 앱 화면 공유 안내. /legacy의 별도 WebRTC 코드는 STUN만 있고 TURN 없음; 다중 PC 실제 연결 미확인.
- **조사만 완료**: 무한 순찰/PPE 미착용 검출/안전모 재고 할당/순찰 복귀/battery<=30% 정책, 실센서 ghost 소거. `research/agent8/PATROL_PPE_BATTERY_FEASIBILITY.md`는 구현 증거 아님.
- **root 배포 게이트**: 새 전용 Sites/Git/DB/R2만 사용, / 및 /legacy 새 서버 검사, 닉네임·게시/댓글·파일·실행방 권한·시점 댓글, 다운로드/영상/UI, 독립 Astra 재검토. 이 담당은 서버 쓰기 검사나 배포를 하지 않았다.

## 변경 파일 / 인계

제품: `lib/scene-runtime.ts`, `app/SceneLab.tsx`, `app/TeamSharingGuide.tsx`, `app/LegacyPage.tsx`, `app/layout.tsx`, 재생성 `public/scene-worker.js`. `lib/scene-local.ts`는 최소 반경 변경 시도 후 원래 .3 검증으로 복원했으며 의미 변경 없음.

검사/문서: 새 `scripts/test-astra-scene-invariants.mjs`, `scripts/test-astra-editor-events.mjs`, `docs/REQUIREMENTS_STATUS.md`, 본 보고와 outputs/agent12 로그. React 검토 스킬의 hooks·ref·상태 수명주기·dialog focus·타입 항목을 검토했다. 사용자 탭은 열거나 조작하지 않았다.

제품 작성 동결. 다음 독립 Astra 담당은 반례만 보고하는 모드에서 최신 소스와 이 증거를 재검토하고, 수정이 필요하면 root가 작성권을 다시 지정한다.

## A13-01 독립 BLOCK 후 재수정 — 2026-10-14

13번 독립 검토에서 `배달 안 해줘`, `전달하지는 마`가 실행 가능한 deliver_helmet으로 변환되는 반례를 제시했다. root가 12번에게 단독 작성권을 재지정하여 `lib/vibe-mission.ts`, `app/VibeMissionWorkspace.tsx` 및 전용 검사/상태표를 수정했다.

- 전달/배달/픽업 등 행동 동사에 동일한 부정 처리를 적용했다. 하지는 마/하지도 마, 안·못, 말고/않도록, 보조사·일부 강조 표현, 취소/금지/중단을 보수적으로 거부한다.
- 긍정 전달/배달 종결 한 개만 허용한다. 전달/배달 단어가 언급되었다는 이유만으로 실행 의사를 추론하지 않는다. 지원 예: `전달해줘`, `전달해 주세요`, `배달해주십시오`. 질문·다중 전달절·다른 미지원 종결은 거부한다.
- PPE 대상 상태 설명인 `안전모를 착용하지 않은 작업자에게 전달해줘` 및 기존 긴 예문은 유지한다. 사용자 대상 설명을 실제 센서의 PPE 판정으로 취급하지 않는다.
- 일반 자연어 전체 이해 기능이 아니라 제한된 문장 규칙임을 UI에 명시했다. 적용 전 기체·대상·순서 미리보기를 요구한다. 새 생성 시 이전 JSON을 비우므로 거부된 명령 화면에 이전 긍정 명령 코드가 남지 않는다.

재검증:

| 검사 | 결과 |
|---|---|
| 13번 원본 negative-mission-repro.mjs | 두 반례 REJECT, 기존 긍정/부정 대조 유지, exit 0 |
| 새 test-mission-negation.mjs | 부정/미지원 38개 거부, 긍정/PPE 상태 대조 8개 수락, Scene 불변 |
| test-vibe-mission.mjs | 기존 의미/거부 검사 및 실제 주행 전달·다중 완료 PASS |
| test-robot-code-export.mjs / test-code-export-safety.mjs | PASS |
| tsc --noEmit --incremental false | exit 0 |

증거는 `outputs/agent12/a13-negation-fix-tests.log`, `outputs/agent12/a13-negation-typecheck.log`. `product-freeze-hashes.json`을 최신 제품 8개(기존 6개 및 vibe-mission.ts/VibeMissionWorkspace.tsx)로 갱신했다. 이번 수정 뒤 전체 build는 root 최종 패키징에서 수행하기로 명시적으로 인계했으며 이전 build 로그를 새 수정의 build 증거로 승격하지 않는다. 13번 독립 재검증까지 BLOCK 해제는 아직 주장하지 않는다. 제품 작성 재동결.
