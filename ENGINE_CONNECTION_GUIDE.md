# Unity / CARLA 적용 설정

2026-10-13. 현재 운영 사이트는 엔진 선택과 외부 실행 영상 공유까지 지원합니다. 엔진 원격 실행기는 미구현이며, 웹 2D 미리보기와 실제 엔진은 별도입니다.

## 1. 지금 사용할 수 있는 영상 공유

1. 발표자 PC에 Unity 또는 CARLA 실행 환경을 준비하고 실제 씬을 실행합니다.
2. 사이트의 시뮬레이션 환경에서 해당 엔진을 선택합니다.
3. 영상 소스에서 해당 엔진 / 외부 프로그램 화면을 선택합니다.
4. 화면 공유 시작을 누르고 실행 창 또는 화면을 선택합니다.
5. 팀원은 같은 사이트의 실시간 관찰로 봅니다. 녹화 저장 후 시간 댓글로 검토합니다.

웹 선택만으로 PC 프로그램이 실행되지는 않습니다. 다른 네트워크에서 영상 연결이 안 되면 TURN 중계 추가가 필요합니다. 실제 Unity/CARLA 실행 화면의 4인 네트워크 검증은 아직 하지 않았습니다.

## 2. Unity 실제 시뮬레이션

- Unity Hub 및 팀이 합의한 동일 Editor 버전으로 프로젝트를 엽니다. 기존 simulation-prep는 준비 자료이며 컴파일 완료 상태가 아닙니다.
- 공장 씬, Raspbot V2 프리팹, collider/rigidbody, 구동·카메라·팔 스크립트를 구성합니다. 외형 배치와 실제 바퀴·접촉 물리는 별도 검증합니다.
- 웹과 직접 연결할 경우 HTTPS/WSS 또는 웹 빌드의 JavaScript 연결기를 구현해 environment / mission / telemetry 메시지를 주고받습니다. Unity Web 빌드는 브라우저 네트워크 제약이 있으므로 raw TCP 소켓 방식을 그대로 쓰지 않습니다.
- 웹 내 실행을 원한다면 Web 빌드 출력과 로딩 페이지, 압축 MIME/header 설정을 호스팅하고 JSON 환경 변환기를 연결합니다. 현재 사이트에는 Unity 빌드가 들어 있지 않습니다.

## 3. CARLA 실제 시뮬레이션

- GPU PC에 선택한 CARLA 패키지와 맞는 Python client 버전을 설치합니다. 서버/클라이언트 호환을 확인합니다.
- Windows 패키지는 CarlaUE4.exe 등을 해당 버전 문서에 맞춰 실행합니다. 기본 RPC 포트 2000과 스트리밍 포트 2001을 같은 PC/신뢰 네트워크에서 사용합니다.
- Python 연결 예: client = carla.Client('127.0.0.1', 2000); client.set_timeout(10.0); world = client.get_world().
- 웹 직접 연동에는 인증된 별도 연결기가 웹 임무를 받아 CARLA actor, 좌표계, 지도 및 센서 설정으로 변환해야 합니다. CARLA RPC를 공개 인터넷에 직접 노출하는 방식은 사용하지 않습니다.
- Raspbot V2 메카넘과 양팔은 CARLA 기본 자동차 동역학으로 대체 검증할 수 없습니다. 전용 모델·제어 구현이 필요합니다.

## 4. 공통 다중 로봇 제어

한 실행기가 물리 tick 및 통로 락의 권위자가 됩니다. 각 브라우저가 락을 따로 결정하면 안 됩니다. 통로 ID, 기체 ID, 진입 시각, 소유자, 출구 이탈 상태와 이벤트를 연결기에서 관리하고 웹은 결과를 표시합니다. 실물에서는 1cm 판정의 센서 오차, 시계, 제동거리, 네트워크 단절을 검증해야 합니다.

현재 웹 데모는 lib/fleet.ts의 단일 스케줄러로 2~4대, 고정 공장 경로, 안전 대기선과 보수적 출구 해제를 검증합니다. 자유 배치 장애물에 대한 자동 통로 추출이나 실기체 연결은 없습니다.

## 공식 문서

- https://carla.readthedocs.io/en/0.9.16/start_quickstart/
- https://docs.unity.com/en-us/engine/7000.0/manual/platform-specific/webgl/develop/networking
- https://unity.com/how-to/profile-optimize-web-build
