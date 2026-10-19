# Astra 13 독립 릴리스 검토 — PASS with limits

2026-10-14. 대상은 복사본 mechanic-hub다. **A13-01 수정 재검증 통과, 검토한 소스와 로컬 실행 범위에서 새 릴리스 차단 반례 없음.** root의 최종 package/build/새 사이트 배포 및 배포 후 서버 검증으로 진행할 수 있다. 전체 사용자 요구 구현 완료, 실물 연동 완료, 공개 사이트 동작 완료를 의미하지 않는다.

제품 코드·기존 운영 사이트·원본 폴더·운영 DB·사용자 편집 탭을 수정하거나 조작하지 않았다. 테스트/보고서는 copyroot outputs/agent13 및 research/agent13에만 작성했다. 빌드와 원격 배포는 root에 맡겼다.

## A13-01 발견, 수정 후 독립 재검증

초기 검토에서 `안전모를 작업자에게 배달 안 해줘`, `안전모를 작업자에게 전달하지는 마`를 parseMission이 deliver_helmet JSON으로 수락했고 applyMission도 적용했다. 원본 실패 로그 `negative-mission-regression.log`는 보존했다. root에 BLOCK을 알린 뒤 검토를 중단했고, 12번 수정 동결을 받은 후 재개했다.

이번에 본인이 원본 `negative-mission-repro.mjs`를 다시 실행하여 두 입력 모두 거부, 기존 긍정/부정 대조 유지, exit 0을 확인했다. 제품의 test-mission-negation.mjs도 직접 실행하여 부정/미지원 38개 거부, 긍정/PPE 상태 설명 8개 수락을 확인했다. 대상의 미착용 설명을 임무 행동의 금지와 혼동하지 않는 대조가 유지된다.

추가로 실제 VibeMissionWorkspace.tsx를 TypeScript transpile 후 JSX/hook mock으로 실행했다. 이전 유효 JSON과 verified 상태를 의도적으로 넣은 다음 실제 생성 버튼 콜백에 두 부정문을 전달했다. 두 경우 모두 code='', verified=null, 오류 메시지로 전환했다. 정규식뿐 아니라 UI 생성 실패 상태도 확인했다. 일반 자연어 전체 이해가 아닌 제한된 긍정 종결 문법이라는 UI 및 상태표 설명을 확인했다. 모든 한국어 부정 표현의 완전성은 주장하지 않는다.

## 직접 만든 독립 검사

`outputs/agent13/independent-review.mjs` 및 `.log`:

| 검사 | 직접 실행 결과 |
|---|---|
| 실제 편집 rev149, 2대 car 경로 | 13,729개 표본을 독자적인 직선/원호 좌표식과 물리 객체의 0.22m 팽창 사각형으로 검사. 물리 경계 침범 없음 |
| 전진/곡률 | segment 전진 내적 양수, 설정 최소 반경 준수, 정지 회전 없음 |
| 미래 예약 초기 유예 후 복원 | R1 초기 위치를 덮는 R2 미래 park 예약이 후속 구간에서 복원되는지 검사. 후속 표본 모두 예약 외부 |
| 실제 물체 제거 우회 반례 | 초기 위치에 box, worker, helmet 각각 추가. worker/helmet은 blocking=false 사용. 모두 해당 물체 ID를 포함한 계획 실패로 거부 |
| 불규칙 tick 실행 | dt 0.011/0.037/0.049초 반복. 0.1m/s 420.204초, 0.55m/s 77.551초, 0.8m/s 60.636초 완료. 최소 기체 간격 모두 0.734801m |
| runtime 안전 | 매 tick 물리 장애물 여유, 속도에 따른 이동거리 상한, 곡률 각속도 상한, 정지 회전 금지, 종료 후 예약/lift 해제, 입력 Scene JSON 불변 통과 |
| 실제 Worker 생성 실패 | SceneLab의 실제 effect를 실행하고 Worker constructor 예외 주입. 이전 routes 제거, checking=false, 시작 실패 메시지 확인 |
| 실제 생성 버튼 콜백 | 부정문 생성 실패 시 이전 JSON/verified 초기화 확인 |

불규칙 tick의 완료 시간은 고정 .02/.05초 및 브라우저 시간과 동일할 필요가 없다. 점 단위 진행에서 남은 tick을 다음 점으로 이월하지 않으므로 시간이 달라질 수 있으며, 여기서는 안전성과 종료 여부를 검사했다. 수치 표본 검사는 연속 수학적 완전성 증명은 아니다. 기존 arcClear/segmentClear 기반 검사도 별도로 실행했지만 그 구현과 독립적인 표본 검사 결과를 함께 남겼다.

`outputs/agent13/export-review.mjs` 및 `.log`:

- 실제 navigate JSON의 층 2 목표 적용, 다른 기체/객체/원본 유지, 선택 ID·revision·잘못된 좌표·추가 필드 거부.
- R4만 존재하는 희소 구성에 R1 추가, 기존 R4 데이터 보존.
- 정상 및 개행/주석 탈출 시도 ID 등 3개 export를 본인 output 폴더에 저장. 생성 Python을 AST 검사한 후 실제 dry-run 실행했고 PROGRAM이 해당 JSON과 정확히 일치했다.
- Notebook 4.5, 코드 셀과 .py 일치, cell ID, 파일명 안전성 확인. read.md에서 실물/미착용 판정 미구현 및 손 전달과 착용의 구분을 확인했다.

## 기존 회귀를 직접 다시 실행한 결과

