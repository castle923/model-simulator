# CARLA 조사 및 웹사이트 연동 검토

2026-10-13. 사용자 표현 "calra"는 CARLA로 해석했습니다. 설치·실행 검증은 수행하지 않았습니다.

## 무엇인가

CARLA는 Unreal Engine 기반의 자율주행 연구 시뮬레이터입니다. 차량·보행자·도로·교통·날씨·센서와
Python API 및 ROS 연동을 제공합니다. 서버가 월드를 실행하고 Python 클라이언트가 actor와 센서를 제어합니다.

공식 GitHub 릴리스에는 0.9.16(UE4 계열)과 0.10.0(UE5 계열)이 보입니다.
Quickstart는 아직 0.9.15를 최신이라고 표기하는 부분이 있어 버전별 요구사항을 섞지 않습니다.
UE4 Quickstart는 RTX 2070급 이상/VRAM 8GB 이상과 약 20GB 디스크를 안내합니다.
실제 선택한 배포 파일의 다운로드·압축해제 크기, GPU, 여유 공간을 별도로 확인해야 합니다.
이 수치를 UE5나 소스 빌드 요구량으로 사용하지 않습니다.

## 웹사이트 적용

| 형태 | 판단 |
|---|---|
| 현재 Worker/정적 웹 호스팅 안에서 CARLA 엔진 실행 | 현재 사이트 구조에서는 불가. GPU/Unreal 서버 필요 |
| 발표자 PC에서 CARLA 실행 후 사이트에서 창 공유 | 가능. 기존 외부 프로그램 화면 공유 경로 사용 |
| 웹에서 환경/물체 설정 → CARLA에 반영 | 별도 backend adapter/Python agent 필요 |
| CARLA 센서 영상을 웹에서 실시간 관찰 | camera stream 변환·WebRTC 중계 등 별도 연동 필요 |
| CARLA 설정/녹화/결과에 댓글 | 기존 작업·실행 기록·영상 댓글과 연결 가능 |
| Pi5가 CARLA 서버 실행 | 현재 프로젝트의 실행 대상으로 권장하지 않음. GPU PC가 서버, Pi는 제어/인지 클라이언트 후보 |

권장 구조: 웹 환경 초안 → 검증된 시나리오 명령 → GPU PC의 Python adapter → CARLA server →
센서/상태 결과 → 웹 기록. 발표 영상은 현재 사이트의 getDisplayMedia/WebRTC로 공유합니다.
CARLA의 TCP 포트를 공개 인터넷에 그대로 개방하지 않고 agent의 outbound 연결 또는 관리된 tunnel을 사용합니다.
임의 Python/shell 실행 대신 허용한 spawn/update/start/stop 명령만 매핑합니다.

## Raspbot V2 적합성

강점: 사람/차량이 많은 야외 상황, 날씨·조명, 카메라 인지, 도로 자율주행 시나리오.
추가 개발: Raspbot 3D asset, 메카넘 제어·접촉 모델, 실내 지도, 초음파/라인 센서 근사, 양팔 관절·파지.
Raspbot V2나 안전모 전달 시나리오가 CARLA에 기본 포함되었다고 확인한 것은 아닙니다.
외형 actor를 배치하는 것과 메카넘/파지 물리를 구현하는 것은 별개입니다.

학원 1차 시연과 Raspbot·양팔 확장에는 Unity 또는 로봇 중심 시뮬레이터가 더 직접적인 출발점이라는 판단입니다.
이는 공개 기능과 프로젝트 요구를 비교한 설계 판단이며 CARLA 실행 성능 비교 결과가 아닙니다.

## 현재 편집기의 적용 범위

이번 웹 편집기는 내장 2D 시뮬레이션만 변경합니다. 상자/콘/작업자/안전모는 정적인 2D 객체이며
작업자 이동·YOLO 탐지·안전모 착용 판정·파지 물리가 없습니다.
JSON은 웹 전용 계약입니다. CARLA actor blueprint·좌표계·지도·단위·spawn 가능 위치로 변환하는 adapter가 필요합니다.
Unity 준비 패키지의 JSON과도 필드가 다르므로 자동 호환으로 표시하지 않습니다.

## 출처

- https://carla.org/
- https://github.com/carla-simulator/carla/releases
- https://carla.readthedocs.io/en/latest/start_quickstart/
- https://carla.readthedocs.io/en/latest/core_actors/
- https://carla-ue5.readthedocs.io/en/latest/tuto_G_getting_started/
