# 9번 에이전트: Raspbot V2 · Pi 5 호환 모델과 ROS 2 프로그램 조사

조사일: 2026-10-14 KST. 범위: 공개 GitHub/Hugging Face 저장소와 공식 문서의 읽기 조사. 실제 가중치 다운로드, 설치, 실행, Pi 접속, 제품 코드 변경, 운영 사이트·DB 변경은 수행하지 않았다. 이 파일만 복사본에 작성했다.

## 판정 기준과 장비 전제

현재 전제는 Raspberry Pi 5 ARM64 CPU, Ubuntu 24.04/ROS 2 Jazzy 우선, USB RGB 카메라, 초음파 센서와 I2C 구동 보드다. 카메라의 UVC 지원·실제 해상도/FPS, 엔코더 제공 여부, odometry와 TF, LiDAR·깊이 카메라는 확인되지 않았다. LiDAR·깊이 카메라가 없는 것으로 놓고 즉시 후보와 센서 조건부 후보를 구분했다. Ubuntu 22.04/Humble은 별도 환경이며 Jazzy 패키지를 그대로 섞지 않는다.

아래의 '호환 후보'는 ARM64 CPU 또는 ROS 2 Jazzy 경로가 공식 자료에 존재한다는 의미다. 사용자의 실제 기체에서 설치·입출력·성능·안정성을 검증했다는 의미가 아니다. 소프트웨어 소스 호환성은 Yahboom 보드의 모터·센서 드라이버 호환성을 보증하지 않는다.

Open Robotics는 Jazzy의 Ubuntu 24.04 arm64 지원을 명시한다. ros/rosdistro의 Jazzy 배포 메타데이터에서 slam_toolbox, navigation2, rtabmap_ros, apriltag를 확인했다. 배포 등록과 특정 날짜의 ARM64 바이너리 설치 성공은 구분해야 하며, 설치 단계에서 실제 apt 후보·의존성을 다시 확인한다. 공식 Pi 추론 가이드는 Raspberry Pi OS에서 시험된 자료이므로 Ubuntu 24.04 전체 조합의 실측 근거로 바꾸어 말하지 않는다.

## 엄선한 8개 후보

