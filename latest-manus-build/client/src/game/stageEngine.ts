import { getStage, type StageDefinition, type StageId, type StageNode } from "./stages";

export type MissionPhase = "intro" | "running" | "paused" | "finished";

export type MissionNode = StageNode & {
  rescued: number;
  casualties: number;
  lost: boolean;
};

export type MissionLink = { nodeId: string; progress: number };

export type MissionState = {
  stageId: StageId;
  phase: MissionPhase;
  elapsed: number;
  battery: number;
  materials: number;
  maxLinks: number;
  nodes: MissionNode[];
  links: MissionLink[];
  emergencyTarget: string | null;
  emergencyUntil: number;
  lavaProgress: number;
  blockedRoadTarget: string | null;
  blockedUntil: number;
  vehicleRepairUntil: number;
  lastSnowEventIndex: number;
  lastEvent: string;
};

export const EMERGENCY_DURATION = 15;

export function createMission(stageId: StageId): MissionState {
  const stage = getStage(stageId);
  return {
    stageId,
    phase: "intro",
    elapsed: 0,
    battery: 100,
    materials: stage.materials,
    maxLinks: stage.maxLinks,
    nodes: stage.nodes.map((node) => ({ ...node, rescued: 0, casualties: 0, lost: false })),
    links: [],
    emergencyTarget: null,
    emergencyUntil: 0,
    lavaProgress: 0,
    blockedRoadTarget: null,
    blockedUntil: 0,
    vehicleRepairUntil: 0,
    lastSnowEventIndex: 0,
    lastEvent: stage.hazard === "volcano" ? "دخان البركان يتجه إلى المدينة — حدّد أولويات الإخلاء" : stage.hazard === "blizzard" ? "الطرق مفتوحة الآن، لكن العاصفة ستغلقها على فترات" : "اربط المباني بنفق الإخلاء قبل وصول العاصفة",
  };
}

export function startMission(state: MissionState): MissionState {
  return { ...state, phase: "running", lastEvent: "انطلقت شبكة الإنقاذ — المسارات النشطة تُسيّر المركبات تلقائيًا" };
}

export function restartMission(state: MissionState) {
  return createMission(state.stageId);
}

export function createDemoMission(stageId: StageId) {
  let mission = startMission(createMission(stageId));
  const stage = getStage(stageId);
  for (const node of stage.nodes.slice(0, Math.min(4, stage.maxLinks))) mission = connectNode(mission, node.id).state;
  const demoElapsed = stageId === "snow" ? 45 : stageId === "volcano" ? 62 : 48;
  return tickMission({ ...mission, elapsed: demoElapsed - .5 }, .5);
}

export function togglePause(state: MissionState): MissionState {
  if (state.phase === "intro" || state.phase === "finished") return state;
  return { ...state, phase: state.phase === "running" ? "paused" : "running" };
}

export function getStageForMission(state: MissionState): StageDefinition {
  return getStage(state.stageId);
}

export function getRescuedCount(state: MissionState) {
  return state.nodes.reduce((sum, node) => sum + node.rescued, 0);
}

export function getLostCount(state: MissionState) {
  return state.nodes.reduce((sum, node) => sum + node.casualties + (node.lost ? Math.max(0, node.people - node.rescued - node.casualties) : 0), 0);
}

export function getRemainingTime(state: MissionState) {
  return Math.max(0, getStageForMission(state).duration - state.elapsed);
}

export function getTotalPeople(state: MissionState) {
  return state.nodes.reduce((sum, node) => sum + node.people, 0);
}

export function isEmergencyActive(state: MissionState) {
  return Boolean(state.emergencyTarget && state.elapsed < state.emergencyUntil);
}

export function isRoadBlocked(state: MissionState, nodeId: string) {
  return state.blockedRoadTarget === nodeId && state.elapsed < state.blockedUntil;
}

export function isVehicleRepairing(state: MissionState) {
  return state.elapsed < state.vehicleRepairUntil;
}

export function getNodeStatus(state: MissionState, node: MissionNode) {
  if (node.lost) return "lost" as const;
  if (node.rescued >= node.people) return "saved" as const;
  if (isRoadBlocked(state, node.id)) return "blocked" as const;
  const remaining = getRemainingTime(state);
  if (remaining < 35 || (node.lavaAt !== undefined && state.elapsed > node.lavaAt - 22)) return "critical" as const;
  if (remaining < 90 || (node.lavaAt !== undefined && state.elapsed > node.lavaAt - 55)) return "warning" as const;
  return "active" as const;
}

