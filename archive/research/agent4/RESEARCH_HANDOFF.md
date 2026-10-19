# 4번째 서브에이전트 연구 인계

작성일: 2026-10-14 (Asia/Seoul). 상태: 문서 연구 및 소형 자료 준비 완료, 기능 구현 미착수.

이 문서의 ‘학습’은 공식 문서를 검토하고 구현 담당에게 지식을 전달했다는 뜻이다. 모델을 영구 훈련하거나 사용자의 자료를 학습 서비스에 업로드하지 않았다. 현재 배포 사이트와 원본 소스, DB, 카메라 세션, 서비스는 변경하지 않았다. 5번째 담당은 향후 별도 구현 승인 후 이 자료를 사용한다.

## 현재 코드에서 확인한 근거

원본 `메카닉/mechanic-hub`를 읽기만 했다. 이후 복사본에서 구현 전 다시 확인해야 한다.

- `app/GazeboCamera.tsx`: 메타/영상 조회 600ms, 위치 전송 850ms. 웹 경로의 위치를 프록시에 반영하는 구조이며 엔진에서 계산한 물리 주행을 웹으로 되돌려 받는 완성형 구조가 아니다.
- `app/api/camera/route.ts`: 세션 만료 7,200,000ms, 영상 최대 2fps. 따라서 연속적인 고프레임 영상과는 다르다.
- `app/FleetLab.tsx`: `time > 0`이면 환경 편집과 기체 삭제 차단. 단순 일시정지로는 해제되지 않는다. 게시된 스냅샷 공간은 8×4m로 고정된다.
- `lib/factory.ts`: `prepareFactory`에서 최대 100,000회 `tickFleet` 동기 검증. 조작 적용 시 UI 정지의 유력 원인이지만 성능 측정으로 비중을 확정하지 않았다.
- `lib/fleet.ts`: 최대 4대, 실행 후 추가 금지. 자유 임무보다 정해진 시연 동작에 맞춘 구조다.
- `app/VibeWorkspace.tsx`: 규칙 기반 안전모 임무 코드 표시. 객체 생성·장면 패치 적용 기능은 없다.
- `app/page.tsx`: 내장 영상은 `canvas.captureStream(24)`, 외부 영상은 `getDisplayMedia`이다. 엔진 선택만으로 외부 프로그램을 실행하거나 연결하지 않는다. `01 / 01`은 고정 문자열이다.

## 11개 요구와 완료 판정

### R1. 기체 정면 카메라 실시간 동기화

원인: 여러 HTTP 조회 주기와 JPEG 전송의 누적 지연, 실행기 미실행·만료·장면 전환도 가능하다. 현재 사용자의 실제 실패 원인은 실행 재현 없이 확정할 수 없다.

설계: `runId/sceneRevision/robotId/simTime/poseSequence/frameSequence`를 공통 계약으로 지정한다. 한 실행에서 위치 권위자를 하나만 선택한다(웹 시연 또는 엔진). 지속 상태 채널과 영상 채널을 구분하고 지연·마지막 프레임·장면 적용 상태를 표시한다. Gazebo CPU 렌더링은 가능하지만 목표 FPS는 측정해야 한다. [S1]

완료 판정: 기체 선택 전환, 이동·회전·정지, 추가·삭제, 장면 변경 각각에 대해 동일 ID/장면 영상임을 검증한다. 타임스탬프로 지연의 중앙값·상위95%·최대값을 보고하고 팀이 정한 목표를 통과한다. 지도 이동과 동떨어진 이전 영상은 ‘동기화됨’으로 표시하지 않는다.

### R2. 객체 이동 버벅거림 및 선택 불가

원인: 주 스레드의 전체 경로 검증, 별도 SVG/Canvas 입력 계층, 실행 후 편집 제한이 복합적이다.

설계: 통일된 hit-test/선택/변환 상태를 두고 Pointer Capture로 드래그 중 포인터 이탈을 처리한다. 드래그는 가벼운 미리보기, 최종 검증은 Worker에 보내고 최신 요청만 적용한다. 취소 이유와 충돌 위치를 표시한다. [S5, S6]

완료 판정: 객체별 이동·크기·회전·삭제와 경계 밖 드래그 취소를 검사한다. 최소 사양 PC에서 프레임/입력 지연을 측정한다. 검증 중에도 입력과 취소 버튼이 응답해야 한다. 팀원 공용 변경은 버전 충돌 확인을 거치고 개인 초안은 독립적으로 편집한다.

### R3. Unity·CARLA·Gazebo 실제 연결

원인: 선택 UI와 엔진 실행기·카메라·물리 연결은 별개다.

