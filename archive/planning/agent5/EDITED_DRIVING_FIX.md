# Edited driving fix and model simulator handoff

2026-10-14. Writer: agent 5. Product source frozen after final build. Original project/site/production DB unchanged by this agent. Parent owns publishing the new model simulator copy.

## Reproduced failure and correction
- Actual user scene rev149: valid physical start, two forward-only robots, no racks. R1 overlapped a *future virtual parking reservation* of R2, rather than a physical obstacle. Future reservation exceptions now apply only to the first departure leg and only to reservations covering the current start; real obstacles remain mandatory throughout.
- Car staging previously skipped shared corridor staging. Car robots now use gate/entry/exit staging with heading constraints. Joint runtime still checks physical collision, exclusive corridor and charging ownership.
- Intermediate car arrival may otherwise face immediately into the next reservation. Goal acceptance now requires a collision-free forward departure primitive. Task arrival direction is not artificially forced; exact continuous arcs and line collision remain active.
- Failures are separated into scene validation, per-leg route planning, and bounded joint execution. Diagnostics name robot, leg, start/goal, covering object IDs where applicable, and adjustment guidance. Search failure does not claim a mathematical proof that no path exists.
- Arbitrary edited maps may still be infeasible or deadlock; start remains blocked rather than bypassing safety.

## Meaningful verification
- Actual rev149 map: both robots complete in 53.72 simulated seconds; every tick outside physical inflated obstacles and all reservations released.
- Added obstacle single-car variation: complete 22.54 seconds. Dragged robot variation: complete 22.76 seconds.
- Covered destination rejected with specific R1, mission-goal leg, and goal-cover object diagnostic.
- tsc --noEmit exit 0.
- test-edited-driving, scene-local, solid-delivery, carried-helmet, vibe-mission, robot-spawn, code-export-safety and robot-code-export scripts PASS.
- npm run build exit 0; prebuild regenerates public/scene-worker.js. Build log: outputs/agent5/edited-driving-final-build.log. Worker rebuilt 2026-10-14 12:31:57 local, 36,875 bytes.
- Independent agent review and final browser QA are parent-owned next gates; this report does not substitute for those checks.

## Sharing and Python clarification
- New TeamSharingGuide explains four meeting-app sharing steps, one controller and video-only observers. Native accessible dialog supports Escape and trigger focus return.
- External-window preview explicitly says local preview, not team transmission. localhost/127.0.0.1 URLs are not links to another PC. Direct team WebRTC, shared map and production DB are disconnected.
- Python is an educational dry-run, not the complete robot program and not an addition to existing robot firmware. The full web planner/collision/multi runtime lives in separate TypeScript. Existing real robot code has not been inspected or connected. JSON still validates and applies to the selected robot. Safe export escaping remains intact.
- Visible title, metadata, Python/notebook/read.md labels changed to model simulator. Filesystem folder remains 메카닉 (2).

## Implemented vs external/unimplemented
| Area | Current status |
|---|---|
| Single/multi common editor, object/robot editing | Implemented web simulation |
| Exact target helmet pickup/carry/worker-held state | Implemented symbolic ownership; hand-held is not worn |
| Goal navigation, one charger, queue/lock and forward car | Implemented web approximation with bounded feasibility checks |
| Robot-specific front camera and attachments | Implemented synthetic preview, not sensor image |
| Virtual QR/elevator | Implemented simulated state, not physical lift API/QR recognition |
| Unity/CARLA/Gazebo real engine execution | Disconnected; selector and connection guidance only |
| Real Pi5, YOLO detections, arm/motor control | Disconnected |
| Infinite patrol/PPE recognition/supply/30% charge policy | Not implemented |
| Direct multi-PC video, TURN, shared scene state | Not implemented in this new mode; meeting-app instructions only |
| Legacy team UI/API | Preserved separately; parent verified local D1 previously; new hosted resource readiness must be verified by parent |

## Changed files in this phase
lib/scene-local.ts; app/scene.worker.ts; app/SceneLab.tsx; app/TeamSharingGuide.tsx (new); app/RobotCodeWorkspace.tsx (explanation only); lib/robot-code-export.ts (branding only); app/scene-local.css; app/layout.tsx; scripts/test-edited-driving.mjs (new); generated public/scene-worker.js.

Canvas coordinate contract remains meters, +X right, +Y screen-down, positive yaw clockwise. ROS/Gazebo ENU requires explicit coordinate/yaw conversion in a future adapter.
