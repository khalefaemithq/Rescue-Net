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