설계: 공통 scene/mission/telemetry 계약과 엔진별 adapter를 만든다. `미설치/미연결/연결됨/장면 적용 중/준비/오류`를 실제 handshake로 구분한다. Unity camera track, CARLA sensor callback, Gazebo camera topic을 각각 어댑트한다. CARLA no-rendering은 GPU 센서가 빈 값을 반환하므로 CPU 카메라 해결책으로 표기하지 않는다. [S1, S3, S4]

완료 판정: 각 엔진별 독립 실제 실행 증거, scene round-trip, 기체 pose·영상·오류·종료 처리 검증이 필요하다. 미설치 엔진은 선택 가능한 안내와 ‘연결 미완료’를 표시하고 동작 완료로 주장하지 않는다.

### R4. 바이브 명령 객체가 Free Space에 들어가지 않음

원인: 현재 기능은 코드 예시와 기존 객체를 이용한 임무 요청만 처리한다.

설계 제안: 자연어를 `ScenePatch` 데이터로 변환한다. 객체 추가·변경·삭제, 기체 생성, 임무를 ID로 명시하고 `baseRevision`과 수정 미리보기를 둔다. 좌표 미지정은 자동 배치 초안으로 해결한다. schema/경계/충돌/참조 검증 후 원자 적용하며 임의 코드를 실행하지 않는다. AI 공급자 선택·키·비용·오프라인 규칙 모드는 향후 결정한다.

완료 판정: 예시 ‘상자 3개, 작업자 1명, R2가 안전모 전달’을 넣으면 객체 수·ID·임무 연결이 미리보기와 적용 후 일치한다. 잘못된 요청과 오래된 revision은 기존 지도를 보존한다. Undo/Redo와 저장·재로드 결과가 같다.

### R5. Unity 영상 소스 선택 후 화면이 없음

원인: `getDisplayMedia`의 창 선택·공유가 필요한 구조다. 엔진 선택은 창 선택을 대신하지 않는다.

설계: ‘웹 미리보기/외부 창 공유/엔진 카메라 스트림’을 독립 영상 소스로 표시한다. 외부 창 공유는 사용자 동작과 브라우저 권한이 필요하며 자동 우회할 수 없다. Unity 직접 영상은 별도 WebRTC 패키지·연결기를 구성한다. [S3, W1]

완료 판정: 공유 허용/취소/창 종료/권한 거절마다 정확한 메시지, 실제 창 출력, 팀원 수신 검증. Unity 실행 여부를 영상 소스 이름만으로 판단하지 않는다.

### R6. 기체 2·3대의 동작 범위 고정

원인: 고정 공간·기체 번호별 출발/진행 방향·단일 통로·정해진 임무 구조다.

설계: 기체별 시작 pose·waypoint·goal·task·운동 모델을 데이터화한다. 지도 영역/층과 여러 예약 구역을 별도 엔티티로 관리한다. 공용 충전소 1개와 대기열은 유지하고 자유 임무와 충전 임무의 충돌을 해결한다.

완료 판정: 1·2·3·4대에서 서로 다른 시작/목표/경유점, 삭제 후 희소 ID, 좁은 통로 예약·충전 대기열을 검사한다. 자유 임무가 가능한 범위와 경로 불가능 판정을 명확히 한다.

### R7. 다중 기체에서도 단일 기체처럼 편집

원인: 편집기와 잠금 조건이 이원화되어 있다.

설계: 단일·다중이 공유하는 editor/store/schema를 사용한다. 기체 포함 모든 엔티티의 이동·회전·속성을 지원한다. 실행 도중 변경은 정지→예약 정리→검증→재계획→재개 절차로 제한한다. 발표자 제어권과 팀원 초안 편집권을 구분한다.

완료 판정: 두 모드의 같은 객체에 같은 편집 조작이 적용된다. 잠긴 이유와 해제 방법이 보인다. 편집으로 이미 충전·통로를 점유한 기체가 순간 이동하거나 이중 점유하지 않는다.

### R8. 산업형 전진 전용·자동차식 U턴

원인/주의: 2륜 전륜·후륜이라는 설명만으로 조향 모델은 결정되지 않는다. 차동구동은 제자리 회전이 가능할 수 있으며 산업 기체 전체가 후진 금지는 아니다. 이 프로젝트 정책으로 후진을 금지할 수 있다.

설계: 운동 모델을 car-like/차동/홀로노믹으로 분리한다. 요청한 모드는 횡이동·후진·제자리 회전을 금지하고 최소 반경, wheelbase, footprint를 설정한다. Smac Hybrid-A*의 `DUBIN`과 최소 회전 반경을 참고한다. 컨트롤러·복구·충전소 이탈에도 같은 조건을 적용한다. [S2]

완료 판정: 모든 경로 구간 전진 속도≥0, 곡률≤1/최소반경, 차체 충돌 없음. 좁은 막다른 길은 무리한 U턴 대신 불가 판정한다. 충전 후 역경로 후진이 남지 않는다. 실제 기체 반경 수치는 미확인이다.