export function connectNode(state: MissionState, nodeId: string) {
  const node = state.nodes.find((candidate) => candidate.id === nodeId);
  if (state.phase !== "running") return { state, message: "ابدأ المهمة أولًا لتفعيل مسارات الإنقاذ" };
  if (!node || node.lost || node.rescued + node.casualties >= node.people) return { state, message: "لا يحتاج هذا الموقع إلى مسار جديد" };
  if (state.links.some((link) => link.nodeId === nodeId)) return { state, message: "هذا المسار يعمل بالفعل" };
  if (state.links.length >= state.maxLinks) return { state, message: `يمكن تشغيل ${state.maxLinks} مسارات فقط في وقت واحد` };
  if (state.materials < 2) return { state, message: "تحتاج مادتين ميدانيتين لفتح مسار جديد" };
  if (isRoadBlocked(state, nodeId)) return { state, message: "تراكم الثلج أغلق هذا الطريق مؤقتًا" };
  return {
    state: {
      ...state,
      materials: state.materials - 2,
      links: [...state.links, { nodeId, progress: 0 }],
      lastEvent: `تم ربط ${node.label} بنفق الإخلاء`,
    },
    message: "خط الإنقاذ نشط — ستبدأ المركبة رحلتها الآن",
  };
}

export function toggleEmergency(state: MissionState, nodeId?: string): { state: MissionState; message: string } {
  if (state.phase !== "running") return { state, message: "لا يمكن تشغيل مسار الطوارئ الآن" };
  if (isEmergencyActive(state)) return { state: { ...state, emergencyTarget: null, emergencyUntil: 0, lastEvent: "تم إيقاف مسار الطوارئ" }, message: "تم إيقاف المسار الطارئ" };
  const target = nodeId ?? state.links[0]?.nodeId;
  const node = state.nodes.find((candidate) => candidate.id === target);
  if (!target || !node || node.lost || node.rescued >= node.people) return { state, message: "اختر أولًا هدفًا ما زال يحتاج إلى إنقاذ" };
  if (state.battery < 12) return { state, message: "تحتاج إلى 12% بطارية على الأقل لمسار الطوارئ" };
  return {
    state: { ...state, emergencyTarget: target, emergencyUntil: state.elapsed + EMERGENCY_DURATION, lastEvent: `مسار طوارئ إلى ${node.label}: سرعة مضاعفة لمدة ${EMERGENCY_DURATION} ثانية` },
    message: "المسار الطارئ نشط — البطارية تنخفض بوتيرة أسرع",
  };
}

function applyVolcanoHazard(state: MissionState, elapsed: number) {
  let changed = false;
  const nodes = state.nodes.map((node) => {
    if (node.lavaAt === undefined || node.lost || elapsed < node.lavaAt) return node;
    changed = true;
    return { ...node, lost: true };
  });
  const newlyLost = nodes.find((node, index) => node.lost && !state.nodes[index].lost);
  return {
    nodes,
    message: newlyLost ? `وصلت اللاڤا إلى ${newlyLost.label} — فُقد من بقي دون إخلاء` : state.lastEvent,
    changed,
  };
}

