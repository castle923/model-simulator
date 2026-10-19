# 11번 · 선택 기체 코드 작업 공간과 다운로드

작성: 2026-10-14. 메카닉 (2) 로컬 복사본 전용. 원본·배포 사이트·운영 DB·Pi5 연결·배포 없음.

| 기능 | 실제 구현 | 이용 방법 |
|---|---|---|
| 현재 기체 코드 | 선택 기체의 현재 임무/목표/대상 ID를 JSON으로 표시 | 기체 카드·관찰 기체 선택 |
| 코드 편집·직접 적용 | 목표 주행과 안전모 전달 JSON을 검증하여 웹 TypeScript 실행기에 적용 | JSON 수정 → 검증 → 선택 기체에 코드 적용 → 경로 검증 → 주행 시작 |
| Python 주석 | 동일 JSON과 BBOX·track ID·PPE 판정·지도 ID 연결·임무 단계를 # 주석으로 설명 | 기본 펼친 Python 설명 영역 확인 |
| 상태 | 현재 기체 상태·지도 버전·안전모 소유 표시 | 손에 보유한 안전모는 착용 완료 아님을 표시 |
| 파일 다운로드 | .py / .json / .ipynb 선택 | 현재 코드 검증 후 선택 형식 다운로드 |
| 사용 방법 | 상단 및 패널 버튼에서 모달 | Esc/닫기, 포커스 복귀, read.md 다운로드 |
| 기체 삭제 | 선택 기체가 없어지면 현재 목록 첫 기체로 fallback | 사라진 기체 코드는 검증 거부 |

## 작성권과 통합

- 11번: mechanic-hub/app/RobotCodeWorkspace.tsx, mechanic-hub/lib/robot-code-export.ts, scripts/test-robot-code-export.mjs, 이 보고서.
- 5번: SceneLab에 배터리 기체 카드 아래 패널·상단 사용법 버튼을 통합하고 CSS 작성. 공통 주행·외곽접근점·소유권 구현은 5번 소유.
- 인터페이스: RobotCodeWorkspace({scene, selectedRobotId, poses, locked, onApply}). named export CodeWorkspaceHelpButton 제공.
- 실제 목표 주행은 applyRobotProgram, 전달은 기존 applyMission으로 처리한다. 다른 기체 임무·지도 객체는 보존하며 적용 시 전체 실행 위치·예약은 초기화한다.
- 전달 JSON은 기존 strict MissionCode 그대로다. 목표 주행은 schema 1/action navigate/goal{x,y,floor}/after charge/basis user_instruction 계약을 추가했다. 설명용 _comment나 #는 실제 JSON에 넣지 않는다.

## 검증

| 확인 | 결과 |
|---|---|
| 목표 코드 적용 | R2 목표만 변경, R1·지도 객체·원본 Scene 보존 |
| 전달 코드 | 현재 정확한 helmetId/workerId와 기존 strict MissionCode 재사용 |
| 잘못된 코드 | 삭제/다른 기체·오래된 지도·NaN·추가 필드·장애물 안 목표 거부 |
| Python | 목표/전달 2종을 Python 실행하여 exit 0, DRY RUN 출력, 실제 카메라 호출 없음 |
| Python 문법 | ast.parse 통과 |
| JSON | 표시한 코드와 직렬화 동일, 유효 JSON |
| Notebook | nbformat 4.5 필수 구조·코드 AST 통과. 격리 설치한 nbformat.validate로 2종 모두 PASS |
| TypeScript | 최종 npx tsc --noEmit --incremental false exit 0 |
| 전체 빌드/브라우저 | 5번 통합 이후 주 에이전트 및 6번의 최종 검증 대상. 이 보고서에서 선확정하지 않음 |

검증용 nbformat은 outputs/agent11/notebook-validator에 --target 격리 설치했으며 전역 Python·제품 dependency 파일을 변경하지 않았다.

## 다운로드 검증 산출물

복사본 루트 outputs/agent11/code-export/에 다음 파일이 있다.

- navigate.py / navigate.json / navigate.ipynb
- delivery.py / delivery.json / delivery.ipynb
- read.md

위 파일은 고정 검증 Scene의 R2 예제이며 사용자 실제 지도 파일이 아니다. 브라우저 다운로드는 현재 선택 기체와 편집·검증한 JSON을 사용한다. Python·Notebook에는 내보내기 시점 phase/안전모 소유 스냅샷을 주석으로 담는다. JSON은 실행 계약에 추가 필드를 섞지 않는다.

## 감지·추적·실물 적용 범위

웹의 현재 실행 코드는 TypeScript이며 JSON은 해당 실행기에 적용되는 제한된 명령이다. Python은 같은 명령을 설명하는 독립 dry-run 예제이며 웹 원본 코드가 아니다. Python·Notebook을 브라우저에서 임의 실행하지 않는다.

Python의 detect_video는 준비된 로컬 PPE 모델·로컬 동영상으로 사용자가 직접 호출할 수 있는 선택 예제다. 기본 실행은 함수 호출 없이 단계만 출력한다. 자동 모델 다운로드·실제 카메라 시작·실물 명령 전송은 없다. COCO YOLOv8n에 PPE 미착용 클래스는 없으며 검증된 별도 모델과 클래스 매핑이 필요하다.

BBOX는 영상 사각형, track ID는 임시 추적 번호이며 사람 신원이 아니다. 가림·미검출만으로 미착용을 확정할 수 없다. judge_ppe, bind_track_to_scene, send_to_real_robot는 명시적인 NotImplementedError이며 아직 구현하지 않은 기능을 실제로 동작하는 듯 표시하지 않는다. 영상 좌표→지도 작업자 연결, 실제 YOLO 판정, Pi5 모터·팔 제어는 미연결이다.

선택 영상 함수 API 근거: https://docs.ultralytics.com/modes/track/ (YOLO.track, tracker, result.boxes). 모델·CPU 속도·실제 PPE 정확도는 실측하지 않았다.

## 인계 시 주의

5번이 전달 대상 외곽 접근으로 변경했으므로 이전 scripts/test-vibe-mission.mjs의 객체 center 일치 검증은 외곽 거리·선택 ID 의미 검증으로 갱신해야 한다. 신규 코드 export 테스트는 해당 경로 center에 의존하지 않는다. 제품 신규 파일은 이 보고 시점에 동결하고 후속 수정은 담당자 협의 후 수행한다.