| 후보와 판정 | 입력·런타임·호환 근거 | 프로젝트에 사용할 기능 | 파일·크기와 라이선스 | 남은 조건 |
|---|---|---|---|---|
| 1. **Ultralytics YOLOv8n: 현재 카메라로 도입 후보** | USB 카메라의 RGB 프레임. Ultralytics Python CPU 추론, ARM64 배포 경로. 공식 Pi 가이드 및 NCNN 변환 지원 | 사람과 COCO 일반 객체의 BBOX·클래스·확률 | HF `Ultralytics/YOLOv8/yolov8n.pt` 실제 파일 **6,534,387 bytes**, 약 6.53 MB/6.23 MiB. 모델 카드 AGPL-3.0, 상위 코드 AGPL-3.0 | Pi의 OS·Python·PyTorch/변환기 버전 고정, 실제 카메라 열기, CPU 지연·발열·메모리 측정. **안전모/안전띠 미착용 전용 모델이 아님** |
| 2. **Tencent NCNN: YOLOv8n CPU 런타임 후보** | Linux ARM/aarch64 지원과 Pi 빌드 안내. GPU 없이 CPU 경로 사용, Vulkan OFF 가능 | Pi에서 변환된 YOLOv8n의 추론 실행 | 모델 가중치가 아니라 런타임. `.param` + `.bin`은 기존 PT에서 변환하여 생성하므로 크기 미확정. BSD-3-Clause 및 포함 의존성별 조건 | 변환 결과와 PT 결과 비교, 입력 전처리·NMS·출력 클래스 일치 검사. Ubuntu라는 이름의 ZIP을 ARM64라고 가정하지 않음 |
| 3. **Ultralytics 내 ByteTrack: 현재 카메라로 도입 후보** | 위 탐지기의 연속 BBOX·점수. Python CPU 경로; 별도 appearance/ReID 신경망 없음 | 한 카메라 영상에서 객체별 일시 track ID 유지 | `ultralytics/cfg/trackers/bytetrack.yaml`과 `ultralytics/trackers/byte_tracker.py`, 추가 가중치 0 bytes. 해당 배포 AGPL-3.0 | 이동 카메라·가림·비슷한 작업자에 ID 교체 가능. 여러 카메라/재접속 간 영구 고유번호 또는 사람 신원인증 아님 |
| 4. **OpenCV 4.x QRCodeDetector: 현재 카메라로 도입 후보** | RGB/회색조 영상, ARM/AArch64 지원 OpenCV CPU 빌드. 5.x 기본 브랜치를 자동 선택하지 않고 4.x 계열 버전 고정 | QR 문자열·모서리 검출, 층/충전소/작업 대상 ID 읽기 | 별도 학습 가중치 없음. OpenCV 4.x 소스와 Ubuntu `python3-opencv` 경로. Apache-2.0 및 포함 구성요소별 조건; 패키지 총 용량 설치 시 확인 | UVC·카메라 초점·조명·QR 크기 시험. QR 읽기는 엘리베이터 조작 API가 아님 |
| 5. **AprilRobotics AprilTag 3: 현재 카메라 + 출력 태그로 도입 후보** | C CPU 라이브러리, CUDA 필수 의존 없음. Jazzy apriltag 릴리스 3.4.5-1 확인. 태그 pose에는 카메라 내부 파라미터·왜곡·실제 태그 길이 필요 | 충전소/엘리베이터/물품 표식 ID, 캘리브레이션 후 상대 위치·방향 | 소스 `AprilRobotics/apriltag`; 학습 가중치 없음. LICENSE.md와 package.xml에 BSD-2-Clause 확인. 빌드·설치 크기 미측정 | 보정 전에는 ID/영상 좌표와 미터 단위 pose를 구분. 이것만으로 공장 전체 SLAM·정밀 도킹 완성은 아님 |
| 6. **slam_toolbox: 2D LiDAR·TF·odom 확보 후 조건부** | Jazzy 브랜치·릴리스 2.8.5-1 확인. `sensor_msgs/LaserScan`과 유효한 odom→base TF, 센서 TF. C++ CPU SLAM | 2D 지도 생성·저장·재사용·위치추정 | `SteveMacenski/slam_toolbox`, 배포 후보 `ros-jazzy-slam-toolbox`. LGPL-2.1. 학습 가중치 없음, 의존성 총 크기 미측정 | 단일 초음파 거리값은 LaserScan을 대체하지 못함. LiDAR ROS 2 드라이버, 시간·TF·odometry 필요. 현재 구성에 바로 지도 생성 가능하다고 판정하지 않음 |
| 7. **Nav2 Jazzy: 위치추정·구동 연결 후 조건부** | Jazzy branch, arm64 ROS 2 플랫폼 경로. 지도/로컬라이제이션·TF·odometry·장애물 관측과 구동 명령 연결 필요 | 목적지 주행, 동적 회피, 동작 트리. Smac Hybrid-A*의 DUBIN 모델로 전진·최소 회전 반경 경로 시험 | `ros-navigation/navigation2`, `ros-jazzy-navigation2`/`ros-jazzy-nav2-bringup`. 학습 가중치 없음. 저장소는 Apache-2.0/BSD-3-Clause/LGPL-2.1-or-later 등 **패키지별 혼합** | 현재 보드의 속도명령·엔코더·비상정지 어댑터 없음. 전진 전용은 planner뿐 아니라 controller·recovery·충전소 출입까지 맞춰야 함. 다중 기체 락/배차는 Nav2 설치만으로 생기지 않음 |
| 8. **RTAB-Map ROS 2: RGB-D/스테레오/LiDAR 확보 후 조건부** | Jazzy 배포 등록 및 `jazzy-devel` 경로, C++ CPU 및 ROS 2 arm64 기반. 공식 입력은 RGB-D/스테레오/LiDAR + 보정·동기화·TF·odom | 시각/깊이 기반 지도, loop closure, 점군·점유격자 | `introlab/rtabmap_ros`, `ros-jazzy-rtabmap-ros`. wrapper BSD-3-Clause; core 선택 의존성은 별도 라이선스. 학습 가중치 없음 | 현재 단일 USB RGB 카메라를 RGB-D나 보정된 stereo로 간주하지 않음. Pi CPU 예산·RAM 미측정, 추가 센서·driver·calibration 필요. 현 구성 즉시 추천 목록에는 넣지 않음 |

## 실제 다운로드 경로와 소스 경로

이 목록은 **나중에 받을 수 있는 주소**이며 다운로드나 설치 명령을 실행하지 않았다. 바뀌는 main/master보다 검증 후 커밋/릴리스에 고정해야 한다.

