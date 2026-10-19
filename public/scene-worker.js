// lib/robot-customization.ts
var text = (v, max = 40) => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(v);
var keys = (o, allowed) => {
  if (Object.keys(o).some((k) => !allowed.includes(k))) throw Error("\uAE30\uCCB4 \uAD6C\uC131\uC5D0 \uC54C \uC218 \uC5C6\uB294 \uD56D\uBAA9\uC774 \uC788\uC2B5\uB2C8\uB2E4.");
};
var finite = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function validateCustomization(raw) {
  if (!raw || typeof raw !== "object" || JSON.stringify(raw).length > 32e3) throw Error("\uAE30\uCCB4 \uAD6C\uC131 JSON\uC740 32KB \uC774\uD558 \uAC1D\uCCB4\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  const c = raw;
  keys(c, ["schema", "kind", "bodyShape", "label", "length", "width", "height", "maxSpeed", "cameras", "manipulators"]);
  if (c.schema !== 1 || !["raspbot", "amr", "forklift", "tracked", "custom", "turtlebot-burger", "turtlebot-waffle", "round-amr"].includes(c.kind) || c.bodyShape !== void 0 && !["rectangle", "ellipse"].includes(c.bodyShape) || !text(c.label) || !finite(c.length, 0.1, 2) || !finite(c.width, 0.1, 1.5) || !finite(c.height, 0.05, 2.5) || !finite(c.maxSpeed, 0.02, 2) || !Array.isArray(c.cameras) || c.cameras.length > 4 || !Array.isArray(c.manipulators) || c.manipulators.length > 2) throw Error("\uAE30\uCCB4 \uC885\uB958\xB7\uCE58\uC218\xB7\uC18D\uB3C4\xB7\uCE74\uBA54\uB77C/\uD314 \uAC1C\uC218\uB97C \uD655\uC778\uD558\uC138\uC694.");
  const ids = /* @__PURE__ */ new Set();
  const id = (v) => {
    if (!text(v, 64) || !/^[-\w]+$/.test(v) || ids.has(v)) throw Error("\uBD80\uD488 ID\uB294 \uC601\uBB38\xB7\uC22B\uC790\xB7_\xB7- 1~64\uC790\uC774\uBA70 \uC911\uBCF5\uB418\uC9C0 \uC54A\uC544\uC57C \uD569\uB2C8\uB2E4.");
    ids.add(v);
  };
  for (const cam of c.cameras) {
    if (!cam || typeof cam !== "object") throw Error("\uCE74\uBA54\uB77C \uC124\uC815 \uC624\uB958");
    keys(cam, ["id", "label", "x", "y", "z", "yawDeg", "pitchDeg", "fovDeg", "range", "width", "height", "enabled"]);
    id(cam.id);
    if (!text(cam.label) || !finite(cam.x, -1.5, 1.5) || !finite(cam.y, -1.5, 1.5) || !finite(cam.z, 0.02, 3) || !finite(cam.yawDeg, -180, 180) || !finite(cam.pitchDeg, -80, 80) || !finite(cam.fovDeg, 20, 150) || !finite(cam.range, 0.2, 30) || !Number.isInteger(cam.width) || !finite(cam.width, 160, 1920) || !Number.isInteger(cam.height) || !finite(cam.height, 120, 1080) || typeof cam.enabled !== "boolean") throw Error("\uCE74\uBA54\uB77C \uC704\uCE58\xB7\uAC01\uB3C4\xB7\uD654\uAC01\xB7\uAC70\uB9AC\xB7\uD574\uC0C1\uB3C4 \uC124\uC815 \uC624\uB958");
  }
  for (const arm of c.manipulators) {
    if (!arm || typeof arm !== "object") throw Error("\uB9E4\uB2C8\uD4F0\uB808\uC774\uD130 \uC124\uC815 \uC624\uB958");
    keys(arm, ["id", "label", "side", "reach", "payloadKg", "stowed", "joints", "enabled"]);
    id(arm.id);
    if (!text(arm.label) || !["left", "right", "center"].includes(arm.side) || !finite(arm.reach, 0.05, 1.5) || !finite(arm.payloadKg, 0, 20) || typeof arm.enabled !== "boolean" || typeof arm.stowed !== "boolean" || !Array.isArray(arm.joints) || arm.joints.length > 6) throw Error("\uB9E4\uB2C8\uD4F0\uB808\uC774\uD130 \uB3C4\uB2EC\uAC70\uB9AC\xB7\uD558\uC911\xB7\uAD00\uC808 \uC124\uC815 \uC624\uB958");
    const names = /* @__PURE__ */ new Set();
    for (const j of arm.joints) {
      if (j && typeof j === "object") keys(j, ["name", "minDeg", "maxDeg", "angleDeg"]);
      if (!j || !text(j.name) || names.has(j.name) || !finite(j.minDeg, -180, 180) || !finite(j.maxDeg, -180, 180) || j.minDeg > j.maxDeg || !finite(j.angleDeg, j.minDeg, j.maxDeg)) throw Error("\uAD00\uC808 \uC774\uB984\xB7\uAC01\uB3C4 \uBC94\uC704\uB97C \uD655\uC778\uD558\uC138\uC694.");
      names.add(j.name);
    }
  }
  return structuredClone(c);
}
function cameraFootprintPadding(c) {
  return Math.hypot(c.length * 0.05, c.width * 0.08) + Math.min(c.length, c.width) * 0.05;
}
function cameraExtent(c) {
  return Math.max(0, ...c.cameras.filter((cam) => cam.enabled).map((cam) => Math.hypot(cam.x, cam.y) + cameraFootprintPadding(c)));
}
function robotRadius(r) {
  const c = r.customization;
  if (!c) return 0.22;
  const bodyAndArms = Math.hypot(c.length, c.width) / 2 + Math.max(0, ...c.manipulators.filter((a) => a.enabled && !a.stowed).map((a) => a.reach));
  return Math.max(bodyAndArms, cameraExtent(c)) + 0.01;
}

// lib/min-heap.ts
var MinHeap = class {
  constructor() {
    this.a = [];
  }
  get length() {
    return this.a.length;
  }
  push(v) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i) {
      const p = i - 1 >> 1;
      if (a[p].f <= v.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = v;
  }
  pop() {
    const a = this.a, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let child = i * 2 + 1;
        if (child + 1 < a.length && a[child + 1].f < a[child].f) child++;
        if (last.f <= a[child].f) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return first;
  }
};

// lib/vibe-mission.ts
function deliveryTargets(s, r) {
  const choose = (kind, id) => {
    const list = s.entities.filter((e2) => e2.kind === kind && (e2.floor === 0 || e2.floor === r.floor));
    const e = id ? s.entities.find((e2) => e2.id === id) : list.length === 1 ? list[0] : void 0;
    if (!e || e.kind !== kind) throw Error(`${r.id}: ${kind === "helmet" ? "\uC548\uC804\uBAA8" : "\uC791\uC5C5\uC790"} \uB300\uC0C1\uC774 \uC5C6\uAC70\uB098 \uC5EC\uB7EC \uAC1C\uC785\uB2C8\uB2E4. \uBC14\uC774\uBE0C \uC784\uBB34\uC5D0\uC11C ID\uB97C \uC120\uD0DD\uD558\uC138\uC694.`);
    if (e.floor !== 0 && e.floor !== r.floor) throw Error(`${r.id}: \uC804\uB2EC \uB300\uC0C1\uACFC \uAE30\uCCB4\uC758 \uCD9C\uBC1C \uCE35\uC774 \uB2E4\uB985\uB2C8\uB2E4.`);
    return e;
  };
  return { helmet: choose("helmet", r.missionTargets?.helmetId), worker: choose("worker", r.missionTargets?.workerId) };
}

// lib/planner.ts
function validateWorld(v) {
  const n = (x) => typeof x === "number" && Number.isFinite(x);
  if (!v || ![v.width, v.height, v.radius].every(n) || v.width < 1 || v.width > 30 || v.height < 1 || v.height > 30 || v.radius <= 0 || v.radius > 4 || !Array.isArray(v.obstacles) || v.obstacles.length > 100) throw new Error("\uB9F5 \uD06C\uAE30 1~30m, \uBC18\uACBD 0~4m, \uC7A5\uC560\uBB3C 100\uAC1C \uC774\uD558\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  for (const p of [v.start, v.goal, ...v.station === void 0 ? [] : [v.station]]) if (!p || !n(p.x) || !n(p.y) || p.x < v.radius || p.y < v.radius || p.x > v.width - v.radius || p.y > v.height - v.radius) throw new Error("\uCD9C\uBC1C\uC810\xB7\uBAA9\uC801\uC9C0\xB7\uCDA9\uC804\uC18C\uAC00 \uB9F5 \uACBD\uACC4\uB97C \uBC97\uC5B4\uB0A9\uB2C8\uB2E4.");
  for (const o of v.obstacles) {
    if (!o || ![o.x, o.y, o.w, o.h].every(n) || o.w <= 0 || o.h <= 0 || o.x < 0 || o.y < 0 || o.x + o.w > v.width + 1e-8 || o.y + o.h > v.height + 1e-8) throw new Error("\uC7A5\uC560\uBB3C \uC704\uCE58\xB7\uD06C\uAE30\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    if (o.kind !== void 0 && !["box", "cone", "worker", "helmet", "rack", "wall", "pallet"].includes(o.kind)) throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uBB3C\uCCB4 \uC885\uB958\uC785\uB2C8\uB2E4.");
    if (o.name !== void 0 && (typeof o.name !== "string" || o.name.length > 40)) throw new Error("\uBB3C\uCCB4 \uC774\uB984\uC740 40\uC790 \uC774\uD558\uC785\uB2C8\uB2E4.");
    if (o.helmetWorn !== void 0 && typeof o.helmetWorn !== "boolean") throw new Error("\uCC29\uC6A9 \uC5EC\uBD80\uB294 true/false\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
    if (o.blocking !== void 0 && typeof o.blocking !== "boolean") throw new Error("\uCDA9\uB3CC \uC5EC\uBD80\uB294 true/false\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  }
  if (blocked(v, v.start) || blocked(v, v.goal) || v.station !== void 0 && blocked(v, v.station)) throw new Error("\uCD9C\uBC1C\uC810\xB7\uBAA9\uC801\uC9C0\xB7\uCDA9\uC804\uC18C\uAC00 \uC7A5\uC560\uBB3C \uC5EC\uC720 \uACF5\uAC04\uACFC \uACB9\uCE69\uB2C8\uB2E4.");
  return v;
}
function blocked(w, p) {
  const r = w.radius;
  return p.x < r || p.y < r || p.x > w.width - r || p.y > w.height - r || (w.dynamicCircles ?? []).some((o) => Math.hypot(p.x - o.x, p.y - o.y) <= w.radius + o.radius) || w.obstacles.some((o) => o.blocking !== false && p.x >= o.x - r && p.x <= o.x + o.w + r && p.y >= o.y - r && p.y <= o.y + o.h + r);
}
function segmentClear(w, a, b) {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite) || blocked(w, a) || blocked(w, b)) return false;
  for (const o of w.dynamicCircles ?? []) {
    const dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy, t = d ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.y - a.y) * dy) / d)) : 0;
    if (Math.hypot(a.x + t * dx - o.x, a.y + t * dy - o.y) <= w.radius + o.radius) return false;
  }
  for (const o of w.obstacles) {
    if (o.blocking === false) continue;
    let enter = 0, leave = 1;
    for (const [origin, delta, min, max] of [[a.x, b.x - a.x, o.x - w.radius, o.x + o.w + w.radius], [a.y, b.y - a.y, o.y - w.radius, o.y + o.h + w.radius]]) {
      if (Math.abs(delta) < 1e-14) {
        if (origin < min || origin > max) {
          enter = Infinity;
          break;
        }
      } else {
        const p = (min - origin) / delta, q = (max - origin) / delta;
        enter = Math.max(enter, Math.min(p, q));
        leave = Math.min(leave, Math.max(p, q));
      }
    }
    if (enter <= leave + 1e-12 && enter <= 1 && leave >= 0) return false;
  }
  return true;
}
function plan(w, budget) {
  validateWorld(w);
  if (segmentClear(w, w.start, w.goal)) return [{ ...w.start }, { ...w.goal }];
  const cell = 0.1, cols = Math.ceil(w.width / cell) + 1, rows = Math.ceil(w.height / cell) + 1;
  const key = (p) => Math.round(p.y / cell) * cols + Math.round(p.x / cell);
  const point = (k) => ({ x: k % cols * cell, y: Math.floor(k / cols) * cell });
  const connect = (p) => {
    const near = key(p), choices = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = near + dy * cols + dx;
      if (k >= 0 && k < cols * rows && segmentClear(w, p, point(k))) choices.push(k);
    }
    choices.sort((a, b) => Math.hypot(point(a).x - p.x, point(a).y - p.y) - Math.hypot(point(b).x - p.x, point(b).y - p.y));
    if (!choices.length) throw Error("\uACA9\uC790\uC640 \uC2DC\uC791\xB7\uBAA9\uD45C \uC5F0\uACB0\uC774 \uBD88\uAC00\uD569\uB2C8\uB2E4.");
    return choices[0];
  };
  const start = connect(w.start), goal = connect(w.goal), parent = /* @__PURE__ */ new Map([[start, -1]]), queue = [start];
  let head = 0;
  while (head < queue.length && !parent.has(goal)) {
    if (budget && (budget.remaining-- <= 0 || head % 64 === 0 && performance.now() > budget.deadline)) throw Error("\uC2E4\uC2DC\uAC04 \uC7AC\uACC4\uD68D \uD0D0\uC0C9 \uD55C\uB3C4");
    const k = queue[head++], p = point(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = k % cols + dx, y = Math.floor(k / cols) + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const j = y * cols + x;
      if (parent.has(j) || !segmentClear(w, p, point(j))) continue;
      parent.set(j, k);
      queue.push(j);
    }
  }
  if (!parent.has(goal)) throw new Error("\uACBD\uB85C \uC5C6\uC74C: \uC7A5\uC560\uBB3C \uB610\uB294 \uC5EC\uC720 \uACF5\uAC04\uC744 \uC870\uC815\uD574 \uC8FC\uC138\uC694.");
  const path = [];
  for (let k = goal; k !== -1; k = parent.get(k)) path.push(point(k));
  path.reverse();
  path.unshift(w.start);
  path.push(w.goal);
  const smooth = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !segmentClear(w, path[i], path[j])) j--;
    smooth.push(path[j]);
    i = j;
  }
  return smooth;
}

