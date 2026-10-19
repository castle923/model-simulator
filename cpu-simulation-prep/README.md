# GPU 없는 환경의 시뮬레이션 준비

2026-10-13. 팀 환경 미확정. Ubuntu 24.04 + ROS 2 Jazzy + Gazebo Harmonic 우선 검토, 22.04 + Humble + Fortress 별도 이식 검토. ROS 1은 제외합니다. 기존 Pi·Windows·팀원 환경을 변경하거나 엔진을 설치하지 않았습니다.

## 제공 파일

- mechanic-factory.sdf: 현재 기본 공장의 정적 랙·기체 프록시·충돌 배치 예제. 카메라 없음.
- mechanic-camera.sdf: 같은 정적 배치 + 고정 상부 시점 RGB 카메라 640×480, 목표 10Hz, /mechanic/camera 토픽.
- 두 파일의 기체는 정적 박스 프록시입니다. 메카넘·관절·센서 실측 모델, 자율주행·통로 락 플러그인, 웹 수신 연결기는 포함하지 않습니다.
- XML 파싱·생성 코드 검사와 WSL Ubuntu의 gz sdf 검증, 실제 Gazebo 이미지 생성 및 웹 수신을 확인했습니다. 상세 실측 범위는 문서 마지막 실행 검증 결과를 확인하세요.

## Gazebo Harmonic 설치 후 Ubuntu에서 실행

물리 서버/배치 확인:

```sh
gz sim -s -r mechanic-factory.sdf
```

카메라를 CPU 소프트웨어 렌더링으로 시험:

```sh
LIBGL_ALWAYS_SOFTWARE=1 DISPLAY= gz sim -s -r --headless-rendering mechanic-camera.sdf
```

다른 터미널에서 토픽 확인:

```sh
gz topic -l
```

OGRE2/EGL 및 Mesa 드라이버 지원을 확인해야 합니다. --headless-rendering은 렌더링을 끄는 명령이 아닙니다. 소프트웨어 렌더링이 지원되지 않으면 영상은 생성되지 않습니다. 목표 10Hz는 성능 측정값이 아닙니다. 저해상도부터 실제 이미지·출력 주기를 확인합니다. 카메라는 사이트로 자동 전송되지 않습니다.

ROS 2 Jazzy와 ros_gz_bridge가 준비된 경우 이미지 토픽을 ROS로 연결하는 명령 예:

```sh
ros2 run ros_gz_bridge parameter_bridge '/mechanic/camera@sensor_msgs/msg/Image[gz.msgs.Image'
```

실제 토픽 이름은 gz topic -l 결과를 따릅니다. ROS 브리지는 아직 실행 검증하지 않았습니다. 현재 구현은 ROS를 거치지 않고 Gazebo Transport → JPEG → HTTPS 수신기로 직접 전달합니다.

## Unity / CARLA

Unity의 빌드된 Player는 -batchmode -nographics로 그래픽 장치 없이 실행할 수 있습니다. 영상이 필요하면 해당 모드를 사용하지 않고 렌더링 환경을 준비합니다. Unity Editor의 개발 요구사항과 headless Player 요구사항을 구분합니다.

CARLA no_rendering_mode=True는 카메라와 GPU 센서에 빈 데이터를 반환합니다. -RenderOffScreen은 디스플레이 창만 없애므로 GPU 없는 실행과 같지 않습니다. 서버 부팅에 필요한 그래픽 환경은 별도 확인해야 합니다. YOLO 카메라 검증은 no-rendering으로 할 수 없습니다.

## 공식 출처

- https://docs.unity3d.com/6000.0/Documentation/Manual/desktop-headless-mode.html
- https://carla.readthedocs.io/en/0.9.16/adv_rendering_options/
- https://gazebosim.org/api/sim/9/headless_rendering.html
- https://gazebosim.org/docs/harmonic/ros_installation/
- https://github.com/gazebosim/gz-sim/blob/gz-sim8/examples/worlds/camera_sensor.sdf
- https://docs.ros.org/en/jazzy/Tutorials.html
- https://moveit.ai/install-moveit2/binary/
- https://github.com/MRPT/mvsim

## 웹 카메라 연결기 (추가 구현)

웹의 Gazebo 카메라 패널에서 수신 세션을 만들고 연결 설정 파일을 받습니다. 이 파일에는 업로드 키가 있습니다. Git/게시판에 올리지 않고 실행 PC에만 보관합니다. 관찰자는 세션 ID만 입력합니다. 세션은 2시간 후 만료되며 작성자가 종료할 수 있습니다.