과거 보고서의 PASS 인용으로 대체하지 않았다. `selected-regressions.log`에 10개 명령의 exit 0과 출력을 기록했고 `scene-local.log`에서 추가 현재 장면 회귀를 실행했다.

- 원본 A13 반례, mission-negation, astra-scene-invariants, astra-editor-events, carried-helmet, front-projection, robot-spawn, vibe-mission, solid-delivery, single-snapshot.
- scene-local: 1/2/3/4대 완료, 희소 R1/R2/R4, 가상 층 이동 후 충전, 전진 자동차, 연속 원호 모서리 충돌, 양 iteration 순서에서 1cm 선행 기체 통로 우선.
- 기본 단일→4대 추가 흐름 114.20초 완료.
- 생성 지도 0.1/0.35/0.8m/s 완료, 설정 최소 반경 0.3/0.65/1.0m 검사 통과.
- __proto__/constructor/toString 안전모의 실제 전체 전달 실행, 바닥→기체→작업자 손 상태, 대상 삭제/새 seed 정리, 중복 claim 거부, 카메라 own-carry 및 객체/기체 삭제·크기·방향·층 투영 확인.
- 실제 TSX pointer handler의 목표층 drag, 숨은 목표 hit-test 제외, paused pose층 유지 확인. 브라우저 pointer 재현은 root가 별도로 진행했으며 본인 테스트가 대신하지 않는다.

## 38개 요구사항 상태표 대조

`docs/REQUIREMENTS_STATUS.md`의 38개 행과 관련 소스를 읽었다. 다음은 검토 범위와 증거의 분류다. 각 행을 실물/브라우저 종단간 실행했다는 뜻은 아니다.

| 영역 | 독립 확인 범위 | 남는 제한 |
|---|---|---|
| 공통 편집/1~4대/희소/단일 lock | schema, commit/clearRuntime, fallback, editorEntities, pointer handler 및 roster 실행 | 모든 가능한 편집 지도에 경로 존재 보장 없음; 사용자의 실제 탭은 조작하지 않음 |
| 주행/예약/충전/오류 | 신규 불변식 검사 및 현재 scene-local 실제 실행 | 가상 반경/배터리/충전이며 실제 CAD·모터·충전 센서 미검증 |
| 사람/안전모/소유권 | 원본 특수 ID부터 전달 완료까지 runtime·render·중복/삭제 검사 | 팔 reach/착용 판단 없음; 손 전달은 미착용으로 표시 |
| 카메라/외형/배터리/속도 | projectFront 직접 실행; drawMap의 동일 scene/pose/time 경로; .toFixed(2)와 공통 speed 소스 확인 | 합성 영상/기호 외형, 실제 센서·제조사 CAD 아님 |
| 바이브/JSON/코드/교육 export | 본인 추가 실행 및 기존 회귀 직접 실행 | 제한 문법, 실제 PPE 인식·Pi 전송 없음 |
| 녹화/다운로드/dialog | MediaRecorder/Blob/native dialog/초점복귀 소스 및 export 생성 실행 | 최종 브라우저 코덱·다운로드·키보드 동작은 root UI gate |
| 팀 공유/메인 기록 | guide, external preview, localStorage 사용과 명칭/metadata 확인 | 메인 직접 WebRTC/공동 지도 없음, 회의 앱 관찰 안내 |
| /legacy 서버/자료 보존 | /legacy route, 별도 서버 저장소 설명 및 새 hosting project ID 소스 확인 | fresh D1/R2, API/room/operator/댓글/업로드 실제 검사는 root 배포 gate |
| 엔진/실물/ghost/자동순찰 | 상태표와 UI/README의 미연결·미구현 표시 대조 | Unity/CARLA/Gazebo 실행 어댑터, Pi/팔/ROS/QR/API, ghost 자동 소거, 무한 순찰/PPE/재고/복귀/30% 충전 미완료 |

현재 문서의 '웹 구현', '가상', '미연결', '미구현' 분류를 부정하는 새 반례는 발견하지 않았다. 자동 순찰/PPE/재고/30% 정책은 외부 연결만 남은 상태가 아니라 웹 업무 흐름 자체도 미구현이다. 이를 전체 완료로 보고해서는 안 된다.

## 동결 및 공개 소스 범위

- 최신 `product-freeze-hashes.json`의 8개 제품 SHA-256을 독립 계산: **8/8 일치**. 결과 `outputs/agent13/freeze-hash-check.json`.
- source helper가 새 .git을 만든 상태를 읽기 확인했다. 본인은 stage/commit/push를 수행하지 않았다.
- git의 현재 공개 후보 목록에서 outputs/node_modules/.sites-runtime/.wrangler/.env/connection JSON 대상 검색은 0건이었다. 모든 자격증명을 포괄적으로 검사했다는 의미는 아니며 root의 최종 helper 패키지 목록이 배포 근거다.
- hosting.json의 project_id는 root가 지정한 새 프로젝트 appgprj_6acef751a74c8191ad7df82853b8c6a0. 원본 배포 프로젝트 변경은 하지 않았다.

## 최종 릴리스 게이트

**로컬 소스 독립 검토: PASS with limits. A13-01 해제.**

root에서 최신 소스 최종 build/package/새 저장소 push/새 사이트 배포 후 / 및 /legacy 공개 접근, fresh DB/파일 저장소, 게시판·댓글·시점 댓글·업로드·단일 조작자 제약, 핵심 UI와 다운로드를 확인해야 공개 릴리스 완료로 보고할 수 있다. 다중 PC WebRTC 실제 연결은 별도 미검증이며 TURN 부재를 유지해야 한다. 본인이 최종 build나 서버 검사를 했다고 보고하지 않는다.
