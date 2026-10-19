export type CameraBindingStatus={state:'idle'|'connecting'|'connected'|'error';target:string;message:string};
type TrackLike=Pick<MediaStreamTrack,'stop'|'onended'>;
export type StreamLike={getTracks:()=>TrackLike[]};
/** Generation-scoped camera ownership. A late permission response cannot attach
 * an old robot's stream to the newly selected robot or to an unmounted panel. */
export function createCameraBindingController<T extends StreamLike>(options:{acquire:(constraints:MediaStreamConstraints)=>Promise<T>;attach:(stream:T|null)=>void;status:(state:CameraBindingStatus)=>void}){
 let target='',generation=0,closed=false,stream:T|null=null;
 const stop=(s:T|null)=>{s?.getTracks().forEach(t=>{t.onended=null;t.stop();});};
 const emit=(state:CameraBindingStatus['state'],message:string)=>{if(!closed)options.status({state,target,message});};
 const disconnect=(message='카메라 연결을 종료했습니다.')=>{generation++;stop(stream);stream=null;if(!closed){options.attach(null);emit('idle',message);}};
 return {
  setTarget(next:string){if(next===target||closed)return;disconnect('관찰 기체·장착 카메라가 변경되어 이전 영상 연결을 종료했습니다.');target=next;emit('idle',next?'선택 장착 카메라에 실제 영상 소스를 연결할 수 있습니다.':'활성 장착 카메라가 없습니다.');},
  async connect(constraints:MediaStreamConstraints){if(closed||!target)return false;disconnect();const ticket=++generation,requested=target;emit('connecting','카메라 권한과 영상 장치를 확인하고 있습니다.');try{const next=await options.acquire(constraints);if(closed||ticket!==generation||requested!==target){stop(next);return false;}stream=next;for(const track of next.getTracks())track.onended=()=>{if(stream===next)disconnect('카메라 장치가 분리되거나 영상 전송이 종료되었습니다.');};options.attach(next);emit('connected','선택한 기체·장착 카메라에 PC 웹캠 영상을 연결했습니다.');return true;}catch(e){if(!closed&&ticket===generation){const name=(e as {name?:string})?.name;emit('error',name==='NotAllowedError'?'카메라 권한이 허용되지 않았습니다.':name==='NotFoundError'?'연결된 카메라를 찾지 못했습니다.':name==='NotReadableError'?'카메라를 다른 프로그램이 사용 중이거나 장치를 읽을 수 없습니다.':'카메라 연결 실패: '+(e instanceof Error?e.message:String(e)));}return false;}},
  disconnect,
  dispose(){if(closed)return;closed=true;generation++;stop(stream);stream=null;options.attach(null);},
 };
}
