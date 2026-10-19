# 8번 에이전트 — 센서·ROS 2 기술 도입 및 호환성 검토

조사일: 2026-10-14 KST. 조사·설계 제안 보고서이며 구현·설치·다운로드·실물 시험·배포 결과가 아니다. 원본 프로젝트, 운영 사이트, DB, 카메라 세션에 변경하지 않았다. 제품별 판매 재고와 가격은 확인하지 않았으며 구매 확정 목록이 아니다.

## 사용자 브리핑

현재 목적에는 **RGB 카메라 + 2D LiDAR + 신뢰할 수 있는 이동거리·방향 측정**을 먼저 갖추는 구성이 가장 적합하다. RGB/YOLO는 사람과 안전모를 구분하고, LiDAR는 주변 물체까지의 거리를 측정하며, 인코더·IMU는 기체 움직임을 추정한다. 역할이 달라 서로 대체하지 않는다. 이후 RGB-D를 추가하면 안전모를 집는 데 필요한 3차원 위치 파악과 낮거나 돌출된 장애물 감지에 도움이 된다. 이는 아래 공식 문서에 기반한 프로젝트 적용 판단이다.

가장 큰 선행 문제는 센서 구매보다 **Raspbot V2의 실제 피드백 인터페이스 확인**이다. 제조사가 ROS 2·모터 제어 자료를 제공한다는 것만으로 바퀴 인코더, 실측 속도, IMU, 배터리 전류가 ROS 토픽으로 제공된다고 볼 수 없다. 현재 웹 배터리·기체 위치는 가상 상태이며 실제 측정으로 대체하려면 별도 연결이 필요하다. [Yahboom 공식 학습 자료](https://www.yahboom.net/study/RASPBOT-V2/), [공식 저장소](https://github.com/YahboomTechnology/Raspbot-V2)

## 1. 전제와 호환성 판정 방법

- 대상: 4명 학생 시연, Raspbot V2/Pi5, 무GPU 환경 우선, 보호장비 전달, 다중 기체·통로·충전·층간 이동, 양팔은 후속 단계.
- Home IoT 키트는 이번 프로젝트 기본 구성에서 제외한다. 실제 부품 목록·전압·인터페이스가 확인되기 전에는 예비 센서라고 단정하지 않는다.
- 우선 기준 후보: Ubuntu 24.04 + ROS 2 Jazzy + Gazebo Harmonic. 공식 권장 조합이다. Ubuntu 22.04를 함께 시험한다면 ROS 2 Humble + Gazebo Fortress가 기본 권장 조합이며, Humble + Harmonic은 추가 호환 작업이 필요한 조합이다. **Gazebo Classic 11과 Fortress는 다른 제품 세대**다. [Gazebo 공식 호환표](https://gazebosim.org/docs/harmonic/ros_installation/)
- ROS 2 Jazzy의 Ubuntu 24.04는 amd64/arm64가 공식 대상이다. 그러나 센서 SDK·제조사 보드 코드·커널·USB 조합까지 자동 보장되지는 않는다. [Open Robotics Jazzy 발표](https://www.openrobotics.org/blog/2024/5/ros-jazzy-jalisco-released)
- 아래 ‘가능’은 설계상 연결 가능, ‘공식 명시’는 문서가 해당 항목을 명시, ‘미검증’은 이 프로젝트 장비에서 빌드·수신·성능을 시험하지 않았다는 뜻이다. 통신/OS/전원/장착/성능을 모두 통과해야 실물 호환 완료다.

## 2. 센서별 도입 우선순위와 호환성

| 센서·기술 | 이 프로젝트의 역할 | 실물 인터페이스·전원 확인 | ROS 2/Jazzy·Pi5 판정 | 시뮬레이션·CPU 판정 | 우선순위 |
|---|---|---|---|---|---|
| 기존 RGB USB 카메라 | 작업자·안전모 분류, QR/AprilTag, 선택 기체 전방 영상 | 실제 카메라의 USB 형식·노출·프레임·카메라 고정 상태 확인 | 제조사 영상 예제는 있음. ROS Image/CameraInfo 연결과 Ubuntu24.04 실물 수신은 미검증 | 카메라 모형 가능. CPU 영상 생성은 렌더러 부하 시험 필요 | 가장 먼저 |
| 2D LiDAR: RPLIDAR A1/C1 등 후보 | 평면 지도, 벽·랙·사람 다리까지 거리, 장애물 회피 | 개발키트 USB-serial 변환/전원과 모델별 baud rate·커넥터 확인. UART 원본을 GPIO에 임의 직결하지 않음 | 제조사 `sllidar_ros2`에 해당 모델 지원. README 배포판 목록은 rolling/humble/galactic/foxy이며 Jazzy+Pi5 명시 보장은 확인 못함 → 조건부 | 2D 스캔 모형/노이즈 가능. Harmonic 예제 gpu_lidar는 렌더링 경로를 사용하므로 무GPU 성능 별도 시험 | 1차 |
| 2D LiDAR: LDROBOT LD06/LD19 후보 | 위와 동일 | UART/USB 변환 모듈 선택, 전압·핀·scan 방향·frame 확인 | 공식 `ldlidar_stl_ros2` LD06/LD19 launch 제공. Foxy 이상 문구 있으나 Jazzy+Pi5 실증 자료가 아님 → 조건부 | 위와 동일. RPLIDAR와 둘 다 살 필요 없음 | 1차 비교 후보 |
| 바퀴 인코더 + IMU | 실제 odom, 방향, 미끄러짐 감지 보조 | Raspbot 보드가 encoder count/속도 피드백을 노출하는지 **미확인**. IMU 추가 시 I2C/SPI/USB, 논리전압·주소·시간 검토 | `robot_localization` Jazzy 패키지는 있으나 실제 데이터·공분산·TF·드라이버가 필요. 명령 PWM을 측정 odom처럼 쓰면 안 됨 | IMU/관절 상태 모형 가능. 위치 순간이동 프록시만으로 실제 운동 기반 IMU 검증은 불가 | 1차 선행 확인 |
| 근접 ToF/범퍼/낭떠러지 센서 | LiDAR의 근접 사각지대, 낮은 상자, 바닥 경계·접촉 감지 | ToF 예 VL53L1X는 I2C API 제공. 칩과 carrier의 전압·레벨시프터 구분. 범퍼는 스위치 입력 등 실물별 확인 | 전용 Jazzy 드라이버 존재를 가정하지 않음. Range/접촉 상태로 내보내는 연결기 필요 | Range/contact·센서 실패 상황 모형 가능 | 1차 보완 |
| RGB-D: RealSense D435i 계열 후보 | 작업 대상의 거리·3D 위치, 집기, 높이가 다른 장애물 | USB3/대역폭/카메라 전원, 깊이 최소 거리·표면·조명 조건 확인. D435i에는 IMU 포함 | 공식 wrapper Ubuntu24.04/Jazzy 안내 있음. Pi5 ARM64+커널+librealsense/firmware 정확 조합은 미검증 | RGBD 모형 가능하나 CPU 렌더링·pointcloud 처리가 무거워질 수 있음 | 2차 |
| RGB-D: Orbbec Gemini 335 계열 후보 | 위와 동일 | 공식 Gemini335/335L USB3 5Gbps·5V/1.5A급 전원 요구. Pi5와 같은 USB 버스 전원만 쓰는 구성은 여유 부족 가능 | wrapper v2는 Jazzy 명시. ARM64 시험 대상이 Pi5와 같지는 않아 Pi5 호환 완료로 보지 않음 | 위와 동일. 실제 firmware·SDK v1/v2 지원 모델 일치 필수 | 2차 비교 후보 |
| 3D LiDAR: Livox Mid-360 후보 | 랙 돌출부·다층 구조·3D mapping 연구 | Ethernet+별도 DC 전원. 공식 정격 9~27V 확인; Pi GPIO/USB 5V 직결 대상 아님 | 공식 `livox_ros_driver2` Ubuntu24.04/Jazzy 빌드 절차 명시. Pi5용 SDK2 빌드·처리량은 미검증. 제조사는 드라이버를 시험용으로 설명 | pointcloud 모형 가능. 대규모 3D SLAM·렌더링 동시 부하는 이번 CPU 시연의 후순위 | 후속 연구 |
| 그리퍼 접촉·전류·힘/토크 센서 | 잡힘·미끄러짐·과도한 힘 확인, 전달 완료 판정 | 양팔 모델 미정. CAN/RS485/USB/EtherCAT 등 실제 bus, 전원, 하중·토크·피드백 필수 | MoveIt 2/ros2_control로 연결 가능하나 해당 팔 드라이버가 필요. 소형 servo에 힘 제어가 있다고 가정하지 않음 | 관절 force/torque·접촉 모형 가능. 실제 유연한 물체·손 접촉 재현은 별도 | 2차 |
| 광학 촉각: GelSight/DIGIT 계열 | 휴머노이드 손의 접촉 형상·미끄러짐 연구 | 추가 영상 장치·장착 공간·처리량·그리퍼 형상 필요 | 제조사 ROS/ROS2·연구 사용 안내는 있으나 Jazzy/Pi5 실제 결합 미검증 | 단순 접촉 모형과 실제 촉각 영상은 다름. 전용 모델 필요 | 장기 연구 |

센서 드라이버 근거: [SLAMTEC 공식 ROS2](https://github.com/Slamtec/sllidar_ros2), [LDROBOT 공식 ROS2](https://github.com/ldrobotSensorTeam/ldlidar_stl_ros2), [RealSense 공식 ROS2](https://github.com/realsenseai/realsense-ros), [Orbbec 공식 ROS2](https://github.com/orbbec/OrbbecSDK_ROS2), [Orbbec 전원 설계](https://doc.orbbec.com/documentation/Orbbec%20Gemini%20330%20Series%20Documentation/Reference%20Design%20-%20Power%20Delivery%20%28Gemini%20330%20Series%29), [Livox 공식 드라이버](https://github.com/Livox-SDK/livox_ros_driver2), [Mid-360 사양](https://www.livoxtech.com/mid-360/specs), [ST ToF API](https://www.st.com/en/embedded-software/stsw-img007.html), [GelSight 촉각](https://www.gelsight.com/products/gelsightmini/).

## 3. 센서를 붙인 후 필요한 ROS 2 기능

1. **실측 상태와 화면 상태 분리:** `실물 측정 / 시뮬레이션 센서 / 웹 추정` 출처를 표시한다. 지도 위치·배터리·영상에 robot_id, run_id, scene_revision, timestamp를 붙여 이전 실행 데이터 혼입을 막는다. 이는 신규 설계 제안이다.
2. **SLAM과 위치 추정:** 2D LaserScan·odom·TF를 먼저 검증한 뒤 SLAM Toolbox로 지도 생성, 저장 지도에서 재위치 추정을 분리한다. 휠+IMU 융합은 robot_localization으로 검토한다. IMU 가속도만 적분해 안정적인 실내 절대 위치를 얻는다고 가정하지 않는다. [SLAM Toolbox Jazzy](https://index.ros.org/p/slam_toolbox/), [robot_localization](https://index.ros.org/p/robot_localization/)
3. **동적 장애물 회피:** Nav2 costmap의 LaserScan/PointCloud2 입력을 활용한다. 감속·정지는 별도 근접 계층으로 두고, 회피할 공간이 없으면 정지·재계획·도움 요청을 허용한다. ‘무조건 회피’는 좁은 통로에서 불가능할 수 있다. [Nav2 Jazzy Obstacle Layer](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/costmap_plugins/obstacle/)
4. **기체별 namespace와 TF:** `/robot_1/scan`, `/robot_2/scan` 등으로 센서·명령을 구분하고 TF frame도 고유화한다. 공유 지도와 기체별 odom, 관측·예약 시각을 분리해야 타 기체의 센서를 자신의 위치로 오해하지 않는다. 이 프로젝트 적용 설계다.
5. **차량형 제약:** 4륜→2륜 개수만 바꿔서는 자동차형이 되지 않는다. 횡이동/후진/제자리 회전 금지, 조향·회전 반경, controller·복구 행동·충전 출입까지 일관되게 제한한다. Smac Hybrid-A*의 DUBIN 후보를 검토할 수 있다. [Nav2 Jazzy Smac Hybrid](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/planners_plugins/smac/smac_hybrid/configuring_smac_hybrid/)
6. **충전 도킹:** 먼 구간은 지도 주행, 가까운 구간은 AprilTag/근접 센서로 정렬, 접촉·충전 전류 확인으로 성공 판정하는 단계 구조를 제안한다. 충전소 1개 예약은 센서만으로 해결되지 않으며 서버/로컬 스케줄러와 기체 watchdog가 필요하다.
7. **엘리베이터:** QR은 층·엘리베이터 ID를 읽는 수단, AprilTag는 크기와 카메라 보정이 있으면 상대 pose 추정 후보다. 실제 호출·층 선택은 장비 인터페이스가 필요하다. Open-RMF lift adapter는 상태·요청 연결 구조의 참고다. [AprilTag ROS2](https://github.com/christianrauch/apriltag_ros), [Open-RMF lift adapter](https://github.com/open-rmf/lift_adapter_template)
8. **양팔 물건 전달:** 카메라의 BBOX는 픽셀 영역이지 3차원 집기 좌표가 아니다. 깊이/보정/TF, 팔의 URDF·관절 한계·자기충돌·실제 joint feedback, 그리퍼 성공 감지가 필요하다. MoveIt 2의 경로·작업 계획과 ros2_control hardware interface로 분리한다. [MoveIt 2](https://moveit.picknik.ai/), [ros2_control Jazzy](https://control.ros.org/jazzy/doc/ros2_control/doc/index.html)

## 4. PPE·트래킹·최근 휴머노이드 기술의 적용 판단

**YOLOv8n 계획은 유지할 수 있다.** 다만 기본 학습 모델이 안전모 미착용을 자동으로 정확히 구분한다고 가정하지 않는다. 강사 데이터의 클래스, 안전모를 손에 든 경우, 가림·역광·다중 사람·재진입을 검증해야 한다. 객체 tracking ID는 해당 영상 내 추적 번호이며 지속적인 인물 고유 신원이나 사람의 법적 식별값이 아니다. 시연은 작업자 표식/목표 확인과 승인된 전달 지점으로 단순화하는 안을 권한다.

공식 Pi 가이드는 현재 더 최신 YOLO 세대 중심으로 갱신되어 있다. 여기의 FPS를 YOLOv8n+SLAM+영상 송출 성능으로 인용하면 안 된다. NCNN/ONNX 등 경량 실행을 비교하되 기존 모델을 자동 교체하지 않는다. CPU에서 전처리·검출·추적·SLAM·통신을 동시에 실행한 지연·온도·메모리 실측이 필요하다. [Ultralytics Pi 공식 가이드](https://docs.ultralytics.com/guides/raspberry-pi)

휴머노이드 분야에서 프로젝트에 옮길 수 있는 핵심은 외형보다 **다중 감각(RGB-D+IMU+힘/접촉), 실행 데이터 기록, 원격 조작 시연, 시연 데이터 기반 학습**이다. LeRobot은 시연 수집→정책 학습→평가 흐름을 제공한다. 양팔이 확정된 뒤 자료 수집 형식을 참고할 수 있으나 현재 기체의 드라이버나 무GPU 학습·실시간 정책 성능은 보장되지 않는다. VLA/모방학습을 자율주행 필수조건으로 두지 않고, 먼저 결정적인 주행·그리퍼 동작을 완성하는 방향을 권한다. [LeRobot 공식 시연 학습](https://huggingface.co/docs/lerobot/il_robots), [GelSight 휴머노이드 촉각 자료](https://www.gelsight.com/industries/robotics/)

## 5. CPU·전원·장착·안전에서 놓치면 안 되는 조건

- **전원:** Pi5는 5V/5A급 공급에서 downstream USB 전체 1.6A, 그 외 호환 전원에서는 600mA 제한이 적용될 수 있다. RGB-D·LiDAR·기존 카메라 합산 peak를 산정하고 필요하면 별도 전원 hub/정격 DC 변환을 검토한다. 원래 배터리·확장보드에 이 여유가 있는지 확인하지 않았다. 모터와 팔 전원을 Pi GPIO로 공급하지 않는다. [Raspberry Pi 공식 하드웨어](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)
- **장착/가림:** 팔·적재물·카메라 PTZ가 LiDAR 스캔을 가릴 수 있다. 고정 센서 TF와 회전 PTZ TF를 구분한다. 2D LiDAR는 스캔 높이에 없는 장애물·상부 돌출부·낭떠러지를 완전히 검출하지 못하므로 높이·근접 센서 조합이 필요하다. 이는 센서 기하에 따른 적용 판단이다.
- **CPU:** PC에서 Gazebo, Pi에서 실제 센서를 처리하는 구성을 우선 비교한다. Pi 한 대에 Gazebo·3D SLAM·YOLO·다중기체·영상 인코딩을 전부 넣는 성능은 확인되지 않았다. 영상·scan·pointcloud의 해상도/빈도·필터·ROI를 조절하며 측정한다.
- **센서 시뮬레이션:** Harmonic은 IMU/contact/lidar 예제를 제공하지만 gpu_lidar/RGB-D/카메라는 렌더링 경로를 쓴다. ‘headless’는 렌더링 불필요를 뜻하지 않는다. CPU 소프트웨어 렌더링 성능은 실험 대상이며, 지도 기하로 만든 웹 raycast는 실제 센서 잡음·반사·누락을 검증한 것이 아니다. [Gazebo Harmonic 센서](https://gazebosim.org/docs/harmonic/sensors/)
- **안전 구분:** RPLIDAR/교육용 센서나 Nav2 Collision Monitor를 붙였다고 안전 인증 시스템이 되지 않는다. 공식 Nav2는 hard real-time safety certification을 제공하지 않는다고 명시한다. 실제 산업용 예 SICK microScan3는 보호 필드와 안전 I/O/네트워크가 별도다. 실제 현장 사용 시 해당 안전 체계를 별도 검토해야 하며 이번 학원 시연의 완성 조건과 혼동하지 않는다. [Nav2 Collision Monitor](https://docs.nav2.org/rolling/configuration_and_development/configuration_guide/core_servers/collision_monitor/configuring_collision_monitor_node/), [SICK microScan3](https://www.sick.com/ag/en/catalog/products/safety/safety-laser-scanners/microscan3/c/g295657)

## 6. 사이트에 추가하면 유용한 기능 — 설계 제안만

| 제안 | 필요 이유 | 완료 판정 예시 |
|---|---|---|
| 센서 진단·지연 패널 | 영상만 있고 scan/TF가 끊긴 상태 구분 | 기체별 마지막 수신 시각·주기·TF·지연·실측/가상 출처 표시 |
| 센서 시야/scan/보호거리 overlay | 카메라·LiDAR 사각지대와 회피 원인 이해 | 동일 scene revision에서 pose와 관측 방향이 일치 |
| 위치 신뢰도·재위치 추정 상태 | 지도 점이 있어도 실제 위치가 불확실할 수 있음 | 위치 유실 시 작업 중단/복구 상태를 기록 |
| watchdog·통신 단절 시 정지 | 웹 연결 해제로 마지막 속도 유지 방지 | 센서·제어 연결 장애 주입 후 로컬 제어기가 정지 |
| 장애물 실패·재계획 테스트 | 도착 성공만으로 회피 성능을 알 수 없음 | 움직이는 사람/가림/좁은 통로/회피 불가를 각각 재현 |
| rosbag2 로그·영상·댓글 동일 타임라인 | 팀원 피드백을 실제 센서 원인과 연결 | 실행시각 댓글에서 pose/scan/영상/명령 함께 재생 |
| 배터리 실제 측정과 충전 접촉 확인 | 현재 가상 %를 실물 예약 판단에 쓰면 부정확 | 전압·전류·온도·충전 여부와 추정 %를 구분 |
| 기체/센서 설정 profile | Pi·PC·엔진간 설정 혼동 방지 | 기체 ID별 geometry·sensor TF·driver·firmware·단위 보존 |
| 자원 소유권·lease 만료 복구 | 통로/충전소/엘리베이터 소유자가 끊기면 교착 가능 | 재접속·만료 시 안전 정지와 운영자 확인 상태 표시 |

## 7. 단계별 도입 제안

**0단계 — 구매 전 실물 확인:** Raspbot 보드 핀맵·모터 피드백·실측 배터리·전원 여유·장착 공간, 카메라 모델, 양팔 모델/무게/통신을 확인한다. 담당 팀원 1명이 실제 보드·기체 사진과 제조사 모델명을 확보하면 큰 불확실성을 줄일 수 있다.

**1단계 — 단일 기체 주행:** 기존 RGB와 2D LiDAR 한 종류, odom/IMU/TF부터 검증한다. 지도 생성·저장·복귀·새 장애물 재계획·통신 단절 정지를 통과한다. 필요 시 별도 인코더/MCU 연결을 설계한다.

**2단계 — 다중 기체:** 같은 검증된 profile을 복제하고 고유 ID·namespace·시각·예약을 시험한다. 1cm 선착순 규칙은 현실 위치/시간 오차보다 작을 수 있으므로 센서 분해능·위치 오차 실측 후 tie-break·대기선 margin을 정한다. 위치 화면의 소수점 자릿수가 정확도라는 뜻은 아니다.

**3단계 — 물건 전달:** RGB-D 한 종류 비교, 고정 전달 위치·가벼운 모형·명확한 대상 표식, 양팔 충돌/하중/그리퍼 피드백을 검증한다. BBOX만으로 집기·수령 완료를 판단하지 않는다.

**4단계 — 층간/연구 확장:** 가상 엘리베이터+QR/AprilTag→인터페이스 확보 후 실제 장비 검토. 3D LiDAR·촉각·시연학습은 기준 시연이 안정된 뒤 별도 실험으로 분리한다.

## 8. 아직 확인되지 않은 사항과 필요한 정보

1. 실제 소유 Raspbot V2의 표준/Superior 구성, 보드 revision·firmware·OS 이미지. 기본 키트에 LiDAR·RGBD·IMU가 포함됐다고 판단하지 않았다.
2. 모터 encoder 유무뿐 아니라 **count/속도를 읽을 수 있는 API** 유무. 없다면 PWM 명령 기반 가상 odom과 실측 odom을 구분해야 한다.
3. 실제 배터리/DC 변환기/USB 전원 여유, 팔 추가시 무게중심·차체 하중. 현재 부품명만으로 전기·기계 호환 완료 판정 불가.
4. 센서별 정확 model/firmware/driver tag와 Ubuntu24.04 ARM64 빌드·USB hotplug·재부팅·장시간 수신. 공식 ROS2 지원은 이 시험을 대체하지 않는다.
5. 팀 PC CPU/RAM과 Pi5 냉각, 동시에 수행할 YOLO·SLAM·인코딩 부하. FPS·최대 기체 수·지연 보장치를 제시하지 않았다.
6. 강사 데이터의 labels·카메라 보정·좌표계·단위, 목표 작업자의 식별 방식, 영상 수집/공유 범위.
7. 실제 엘리베이터 제조사 인터페이스와 호출·문·탑승 센서. QR만으로 제어되지 않는다.
8. 실물 시연의 성공률·접근거리·정지거리·회피 불가 처리 기준은 팀·강사 합의가 필요하다.

## 9. 핵심 공식 출처 12개 및 보조 근거

1. [Yahboom Raspbot V2 자료](https://www.yahboom.net/study/RASPBOT-V2/) — 실제 chassis 교육·제어 자료의 출발점.
2. [Gazebo ROS 호환표](https://gazebosim.org/docs/harmonic/ros_installation/) — Jazzy/Harmonic·Humble/Fortress 구분.
3. [SLAMTEC sllidar_ros2](https://github.com/Slamtec/sllidar_ros2) — 모델·driver·serial 설정 범위.
4. [LDROBOT ldlidar_stl_ros2](https://github.com/ldrobotSensorTeam/ldlidar_stl_ros2) — LD06/LD19 후보.
5. [RealSense ROS wrapper](https://github.com/realsenseai/realsense-ros) — Jazzy 지원 안내.
6. [Orbbec ROS2 wrapper](https://github.com/orbbec/OrbbecSDK_ROS2) — SDK 세대·모델·배포판 구분.
7. [Livox driver2](https://github.com/Livox-SDK/livox_ros_driver2) — 3D LiDAR/Jazzy·시험용 driver 조건.
8. [Raspberry Pi 하드웨어](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html) — USB 전원 예산.
9. [Nav2 Jazzy Obstacle Layer](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/costmap_plugins/obstacle/) — 센서→회피 입력.
10. [AprilTag ROS2](https://github.com/christianrauch/apriltag_ros) — 보정 영상/CameraInfo/표식 pose.
11. [MoveIt 2](https://moveit.picknik.ai/) — 물체 집기/팔 계획.
12. [Open-RMF lift adapter](https://github.com/open-rmf/lift_adapter_template) — 엘리베이터 요청/상태 인터페이스.

보조 근거는 각 절에 연결했다. 원문 전체나 엔진·모델 파일은 다운로드하지 않았다. 기존 메모는 제품 식별과 ‘프록시/실물 구분’ 확인에만 사용했고 기술 지원 현황은 이번 공식 자료로 재확인했다. Raspbot 내장 encoder/IMU는 확인하지 못했음을 의도적으로 남겼다.

## 작업 경계 기록

8번은 본 보고서 한 파일만 작성했다. 구매·설치·대형 다운로드·코드 구현·로컬 서비스 실행·운영 접속 변경·DB 변경·원격 push·배포 없음. 5번 구현 코드와 6번 검증 결과는 수정하지 않았다. 권고는 후속 설계 후보이며 이번 보고서 자체가 설치·구매·실물 연결 승인 또는 호환성 시험 완료를 의미하지 않는다.
