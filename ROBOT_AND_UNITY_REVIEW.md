# Raspbot V2 · Pi 5 · Unity 기능 검토

2026-10-13. 팀 합의 전 설계 검토입니다. 실제 기체 제어나 Unity 실행 완료를 의미하지 않습니다.
홈 IoT 키트는 범위 밖이며 양팔은 1차 목표 완료 후 별도 단계입니다.

## Unity에서 가능한 범위

| 기능 | 구현 방식 | 검증 한계 / 필요한 데이터 |
|---|---|---|
| 전후·좌우·대각선·회전 | 메카넘 순/역운동학, 4륜 속도 입력 | 휠 반경, 축간 거리, 바퀴 배치·회전 방향 |
| 충돌과 회피 | Collider/Rigidbody, 가상 센서, 경로 계획 | 원본 3D/CAD, 충돌 형상, 환경 치수 |
| 목적지→복귀 단일 명령 | 임무 상태기계, 전역/지역 계획, 복귀 상태 | 위치 추정 방식, 목적지 표현, 실패·중단 규칙 |
| 초음파 센서 | 여러 Raycast의 부채꼴 근사, 잡음·지연·누락 주입 | 실제 각도·범위·반사 특성. 음향 물리와 동일하지 않음 |
| 4채널 라인 센서 | 센서 위치에서 바닥 색/라인 마스크 표본 | 센서 위치·임계값·바닥·조명 보정 |
| 2축 카메라 | Camera + 팬·틸트 관절, RenderTexture | 장착 변환, 실제 FOV/해상도/왜곡·관절 한계 |
| YOLOv8n | 가상 카메라 프레임을 Python 추론 서버 또는 Pi로 전송 | 실제 모델, 전처리/NMS/좌표 변환/클래스 확인 |
| BBOX·트래킹 ID | 프레임 ID와 시각을 맞춰 결과 overlay | 가림·재진입 ID 변경 시험, 신원 인증과 구분 |
| 보호장비 미착용 판단 | PPE 전용 데이터와 클래스·판단 규칙 | 기본 일반 모델에 안전모/안전띠 클래스가 있다고 가정 금지 |
| OLED/RGB/부저 | 화면 상태·색·소리로 입출력 매핑 | 실제 전기적 상태·음량·소비전류는 보장 불가 |
| 양팔 파지·전달 | ArticulationBody, IK, 접촉·그리퍼 모델 | 양팔 제품·관절·질량·무게중심·토크·그리퍼 한계 |
| 고장 조건 | 통신 지연/끊김·센서 실패·기능 비활성 주입 | 실제 제어보드 watchdog와 별도 검증 |

일반 WheelCollider는 자동차용 slip 마찰 모델입니다. 메카넘 롤러의 비등방 마찰을
그대로 제공한다고 가정하지 않습니다. 학원 시연에는 운동학 기반 모델부터 시작하고,
실측 미끄러짐·가속·정지거리로 보정한 힘 모델로 확장합니다.

## 권장 실행 구조

Unity 데스크톱이 가상 기체·환경·센서를 실행 → Python/ROS의 인지·계획 모듈이 판단 →
Unity 제어 adapter가 명령 적용 → 결과 기록. 웹사이트는 Unity 창의 영상을 공유·녹화합니다.
따라서 모든 팀원 PC에 Unity를 설치할 필요는 없습니다. 발표자 PC에는 Unity가 필요합니다.

Pi 연산을 시험할 때는 가상 센서 입력을 Pi의 알고리즘에 전달하고 명령을 Unity로 되돌리는
구조를 사용합니다. 이때 물리 모터 출력은 분리/비활성화합니다. Pi 처리 지연은 측정할 수 있지만
실제 바닥 주행 성능을 증명하지는 않습니다. Unity PC에서 얻은 FPS를 Pi5 FPS로 표기하지 않습니다.

ROS-TCP-Connector는 후보입니다. Unity 버전과 ROS2 Humble의 실제 호환 조합은 smoke test 후 고정합니다.
웹 영상 공유를 선택했으므로 ROS TCP를 브라우저에서 직접 연결할 필요는 없습니다.

## Pi 5가 사이트에 연결될 때 (후속 구현 설계)

단순 Pi 부팅만으로 원격 사이트가 자동 발견할 수 없습니다. Pi agent가 outbound HTTPS/WSS로
등록하고, 연결 토큰·기체 ID·보드/SDK 버전·지원 기능 목록·heartbeat를 보고하게 합니다.
카메라/센서 읽기, 부저/RGB/OLED, 서보, 모터 기능은 하나씩 실제 probe 후 available/unsupported/error로 표시합니다.
전압·배터리 잔량·엔코더·IMU는 기체 보드에서 실제 제공하는 경우에만 노출합니다.

명령 경로: 서버가 단일 조작자 권한·명령 유효시간 검사 → Pi agent가 로컬에서 다시 검사 → 보드 driver.
사이트는 임의 shell 명령, pip 설치, Git 병합, GPIO 전체 초기화를 원격 명령으로 제공하지 않습니다.
heartbeat 만료·명령 만료 시 로컬 정지, 프로그램 종료 시 정지, 물리 비상정지 경로를 따로 검증합니다.
익명 닉네임 참여자는 관찰만 허용하고 실제 모터 제어에는 별도 명시적 장치 권한이 필요합니다.
이번 사이트 릴리스에는 실제 장치 자동 발견/제어가 포함되지 않습니다.

## 확보해야 할 자료

- 기체 보드 버전/실물 배선/펌웨어/SDK.
- 제조사 또는 강사님 제공 URDF·CAD·mesh와 사용 조건.
- 실제 차체 치수·질량·무게중심·휠 반경·축간 거리.
- 카메라 장착 위치/FOV/보정, 센서 위치/범위/지연.
- YOLOv8n 가중치·클래스명·입출력 규격·평가 데이터.
- 시연 환경/목적지/왕복 성공 기준 (팀 협의).

## 공식 출처

- https://github.com/YahboomTechnology/Raspbot-V2
- https://docs.unity.com/en-us/engine/6000.5/manual/physics-section/physics-overview/collision-section/collider-shapes/wheel-colliders/friction
- https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/camera/targettexture
- https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/articulationbody
- https://github.com/Unity-Technologies/ROS-TCP-Connector
- https://github.com/ultralytics/ultralytics/blob/main/examples/YOLOv8-ONNXRuntime/README.md
