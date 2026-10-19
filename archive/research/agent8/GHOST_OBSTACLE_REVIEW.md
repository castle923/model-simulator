# 8번 에이전트 — 사라진 사람의 Ghost 장애물 원인·해결 검토

조사일: 2026-10-14 KST. 공식 Nav2 Jazzy 자료와 복사본 소스를 읽은 분석 보고서다. 코드 구현, 서비스 실행, 센서 시험, 다운로드, DB·원본·운영 사이트 변경은 하지 않았다.

## 브리핑

**경로 계획 때 있던 사람이 이동했다고 해서 기체가 저장한 장애물 정보가 저절로 없어지지는 않는다.** 실제 센서가 빈 공간을 다시 관측해서 지우거나, 별도 동적 객체 추적기가 관측의 유효성을 관리하고 경로를 재계산해야 한다. 현재 웹 시연은 사람이 센서로 감지되어 생긴 장애물이 아니라 사용자가 지도에 배치한 정적 객체이므로, 실제 Nav2의 잔상 문제와 구분해야 한다.

단순히 ‘몇 초 지나면 사람 장애물 삭제’로 해결하면 가려졌거나 멈춰 서 있는 사람을 지워 위험해진다. **안 보임, 센서 고장, 가려짐, 실제로 비어 있음**을 분리하는 것이 핵심이다.

## 1. 현재 복사본과 실제 ROS 상황의 차이

| 구분 | 소스로 확인한 상태 | 의미와 한계 |
|---|---|---|
| 웹 Free Space | `lib/scene-local.ts`의 `sceneWorld()`가 현재 층의 `blocking` entities를 사각 장애물로 변환 | 작업자는 맵 데이터이며 실물 카메라·LiDAR 관측 결과가 아님 |
| 웹 경로 | `planScene()`이 경유점·목표·충전·접근 위치를 계획, 화면은 준비된 route 사용 | 사람이 실제로 사라져도 이 데이터와 route가 자동 갱신되지 않음 |
| 웹 편집 | `app/SceneLab.tsx` `commit()`은 실행 중 편집을 거부. 일시정지 후 적용하면 실행 종료·지도 revision 증가·경로/예약 초기화 | 현재 가능한 조치는 정지→객체 이동/삭제→검증→새 실행. 실행 중 센서 기반 재계획과 다름 |
| 실제 엔진 | 복사본 자체 안내에 Unity·CARLA·Gazebo 실제 엔진/영상 미연결 표시 | Nav2 파라미터를 설명해도 현재 웹의 실물 ghost가 고쳐지는 것은 아님 |
| 전달 접근 | `approachLeg()`는 차체 반경 0.22m + 외곽 여유 0.10m, 합계 0.32m 바깥 후보 중 접근 경로 선택 | 웹 가정값. 팔의 실제 reach·높이·그리퍼·힘·깊이 검증을 한 것이 아님 |

읽기 시점의 복사본 코드 기준이다. 5번이 후속 변경하는 경우 정확한 줄 번호는 바뀔 수 있다. 제품 코드는 수정하지 않았다.

## 2. 실제 Ghost 장애물이 남는 대표 원인

