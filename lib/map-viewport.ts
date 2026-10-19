export type MapDimensions = { width: number; height: number };
export type MapViewport = { zoom: number; centerX: number; centerY: number };
export type CanvasAnchor = { u: number; v: number };
export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 6;
const bound = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function dimensions(scene: MapDimensions) {
 if (!Number.isFinite(scene.width) || !Number.isFinite(scene.height) || scene.width <= 0 || scene.height <= 0) throw new Error('지도 가로·세로는 유한한 양수여야 합니다.');
}
/** Fit exactly the full world. No scene object is mutated. */
export function fitViewport(scene: MapDimensions): MapViewport {
 dimensions(scene);return { zoom: 1, centerX: scene.width / 2, centerY: scene.height / 2 };
}
/** Keep the visible world rectangle inside map bounds; reset non-finite view fields safely. */
export function clampViewport(view: MapViewport, scene: MapDimensions): MapViewport {
 dimensions(scene);const zoom=bound(Number.isFinite(view.zoom)?view.zoom:1,MIN_MAP_ZOOM,MAX_MAP_ZOOM);
 const halfW=scene.width/(2*zoom),halfH=scene.height/(2*zoom);
 return {zoom,centerX:bound(Number.isFinite(view.centerX)?view.centerX:scene.width/2,halfW,scene.width-halfW),centerY:bound(Number.isFinite(view.centerY)?view.centerY:scene.height/2,halfH,scene.height-halfH)};
}
/** Map normalized canvas coordinates to world coordinates using the same transform as drawing. */
export function worldFromCanvas(view: MapViewport, scene: MapDimensions, u: number, v: number): { x: number; y: number } {
 const safe=clampViewport(view,scene);if(!Number.isFinite(u)||!Number.isFinite(v))throw new Error('캔버스 좌표는 유한해야 합니다.');
 return {x:safe.centerX+(u-.5)*scene.width/safe.zoom,y:safe.centerY+(v-.5)*scene.height/safe.zoom};
}
/** Preserve the world point under an anchor until a map edge requires clamping. */
export function zoomAt(view: MapViewport, scene: MapDimensions, factor: number, anchor: CanvasAnchor={u:.5,v:.5}): MapViewport {
 if(!Number.isFinite(factor)||factor<=0||!Number.isFinite(anchor.u)||!Number.isFinite(anchor.v))throw new Error('확대 배율과 기준 좌표를 확인하세요.');
 const safe=clampViewport(view,scene),u=bound(anchor.u,0,1),v=bound(anchor.v,0,1),world=worldFromCanvas(safe,scene,u,v),zoom=bound(safe.zoom*factor,MIN_MAP_ZOOM,MAX_MAP_ZOOM);
 return clampViewport({zoom,centerX:world.x-(u-.5)*scene.width/zoom,centerY:world.y-(v-.5)*scene.height/zoom},scene);
}
/** Focus an existing world position without moving the robot or altering the scene. */
export function focusViewport(view: MapViewport, scene: MapDimensions, x: number, y: number, zoom=Math.max(view.zoom,3)): MapViewport {
 if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('주시할 기체 좌표를 확인하세요.');
 return clampViewport({zoom,centerX:x,centerY:y},scene);
}