### R9. QR·엘리베이터 층간 이동

설계: QR은 liftId/floor/정차점 식별로 취급한다. 가상 인식과 실제 영상 디코딩을 별도 모드로 표시한다. 상태기는 호출→예약→문 열림 확인→탑승→층 이동→하차→층 지도 재위치추정으로 만든다. Open-RMF adapter는 제조사 REST/WebSocket/ROS 인터페이스를 채우는 참고 구조이며 QR만으로 층 조작은 되지 않는다. [S8]

완료 판정: 두 층·2대 기체 탑승 순서, 잘못된 QR/층, 문 닫힘, 호출 실패/timeout, 점유 취소에서 안전 대기한다. 실물 연결은 제조사 API와 승인된 인터페이스가 필요하며 현재 확보되지 않았다.

### R10. 실행 세션 01/01과 작업 추가 UX

원인: 세션 개수는 고정 표시이며 작업 게시물·임무·실행 기록의 구분이 약하다.

설계: 작업(게시물), 임무(행동 순서), 실행(특정 지도/임무 버전의 한 번 수행), 실행방(공동 관찰)을 나눈다. 실제 기록 개수를 조회하고 ‘새 실행/다시 실행/작업 등록’과 간단한 설명을 배치한다. 기존 댓글 시간은 녹화 시작 기준이라는 정보를 보존한다.

완료 판정: 첫 입장 사용자도 작업 등록→임무 선택→실행→녹화 저장→시점 댓글→재생 이동을 수행한다. 실행별 지도/임무/엔진/코드 버전이 남고 재실행은 별도 ID다.

### R11. 지도 우측 상단 카메라와 방송 합성

설계: 선택 기체·영상 종류·연결 상태·지연이 보이는 inset을 지도에 둔다. 확대/접기와 객체 조작 영역을 보장한다. HTML overlay는 Canvas capture에 자동 포함되지 않으므로 지도+카메라를 별도 합성 Canvas로 출력하거나 명시적 전체 화면 공유를 사용한다. cross-origin 영상의 Canvas 오염 가능성도 검증한다. [S7, W2]

완료 판정: 지도 inset/전체화면/팀원 방송/녹화에 같은 기체 영상이 나온다. 선택 기체 삭제 시 대체 대상과 상태가 바뀌고 이전 영상이 남지 않는다. 2명 이상 별도 네트워크에서 수신 검증이 필요하다.

## 공식 자료 인덱스

8개 문서 파일은 `materials/`에 실제 저장되어 있다. URL·최종 URL·HEAD 결과·크기·SHA256·목적은 `manifest.json`이 원장이다. HTML은 본문 참고용이며 오프라인에서 링크·CSS까지 완전 재현하는 패키지가 아니다. 내려받은 자료/예제를 실행하지 않았다.