| 원인 | 재현되는 상황 | 확인할 증거 | 해결 방향 |
|---|---|---|---|
| 정적 지도에 사람이 기록됨 | 사람을 포함해 저장한 지도에서 사람이 사라져도 계속 막힘 | 원본 OccupancyGrid/static layer에도 같은 셀이 occupied인지 | 벽·랙 위주의 지도와 이동체 관측을 분리. 오염된 지도는 별도 검토·수정 후 승인된 버전 사용 |
| marking만 있고 clearing 없음 | LiDAR로 사람 흔적을 추가했지만 빈 공간 광선은 사용 안 함 | source의 marking/clearing, scan과 obstacle layer 비교 | 유효한 free ray에 의한 clearing 활성·검증 |
| 센서 시야·거리 밖 또는 가림 | 사람이 랙 뒤로 이동. 옛 위치를 다시 보지 못함 | 현재 관측 ray가 옛 셀을 실제 통과하는지 | 미관측 상태를 free로 단정하지 말고 재관측·감속·시야 확보 |
| clearing 범위/높이 불일치 | marking은 먼 곳까지 되는데 clearing은 그보다 짧음; 3D 높이 필터가 점을 제거 | obstacle/raytrace min/max, sensor origin, voxel 높이 | 실제 센서 유효 범위 안에서 clearing이 관측 위치를 덮도록 조정 |
| 오래된 관측 재사용 | 큰 observation buffer 또는 센서 중단 후 마지막 marking이 남음 | 원본 stamp, buffer 보관, 갱신 current 상태 | 버퍼·freshness 관리와 센서 건강 상태를 함께 처리 |
| TF·시각·namespace 오류 | 움직인 센서 좌표를 옛 pose로 변환, 다른 기체 scan 혼입 | frame_id·stamp·TF 실패/대기·use_sim_time·기체 ID | 시간 기준·TF chain·센서 보정·기체별 topic을 먼저 수정 |
| 다른 layer가 같은 자리를 계속 막음 | obstacle layer를 지워도 static/semantic/voxel layer가 다시 표시 | layer별 grid·voxel·track를 각각 확인 | 원인 layer만 바로잡고 결합 정책 검토 |
| 객체 tracker만 남음 | YOLO에서 사라졌지만 옛 track·semantic obstacle 계속 발행 | last_seen, confidence, 상태·TTL, publisher | 추적 상태 전이·만료·장면 revision 관리. 보이지 않는 위치의 물리 점유를 별도 보수 판단 |