export function tickMission(state: MissionState, delta: number): MissionState {
  if (state.phase !== "running") return state;
  const stage = getStageForMission(state);
  const elapsed = Math.min(stage.duration, state.elapsed + delta);
  let nodes = state.nodes;
  let links = state.links;
  let lastEvent = state.lastEvent;
  let blockedRoadTarget = state.blockedRoadTarget;
  let blockedUntil = state.blockedUntil;
  let vehicleRepairUntil = state.vehicleRepairUntil;
  let lastSnowEventIndex = state.lastSnowEventIndex;

  if (stage.hazard === "volcano") {
    const lava = applyVolcanoHazard(state, elapsed);
    nodes = lava.nodes;
    if (lava.changed) lastEvent = lava.message;
  }

  if (stage.hazard === "blizzard") {
    const eventIndex = Math.floor(elapsed / 15);
    if (eventIndex > 0 && eventIndex > lastSnowEventIndex) {
      const sequence = stage.snowBlockSequence ?? [];
      const targetId = sequence[(eventIndex - 1) % sequence.length];
      const target = nodes.find((node) => node.id === targetId);
      blockedRoadTarget = targetId;
      blockedUntil = elapsed + 9;
      vehicleRepairUntil = eventIndex % 3 === 0 ? elapsed + 10 : 0;
      lastSnowEventIndex = eventIndex;
      lastEvent = vehicleRepairUntil > elapsed
        ? `عاصفة كثيفة: انغلق طريق ${target?.label ?? "القطاع"} وتعطلت المركبات — الإصلاح 10 ثوانٍ`
        : `تراكم الثلج أغلق طريق ${target?.label ?? "القطاع"} مؤقتًا`;
    }
    if (blockedRoadTarget && elapsed >= blockedUntil) blockedRoadTarget = null;
    if (vehicleRepairUntil && elapsed >= vehicleRepairUntil) {
      vehicleRepairUntil = 0;
      lastEvent = "عادت المركبات إلى العمل — استمر في الإخلاء قبل أن تنغلق الطرق مجددًا";
    }
  }

  const emergencyActive = state.emergencyTarget && elapsed < state.emergencyUntil ? state.emergencyTarget : null;
  const repairsActive = elapsed < vehicleRepairUntil;
  const nextLinks: MissionLink[] = [];
  const activeLinkIds = new Set<string>();
  const linkEntries = links.map((link) => ({ ...link }));
  const nextNodes = nodes.map((node) => {
    if (node.lost || node.rescued + node.casualties >= node.people) return node;
    const link = linkEntries.find((candidate) => candidate.nodeId === node.id);
    const emergencyOnly = emergencyActive === node.id && !link;
    const roadClosed = blockedRoadTarget === node.id && elapsed < blockedUntil;
    if ((!link && !emergencyOnly) || repairsActive || roadClosed || state.battery <= 0) return node;
    const speed = emergencyActive === node.id ? 1.82 : 1;
    let progress = (link?.progress ?? 0) + delta * speed;
    let rescued = node.rescued;
    while (progress >= stage.tripDuration && rescued + node.casualties < node.people) {
      progress -= stage.tripDuration;
      rescued += Math.min(2, node.people - rescued - node.casualties);
      lastEvent = `${node.label}: وصلت مركبة الإخلاء إلى النفق`;
    }
    if (link && rescued + node.casualties < node.people) {
      nextLinks.push({ ...link, progress });
      activeLinkIds.add(node.id);
    }
    return { ...node, rescued };
  });

  const activeLinks = activeLinkIds.size + (emergencyActive && !activeLinkIds.has(emergencyActive) ? 1 : 0);
  const emergencyDrain = emergencyActive ? 0.16 : 0;
  const battery = Math.max(0, state.battery - delta * (activeLinks * 0.07 + emergencyDrain));
  const allResolved = nextNodes.every((node) => node.lost || node.rescued + node.casualties >= node.people);
  const timeExpired = elapsed >= stage.duration;
  const finishedNodes = timeExpired
    ? nextNodes.map((node) => node.lost || node.rescued + node.casualties >= node.people ? node : { ...node, lost: true })
    : nextNodes;
  const phase: MissionPhase = allResolved || timeExpired ? "finished" : "running";

  if (timeExpired) lastEvent = stage.hazard === "volcano" ? "وصلت جبهة اللاڤا إلى آخر الممرات" : stage.hazard === "blizzard" ? "ابتلعت العاصفة آخر الطرق المفتوحة" : "وصلت العاصفة إلى الجزيرة";
  if (allResolved) lastEvent = "اكتمل الإخلاء — وصلت آخر المركبات إلى النفق";

  return {
    ...state,
    phase,
    elapsed,
    nodes: finishedNodes,
    links: phase === "finished" ? [] : nextLinks,
    battery,
    emergencyTarget: emergencyActive,
    emergencyUntil: emergencyActive ? state.emergencyUntil : 0,
    lavaProgress: stage.hazard === "volcano" ? Math.min(1, elapsed / 282) : 0,
    blockedRoadTarget,
    blockedUntil,
    vehicleRepairUntil,
    lastSnowEventIndex,
    lastEvent,
  };
}

/* ===== مسار اللاڤا وقذائف البركان (دوال نقية قابلة للاختبار) ===== */

export type FlowPoint = { x: number; y: number };

export const VOLCANO_CRATER: FlowPoint = { x: 135, y: 70 };
export const BOMB_LANDING_BOUNDS = { x0: 330, x1: 900, y0: 210, y1: 560 };
export const BOMB_IMPACT_WINDOW = 0.9;
export const BOMB_SCORCH_LINGER = 20;

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getLavaTimedNodes(stage: StageDefinition): StageNode[] {
  return stage.nodes
    .filter((node) => node.lavaAt !== undefined)
    .sort((a, b) => (a.lavaAt ?? 0) - (b.lavaAt ?? 0));
}

