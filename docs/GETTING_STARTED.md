# 설치·실행·검사
## 공통 환경
Node.js24(프로젝트 최소22.13), npm, Python3가 필요합니다. `python --version`을 확인하세요. 일부 내보내기 안전성 검사가 Python 인터프리터를 사용합니다. 웹 앱 자체에 ROS/Unity/CARLA/Gazebo 또는 GPU는 필요하지 않습니다.
```bash
git clone https://github.com/castle923/model-simulator.git
cd model-simulator
npm ci --include=dev --include=optional
node scripts/build-scene-worker.mjs
node scripts/run-framework.mjs dev --host 127.0.0.1 --port 5176
```
비공개 저장소이므로 GitHub 계정에 저장소 접근 권한이 필요합니다. 팀원 초대는 소유자가 별도로 설정합니다. 기존 포트가 사용 중이면 다른 포트를 지정하세요. Windows에서는 `npm.cmd`를 사용할 수 있습니다.

## 검사
```bash
node research/agent20-custom/verify-final.mjs
node scripts/run-framework.mjs build
```
전체 검사는30개 회귀/독립 스크립트와 TypeScript 검사이며 `outputs/agent20-custom/verification.json`에 실행별 결과와 SHA-256을 씁니다. 가짜 React/MediaStream은 실제 브라우저나 실물 카메라 증명이 아닙니다. UI는 직접 실행해 기체 선택·주행·카메라·줌·드래그를 확인하세요.

`test-hub.mjs`는 로컬 DB에 검증 데이터를 기록하므로 기본 CI에 포함하지 않습니다. 운영 URL에 실행하지 마세요. `/legacy`는 로컬 D1/R2 구성·스키마 적용이 별도로 필요합니다. `.openai/hosting.json`에는 바인딩 이름만 있으며 기존 운영 프로젝트 ID와 인증정보는 제외했습니다.

## 실물과 외부 엔진
현재 `/`는 웹 합성 시뮬레이션입니다. 엔진 이름 선택이나 창 미리보기는 엔진 설치·좌표/영상 연결 완료를 뜻하지 않습니다. `cpu-simulation-prep/README.md`와 `ENGINE_CONNECTION_GUIDE.md`는 별도 준비 자료입니다. 로봇/카메라/DB를 자동 연결하지 마세요.