- YOLOv8n HF 고정 리비전: [yolov8n.pt 다운로드](https://huggingface.co/Ultralytics/YOLOv8/resolve/27f858f2dc238503a66ce10248cf7ec71a3ded5d/yolov8n.pt). 조사 시 HF repo SHA `27f858f2dc238503a66ce10248cf7ec71a3ded5d`와 tree API의 크기를 확인했다. 가중치 본문·SHA256은 다운로드하지 않아 검증하지 않았다.
- NCNN: [소스](https://github.com/Tencent/ncnn), [공식 Pi/ARM 빌드 안내](https://github.com/Tencent/ncnn/wiki/how-to-build). CPU 전용 ARM64 네이티브 빌드 또는 검증한 ARM64 wheel 후보를 선택한다. NCNN release 20260526의 Ubuntu ZIP은 존재하지만 이름만으로 Pi용 ABI를 보장할 수 없어 직접 설치 후보로 지정하지 않았다.
- ByteTrack: [YAML](https://github.com/ultralytics/ultralytics/blob/main/ultralytics/cfg/trackers/bytetrack.yaml), [구현](https://github.com/ultralytics/ultralytics/blob/main/ultralytics/trackers/byte_tracker.py). Ultralytics 버전을 고정하고 `tracker="bytetrack.yaml"`을 명시하여 바뀌는 기본 tracker에 의존하지 않는다.
- OpenCV: [4.x 소스](https://github.com/opencv/opencv/tree/4.x). 시스템 apt 패키지와 Python venv 라이브러리를 섞으면 ROS cv_bridge와 ABI가 달라질 수 있어 환경을 분리·고정해야 한다.
- AprilTag: [소스](https://github.com/AprilRobotics/apriltag). ROS wrapper 선택은 별도이며 core 라이브러리 설치만으로 ROS image topic 구독이 생기지는 않는다.
- slam_toolbox: [jazzy 소스](https://github.com/SteveMacenski/slam_toolbox/tree/jazzy).
- Nav2: [jazzy 소스](https://github.com/ros-navigation/navigation2/tree/jazzy).
- RTAB-Map ROS: [jazzy-devel 소스](https://github.com/introlab/rtabmap_ros/tree/jazzy-devel). 배포된 패키지 버전과 소스 최신 버전은 다를 수 있다.

## PPE 모델을 추천에서 제외한 이유

COCO 80개 클래스 정의를 확인했으며 `person`은 있지만 `helmet`/`no_helmet`/`safety_harness`는 없다. 따라서 공식 YOLOv8n 파일을 받는 것만으로 안전모 미착용 감지가 완성되지 않는다. 전용 PPE 가중치 또는 권한이 확인된 학습 데이터가 필요하다.

조사 중 [iam-tsr/yolov8n-helmet-detection](https://huggingface.co/iam-tsr/yolov8n-helmet-detection)의 `best.pt` **6,199,658 bytes**와 카드상 helmet/no_helmet·MIT 표시는 확인했다. 그러나 상위 YOLOv8 AGPL 표시와 파생 가중치/학습 데이터 권리의 정합성을 이 자료만으로 확인할 수 없다. 실제 label index·체크포인트 호환·산업 안전모 도메인 적합성·Pi 추론도 미검증이므로 **사용자 엄격 조건에 따라 채택/다운로드 추천에서 제외**했다. 이는 해당 저장소가 법적으로 잘못되었다는 판정이 아니다.

GitHub의 `thevietofficial-coder/safety-helmet-detection`도 확인했으나 모델 카드의 person AP50이 0.007로 기재되고 파생 모델 권리·ARM64 재현 근거가 충분하지 않아 채택하지 않았다. 다른 익명 ONNX/PPE 파일, CUDA 전용 TensorRT `.engine`, ROS 1 전용 패키지, 가중치 없는 데모 저장소도 추천 대상에서 제외한다.

## 실제로 대입할 때의 연결 경계

현재 바로 준비할 조합은 `USB 카메라 → YOLOv8n/NCNN → ByteTrack → {robotId, frameId, timestamp, classId, bbox, confidence, trackId}`다. QR/AprilTag는 별도 detector 결과를 같은 프레임 시각으로 묶는다. 웹에는 결과와 영상의 연결 상태를 표시하되 이 결과만으로 물체까지의 미터 거리, 충돌 없는 주행 또는 팔 집기를 보장하지 않는다.

SLAM/주행 조합은 `센서 드라이버 + 보정/TF/odom → slam_toolbox 또는 RTAB-Map → Nav2 → 기체별 구동 어댑터`다. Gazebo에서는 가상 LaserScan/odom을 먼저 사용할 수 있지만 시뮬레이션 통과를 실물 호환 인증으로 바꾸어 말하면 안 된다. ROS에서 각 로봇 namespace·TF frame·sensor topic을 분리하며 다중기체 배차·통로/충전소 예약은 상위 시스템에 남는다.

단일 RGB 카메라의 BBOX/track ID만으로 매니퓰레이터가 안전모를 집는 기능은 완성할 수 없다. 카메라-팔 좌표 보정, 깊이/기하 추정, 팔 제원·ROS 드라이버·gripper 조건을 별도 확인해야 한다. IoT 홈 키트는 이번 기본 연결 구성에 포함하지 않는다.

## 향후 설치·도입 완료 판정

1. Pi5의 실제 OS·ARM64·RAM·카메라 UVC·보드 인터페이스를 확인하고 런타임/패키지 버전과 라이선스 파일을 고정한다.
2. 가중치 취득 후 SHA256·파일 크기·class names·출처를 기록한다. PT→NCNN 변환 전후 같은 영상에서 탐지 결과 차이를 검증한다.
3. 낮은 해상도부터 CPU latency p50/p95, 처리 FPS, 영상 end-to-end 지연, 온도·메모리를 측정한다. 웹 전송 JPEG의 해상도와 detector 입력 해상도는 구분한다.
4. 추적은 가림·교차·카메라 회전에서 ID 교체율을 기록한다. 영구 신원번호로 쓰지 않는다.
5. QR/AprilTag는 실제 인쇄 크기·거리·각도·조명별 검출과 pose 오차를 측정한다.
6. SLAM은 LaserScan/TF/odom 및 시각 동기화 검증 후 지도·loop closure·재위치추정을 시험한다. 엔코더 없음을 가상 배터리/웹 좌표로 대체하지 않는다.
7. Nav2는 먼저 Gazebo에서 목표 도달·장애물 회피·전진 제약·충전소 출입을 시험하고 이후 허가된 실물에서 저속 단계 검증한다.

어느 후보에도 사용자의 Pi5 실측 FPS나 안전 성능을 보장하지 않는다. 이번 결과는 도입 가능한 공개 소프트웨어의 선별이며 이미 설치되어 작동하는 결과물이 아니다.

## 주요 근거 12개

1. [HF 공식 YOLOv8 모델 카드·라이선스](https://huggingface.co/Ultralytics/YOLOv8)
2. [HF 파일 tree API — 실제 yolov8n.pt 크기](https://huggingface.co/api/models/Ultralytics/YOLOv8/tree/main)
3. [Ultralytics 공식 Pi CPU/NCNN 배포 가이드](https://docs.ultralytics.com/guides/raspberry-pi)
4. [Tencent NCNN ARM/aarch64·CPU 소스와 라이선스](https://github.com/Tencent/ncnn)
5. [Ultralytics tracker 공식 문서](https://docs.ultralytics.com/modes/track)
6. [OpenCV QRCodeDetector 공식 API](https://docs.opencv.org/4.x/de/dc3/classcv_1_1QRCodeDetector.html)
7. [AprilTag core 공식 소스·pose 조건](https://github.com/AprilRobotics/apriltag)
8. [slam_toolbox 공식 소스·LaserScan/TF 입력](https://github.com/SteveMacenski/slam_toolbox)
9. [Nav2 공식 소스·패키지별 라이선스](https://github.com/ros-navigation/navigation2)
10. [RTAB-Map ROS 공식 소스·입력/배포](https://github.com/introlab/rtabmap_ros)
11. [Jazzy 공식 배포 레지스트리 — 브랜치/릴리스](https://github.com/ros/rosdistro/blob/master/jazzy/distribution.yaml)
12. [Open Robotics Jazzy arm64 공식 지원 발표](https://www.openrobotics.org/blog/2024/5/ros-jazzy-jalisco-released)

추가 직접 확인: 위 저장소들의 LICENSE/package.xml/README 원문 및 HF API. 일부 GitHub tree·docs.ros.org 페이지는 웹 수집 오류로 raw 소스/공식 레지스트리를 교차 확인했다. GitHub API의 NOASSERTION은 라이선스가 없다는 뜻으로 단정하지 않고 LICENSE 원문으로 보완했다.