| ID | 공식 자료 | 로컬 파일 |
|---|---|---|
| S1 | [Gazebo Sim 8 Headless Rendering](https://gazebosim.org/api/sim/8/headless_rendering.html) | materials/gazebo8-headless.html |
| S2 | [Nav2 Jazzy Smac Hybrid-A*](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/planners_plugins/smac/smac_hybrid/configuring_smac_hybrid/) | materials/nav2-jazzy-smac-hybrid.html |
| S3 | [Unity WebRTC 3.0 Video Streaming](https://docs.unity.cn/Packages/com.unity.webrtc%403.0/manual/videostreaming.html) | materials/unity-webrtc-video.html |
| S4 | [CARLA Retrieve Simulation Data](https://carla.readthedocs.io/en/latest/tuto_G_retrieve_data/) | materials/carla-retrieve-data.html |
| S5 | [MDN setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) | materials/mdn-pointer-capture.html |
| S6 | [MDN Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) | materials/mdn-web-workers.html |
| S7 | [MDN Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) | materials/mdn-canvas-capture.html |
| S8 | [Open-RMF Lift Adapter Template](https://github.com/open-rmf/lift_adapter_template) | materials/rmf-lift-adapter-README.md |

추가 공식 링크(다운로드하지 않음):

- W1 [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia): HTTPS/사용자 선택·권한 요구.
- W2 [MDN requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback): 영상 프레임 처리와 메타데이터 기반 동기화 참고.
- W3 [Unity ROS-TCP-Connector](https://github.com/Unity-Technologies/ROS-TCP-Connector): ROS 메시지/좌표 변환 참고. 현재 Unity·ROS 2 Jazzy 버전 호환성은 실제 조합 확인 필요.
- W4 [Gazebo Harmonic 설치](https://gazebosim.org/docs/harmonic/install/): Harmonic은 Sim8, Ubuntu Jammy/Noble 지원 문서.
- W5 [ROS 2 Jazzy Ubuntu 설치](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html): 조회 시 bot-check 응답이 나와 본문 검증 실패. 공식 지원 조합 최종 확인은 [REP-2000](https://www.ros.org/reps/rep-2000.html)과 실제 패키지 메타데이터로 재확인한다.

## 향후 설치 후보와 미확인 사항

이번에는 아무 패키지도 설치하지 않았다. 다음은 구현 단계의 선택지이며 자동 설치 지시가 아니다.

| 대상 | 후보 | 제약·미확인 |
|---|---|---|
| 기준 ROS 환경 | Ubuntu 24.04 + ROS 2 Jazzy + Gazebo Harmonic/ros_gz | 22.04는 Humble 등 별도 검증 조합으로 운영. 배포판 혼용 금지, 팀 결정 필요 |
| 웹 성능 | 브라우저 기본 Pointer Events/Worker/Canvas, 기존 TS 도구 | 신규 대형 라이브러리 필요성 미확정 |
| Gazebo CPU | Mesa software rendering, Gazebo8, 메시지/이미지 bridge, 이미지 인코더 | 기존 설치 재사용 여부 확인. CPU/RAM/FPS 벤치마크 전 성능 보장 금지 |
| Unity | Editor/Hub, WebRTC, 선택적으로 ROS-TCP-Connector | 라이선스·버전·렌더링 드라이버·인코더 호환 확인. 엔진 대용량 다운로드 안 함 |
| CARLA | CARLA server + 일치하는 PythonAPI | no-rendering 카메라 불가. GPU 없는 PC에서 카메라 성능·지원 미검증; 외부 실행기 대안 |
| 산업형 주행 | Nav2 Smac planner/controller 또는 브라우저용 등가 구현 | 로봇 wheelbase/footprint/최소반경 확보 필요 |
| QR/엘리베이터 | 영상 QR decoder 후보 + Open-RMF lift adapter | QR 라이브러리 선정, 제조사 API·인증·문 상태 인터페이스 미확보 |
| 자연어 변환 | 규칙 기반 ScenePatch 우선, 선택 AI provider | API 키/비용/데이터 처리 정책 미결정; 임의 코드 실행 금지 |
| 팀 방송 | WebRTC signaling + 필요 시 TURN | 기존 사이트 수정 승인 없음. 타 네트워크 연결 테스트 미실시 |

Unity/CARLA 엔진·모델·Ubuntu ISO의 크기는 버전과 구성에 따라 달라 이번에 다운로드하지 않았다. 나중에 정확한 배포 파일을 정한 뒤 HEAD/공식 요구 공간·실제 여유 디스크·압축 해제 공간을 확인해야 한다.

## 5번째 담당에게 넘기는 순서

1. 사용자에게 구현 시작과 대상 범위를 별도로 승인받는다. 현재 복사본은 자료 준비 단계이며 배포 금지가 우선한다.
2. 공통 Scene/Robot/Mission/Run schema와 편집·실행 상태 전환을 설계한다.
3. 단일·다중 편집기를 통합하고 Worker 검증·기체별 자유 임무를 구현한다.
4. 자동차형 전진 전용 경로와 충전소 출입 재설계를 검증한다.
5. 한 엔진의 실제 연결부터 상태/영상/장면 동기화를 입증한 후 나머지를 확장한다.
6. ScenePatch 바이브 입력, 실행 세션 UX, 지도 inset·방송 합성을 추가한다.
7. QR·다층 엘리베이터는 가상 시연과 실제 연결을 분리해 진행한다.

어느 단계든 팀원 변경을 우선하고 한 파일 한 작성자를 유지한다. ‘가능/구현/실행검증/하드웨어검증/배포’를 별도로 보고한다. 원본·운영 사이트/DB 연결·배포는 현재 금지되어 있다.

## 준비 결과와 제한

- 실제 다운로드: 8개, 1,199,688바이트(약 1.14MiB), 다운로드 후 SHA256 재검증 8개 일치.
- HEAD는 모두 시도했다. CARLA HEAD는 429였지만 제한된 GET은 성공하여 79,010바이트 문서를 저장했다. Unity의 HEAD 선언 크기와 실제 GET 크기는 달랐으며 manifest에 둘 다 기록했다.
- 자료 다운로드는 파일당 2MiB/총20MiB 제한을 적용했다. 엔진·모델·ISO·실행 파일은 받지 않았다.
- 코드 수정·서비스 실행·설치·브라우저 조작·DB 변경·카메라 세션 생성·배포·원격 push는 수행하지 않았다.
- 현재 사용자가 겪는 오류의 실행 재현, 성능 측정, Unity/CARLA/Gazebo 실제 통합 검증은 하지 않았다. 문서의 완료 판정은 향후 검증 요구이며 통과 주장 아니다.