세션 작성자는 웹에서 현재 지도를 명시적으로 적용할 수 있습니다. 서버는 장애물·기체·단일 충전소 형상을 검증해 SDF를 생성하고, 연결기는 Gazebo 모델을 교체한 뒤 실제 장면의 모델 이름을 확인합니다. 장면별 고유 이미지 토픽과 프레임 버전으로 전환 전 영상을 구분합니다. 카메라 시점은 상부 또는 선택한 R1~R4의 정면입니다. 정면 시점에서 위치 동기화를 켜면 웹 주행 좌표를 약 1초 간격으로 전송하고 연결기가 `set_pose/blocking`으로 Gazebo 프록시를 움직입니다. 위치 번호는 장면 버전에 묶이며 연결기의 적용 확인과 그 뒤 받은 영상 번호를 UI에 따로 표시합니다. 기체 추가·삭제 또는 환경 배치 변경은 장면을 자동 재적용하며, 삭제된 기체의 활성 프레임·위치 데이터는 교체됩니다. 카메라 대상이 삭제되면 남은 첫 기체 또는 상부 시점으로 전환합니다. 이는 웹 2D 위치를 Gazebo 시각 모델에 투영하는 기능이며 Gazebo 물리 엔진이 주행·충전·락을 수행하는 것은 아닙니다. 시점·지도·위치 변경은 세션 작성자에게만 허용됩니다.

Ubuntu의 Gazebo Harmonic Python transport13/msgs10 및 Pillow가 설치된 환경에서 실행:

```sh
python3 gazebo_camera_bridge.py --config gazebo-camera-connection.json
```

Gazebo image의 640×480 RGB/BGR/RGBA/BGRA 버퍼를 JPEG 품질 85로 바꿔 HTTPS로 최대 2fps 업로드합니다. 256KB를 넘는 품질 85 JPEG는 무단 압축률 변경 없이 오류로 기록합니다. 실제 이미지 메시지가 오기 전에는 업로드하지 않습니다. 웹에서는 마지막 프레임을 갱신하고 5초 이상 갱신이 없으면 중단 상태로 표시합니다. 이 구현은 R2에 최근 프레임 하나만 덮어쓰는 저속 미리보기입니다. 고프레임 WebRTC 카메라 스트림·녹화·센서 타임스탬프 동기화·자동 제어는 별도입니다.

검증 완료: Python 변환 로직의 합성 데이터 단위 검사, 로컬 API JPEG 바이트 보존·키·작성자·이전 프레임·빈 영상·종료 검사. 추가 검증: WSL 설치 후 실제 Gazebo 구독·CPU renderer·Ubuntu 실행·공개 사이트 수신을 확인했습니다. 다른 CPU PC와 팀원 다중 PC의 동시 수신은 별도 확인이 필요합니다.

## 2026-10-13 실제 실행 검증 결과

현재 Windows PC의 WSL 2 + Ubuntu 24.04.5에서 Gazebo Harmonic Sim 8.15.0을 설치하고 SDF 검증(Valid), 실제 Image 구독 및 공개 웹 수신까지 확인했습니다. EGL renderer는 llvmpipe (LLVM 20.1.2, 256 bits)이며 하드웨어 GPU를 사용하지 않는 설정으로 실행했습니다.

6초 표본에서 카메라 프레임 60개, 측정 9.83fps였습니다. 이는 이 PC의 짧은 표본이며 다른 CPU의 보장값이 아닙니다. Gazebo set_pose 요청으로 프록시 위치를 바꿨고 이미지 해시가 달라지는 것을 확인했습니다. 웹은 별도로 최대 2fps의 저속 JPEG 전달 경로를 사용합니다.

기체는 여전히 정적 박스 프록시입니다. 기존 `set_pose` 시험은 외형 위치 변경 검사이며 메카넘 동역학이나 자율주행 검증이 아닙니다. 웹 캔버스의 환경은 작성자가 '현재 지도 → 카메라에 적용'을 누르거나 카메라 시점을 선택할 때 Gazebo에 반영됩니다. 새 위치 동기화 경로의 실제 운영 검증 결과는 별도 기록해야 하며, 연결기 적용 확인만으로 이미지의 위치 일치까지 증명하지 않습니다.

403 업로드를 해결하기 위해 연결기는 자체 User-Agent MechanicGazeboBridge/1.0을 명시합니다. Gazebo가 생성한 프레임만 업로드하며 업로드 키는 로그에 출력하지 않습니다.

### Windows에서 재시작

```powershell
./Start-GazeboCamera.ps1 -ConfigPath 'C:/Users/ST-USER/Downloads/gazebo-camera-connection (1).json'
```

설정 파일 경로는 사용자가 내려받은 실제 파일에 맞춥니다. 이 스크립트는 숨긴 Windows WSL 클라이언트로 실행기를 유지하고 최대 2시간 실행합니다. 세션이 먼저 만료되면 연결기가 종료됩니다. 재부팅하면 자동으로 시작하지 않습니다. 런타임 로그는 %LOCALAPPDATA%/MechanicGazeboCamera에 있습니다.

```powershell
./Stop-GazeboCamera.ps1
```

중지 스크립트는 이 작업의 PID 파일과 명령 경로를 확인한 뒤 해당 실행기만 종료합니다. 실제 중지·재시작·영상 재수신을 검증했습니다. 사용자 개인 Ubuntu 계정은 생성하지 않았고 설치·실행 명령은 WSL 게스트 root로 수행했습니다. 팀의 최종 Ubuntu/ROS 환경은 미확정입니다.
