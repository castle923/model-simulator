export function validText(value: unknown, max: number, label: string, empty=false) {
  if(typeof value!=="string" || value.length>max || (!empty&&!value.trim())) throw new Error(label+"을 확인해 주세요.");
  return value.trim();
}
export function requireOwner(actual: string, expected: string) { if(actual!==expected) throw new Error("작성자만 변경할 수 있습니다."); }
export function requireVersion(actual:number, expected:number) {if(actual!==expected) throw new Error("다른 변경이 저장되었습니다. 새로고침 후 비교해 주세요.");}
export function validSeconds(value:unknown) {if(value===null||value===undefined)return null;if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>86400)throw new Error("댓글 시간을 확인해 주세요.");return value;}
