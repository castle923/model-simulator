# Industrial runtime implementation handoff — source freeze

Scope: new isolated industrial-1 world; existing Scene/schema2 user maps untouched. Parent owns eventual publication. No remote operation by agent14.

## Geometry and motion

Fixed 3 × 2m factory: one 0.24m narrow aisle, two open turning yards, four shared parking/work bays A/P1 through D/P4, one charger, off-axis entrance QR waiting poses, two exit berths. Idle robots remain physical obstacles. No automatic relocation or return-to-home. Nominal body 0.20874 × 0.16583 × 0.12705m follows manufacturer dimensions. Default 0.20m minimum turn radius is a configurable virtual constraint, not a measured Ackermann property of the mecanum Raspbot. Load envelope defaults to 0.22 × 0.18m.

All motion is exact forward arc/straight integration with v>=0, bounded curvature, analytic trapezoidal acceleration/deceleration. No stopped yaw rotation, reverse, lateral sliding, pose snapping, or final teleport. Local/approach planning treats the whole aisle as forbidden. Only a granted crossing path can enter. Every approach is planned to stop at a QR waiting pose outside the aisle before requesting permission; no emergency stopline clamp. The approach deceleration distance is v²/(2a), with a geometrically separate off-axis holding bay. Reaction time is currently a profile/display assumption, not a simulated control-latency term; faults trigger braking on the next internal 20ms tick.

SAT collision checks use rotated rectangular bodies including margin/load. Path verification adaptively bounds sample spacing with footprint circumradius rho and curvature k: step <= .005/(1+rho*abs(k)), so the nearest endpoint corner travel is <=2.5mm; an additional 3mm footprint inflation conservatively covers it. Primitive endpoints are always sampled. Planner uses direct Dubins candidates then a bounded 18k-expansion/65ms runtime lattice fallback. Occupied terminal poses are rejected before search. A failed dynamic solve triggers a bounded static-only feasibility check, cached by pose/goal/profile/static geometry. A static constraint or bounded-search failure marks the task ERROR with a truthful reason; only other-robot occupancy remains WAIT. No unchecked route is emitted.

## Protocol

Both virtual entrance QR identifiers resolve AISLE-1. REQUEST includes robot/boot/request/coordinator-epoch identity. Coordinator commits aisle + exit berth + both movement yards synchronously in an in-memory journal before sending GRANT. One complete token binds resource, robot, boot, request, epoch, grant sequence, direction and exit berth. Both directions and same-direction requests share the resource. Queue order is received sequence with ID tie break; a currently blocked request can be skipped for another feasible request. No blanket fairness guarantee under permanently blocked destinations.

Admission uses delivered, age-checked, monotonically ordered robot telemetry plus committed movement reservations, and waits for received stationary reports before crossing. Normal crossing paths do not use current physical robot positions as a planning oracle. The separately counted physical world guard checks actual rectangular bodies; any intervention enters FAULT/UNKNOWN and is explicitly not a successful protocol result. Normal tested runs required zero interventions.

ENTER is repeated while within the aisle. EXIT is published only when the complete rear footprint has cleared. The aisle can be released before its independent exit berth; BERTH_CLEAR must match the current full token, including same-robot later grants. Local movement yards remain held until final safe arrival, conservatively serializing crossings. Delay, seeded loss, and duplication are simulated in an in-process message queue, not MQTT/ROS or a real network. STATUS is epoch/message ordered and reports received grants to other robots. Heartbeat report freshness uses sender sample time, separate from receive-time liveness.

No TTL turns uncertain occupancy FREE. Disconnect or robot/coordinator restart holds the journal/berths and decelerates physical motion. Explicit operator reconciliation uses labelled world truth, requires all robots stopped, checks occupancy against the preserved owner and reissues current boot/epoch tokens, including an uncleared berth after aisle release. This is not automatic sensor recovery or disk-backed durability. UI stores configuration only with a dirty marker and requires an explicit new experiment after interrupted refresh.

