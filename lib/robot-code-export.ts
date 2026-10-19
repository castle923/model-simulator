import {validateScene,type Scene} from './scene-local.ts';
import {applyMission,deliveryTargets,validateMissionCode,type MissionCode} from './vibe-mission.ts';

export type NavigateCode={schema:1;baseRevision:number;robotId:string;action:'navigate';goal:{x:number;y:number;floor:number};after:'charge'|'stay';basis:'user_instruction'};
export type RobotProgram=MissionCode|NavigateCode;
/** Untrusted labels must never create another physical Python source line. */
export function pythonComment(value:unknown){return JSON.stringify(String(value)).slice(1,-1).replace(/[\u0085\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
export function robotProgramBasename(id:string){const safe=String(id).replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)||'robot';return safe+'-program';}
export function currentRobotProgram(scene:Scene,id:string):RobotProgram{
 const r=scene.robots.find(r=>r.id===id);if(!r)throw Error('선택 기체가 없습니다.');if(r.experiment)throw Error('강제 실험 모드 해제 후 정상 기체 코드를 불러오거나 내려받으세요. 실험 충돌 허용 설정은 일반 코드에 포함되지 않습니다.');
 if(r.mission==='helmet'){const t=deliveryTargets(scene,r);return {schema:1,baseRevision:scene.revision,robotId:id,action:'deliver_helmet',helmetId:t.helmet.id,workerId:t.worker.id,after:'goal_then_charge',basis:'user_instruction'};}
 return {schema:1,baseRevision:scene.revision,robotId:id,action:'navigate',goal:{...r.goal,floor:r.goalFloor},after:r.after??'charge',basis:'user_instruction'};
}
export function validateRobotProgram(scene:Scene,raw:unknown,selectedId:string):RobotProgram{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('JSON 객체 형태의 기체 코드를 입력하세요.');
 const c=raw as RobotProgram;if(c.robotId!==selectedId)throw Error('코드의 robotId와 현재 선택 기체가 다릅니다.');
 if(c.action==='deliver_helmet')return validateMissionCode(scene,c);
 const keys=['schema','baseRevision','robotId','action','goal','after','basis'];
 if(c.action!=='navigate'||Object.keys(c).length!==keys.length||Object.keys(c).some(k=>!keys.includes(k))||c.schema!==1||!['charge','stay'].includes(c.after)||c.basis!=='user_instruction'||c.baseRevision!==scene.revision)throw Error('목표 주행 코드 형식 또는 지도 버전이 맞지 않습니다. 현재 기체 코드 불러오기로 갱신하세요.');
 if(!c.goal||typeof c.goal!=='object'||Object.keys(c.goal).length!==3||Object.keys(c.goal).some(k=>!['x','y','floor'].includes(k))||![c.goal.x,c.goal.y,c.goal.floor].every(Number.isFinite)||!Number.isInteger(c.goal.floor))throw Error('goal에는 숫자 x, y, 정수 floor만 입력하세요.');
 if(!scene.robots.some(r=>r.id===c.robotId))throw Error('적용 기체가 삭제되었습니다.');
 validateScene({...scene,robots:scene.robots.map(r=>r.id===c.robotId?{...r,experiment:undefined,model:r.experiment?.originalModel??r.model,goal:{x:c.goal.x,y:c.goal.y},goalFloor:c.goal.floor,mission:'navigate',missionTargets:undefined,after:c.after}:r)});return structuredClone(c);
}
export function applyRobotProgram(scene:Scene,raw:unknown,id:string):Scene{
 const c=validateRobotProgram(scene,raw,id);if(c.action==='deliver_helmet')return applyMission(scene,c);
 return validateScene({...structuredClone(scene),revision:scene.revision+1,robots:scene.robots.map(r=>r.id===id?{...structuredClone(r),experiment:undefined,model:r.experiment?.originalModel??r.model,mission:'navigate',missionTargets:undefined,goal:{x:c.goal.x,y:c.goal.y},goalFloor:c.goal.floor,after:c.after}:structuredClone(r))});
}
export const CODE_README=`# model simulator 코드 작업 공간 사용 방법

## 실제로 적용되는 코드
왼쪽 배터리 카드 아래 코드 공간에서 기체를 선택합니다. JSON은 현재 웹 시뮬레이션의 제한된 명령입니다.
현재 기체 코드 불러오기 → JSON 수정 → 코드 검증 → 선택 기체에 적용 → 경로 검증 → 주행 시작 순서입니다.
navigate의 after는 charge(충전 후 완료) 또는 stay(목표에서 완료·대기)입니다. 생략된 기존 기체는 charge입니다.
applyRobotProgram은 목표 주행을, applyMission은 안전모 전달을 TypeScript 실행기에 반영합니다.
JSON에 # 주석을 넣으면 문법 오류입니다. 각 필드의 설명은 화면의 별도 설명에 있습니다.
지도 버전이나 적용 기체가 다르면 재생성·재검증해야 합니다. 실행 중 적용할 수 없습니다.
적용 시 다른 기체의 임무와 객체는 보존하며 전체 실행 위치·예약은 초기화합니다.

## 다운로드
.json은 화면에서 검증한 JSON과 같습니다. .py는 같은 명령을 단계별로 출력하는 Python 교육 예제입니다.
.ipynb는 같은 Python 코드와 설명을 담은 nbformat 4 노트북입니다. 선택 기체·입력 JSON이 다르면 다운로드가 차단됩니다.
Python: python R1-program.py. 기본 실행은 dry-run이며 카메라·모터를 시작하지 않습니다. Python 3 표준 라이브러리만 필요합니다.
노트북: Jupyter/VS Code에서 열고 Run All. 표준 라이브러리 dry-run 셀만 실행됩니다.

## 객체 인식·미착용 설명
현재 웹은 지도 객체 ID와 사용자 지시를 사용합니다. 실제 영상 검출 결과가 아닙니다.
교육 예제의 detect_video 함수는 사용자가 준비한 로컬 PPE 모델/동영상으로 명시적으로 호출할 때만 동작하는 예시입니다.
COCO 기본 YOLOv8n에는 안전모/미착용 PPE 클래스가 없습니다. 검증된 자체 PPE 모델과 실제 클래스 매핑이 필요합니다.
BBOX는 화면상의 사각형이고 track ID는 임시 추적 번호이며 실제 사람 신원이 아닙니다.
안전모가 검출되지 않았다는 사실만으로 미착용을 확정할 수 없습니다. 가림·화질·신뢰도·시간 누적을 검토해야 합니다.
영상 track ID를 지도 작업자 ID와 연결하는 교정·좌표·확인 절차는 미구현이며 NotImplementedError로 표시합니다.
작업자 손에 전달된 안전모는 착용 완료가 아닙니다. 보호장구 착용 판정은 별도 개발·검증이 필요합니다.

## 실제 기체 연결
Unity/CARLA/Gazebo 실제 엔진, Pi5 모터·팔 제어, 실제 카메라·PPE 모델 연동은 완료하지 않았습니다.
실물 전송 함수는 NotImplementedError입니다. 웹 코드를 다운로드해도 실제 기체를 자동 조작하지 않습니다.
근거: https://docs.ultralytics.com/modes/track/
`;

export function pythonForProgram(program:RobotProgram,snapshot:Record<string,unknown>={}):string{
 if(snapshot.experiment||snapshot.experimentMode==='force-direct'||(program as RobotProgram&{experiment?:unknown}).experiment)throw Error('강제 실험 모드 해제 후 정상 코드로 내보내세요. 충돌 허용 실험을 정상 안전 주행 코드로 변환하지 않습니다.');
 const literal=JSON.stringify(JSON.stringify(program));
 return `# model simulator · 교육용 Python (첫 두 줄에는 사용자 입력을 넣지 않습니다)
# 이 파일은 웹 TypeScript 실행기 원본이 아닌 같은 JSON 명령의 dry-run 설명입니다.
# 선택 기체: ${pythonComment(program.robotId)}
# 내보내기 시 웹 상태 스냅샷: ${pythonComment(JSON.stringify(snapshot))}
# 기본 실행: python ${robotProgramBasename(program.robotId)}.py / 실제 카메라·모터 호출 없음
import json  # JSON 텍스트를 Python dict로 읽는 표준 라이브러리
from pathlib import Path  # 선택적으로 사용할 로컬 파일의 존재를 확인

# 화면에서 검증한 명령을 그대로 포함합니다. 객체 ID는 실제 영상 인식 결과가 아닙니다.
PROGRAM = json.loads(${literal})  # robotId, 지도 버전, 대상 ID 또는 목표 좌표

def detect_video(weights_path, video_path):
    # 선택 실행 예제: 사용자 로컬 PPE weights와 영상이 있을 때만 직접 호출하세요.
    # 기본 COCO YOLOv8n에는 안전모/미착용 클래스가 없으므로 PPE 모델을 준비해야 합니다.
    if not Path(weights_path).is_file() or not Path(video_path).is_file():
        raise FileNotFoundError("로컬 PPE 모델과 로컬 영상이 필요합니다")  # 자동 다운로드 방지
    from ultralytics import YOLO  # 선택 기능: 별도로 설치·검증한 ultralytics 필요
    model = YOLO(str(Path(weights_path).resolve()))  # 준비된 로컬 모델만 로딩
    # CPU 사용 예시이며 Pi5 처리 속도는 실측하지 않았습니다. 실제 카메라는 시작하지 않습니다.
    for result in model.track(source=str(Path(video_path).resolve()), tracker="bytetrack.yaml", device="cpu", stream=True):
        boxes = result.boxes  # 영상의 검출 사각형 BBOX 목록
        if boxes is None:
            continue  # 검출이 없는 프레임에서는 미착용 확정 금지
        for i in range(len(boxes)):
            class_id = int(boxes.cls[i].item())  # 사용한 PPE 모델의 클래스 번호
            yield {"bbox": boxes.xyxy[i].tolist(), "class_id": class_id,
                   "label": result.names[class_id], "confidence": float(boxes.conf[i].item()),
                   "track_id": None if boxes.id is None else int(boxes.id[i].item())}
            # track_id는 임시 영상 추적 번호이며 작업자 신원이나 지도 workerId가 아닙니다.

def judge_ppe(detections, class_mapping):
    # 1. 검출 BBOX → person/helmet/no_helmet 클래스 매핑을 실제 모델 라벨에 맞춥니다.
    # 2. 사람 머리 영역과 안전모 관계, 신뢰도, 가림, 여러 프레임을 검토해야 합니다.
    # 3. 미검출만으로 미착용을 확정하지 않습니다. 현재 자동 판정 로직은 미구현입니다.
    raise NotImplementedError("PPE 클래스 매핑·시간 누적·미착용 판정은 별도 검증 필요")

def bind_track_to_scene(track_id):
    # 영상 track ID → 지도 workerId 연결에는 카메라 교정·위치 변환·사용자 확인이 필요합니다.
    # 현재 웹 임무의 workerId는 사용자가 지정한 지도 객체 ID입니다.
    raise NotImplementedError("영상 추적 ID와 지도 작업자 ID 연결은 미구현")

def send_to_real_robot(program):
    # 실제 Pi5/ROS2/모터/팔 제어 어댑터는 아직 연결하지 않았습니다.
    raise NotImplementedError("실제 기체 전송 금지: 실물 제어 어댑터 미연결")

def dry_run(program):
    # 웹에서는 검증된 JSON을 TypeScript applyRobotProgram/applyMission에 적용합니다.
    print("DRY RUN / 실제 실행·검출 아님 / 기체:", program["robotId"])
    if program["action"] == "deliver_helmet":
        # 미착용은 현재 사용자의 지시이며 YOLO 판정이 아닙니다.
        print("1. 안전모 외곽 접근 및 가상 집기:", program["helmetId"])
        print("2. 지정 작업자 외곽 접근 및 가상 전달:", program["workerId"])
        print("3. 기존 목표 방문 → 공용 충전소 대기·충전 → 이탈")
        # 전달은 작업자 손에 보유하는 상태이며 실제 착용 완료가 아닙니다.
    else:
        print("1. 기존 경유점을 따라 목표 접근:", program["goal"])
        if program["after"] == "stay":
            print("2. 목표 도착 후 해당 위치에서 임무 완료·대기 (충전 경로 없음)")
        else:
            print("2. 공용 충전소 대기·충전 → 이탈")
    return program  # 명령 내용을 반환할 뿐 모터를 움직이지 않습니다.

if __name__ == "__main__":
    dry_run(PROGRAM)  # 기본 실행은 단계 출력만 수행합니다.
`;
}
export function notebookForProgram(program:RobotProgram,snapshot:Record<string,unknown>={}){return {nbformat:4,nbformat_minor:5,metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'},language_info:{name:'python',version:'3'}},cells:[{id:'scope',cell_type:'markdown',metadata:{},source:['# model simulator 선택 기체 코드\n','Python은 교육용 dry-run입니다. 실제 웹 실행은 JSON → TypeScript 실행기입니다. 실제 영상 검출·로봇 제어는 미연결입니다.\n']},{id:'program',cell_type:'code',metadata:{},execution_count:null,outputs:[],source:pythonForProgram(program,snapshot).split('\n').map(line=>line+'\n')}]};}