근거: [Nav2 Jazzy Static Layer](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/costmap_plugins/static/), [Obstacle Layer](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/costmap_plugins/obstacle/), [Voxel Layer](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/costmap_plugins/voxel/), [Jazzy obstacle_layer 소스](https://api.nav2.org/nav2-jazzy/html/obstacle__layer_8cpp_source.html). 표의 진단 순서는 프로젝트 적용 제안이며 현상 재현 결과가 아니다.

## 3. 파라미터를 오해하면 안 되는 부분

| 항목 | 정확한 의미·주의 | 이번 프로젝트 적용 방향 |
|---|---|---|
| `marking` / `clearing` | 장애물 표시와 광선 기반 비어 있는 공간 지우기는 별도. 문서상 clearing 기본값은 false | 실제 설정 확인 없이 ‘LiDAR가 있으니 자동 삭제’라고 설명하지 않음 |
| `raytrace_*_range` | 센서 원점부터 유효 광선이 지나간 구간을 지움. 보지 못한 가림 뒤를 지울 근거는 없음 | marking 범위와 실물 신뢰 거리·근접 사각지대를 함께 시험 |
| `observation_persistence` | 관측 메시지 보관 시간. 이미 찍힌 셀의 자동 삭제 TTL이 아님 | 값을 줄이는 것만으로 ghost 완치라고 판단하지 않음 |
| persistence `0.0` | Jazzy 소스는 오래된 관측들을 지우되 최신 1개는 보관 | 0이 ‘모든 점 즉시 삭제’라는 뜻은 아님 |
| `expected_update_rate` | Jazzy 코드상 초 단위 허용 갱신 간격으로 duration 변환. 0은 current 검사를 끔 | 센서 Hz 숫자를 그대로 넣지 않음. 측정된 지터를 고려한 허용 interval 설정 |
| `inf_is_valid` | LaserScan 무한값을 clearing에 사용할지. invalid/NaN/무수신과 실제 max-range 반환은 다름 | 해당 센서가 +inf를 ‘물체 없음’으로 정의할 때만 검토. 무수신을 free로 바꾸면 안 됨 |
| `rolling_window` | 지도창이 로봇을 따라 이동 | 영역 밖 셀이 빠져도 시야 안 ghost의 시간 만료를 해결하는 기능은 아님 |
| `track_unknown_space` | 미관측을 unknown으로 보존할지 | unknown을 free와 구분. planner의 unknown 허용 정책도 따로 확인 |
| Voxel Layer | 3D 관측을 관리해 2D로 투영. 높이·mark/unknown threshold 영향 | RGB-D/3D LiDAR 입력에 적합하나 기본적으로 시간 감쇠 tracker와 같지 않음 |

구현 의미는 [Jazzy ObservationBuffer 소스](https://api.nav2.org/nav2-jazzy/html/observation__buffer_8cpp_source.html)에서 확인했다. `purgeStaleObservations()`와 `isCurrent()`가 위 구분을 보여준다. 지도창/unknown은 [Nav2 Jazzy Costmap 2D](https://docs.nav2.org/jazzy/configuration_and_development/configuration_guide/core_servers/costmap_2d/)를 확인했다. 설정값을 실제 변경하지 않았다.

## 4. 권장 해결 구조

1. **정적 지도:** 벽·랙 등 지속 구조물과 승인된 keepout만 유지. 사람이 있던 위치를 영구 구조물로 만들지 않는다.
2. **물리적 동적 관측:** LiDAR LaserScan 또는 깊이 PointCloud2를 장애물 layer로 반영. 관측된 occupied와 유효 ray로 확인한 free를 구분한다.
3. **의미·추적 layer:** 사람/안전모 ID, last_seen, confidence, 예측 pose, velocity, covariance, occlusion 상태를 별도 관리한다. tracker 번호와 신원은 다르다.
4. **상태 전이:** `관측됨 → 잠시 미검출/가림 → 확인 필요 → 재관측 후 free 또는 계속 occupied`. track timeout은 ID/예측 유효기간이지 안전 확인 없는 물리 점유 삭제 허가가 아니다.
5. **히스테리시스:** 검출·미검출 한 프레임마다 표시/삭제하지 말고 연속 관측·센서 건강·시야 조건으로 변경한다. TTL·연속 프레임 수는 시험으로 정하며 고정 정답 없음.
6. **경로·제어:** 장애물 변경이 현재 route에 영향을 주면 제한된 주기로 재계획. 위험 거리는 우선 정지/감속, route 없음은 대기·도움 요청. 사람에게 접근하는 임무는 추적 손실 시 마지막 위치로 돌진하지 않는다.
7. **복구:** 전체 costmap clear는 원인 layer·센서 정상화 확인 후 제한된 recovery로만 사용한다. 주기적으로 전체 지우면 실제 장애물도 일시 제거될 수 있고, static/semantic publisher가 원인일 경우 바로 다시 생긴다. [Nav2 Jazzy recovery 예시](https://docs.nav2.org/jazzy/getting_started/nav2_behavior_trees/detailed_behavior_tree_walkthrough/detailed_behavior_tree_walkthrough/)

구현 예시값은 본 보고서에서 확정하지 않는다. 실험용 TTL 1초 등을 가정하더라도 센서 주기·최대 지연·사람 속도·로봇 정지거리·가림 조건 측정 전에는 안전 운용값이 아니다.

## 5. 실제 사람·안전모 감지와 접근의 한계

| 구성 | 잘하는 것 | 해결하지 못하는 것 |
|---|---|---|
| RGB+YOLO | 사람/안전모/PPE 클래스·영상 추적 | BBOX만으로 metric 거리·정확한 지도 좌표·집기 높이 확보 불가. 미검출은 빈 공간 증거가 아님 |
| 2D LiDAR | 스캔 높이의 거리·free ray·벽/다리 | 사람인지 의미 분류, 바닥의 작은 안전모·상부 돌출·팔 집기 pose를 모두 제공하지 않음 |
| RGB-D | RGB 의미+깊이, 바닥 물체·집기 위치 후보 | 가림·최소 거리·광택/투명 표면·조명·USB/CPU 제약. 사각지대는 여전히 존재 |
| 근접 ToF·범퍼 | 가까운 물체·접촉 보조 | 넓은 공간 지도나 사람 신원·PPE 분류 대체 불가 |
| IMU+encoder | 이동 상태와 TF/odom 기반 | 센서가 사람을 안 본 것을 free로 판정하는 근거는 아님 |

추천은 기존 RGB + 2D LiDAR + 신뢰 odom/IMU로 주행부터 완성하고, 픽업 단계에서 RGB-D·그리퍼 피드백을 추가하는 것이다. 실물 드라이버·전원 호환 조건은 동일 폴더 `SENSOR_TECH_REVIEW.md`를 따른다. 현재 외곽 접근 gap 0.32m는 웹 차체 가정이며, 안전모까지 팔이 닿는지·사람과 충분히 떨어지는지·센서 최소 거리 밖인지 실물 시험이 필요하다.

## 6. Gazebo Harmonic 검증 설계

Harmonic 센서 예제는 IMU/contact/lidar를 제공한다. 움직이는 사람 모형과 raycast 센서를 구성하면 ghost 분석을 재현할 수 있지만, 현재 웹 카메라 프록시만으로 Nav2 clearing 검증이 완료되지는 않는다. ROS bridge·scan/pointcloud·TF·clock·Nav2 layer를 실제 연결한 별도 시험이 필요하다. [Gazebo Harmonic 센서 공식 예제](https://gazebosim.org/docs/harmonic/sensors/)

| 시험 | 의도한 결과·기록할 증거 |
|---|---|
| 사람이 경로를 막다가 옆으로 이동, 옛 위치가 다시 보임 | 유효 free ray 후 해당 동적 셀이 해제되고 새 route 반영. scan/TF/layer/명령/영상 동일 시각 기록 |
| 사람이 30초 가만히 서 있음 | TTL이 지났다는 이유로 지워지지 않음. 이 시간은 **시험 가정**이며 제품 설정값 아님 |
| 사람이 랙 뒤로 가려짐 | 시야 손실을 free로 오인하지 않고 uncertainty/재관측 상태로 전환 |
| 센서 케이블 분리 또는 메시지 중단 | 건강 경고·감속/정지. 마지막 관측 삭제 후 무조건 진행하지 않음 |
| TF 지연·잘못된 frame·sim clock 정지 | 관측 거부/갱신 지연 진단, 옛 위치의 중복 장애물 여부 확인 |
| static map에 사람 흔적이 이미 있음 | dynamic clear만으로 해결되지 않는 것을 보여주고 static 원인 식별 |
| RGB 미검출이나 깊이/LiDAR는 물체 검출 | 의미 track 손실에도 물리 충돌 영역 유지 |
| 안전모 픽업으로 실제 물체가 바닥에서 제거됨 | 센서 재관측·gripper 확인 후 바닥 점유 해제, 적재물 상태 전환 |
| 두 기체가 같은 사람을 다르게 관측 | 고유 namespace·시간·좌표 변환 유지. 오래된 타 기체 track이 현재 free 관측을 무조건 덮지 않음 |
| 전체 clear 직후 사람이 여전히 있음 | 재검출 전 공백에서 주행하지 않는 복구 상태 확인 |

측정치는 ghost 제거 지연, 센서 freshness, 경로 재계획 지연, 실제 장애물 누락률, 최소 접근거리, 정지거리로 잡는다. 통과 기준은 팀/강사가 실제 PC·속도·센서 조건에 맞춰 정해야 한다.

## 작업 경계

보고서 한 파일 작성 외 변경 없음. 제품 코드·운영 사이트·DB·원본·카메라 세션 변경 없음. 시험 계획이며 실제 센서나 Gazebo 실행 결과가 아니다. 현재 상태에서 확정할 수 있는 것은 웹 객체가 정적 데이터로 다뤄지는 구조와 공식 Nav2 동작 의미이며, 특정 실물 ghost의 원인은 로그/토픽/TF를 받아야 확정할 수 있다.