## Tasks

Persistent R1–R4 actors and independent bounded queues; hot enqueue changes neither other poses nor simulation time/resources. Navigate named bay, charge at a single physically occupied charger, or claim/pick up/deliver one virtual helmet C→D. The helmet is a synthetic scene item, not YOLO image detection or a real wearing judgement. Active cancellation is deferred until a safe stop; ungranted QR requests can be invalidated there. Granted occupancy is never revoked early. An occupied destination or physically impossible same-yard swap waits; the system does not move an uncommanded robot or claim arbitrary map/command completion.

## Verification

- `npx tsc --noEmit --incremental false`: exit 0.
- `npm run build`: exit 0, all five Vite/vinext stages. Existing scene-worker hash unchanged.
- `node --experimental-strip-types scripts/test-industrial-runtime.mjs`: PASS.
  - simultaneous R1→B, R2→A, R3→D, R4→C: 4 completed at 101.28 virtual seconds; max body occupancy 1, oracle interventions 0, four grants.
  - reverse repeat tasks: total eight completed at 202.46s.
  - hot R2 departure unblocks R1 destination: poses/time unchanged on enqueue, two tasks complete.
  - 15% loss, 60% duplication, .25s nominal delay: four complete at 102.92s, 303 dropped packets, no guard intervention.
  - charger waits until its occupant receives a hot departure; both charging tasks and departure complete.
  - R3 charge, R4→A, R1 helmet: all three tasks complete; one pickup and one delivery with retained ownership.
  - .73s caller dt safely subdivided; four complete at 101.47s.
  - each runtime sample asserts forward displacement, continuous curvature, no teleport/in-place yaw, acceleration/deceleration limits and occupancy.
- `node --experimental-strip-types scripts/test-industrial-protocol.mjs`: PASS eleven cases after P0-11 repair.
  - disconnect, coordinator restart and robot restart while occupied: exact v²/(2a) braking, owner/berth preserved, explicit recovery completes original missions.
  - total message loss cannot grant or enter.
  - delayed old BERTH_CLEAR cannot release a newer same-robot berth.
  - out-of-order heartbeat does not overwrite or refresh pose.
  - rotated corner and oversized loaded tight-radius grazing rejected; unsupported loaded width rejected.
  - restart after aisle EXIT but before BERTH_CLEAR preserves/reissues berth token and completes.
  - cancel at ungranted QR stop invalidates pending requests.

## Limits requiring truthful presentation

Fixed validated topology, not an arbitrary factory map editor. In-memory synthetic messaging and odometry, not hardware, camera pixels, production networking or crash-durable safety software. Glass/unknown sensor failures are not modelled. Both yards reserved for each crossing is conservative and may reduce throughput. Configured profiles can yield an explicit task ERROR if a requested static forward-only leg cannot be found within the search budget; no guarantee all allowed profiles/tasks converge. Permanently occupied bays and same-yard mutual swaps may require an explicit user command to a free holding/charging bay. No unsafe automated owner release. Physical guard is a final diagnostic oracle and any nonzero count invalidates a normal-success claim. Full independent agent15 review remains pending at this handoff.

## Independent review repair P0-11

Agent15 found minRadius=.35 / R1 charge and a static aisle wall silently left tasks ACTIVE/WAIT. Fixed with cached static-only feasibility classification and explicit TASK_ERROR/FAULT reason. No actor pose is reset. Ungranted requests/holding claims are invalidated, committed occupancy is never released by this path. Other-robot destination occupancy remains WAIT and still completes after a hot departure. Added two regression assertions. Re-ran both full industrial tests, agent15 independent-probes, TypeScript and production build: all pass. Revised runtime SHA256 E3703C69D73F3777EBB4A7BD7790CBDB621005C10A494570D4F6D8B2EE280F5A. Independent re-review pending.