export function getLavaPath(stage: StageDefinition): FlowPoint[] {
  return [VOLCANO_CRATER, ...getLavaTimedNodes(stage).map((node) => ({ x: node.x, y: node.y }))];
}

export function pathLength(points: FlowPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

export function pointAlongPath(points: FlowPoint[], distance: number): FlowPoint & { angle: number } {
  const safe = Math.max(0, Math.min(distance, pathLength(points)));
  let remaining = safe;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (remaining <= length || index === points.length - 1) {
      const ratio = length ? Math.max(0, Math.min(1, remaining / length)) : 0;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
        angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
      };
    }
    remaining -= length;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

/** نسبة مسار اللاڤا المُستهلك عند زمن معين: تنمو خطيًا بين مواعيد بلوغ الأحياء. */
export function getLavaFront(stage: StageDefinition, elapsed: number): number {
  const timed = getLavaTimedNodes(stage);
  if (!timed.length) return 0;
  const anchors = [0, ...timed.map((node) => node.lavaAt as number)];
  const segments = anchors.length - 1;
  const time = Math.max(0, Math.min(elapsed, anchors[segments]));
  for (let index = 1; index < anchors.length; index += 1) {
    if (time <= anchors[index]) {
      const span = anchors[index] - anchors[index - 1] || 1;
      return (index - 1 + Math.max(0, (time - anchors[index - 1]) / span)) / segments;
    }
  }
  return 1;
}

/** قص نقطة بداية المسار حتى مسافة مشي محددة (لرسم جبهة اللاڤا جزئيًا). */
export function trimPathToDistance(points: FlowPoint[], distance: number): FlowPoint[] {
  const total = pathLength(points);
  const capped = Math.max(0, Math.min(distance, total));
  if (capped >= total) return points;
  const trimmed: FlowPoint[] = [points[0]];
  let remaining = capped;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (remaining <= length) {
      if (remaining > 0) {
        const ratio = length ? remaining / length : 0;
        trimmed.push({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio });
      }
      return trimmed;
    }
    remaining -= length;
    trimmed.push(end);
  }
  return trimmed;
}

export type BombEvent = { id: number; launch: number; flight: number; from: FlowPoint; to: FlowPoint; arc: number };

export function makeBombSchedule(seed: number, crater: FlowPoint, until: number): BombEvent[] {
  const random = mulberry32(seed);
  const events: BombEvent[] = [];
  let time = 22 + random() * 8;
  let guard = 0;
  while (time < until && guard < 200) {
    guard += 1;
    events.push({
      id: events.length,
      launch: time,
      flight: 1.5 + random() * 0.8,
      from: crater,
      to: {
        x: BOMB_LANDING_BOUNDS.x0 + random() * (BOMB_LANDING_BOUNDS.x1 - BOMB_LANDING_BOUNDS.x0),
        y: BOMB_LANDING_BOUNDS.y0 + random() * (BOMB_LANDING_BOUNDS.y1 - BOMB_LANDING_BOUNDS.y0),
      },
      arc: 110 + random() * 90,
    });
    time += 9 + random() * 9;
  }
  return events;
}

export function bombPosition(bomb: BombEvent, elapsed: number): FlowPoint & { height: number; progress: number } {
  const progress = Math.max(0, Math.min(1, (elapsed - bomb.launch) / bomb.flight));
  return {
    x: bomb.from.x + (bomb.to.x - bomb.from.x) * progress,
    y: bomb.from.y + (bomb.to.y - bomb.from.y) * progress,
    height: Math.sin(Math.PI * progress) * bomb.arc,
    progress,
  };
}

export function bombsInFlight(schedule: BombEvent[], elapsed: number): BombEvent[] {
  return schedule.filter((bomb) => elapsed >= bomb.launch && elapsed < bomb.launch + bomb.flight);
}

export function bombImpacts(schedule: BombEvent[], elapsed: number): BombEvent[] {
  return schedule.filter((bomb) => elapsed >= bomb.launch + bomb.flight && elapsed < bomb.launch + bomb.flight + BOMB_IMPACT_WINDOW);
}

export function bombScorches(schedule: BombEvent[], elapsed: number): BombEvent[] {
  return schedule.filter((bomb) => elapsed >= bomb.launch + bomb.flight && elapsed < bomb.launch + bomb.flight + BOMB_SCORCH_LINGER);
}

export function eruptedCount(schedule: BombEvent[], elapsed: number): number {
  return schedule.filter((bomb) => bomb.launch <= elapsed).length;
}
