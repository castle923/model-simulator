# model simulator

4인 학생 프로젝트용 자율주행·다중 기체 웹 시뮬레이터입니다. **코드와 연구·검증 결과를 보존하고 팀이 후속 개발할 수 있도록 정리한 GitHub 저장소**입니다. 손상된 Codex 공유 대화의 복원본은 아닙니다.

| 먼저 볼 자료 | 내용 |
|---|---|
| [현재 상태](docs/STATUS.md) | 구현·부분 구현·미연결·검증 한계 |
| [파이프라인](docs/PIPELINES.md) | 개발/실행/검증/협업/배포 흐름 |
| [마일스톤](docs/MILESTONES.md) | 단계별 성과와 남은 작업 |
| [설치와 실행](docs/GETTING_STARTED.md) | Node/Python, 로컬 미리보기, 검사 |
| [기체·카메라·작업공간 사용법](docs/ROBOT_STUDIO.md) | 커스텀·고급 임무·줌·오류 실험 |
| [연구 자료 목록](docs/RESEARCH_INDEX.md) | 에이전트별 조사·준비·검토 자료 |
| [소스 보존 내역](docs/ARCHIVE_POLICY.md) | 출처·제외 파일·SHA-256 |
| [기여 규칙](CONTRIBUTING.md) | 팀원 변경 보호와 PR 절차 |

## 주요 기능
- 단일/다중 공통 Free Space: 2~30m, 최대8대, 객체/기체/목표/경유점 편집 및 JSON.
- 가상 전방향/전진 전용 곡선 경로, 합성 관측·동적 우회, 좁은 통로 예약, 공용 충전 대기.
- Raspbot 근사·TurtleBot3 Burger/Waffle Pi·AMR 등 8종 프리셋, 치수·형상·개별 속도·카메라·팔 구성.
- 선택 기체/장착 카메라 합성 시점, PC 웹캠 연결 UI, 지도 녹화, 16:9·줌·화면 이동·테마 설정.
- 기체별 고급 임무/제한된 자연어 명령, 교육용 Python/JSON/Notebook 내보내기.
- 명시적 force-direct 웹 오류 실험, 침범 진단·의견·시도 이력. 실제 기체 실행 기능이 아닙니다.
- 별도 `/legacy`에 팀 게시판·실행·댓글·파일·WebRTC 관련 과거 소스 보존.

## 빠른 시작
Node.js24, Python3, npm이 필요합니다. 자세한 설명은 [설치 안내](docs/GETTING_STARTED.md)를 확인하세요.
```bash
npm ci --include=dev --include=optional
node scripts/build-scene-worker.mjs
node scripts/run-framework.mjs dev --host 127.0.0.1 --port 5176
```
브라우저에서 http://127.0.0.1:5176/ 을 엽니다. 배포/DB 프로비저닝은 하지 않습니다.
```bash
node research/agent20-custom/verify-final.mjs
node scripts/run-framework.mjs build
```

## 검증과 한계
2026-10-16 배포 기준 소스는 `ed53be47717ce0154200846f736690bc6be8f2a0`입니다. 과거 30개 스크립트·타입 검사와 Astra 검토 결과는 `verification/` 및 `research/agent20-custom/REVIEW.md`에 보존합니다. 새 GitHub CI 결과는 Actions에서 별도로 확인합니다.

8대 지원은 임의 배치의 완주 보장이 아닙니다. 22×12m 혼잡 충전 배치에서 가상600초 후6대 완료·2대 안전 대기가 남았습니다. 카메라 수명주기는 모의 스트림으로 검사했으며 실물 USB 화질·지연은 검증하지 않았습니다. Unity/CARLA/Gazebo/Pi5·모터·실제 팔 제어는 연결 완료 상태가 아닙니다. 자동 순찰/PPE 판정/30% 배터리 정책은 후속 과제입니다.

기존 시연: https://model-simulator.chummy-fly-1695.chatgpt.site/ — 이 저장소 push로 해당 사이트를 자동 갱신하지 않습니다. 설치된 외부 엔진이나 로봇 제어권을 제공하지 않습니다.

## 폴더
| 경로 | 내용 |
|---|---|
| `app/`, `components/`, `hooks/` | 화면·상호작용·기존 팀 UI |
| `lib/` | 장면·계획·센서·교통·충전·명령·카메라 모델 |
| `scripts/`, `research/agent20-custom/` | 빌드·회귀·독립 반례 검사 |
| `cpu-simulation-prep/` | CPU/Gazebo 연결 준비 스크립트·샘플, 설치/실행 자동 승인 아님 |
| `db/`, `drizzle/`, `examples/` | legacy DB 스키마·마이그레이션·예시, 운영 데이터 제외 |
| `archive/research/`, `archive/planning/` | 에이전트4~16 조사·구현 인계 문서 |
| `docs/history/` | 옛 README와 상태 해석 안내 |
| `verification/` | 과거 검사 증거와 파일 무결성 목록 |

외부 라이선스는 `vendor/` 및 `build/`의 기존 라이선스 파일을 유지합니다. 프로젝트 전체의 재배포 라이선스는 아직 지정하지 않았습니다.