// lib/scene-local.ts
var isForceExperiment = (r) => r.experiment?.mode === "force-direct";
var PlanningError = class extends Error {
  constructor(diagnostic) {
    super(`${diagnostic.robotId} \xB7 ${diagnostic.leg}: ${diagnostic.cause} \uC2DC\uC791(${diagnostic.from.x.toFixed(2)}, ${diagnostic.from.y.toFixed(2)}, ${(diagnostic.from.yaw * 180 / Math.PI).toFixed(1)}\xB0) \u2192 \uBAA9\uD45C(${diagnostic.to.x.toFixed(2)}, ${diagnostic.to.y.toFixed(2)}). ${diagnostic.blockers.length ? "\uAD00\uB828 \uAC1D\uCCB4: " + diagnostic.blockers.join(", ") + ". " : ""}${diagnostic.suggestion}`);
    this.diagnostic = diagnostic;
  }
};
var labels = { rack: "\uB799", box: "\uC0C1\uC790", wall: "\uBCBD", worker: "\uC791\uC5C5\uC790", helmet: "\uC548\uC804\uBAA8", cone: "\uCF58", pallet: "\uD314\uB808\uD2B8", charger: "\uCDA9\uC804\uC18C", lock: "\uD1B5\uB85C \uB77D", queue: "\uCDA9\uC804 \uB300\uAE30\uC810", lift: "\uC5D8\uB9AC\uBCA0\uC774\uD130", qr: "QR \uD45C\uC9C0" };
var center = (e) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
var visible = (e, floor) => e.floor === 0 || e.floor === floor;
var editorEntities = (s) => s.entities.filter((e) => s.robots.length > 1 || e.kind !== "lock");
var isSolidEntity = (e) => e.blocking || e.kind === "worker" || e.kind === "helmet";
function sceneWorld(s, floor, start, goal, robot) {
  return { width: s.width, height: s.height, radius: robot ? robotRadius(robot) : 0.22, start, goal, obstacles: editorEntities(s).filter((e) => visible(e, floor) && isSolidEntity(e)).map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })) };
}
function validateScene(s) {
  if (!s || s.schema !== 2 || !Number.isInteger(s.revision) || s.revision < 1 || !Number.isFinite(s.width) || !Number.isFinite(s.height) || s.width < 2 || s.width > 30 || s.height < 2 || s.height > 30 || !Number.isInteger(s.floors) || s.floors < 1 || s.floors > 4) throw Error("\uC9C0\uB3C4\uB294 2~30m, \uCE35\uC740 1~4\uAC1C\uB85C \uC9C0\uC815\uD558\uC138\uC694.");
  if (!Array.isArray(s.entities) || s.entities.length > 100 || !Array.isArray(s.robots) || s.robots.length < 1 || s.robots.length > 8) throw Error("\uAC1D\uCCB4 \uCD5C\uB300 100\uAC1C, \uAE30\uCCB4 1~8\uB300\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const ids = /* @__PURE__ */ new Set();
  for (const item of [...s.entities, ...s.robots]) {
    if (typeof item.id !== "string" || !item.id || item.id.length > 128 || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(item.id) || ids.has(item.id)) throw Error("\uAC1D\uCCB4/\uAE30\uCCB4 ID\uB294 \uC81C\uC5B4\uBB38\uC790 \uC5C6\uC774 1~128\uC790\uC774\uBA70 \uC911\uBCF5\uB418\uC9C0 \uC54A\uC544\uC57C \uD569\uB2C8\uB2E4.");
    ids.add(item.id);
  }
  if (s.entities.filter((e) => e.kind === "charger").length !== 1) throw Error("\uACF5\uC6A9 \uCDA9\uC804\uC18C\uB294 \uBC18\uB4DC\uC2DC 1\uAC1C\uC785\uB2C8\uB2E4.");
  for (const e of s.entities) if (!Object.hasOwn(labels, e.kind) || typeof e.name !== "string" || e.name.length > 40 || ![e.x, e.y, e.w, e.h].every(Number.isFinite) || e.w < 0.15 || e.h < 0.15 || e.x < 0 || e.y < 0 || e.x + e.w > s.width + 1e-8 || e.y + e.h > s.height + 1e-8 || !Number.isInteger(e.floor) || e.floor < 0 || e.floor > s.floors || typeof e.blocking !== "boolean") throw Error("\uAC1D\uCCB4 \uC885\uB958\xB7\uC774\uB984\xB7\uD06C\uAE30\xB7\uC704\uCE58\xB7\uCE35\uC744 \uD655\uC778\uD558\uC138\uC694.");
  for (const r of s.robots) {
    if (r.experiment !== void 0 && (!r.experiment || typeof r.experiment !== "object" || Object.keys(r.experiment).length !== 2 || Object.keys(r.experiment).some((k) => !["mode", "originalModel"].includes(k)) || r.experiment.mode !== "force-direct" || !["holonomic", "car"].includes(r.experiment.originalModel) || r.model !== "holonomic" || r.mission !== "navigate" || r.after !== "stay" || r.goalFloor !== r.floor)) throw Error(`${r.id}: \uAC15\uC81C \uC2E4\uD5D8\uC740 \uAC19\uC740 \uCE35\uC758 \uBAA9\uD45C \uC8FC\uD589\xB7\uBAA9\uD45C \uB300\uAE30\xB7\uD640\uB85C\uB178\uBBF9 \uC870\uAC74\uC73C\uB85C\uB9CC \uBA85\uC2DC\uC801\uC73C\uB85C \uC2E4\uD589\uD558\uC138\uC694.`);
    if (r.customization !== void 0) validateCustomization(r.customization);
    const radius = robotRadius(r);
    if (r.after !== void 0 && !["charge", "stay"].includes(r.after)) throw Error(`${r.id}: \uC644\uB8CC \uD6C4 \uB3D9\uC791\uC740 charge \uB610\uB294 stay\uC785\uB2C8\uB2E4.`);
    if (r.mission === "helmet" && r.after === "stay") throw Error(`${r.id}: \uC548\uC804\uBAA8 \uC804\uB2EC\uC740 \uBAA9\uD45C \uBC29\uBB38 \uD6C4 \uCDA9\uC804\uD558\uB294 \uAE30\uC874 \uC808\uCC28\uB9CC \uC9C0\uC6D0\uD569\uB2C8\uB2E4.`);
    if (typeof r.name !== "string" || r.name.length > 40 || r.mission !== void 0 && !["navigate", "helmet"].includes(r.mission) || r.missionTargets !== void 0 && (!r.missionTargets || typeof r.missionTargets.helmetId !== "string" || typeof r.missionTargets.workerId !== "string") || ![r.x, r.y, r.yaw, r.minRadius].every(Number.isFinite) || r.minRadius < 0.3 || r.minRadius > 3 || !["car", "holonomic"].includes(r.model) || !Number.isInteger(r.floor) || !Number.isInteger(r.goalFloor) || r.floor < 1 || r.floor > s.floors || r.goalFloor < 1 || r.goalFloor > s.floors || !Array.isArray(r.waypoints) || r.waypoints.length > 40) throw Error(`${r.id}: \uC8FC\uD589 \uC124\uC815 \uC624\uB958`);
    for (const [index, [p, floor]] of [[r, r.floor], [r.goal, r.goalFloor], ...r.waypoints.map((p2) => [p2, r.floor])].entries()) {
      if (!p || ![p.x, p.y].every(Number.isFinite)) throw Error(`${r.id}: \uCD9C\uBC1C\xB7\uBAA9\uD45C\xB7\uACBD\uC720\uC810 \uC88C\uD45C\uB97C \uD655\uC778\uD558\uC138\uC694.`);
      if (!segmentClear({ ...sceneWorld(s, floor, p, p, r), ...isForceExperiment(r) ? { obstacles: [] } : {} }, p, p)) throw new PlanningError({ robotId: r.id, leg: index === 0 ? "\uCD9C\uBC1C \uC704\uCE58" : index === 1 ? "\uC784\uBB34 \uBAA9\uD45C \uBC29\uBB38" : "\uACBD\uC720\uC810 " + (index - 1), from: { x: r.x, y: r.y, yaw: r.yaw, floor: r.floor }, to: { ...p }, cause: "\uC9C0\uB3C4 \uACBD\uACC4 \uB610\uB294 \uC7A5\uC560\uBB3C \uCC28\uCCB4 \uC5EC\uC720 \uACF5\uAC04\uACFC \uACB9\uCE69\uB2C8\uB2E4.", blockers: s.entities.filter((e) => visible(e, floor) && isSolidEntity(e) && p.x >= e.x - radius && p.x <= e.x + e.w + radius && p.y >= e.y - radius && p.y <= e.y + e.h + radius).map((e) => e.name + " [" + e.id + "]"), suggestion: `\uD574\uB2F9 \uC704\uCE58\uB97C \uAC1D\uCCB4 \uBC0F \uC9C0\uB3C4 \uACBD\uACC4\uC5D0\uC11C \uBCF4\uC218\uC801 \uCC28\uCCB4 \uBC18\uACBD ${radius.toFixed(2)}m \uC774\uC0C1 \uB5A8\uC5B4\uB728\uB9AC\uC138\uC694.` });
    }
  }
  for (let i = 0; i < s.robots.length; i++) for (let j = i + 1; j < s.robots.length; j++) if (!isForceExperiment(s.robots[i]) && !isForceExperiment(s.robots[j]) && s.robots[i].floor === s.robots[j].floor && Math.hypot(s.robots[i].x - s.robots[j].x, s.robots[i].y - s.robots[j].y) < robotRadius(s.robots[i]) + robotRadius(s.robots[j]) + 0.06) throw Error("\uCD9C\uBC1C \uAE30\uCCB4 \uC0AC\uC774\uB97C \uCC28\uCCB4 \uD06C\uAE30\uC640 0.06m \uC5EC\uC720 \uC774\uC0C1 \uB744\uC6B0\uC138\uC694.");
  return s;
}
var wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function arcClear(w, start, curvature, length) {
  if (Math.abs(curvature) < 1e-10) return segmentClear(w, start, { x: start.x + length * Math.cos(start.yaw), y: start.y + length * Math.sin(start.yaw) });
  const sweep = length * curvature, cx = start.x - Math.sin(start.yaw) / curvature, cy = start.y + Math.cos(start.yaw) / curvature;
  const contains = (angle) => {
    const d = wrap(angle - start.yaw);
    return sweep > 0 ? d >= -1e-10 && d <= sweep + 1e-10 : d <= 1e-10 && d >= sweep - 1e-10;
  };
  const point = (a) => ({ x: cx + Math.sin(a) / curvature, y: cy - Math.cos(a) / curvature });
  for (const a of [start.yaw, start.yaw + sweep, 0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (contains(a)) {
    const p = point(a);
    if (p.x < w.radius - 1e-9 || p.y < w.radius - 1e-9 || p.x > w.width - w.radius + 1e-9 || p.y > w.height - w.radius + 1e-9) return false;
  }
  for (const o of w.dynamicCircles ?? []) {
    const a = Math.atan2(curvature * (o.x - cx), -curvature * (o.y - cy)), angles = [start.yaw, start.yaw + sweep, ...contains(a) ? [a] : []];
    if (angles.some((a2) => Math.hypot(point(a2).x - o.x, point(a2).y - o.y) <= w.radius + o.radius)) return false;
  }
  for (const o of w.obstacles.filter((o2) => o2.blocking !== false)) {
    const left = o.x - w.radius, right = o.x + o.w + w.radius, top = o.y - w.radius, bottom = o.y + o.h + w.radius, inRect = (p) => p.x >= left - 1e-9 && p.x <= right + 1e-9 && p.y >= top - 1e-9 && p.y <= bottom + 1e-9;
    if (inRect(start) || inRect(point(start.yaw + sweep))) return false;
    for (const x of [left, right]) {
      const v = curvature * (x - cx);
      if (Math.abs(v) > 1 + 1e-10) continue;
      const a = Math.asin(Math.max(-1, Math.min(1, v)));
      for (const angle of [a, Math.PI - a]) if (contains(angle) && inRect(point(angle))) return false;
    }
    for (const y of [top, bottom]) {
      const v = curvature * (cy - y);
      if (Math.abs(v) > 1 + 1e-10) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, v)));
      for (const angle of [a, -a]) if (contains(angle) && inRect(point(angle))) return false;
    }
  }
  return true;
}
function routeLeg(s, r, start, goal, maxNodes = 35e3, dynamicCircles = [], budget) {
  const w = { ...sceneWorld(s, start.floor, start, goal, r), dynamicCircles };
  if (isForceExperiment(r)) {
    if (![start.x, start.y, start.yaw, goal.x, goal.y].every(Number.isFinite) || [start, goal].some((p) => p.x < w.radius || p.y < w.radius || p.x > w.width - w.radius || p.y > w.height - w.radius)) throw Error("\uAC15\uC81C \uC2E4\uD5D8\uC5D0\uC11C\uB3C4 \uCC28\uCCB4\uAC00 \uC9C0\uB3C4 \uACBD\uACC4\uB97C \uBC97\uC5B4\uB0A0 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    const length = Math.hypot(goal.x - start.x, goal.y - start.y), count = Math.max(1, Math.ceil(length / 0.08)), yaw = length ? Math.atan2(goal.y - start.y, goal.x - start.x) : start.yaw;
    return [start, ...Array.from({ length: count }, (_, i) => ({ x: start.x + (goal.x - start.x) * (i + 1) / count, y: start.y + (goal.y - start.y) * (i + 1) / count, yaw, floor: start.floor }))];
  }
  if (!segmentClear(w, start, start)) throw Error("\uCD9C\uBC1C \uCC28\uCCB4 \uC5EC\uC720 \uACF5\uAC04\uC774 \uC7A5\uC560\uBB3C \uB610\uB294 \uC9C0\uB3C4 \uACBD\uACC4\uC640 \uACB9\uCE69\uB2C8\uB2E4.");
  if (!segmentClear(w, goal, goal)) throw Error("\uB3C4\uCC29 \uCC28\uCCB4 \uC5EC\uC720 \uACF5\uAC04\uC774 \uC7A5\uC560\uBB3C \uB610\uB294 \uC9C0\uB3C4 \uACBD\uACC4\uC640 \uACB9\uCE69\uB2C8\uB2E4.");
  if (r.model === "holonomic") {
    const p = plan(w, budget), out = [start];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.08)), yaw = Math.atan2(b.y - a.y, b.x - a.x);
      for (let j = 1; j <= n; j++) out.push({ x: a.x + (b.x - a.x) * j / n, y: a.y + (b.y - a.y) * j / n, yaw, floor: start.floor });
    }
    return out;
  }
  const step = 0.16, key = (p) => `${Math.round(p.x / 0.13)},${Math.round(p.y / 0.13)},${Math.round((wrap(p.yaw) + Math.PI) / (Math.PI / 16))}`;
  const first = { ...start, g: 0, f: Math.hypot(start.x - goal.x, start.y - goal.y), parent: null }, open = new MinHeap(), cost = /* @__PURE__ */ new Map([[key(first), 0]]);
  let end = null;
  open.push(first);
  for (let count = 0; open.length && count < maxNodes; count++) {
    if (budget && (budget.remaining-- <= 0 || count % 64 === 0 && performance.now() > budget.deadline)) throw Error("\uC2E4\uC2DC\uAC04 \uC7AC\uACC4\uD68D \uD0D0\uC0C9 \uD55C\uB3C4");
    const n = open.pop();
    if (Math.hypot(n.x - goal.x, n.y - goal.y) < 0.16 && (goal.yaw === void 0 || Math.abs(wrap(n.yaw - goal.yaw)) < Math.PI / 12) && (goal.departure !== true || [0, -1 / r.minRadius, 1 / r.minRadius].some((k) => arcClear(w, n, k, 0.32)))) {
      end = n;
      break;
    }
    for (const turn of [0, -1, 1]) {
      const curvature = turn / r.minRadius, da = step * curvature, yaw = wrap(n.yaw + da), x = turn ? n.x + (Math.sin(n.yaw + da) - Math.sin(n.yaw)) / curvature : n.x + step * Math.cos(n.yaw), y = turn ? n.y + (-Math.cos(n.yaw + da) + Math.cos(n.yaw)) / curvature : n.y + step * Math.sin(n.yaw);
      const p = { x, y, yaw, floor: n.floor };
      if (!arcClear(w, n, curvature, step)) continue;
      const g = n.g + step + (turn ? 5e-3 : 0), k = key(p);
      if ((cost.get(k) ?? Infinity) <= g) continue;
      cost.set(k, g);
      open.push({ ...p, g, f: g + Math.hypot(x - goal.x, y - goal.y), parent: n });
    }
  }
  if (!end) throw Error(`\uC804\uC9C4 \uC804\uC6A9 \uCD5C\uC18C \uBC18\uACBD ${r.minRadius.toFixed(2)}m \uACBD\uB85C\uB97C \uD604\uC7AC \uD0D0\uC0C9 \uD574\uC0C1\uB3C4/\uD55C\uB3C4\uC5D0\uC11C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. U\uD134 \uACF5\uAC04\xB7\uCD9C\uBC1C \uBC29\uD5A5\uC744 \uD655\uC778\uD558\uC138\uC694.`);
  const result = [];
  for (let p = end; p; p = p.parent) result.push({ x: p.x, y: p.y, yaw: p.yaw, floor: p.floor });
  return result.reverse();
}
function approachLeg(s, r, start, target) {
  const gap = robotRadius(r) + 0.1, candidates = [];
  for (const fraction of [0.5, 0.25, 0.75]) {
    candidates.push({ x: target.x - gap, y: target.y + target.h * fraction }, { x: target.x + target.w + gap, y: target.y + target.h * fraction }, { x: target.x + target.w * fraction, y: target.y - gap }, { x: target.x + target.w * fraction, y: target.y + target.h + gap });
  }
  let best = null, cost = Infinity;
  for (const goal of candidates) {
    try {
      const route = routeLeg(s, r, start, goal), length = route.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - route[i - 1].x, p.y - route[i - 1].y) : sum, 0);
      if (length < cost) {
        best = route;
        cost = length;
      }
    } catch {
    }
  }
  if (!best) throw Error(`${r.id}: ${target.name} \uBAB8\uCCB4 \uBC16\uC5D0 \uC548\uC804\uD558\uAC8C \uC811\uADFC\uD560 \uACF5\uAC04\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB300\uC0C1 \uC8FC\uC704\uC5D0 \uC124\uC815\uB41C \uCC28\uCCB4 \uBC18\uACBD ${robotRadius(r).toFixed(2)}m\uC640 \uC811\uADFC \uC5EC\uC720 0.10m\uB97C \uD655\uBCF4\uD558\uC138\uC694.`);
  return best;
}
function planScene(s) {
  validateScene(s);
  const helmetClaims = /* @__PURE__ */ new Map(), workerClaims = /* @__PURE__ */ new Map();
  for (const r of s.robots.filter((r2) => r2.mission === "helmet")) {
    const { helmet, worker } = deliveryTargets(s, r);
    if (helmetClaims.has(helmet.id)) throw Error("\uAC19\uC740 \uC548\uC804\uBAA8\uB97C \uB450 \uAE30\uCCB4\uAC00 \uC9D1\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: " + helmetClaims.get(helmet.id) + " / " + r.id);
    if (workerClaims.has(worker.id)) throw Error("\uAC19\uC740 \uC791\uC5C5\uC790\uC5D0\uAC8C \uC911\uBCF5 \uC804\uB2EC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: " + workerClaims.get(worker.id) + " / " + r.id);
    helmetClaims.set(helmet.id, r.id);
    workerClaims.set(worker.id, r.id);
  }
  const charger = s.entities.find((e) => e.kind === "charger"), queues = s.entities.filter((e) => e.kind === "queue" && visible(e, charger.floor || 1)), chargingRobots = s.robots.filter((r) => r.after !== "stay");
  if (queues.length < chargingRobots.length) throw Error("\uCDA9\uC804 \uD6C4 \uC644\uB8CC \uAE30\uCCB4\uB9C8\uB2E4 \uCDA9\uC804\uC18C\uC640 \uAC19\uC740 \uCE35\uC5D0 \uB300\uAE30\uC810\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uAE30\uCCB4 \uCD94\uAC00 \uC2DC \uC548\uC804\uD55C \uB300\uAE30\uC810\uC744 \uC790\uB3D9 \uC0DD\uC131\uD569\uB2C8\uB2E4.");
  const parking = [];
  return s.robots.map((r, robotIndex) => {
    const radius = robotRadius(r);
    const points = [{ x: r.x, y: r.y, yaw: r.yaw, floor: r.floor }], qrIndices = [];
    let liftStart = -1, liftEnd = -1, pickup = -1, deliver = -1, helmetId, workerId, reservation;
    const checkpoints = [], targets = [];
    const legScene = (_from) => s;
    const append = (goal, label = "\uACBD\uC720 \uAD6C\uAC04") => {
      const from = points.at(-1);
      const planned = legScene(from);
      try {
        points.push(...routeLeg(planned, r, from, { ...goal, departure: r.model === "car" && label !== "\uCDA9\uC804\uC18C \uC774\uD0C8/\uC644\uB8CC \uC8FC\uCC28" && !(r.after === "stay" && label === "\uC784\uBB34 \uBAA9\uD45C \uBC29\uBB38") }).slice(1));
        checkpoints.push(points.length - 1);
        targets.push({ index: points.length - 1, pose: { ...points.at(-1), x: goal.x, y: goal.y } });
      } catch (error) {
        const blockers = planned.entities.filter((e) => visible(e, from.floor) && isSolidEntity(e) && (from.x >= e.x - radius && from.x <= e.x + e.w + radius && from.y >= e.y - radius && from.y <= e.y + e.h + radius || goal.x >= e.x - radius && goal.x <= e.x + e.w + radius && goal.y >= e.y - radius && goal.y <= e.y + e.h + radius)).map((e) => e.name + " [" + e.id + "]");
        throw new PlanningError({ robotId: r.id, leg: label, from: { ...from }, to: { ...goal }, cause: error.message, blockers, suggestion: r.model === "car" ? "\uD574\uB2F9 \uAE30\uCCB4\uB97C \uC120\uD0DD\uD574 \uCD9C\uBC1C \uBC29\uD5A5\xB7\uCD5C\uC18C \uD68C\uC804 \uBC18\uACBD\xB7\uD574\uB2F9 \uB3C4\uCC29\uC810 \uC8FC\uC704 \uD68C\uC804 \uACF5\uAC04\uC744 \uC870\uC815\uD558\uC138\uC694." : "\uD574\uB2F9 \uAE30\uCCB4\uC640 \uAD00\uB828 \uAC1D\uCCB4/\uB3C4\uCC29\uC810\uC744 \uB5A8\uC5B4\uB728\uB824 \uBC30\uCE58\uD558\uC138\uC694." });
      }
    };
    const changeFloor = (floor) => {
      if (points.at(-1).floor === floor) return;
      const lift = s.entities.find((e) => e.kind === "lift" && e.floor === 0), qr = s.entities.find((e) => e.kind === "qr" && e.floor === 0);
      if (!lift || !qr) throw Error("\uCE35\uAC04 \uC774\uB3D9\uC5D0\uB294 \uACF5\uC6A9 \uAC00\uC0C1 \uC5D8\uB9AC\uBCA0\uC774\uD130\uC640 QR \uD45C\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
      append(center(qr), "QR \uC811\uADFC");
      qrIndices.push(points.length - 1);
      append(center(lift), "\uC5D8\uB9AC\uBCA0\uC774\uD130 \uD0D1\uC2B9 \uC811\uADFC");
      liftStart = points.length - 1;
      points.push({ ...points.at(-1), floor });
      liftEnd = points.length - 1;
      checkpoints.push(liftEnd);
    };
    for (const [i, p] of r.waypoints.entries()) append(p, "\uACBD\uC720\uC810 " + (i + 1));
    if (r.mission === "helmet") {
      const { helmet, worker } = deliveryTargets(s, r);
      helmetId = helmet.id;
      workerId = worker.id;
      points.push(...approachLeg(legScene(points.at(-1)), r, points.at(-1), helmet).slice(1));
      pickup = points.length - 1;
      checkpoints.push(pickup);
      points.push(...approachLeg(legScene(points.at(-1)), r, points.at(-1), worker).slice(1));
      if (points.length - 1 === pickup) points.push({ ...points.at(-1) });
      deliver = points.length - 1;
      checkpoints.push(deliver);
    }
    changeFloor(r.goalFloor);
    append(r.goal, "\uC784\uBB34 \uBAA9\uD45C \uBC29\uBB38");
    if (r.after === "stay") {
      const beyond = points.length + 1;
      return { id: r.id, points, liftStart, liftEnd, pickup, deliver, queue: beyond, charge: beyond + 1, exit: points.length - 1, qrIndices, checkpoints, targets: checkpoints.map((index) => targets.find((t) => t.index === index) ?? { index, pose: { ...points[index] } }), revision: 0, helmetId, workerId };
    }
    const chargeFloor = charger.floor || 1;
    changeFloor(chargeFloor);
    const q = queues[chargingRobots.findIndex((robot) => robot.id === r.id)];
    if (!visible(q, chargeFloor)) throw Error("\uCDA9\uC804 \uB300\uAE30\uC810\uC740 \uCDA9\uC804\uC18C\uC640 \uAC19\uC740 \uCE35\uC5D0 \uBC30\uCE58\uD558\uC138\uC694.");
    append(center(q), "\uCDA9\uC804 \uC55E \uB300\uAE30\uC810 " + q.name);
    const queue = points.length - 1;
    append(center(charger), "\uCDA9\uC804\uC18C \uC9C4\uC785");
    const charge = points.length - 1;
    const preferred = { x: 0.55 + robotIndex * 0.65, y: Math.max(0.35, charger.y - 1) }, candidates = [preferred];
    for (let y = 0.4; y < s.height - 0.3; y += 0.55) for (let x = 0.4; x < s.width - 0.3; x += 0.55) candidates.push({ x, y });
    candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.y - preferred.y) - Math.hypot(b.x - preferred.x, b.y - preferred.y));
    let parked = false;
    for (const goal of candidates.slice(0, 50)) {
      if (parking.some((p) => Math.hypot(p.x - goal.x, p.y - goal.y) < p.radius + radius + 0.21) || Math.hypot(goal.x - center(charger).x, goal.y - center(charger).y) < 0.85 || queues.some((q2) => Math.hypot(goal.x - center(q2).x, goal.y - center(q2).y) < 0.65)) continue;
      try {
        append(goal, "\uCDA9\uC804\uC18C \uC774\uD0C8/\uC644\uB8CC \uC8FC\uCC28");
        parking.push({ ...points.at(-1), radius });
        parked = true;
        break;
      } catch {
      }
    }
    if (!parked) throw Error(r.id + ": \uCDA9\uC804\uC18C\uC5D0\uC11C \uC774\uD0C8\uD560 \uC548\uC804\uD55C \uC8FC\uCC28 \uACBD\uB85C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return { id: r.id, points, liftStart, liftEnd, pickup, deliver, queue, charge, exit: points.length - 1, qrIndices, checkpoints, targets: checkpoints.map((index) => targets.find((t) => t.index === index) ?? { index, pose: { ...points[index] } }), revision: 0, helmetId, workerId, reservation };
  });
}

// app/scene.worker.ts
self.onmessage = (event) => {
  const { sequence, scene } = event.data;
  let stage = "scene_validation";
  try {
    validateScene(scene);
    stage = "route_planning";
    const routes = planScene(scene);
    self.postMessage({ sequence, revision: scene.revision, routes });
  } catch (error) {
    self.postMessage({ sequence, revision: scene.revision, stage, error: error.message, diagnostic: error instanceof PlanningError ? error.diagnostic : void 0 });
  }
};
