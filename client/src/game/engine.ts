export type NodeId = "residential" | "hospital" | "school" | "harbor" | "radio";
export type UpgradeId = "rapid" | "bridge" | "charge" | "network" | "crew" | "alert" | "capacity";
export type GamePhase = "intro" | "running" | "paused" | "upgrade" | "finished";

export type RescueNode = {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  people: number;
  rescued: number;
  priority: number;
  deadline: number;
  lost: boolean;
  casualties: number;
};

export type RescueLink = {
  id: NodeId;
  nodeId: NodeId;
  broken: boolean;
  detour?: boolean;
};

export type EmergencyRoute = {
  targetId: NodeId;
  startedAt: number;
  expiresAt: number;
};

export type GameState = {
  phase: GamePhase;
  elapsed: number;
  battery: number;
  materials: number;
  links: RescueLink[];
  nodes: RescueNode[];
  maxLinks: number;
  rescueRate: number;
  ambulanceCapacity: number;
  tripDuration: number;
  tripProgress: Partial<Record<NodeId, number>>;
  batteryDrain: number;
  vehicleSpeed: number;
  bridgePass: boolean;
  deadlineBonus: number;
  processedUpgradeWaves: number[];
  hazard: "none" | "bridge" | "cliff" | "storm";
  lastEvent: string;
  upgrades: UpgradeId[];
  emergencyRoute: EmergencyRoute | null;
  pivotalDecision: NodeId | null;
  radioStrikeApplied: boolean;
  radioStrikeLosses: number;
  floodedHarbor: boolean;
  cliffCollapseAt: number;
  cliffCollapsed: boolean;
  manualDetours: Partial<Record<"harbor" | "residential", boolean>>;
};

export type RoadPoint = { x: number; y: number };

export const GAME_DURATION = 180;
export const EMERGENCY_DURATION = 15;
export const EMERGENCY_BATTERY_MULTIPLIER = 2;
export const AMBULANCE_TRIP_DURATION = 4;
export const UPGRADE_OPTIONS: { id: UpgradeId; title: string; description: string; icon: string }[] = [
  { id: "rapid", title: "مركبة سريعة", description: "سرعة المركبات +25%", icon: "↠" },
  { id: "bridge", title: "جسر مؤقت", description: "يعيد وصل الميناء بعد الانهيار", icon: "⌇" },
  { id: "charge", title: "محطة شحن", description: "+25% بطارية واستهلاك أقل", icon: "ϟ" },
  { id: "network", title: "شبكة مزدوجة", description: "خط إنقاذ إضافي", icon: "⌘" },
  { id: "crew", title: "طاقم إضافي", description: "سرعة الإنقاذ أعلى", icon: "✦" },
  { id: "capacity", title: "إسعاف واسع", description: "+2 مقاعد في كل رحلة", icon: "▣" },
  { id: "alert", title: "فريق اتصالات", description: "+2 مواد لفتح خطوط إنقاذ إضافية", icon: "◌" },
];

const BASE_NODES: RescueNode[] = [
  { id: "residential", label: "الحي السكني", x: 250, y: 210, people: 36, rescued: 0, priority: 2, deadline: 140, lost: false, casualties: 0 },
  { id: "hospital", label: "المستشفى", x: 440, y: 245, people: 24, rescued: 0, priority: 5, deadline: 165, lost: false, casualties: 0 },
  { id: "school", label: "المدرسة", x: 750, y: 190, people: 28, rescued: 0, priority: 4, deadline: 125, lost: false, casualties: 0 },
  { id: "harbor", label: "الميناء", x: 810, y: 485, people: 26, rescued: 0, priority: 3, deadline: 155, lost: false, casualties: 0 },
  { id: "radio", label: "محطة الاتصالات", x: 290, y: 480, people: 10, rescued: 0, priority: 3, deadline: 150, lost: false, casualties: 0 },
];

export type RoadGraphNodeId = "hq" | NodeId;
export type RoadGraphNode = { id: RoadGraphNodeId; point: RoadPoint };
export type RoadGraphEdge = { id: string; from: RoadGraphNodeId; to: RoadGraphNodeId; points: RoadPoint[]; condition?: "harbor_main" | "residential_main" | "flood_connector" | "cliff_connector" };

export const ROAD_GRAPH_NODES: Record<RoadGraphNodeId, RoadGraphNode> = {
  hq: { id: "hq", point: { x: 555, y: 360 } },
  residential: { id: "residential", point: { x: 250, y: 210 } },
  hospital: { id: "hospital", point: { x: 440, y: 245 } },
  school: { id: "school", point: { x: 750, y: 190 } },
  harbor: { id: "harbor", point: { x: 810, y: 485 } },
  radio: { id: "radio", point: { x: 290, y: 480 } },
};

const HQ_RADIO_STONE_ROUTE: RoadPoint[] = [{ x: 555, y: 360 }, { x: 544, y: 373 }, { x: 528, y: 391 }, { x: 512, y: 409 }, { x: 495, y: 427 }, { x: 476, y: 441 }, { x: 455, y: 452 }, { x: 433, y: 462 }, { x: 410, y: 471 }, { x: 385, y: 478 }, { x: 360, y: 483 }, { x: 340, y: 484 }, { x: 320, y: 484 }, { x: 304, y: 482 }, { x: 290, y: 480 }];
const RADIO_RESIDENTIAL_STONE_ROUTE: RoadPoint[] = [{ x: 290, y: 480 }, { x: 278, y: 475 }, { x: 266, y: 468 }, { x: 256, y: 458 }, { x: 246, y: 446 }, { x: 238, y: 434 }, { x: 234, y: 420 }, { x: 236, y: 406 }, { x: 242, y: 392 }, { x: 250, y: 379 }, { x: 254, y: 366 }, { x: 252, y: 354 }, { x: 244, y: 345 }, { x: 234, y: 338 }, { x: 222, y: 334 }, { x: 212, y: 325 }, { x: 208, y: 314 }, { x: 214, y: 303 }, { x: 226, y: 294 }, { x: 240, y: 286 }, { x: 250, y: 277 }, { x: 260, y: 267 }, { x: 269, y: 255 }, { x: 271, y: 242 }, { x: 266, y: 230 }, { x: 258, y: 219 }, { x: 250, y: 210 }];

export const ROAD_GRAPH_EDGES: RoadGraphEdge[] = [
  { id: "main-residential", from: "hq", to: "residential", condition: "residential_main", points: [...HQ_RADIO_STONE_ROUTE, ...RADIO_RESIDENTIAL_STONE_ROUTE.slice(1)] },
  { id: "main-hospital", from: "hq", to: "hospital", points: [{ x: 555, y: 360 }, { x: 544, y: 350 }, { x: 534, y: 339 }, { x: 520, y: 329 }, { x: 506, y: 319 }, { x: 494, y: 309 }, { x: 482, y: 298 }, { x: 472, y: 285 }, { x: 461, y: 271 }, { x: 450, y: 258 }, { x: 440, y: 245 }] },
  { id: "main-school", from: "hq", to: "school", points: [{ x: 555, y: 360 }, { x: 566, y: 357 }, { x: 578, y: 351 }, { x: 591, y: 343 }, { x: 604, y: 334 }, { x: 619, y: 322 }, { x: 634, y: 310 }, { x: 650, y: 295 }, { x: 666, y: 280 }, { x: 680, y: 264 }, { x: 694, y: 250 }, { x: 706, y: 238 }, { x: 718, y: 226 }, { x: 730, y: 214 }, { x: 740, y: 202 }, { x: 750, y: 190 }] },
  { id: "main-harbor", from: "hq", to: "harbor", condition: "harbor_main", points: [{ x: 555, y: 360 }, { x: 552, y: 373 }, { x: 548, y: 385 }, { x: 542, y: 401 }, { x: 536, y: 416 }, { x: 553, y: 428 }, { x: 575, y: 438 }, { x: 598, y: 444 }, { x: 620, y: 449 }, { x: 646, y: 455 }, { x: 674, y: 461 }, { x: 700, y: 468 }, { x: 730, y: 474 }, { x: 752, y: 479 }, { x: 774, y: 482 }, { x: 792, y: 484 }, { x: 810, y: 485 }] },
  { id: "main-radio", from: "hq", to: "radio", points: HQ_RADIO_STONE_ROUTE },
  { id: "flood-school-harbor", from: "school", to: "harbor", condition: "flood_connector", points: [{ x: 750, y: 190 }, { x: 738, y: 204 }, { x: 724, y: 218 }, { x: 706, y: 238 }, { x: 724, y: 252 }, { x: 742, y: 266 }, { x: 756, y: 277 }, { x: 768, y: 289 }, { x: 778, y: 300 }, { x: 786, y: 314 }, { x: 792, y: 327 }, { x: 792, y: 339 }, { x: 790, y: 350 }, { x: 782, y: 366 }, { x: 774, y: 382 }, { x: 771, y: 396 }, { x: 770, y: 410 }, { x: 776, y: 424 }, { x: 782, y: 435 }, { x: 790, y: 448 }, { x: 798, y: 460 }, { x: 804, y: 473 }, { x: 810, y: 485 }] },
  { id: "cliff-radio-residential", from: "radio", to: "residential", condition: "cliff_connector", points: RADIO_RESIDENTIAL_STONE_ROUTE },
];

function edgeLength(points: RoadPoint[]) {
  return points.slice(1).reduce((distance, point, index) => distance + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

function pointsInDirection(edge: RoadGraphEdge, from: RoadGraphNodeId) {
  return edge.from === from ? edge.points : [...edge.points].reverse();
}

function canUseRoadEdge(state: GameState, edge: RoadGraphEdge) {
  if (edge.condition === "flood_connector") return state.floodedHarbor && state.manualDetours.harbor;
  if (edge.condition === "cliff_connector") return state.cliffCollapsed && state.manualDetours.residential;
  if (edge.condition === "harbor_main") return !(state.floodedHarbor && state.manualDetours.harbor);
  if (edge.condition === "residential_main") return !(state.cliffCollapsed && state.manualDetours.residential);
  return true;
}

export function findRoadGraphPath(state: GameState, from: RoadGraphNodeId, to: RoadGraphNodeId): RoadPoint[] {
  const queue: { node: RoadGraphNodeId; distance: number; points: RoadPoint[] }[] = [{ node: from, distance: 0, points: [ROAD_GRAPH_NODES[from].point] }];
  const best = new Map<RoadGraphNodeId, number>([[from, 0]]);

  while (queue.length) {
    queue.sort((left, right) => left.distance - right.distance);
    const current = queue.shift();
    if (!current) break;
    if (current.node === to) return current.points;
    for (const edge of ROAD_GRAPH_EDGES) {
      if (!canUseRoadEdge(state, edge) || (edge.from !== current.node && edge.to !== current.node)) continue;
      const next = edge.from === current.node ? edge.to : edge.from;
      const segment = pointsInDirection(edge, current.node);
      const nextDistance = current.distance + edgeLength(segment);
      if (nextDistance >= (best.get(next) ?? Infinity)) continue;
      best.set(next, nextDistance);
      queue.push({ node: next, distance: nextDistance, points: [...current.points, ...segment.slice(1)] });
    }
  }
  return [ROAD_GRAPH_NODES[from].point, ROAD_GRAPH_NODES[to].point];
}

export function getRoadRoute(state: GameState, nodeId: NodeId): RoadPoint[] {
  if (nodeId === "harbor" && state.floodedHarbor && state.manualDetours.harbor) {
    const toSchool = findRoadGraphPath(state, "hq", "school");
    const schoolToHarbor = findRoadGraphPath(state, "school", "harbor");
    return [...toSchool, ...schoolToHarbor.slice(1)];
  }
  if (nodeId === "residential" && state.cliffCollapsed && state.manualDetours.residential) {
    const toRadio = findRoadGraphPath(state, "hq", "radio");
    const radioToResidential = findRoadGraphPath(state, "radio", "residential");
    return [...toRadio, ...radioToResidential.slice(1)];
  }
  return findRoadGraphPath(state, "hq", nodeId);
}

export function getRainDensityMultiplier(elapsed: number) {
  if (elapsed >= 120) return 2;
  if (elapsed >= 60) return 1.5;
  return 1;
}

export function createGame(): GameState {
  return {
    phase: "intro",
    elapsed: 0,
    battery: 100,
    materials: 12,
    links: [],
    nodes: BASE_NODES.map((node) => ({ ...node })),
    maxLinks: 3,
    rescueRate: 0.12,
    ambulanceCapacity: 1,
    tripDuration: AMBULANCE_TRIP_DURATION,
    tripProgress: {},
    batteryDrain: 0.18,
    vehicleSpeed: 1,
    bridgePass: false,
    deadlineBonus: 0,
    processedUpgradeWaves: [],
    hazard: "none",
    lastEvent: "ارسم خطوطًا من مركز الإنقاذ إلى أهداف الخطر",
    upgrades: [],
    emergencyRoute: null,
    pivotalDecision: null,
    radioStrikeApplied: false,
    radioStrikeLosses: 0,
    floodedHarbor: false,
    cliffCollapseAt: 80 + Math.floor(Math.random() * 21),
    cliffCollapsed: false,
    manualDetours: {},
  };
}

export function startGame(state: GameState): GameState {
  return { ...state, phase: "running", lastEvent: "بدأت شبكة الإنقاذ بالعمل" };
}

export function createDemoGame(): GameState {
  let game = startGame(createGame());
  for (const nodeId of ["hospital", "school", "harbor"] as NodeId[]) {
    game = connectNode(game, nodeId).state;
  }
  return { ...game, lastEvent: "وضع العرض: المركبات تتبع خطوط الإنقاذ تلقائيًا" };
}

export function createResultDemo(): GameState {
  const demo = createDemoGame();
  const nodes = demo.nodes.map((node) => {
    if (node.id === "hospital") return { ...node, rescued: node.people, lost: false };
    if (node.id === "school") return { ...node, rescued: node.people, lost: false };
    if (node.id === "harbor") return { ...node, rescued: 10, lost: true };
    if (node.id === "residential") return { ...node, rescued: 12, lost: true };
    return { ...node, rescued: node.people, lost: false };
  });
  return {
    ...demo,
    elapsed: GAME_DURATION,
    phase: "finished",
    battery: 28,
    nodes,
    hazard: "storm",
    pivotalDecision: "hospital",
    lastEvent: "انتهت المهمة بعد العاصفة البحرية",
  };
}

export function createVictoryDemo(): GameState {
  const demo = createDemoGame();
  return {
    ...demo,
    elapsed: 118,
    phase: "finished",
    battery: 36,
    nodes: demo.nodes.map((node) => ({ ...node, rescued: node.people, lost: false })),
    links: [],
    hazard: "storm",
    lastEvent: "وصلت آخر مركبات الإنقاذ إلى النفق — أُخليت الجزيرة بالكامل",
  };
}

export function getWave(state: GameState): number {
  return Math.min(4, Math.floor(state.elapsed / 45) + 1);
}

export function getRemainingTime(state: GameState): number {
  return Math.max(0, GAME_DURATION - state.elapsed);
}

export function getRescuedCount(state: GameState): number {
  return Math.floor(state.nodes.reduce((total, node) => total + node.rescued, 0) + 0.000001);
}

export function getLostCount(state: GameState): number {
  const unrescued = state.nodes.reduce((total, node) => total + node.casualties + (node.lost ? Math.max(0, node.people - node.rescued - node.casualties) : 0), 0);
  return Math.ceil(unrescued - 0.000001);
}

export function getScore(state: GameState): number {
  return Math.max(0, getRescuedCount(state) * 100 + Math.round(state.battery) * 2 + state.links.filter((link) => !link.broken).length * 25 - getLostCount(state) * 75);
}

export function isEmergencyActive(state: GameState): boolean {
  return Boolean(state.emergencyRoute && state.elapsed < state.emergencyRoute.expiresAt);
}

export function getEmergencySecondsLeft(state: GameState): number {
  return state.emergencyRoute ? Math.max(0, Math.ceil(state.emergencyRoute.expiresAt - state.elapsed)) : 0;
}

export function getShareSummary(state: GameState): string {
  const rescued = getRescuedCount(state);
  const total = state.nodes.reduce((sum, node) => sum + node.people, 0);
  const chosen = state.nodes.find((node) => node.id === state.pivotalDecision) ?? [...state.nodes].sort((a, b) => b.rescued - a.rescued || b.priority - a.priority)[0];
  const delayed = state.nodes.find((node) => node.id === "harbor" && node.rescued < node.people) ?? state.nodes.find((node) => node.id !== chosen?.id && node.rescued < node.people);
  const decision = state.pivotalDecision
    ? `فعّلت مسار الطوارئ إلى ${chosen?.label ?? "المنطقة الحرجة"}${delayed ? ` على حساب تأخير ${delayed.label}` : ""}`
    : `أعطيت الأولوية إلى ${chosen?.label ?? "أهداف الإنقاذ"}${delayed ? ` قبل ${delayed.label}` : ""}`;
  const losses = getLostCount(state);
  return `أنقذت ${rescued}/${total}${losses ? ` — فُقد ${losses} مع وصول العاصفة` : " — أُخليت الجزيرة بالكامل"} — انهيار الجسر عند 1:35 — ${decision}.`;
}

export function getNodeStatus(state: GameState, node: RescueNode): "safe" | "warning" | "critical" | "saved" | "lost" {
  if (node.lost) return "lost";
  if (node.rescued >= node.people) return "saved";
  const timeLeft = GAME_DURATION - state.elapsed;
  if (timeLeft <= 20) return "critical";
  if (timeLeft <= 55) return "warning";
  return "safe";
}

export function connectNode(state: GameState, nodeId: NodeId): { state: GameState; message: string } {
  const link = state.links.find((item) => item.nodeId === nodeId);
  const node = state.nodes.find((item) => item.id === nodeId);
  if (!node || node.lost || node.rescued + node.casualties >= node.people) return { state, message: "هذه النقطة لا تحتاج مسارًا جديدًا" };
  if (GAME_DURATION - state.elapsed <= 10) return { state, message: "تبقّى أقل من 10 ثوانٍ — تستمر الرحلات الحالية حتى وصول العاصفة" };
  if (nodeId === "harbor" && state.floodedHarbor && !state.manualDetours.harbor) return { state, message: "مياه الميناء أغلقت الطريق — فعّل التحويل اليدوي عبر المدرسة أولًا" };
  if (nodeId === "residential" && state.cliffCollapsed && !state.manualDetours.residential) return { state, message: "انهار طريق الحي — فعّل التحويل اليدوي عبر الاتصالات أولًا" };
  if (nodeId === "harbor" && state.hazard === "bridge" && !state.bridgePass) {
    return { state, message: "الجسر الشرقي مقطوع — اختر ترقية الجسر الميداني لفتح الميناء" };
  }
  if (link?.broken) {
    return { state, message: "المسار مقطوع — أصلح الجسر الميداني أولًا" };
  }
  if (link) return { state, message: "المسار يعمل بالفعل؛ اضغط على هدف آخر" };
  if (state.links.length >= state.maxLinks) return { state, message: "وصلت إلى الحد الأقصى من الخطوط" };
  if (state.materials < 2) return { state, message: "تحتاج مادتين لإنشاء خط جديد" };
  return {
    state: {
      ...state,
      materials: state.materials - 2,
      links: [...state.links, { id: nodeId, nodeId, broken: false }],
      lastEvent: `تم ربط ${node.label} بالشبكة`,
    },
    message: "خط الإنقاذ نشط" ,
  };
}

export function activateDetour(state: GameState, nodeId: "harbor" | "residential"): GameState {
  const allowed = nodeId === "harbor" ? state.floodedHarbor : state.cliffCollapsed;
  if (!allowed || state.manualDetours[nodeId]) return state;
  const label = nodeId === "harbor" ? "الميناء عبر المدرسة" : "الحي عبر الاتصالات";
  return {
    ...state,
    manualDetours: { ...state.manualDetours, [nodeId]: true },
    links: state.links.map((link) => link.nodeId === nodeId ? { ...link, broken: false, detour: true } : link),
    lastEvent: `فعّلت التحويل اليدوي: ${label} — الطريق البديل أطول`,
  };
}

export function activateEmergencyRoute(state: GameState, nodeId: NodeId): { state: GameState; message: string } {
  const node = state.nodes.find((item) => item.id === nodeId);
  if (state.phase !== "running") return { state, message: "لا يمكن تشغيل مسار الطوارئ الآن" };
  if (!node || node.lost || node.rescued + node.casualties >= node.people) return { state, message: "اختر هدفًا لا يزال يحتاج إنقاذًا" };
  if (isEmergencyActive(state)) return { state, message: "مسار الطوارئ يعمل بالفعل؛ لا يمكن فتح مسار ثانٍ" };
  if (state.battery < 12) return { state, message: "تحتاج 12% بطارية على الأقل لمسار الطوارئ" };
  return {
    state: {
      ...state,
      emergencyRoute: { targetId: nodeId, startedAt: state.elapsed, expiresAt: state.elapsed + EMERGENCY_DURATION },
      pivotalDecision: nodeId,
      lastEvent: `مسار طوارئ إلى ${node.label}: إنقاذ أسرع، بطارية ×2`,
    },
    message: "مسار الطوارئ نشط لمدة 15 ثانية — البطارية تُستهلك بمعدل مضاعف",
  };
}

export function cancelEmergencyRoute(state: GameState): GameState {
  if (!isEmergencyActive(state)) return state;
  return {
    ...state,
    emergencyRoute: null,
    lastEvent: "تم إلغاء مسار الطوارئ — عاد استهلاك البطارية إلى المستوى الطبيعي",
  };
}

export function chooseUpgrade(state: GameState, upgrade: UpgradeId): GameState {
  if (state.phase !== "upgrade") return state;
  const harbor = state.nodes.find((node) => node.id === "harbor");
  const bridgeNeeded = Boolean(harbor && harbor.rescued + harbor.casualties < harbor.people && state.links.some((link) => link.nodeId === "harbor" && link.broken) && !state.bridgePass);
  if (upgrade === "bridge" && !bridgeNeeded) return state;
  const next: GameState = {
    ...state,
    phase: "running",
    upgrades: [...state.upgrades, upgrade],
    lastEvent: "تم تفعيل الترقية",
  };
  if (upgrade === "rapid") next.vehicleSpeed = 1;
  if (upgrade === "bridge") {
    next.bridgePass = true;
    next.links = next.links.map((link) => (link.nodeId === "harbor" ? { ...link, broken: false } : link));
    next.lastEvent = "تم نشر الجسر الميداني — عاد طريق الميناء للعمل ويمكن فتحه لاحقًا";
  }
  if (upgrade === "charge") {
    next.battery = Math.min(100, next.battery + 25);
    next.batteryDrain *= 0.78;
  }
  if (upgrade === "network") next.maxLinks += 1;
  if (upgrade === "crew") next.tripDuration *= 0.82;
  if (upgrade === "capacity") next.ambulanceCapacity += 2;
  if (upgrade === "alert") next.materials += 2;
  return next;
}

export function tickGame(state: GameState, delta: number): GameState {
  if (state.phase !== "running") return state;
  const nextElapsed = Math.min(GAME_DURATION, state.elapsed + delta);
  const bridgeTriggered = nextElapsed >= 95;
  const stormTriggered = nextElapsed >= 120;
  const radioStrikeTriggered = nextElapsed >= 45 && !state.radioStrikeApplied;
  const floodTriggered = nextElapsed >= 110 && !state.floodedHarbor;
  const cliffTriggered = nextElapsed >= state.cliffCollapseAt && !state.cliffCollapsed;
  let links = state.links;
  let lastEvent = state.lastEvent;
  let radioStrikeApplied = state.radioStrikeApplied;
  let radioStrikeLosses = state.radioStrikeLosses;
  let floodedHarbor = state.floodedHarbor;
  let cliffCollapsed = state.cliffCollapsed;
  let startingNodes = state.nodes;
  const harborNeedsEvacuation = state.nodes.some((node) => node.id === "harbor" && node.rescued + node.casualties < node.people);
  const harborRouteActive = state.links.some((link) => link.nodeId === "harbor") && harborNeedsEvacuation;
  const bridgeEventActive = bridgeTriggered && harborRouteActive;

  if (radioStrikeTriggered) {
    radioStrikeApplied = true;
    const radio = state.nodes.find((node) => node.id === "radio");
    const radioIsAmongFirstRoutes = state.links.slice(0, 3).some((link) => link.nodeId === "radio" && !link.broken);
    if (radio && !radioIsAmongFirstRoutes && radio.rescued + radio.casualties < radio.people) {
      radioStrikeLosses = Math.min(1 + (Math.random() < 0.5 ? 0 : 1), radio.people - radio.rescued - radio.casualties);
      startingNodes = state.nodes.map((node) => node.id === "radio" ? { ...node, casualties: node.casualties + radioStrikeLosses } : node);
      lastEvent = `صعقة أصابت محطة الاتصالات — فُقد ${radioStrikeLosses} قبل وصول الإسعاف`;
    } else {
      lastEvent = "صعقة أصابت محطة الاتصالات — المسار المبكر حدّ من الخسائر";
    }
  }
  if (floodTriggered) {
    floodedHarbor = true;
    links = links.map((link) => link.nodeId === "harbor" ? { ...link, broken: true } : link);
    lastEvent = "مياه شديدة قطعت طريق الميناء المباشر — أوقف المسار وفعّل التحويل اليدوي عبر المدرسة";
  }
  if (cliffTriggered) {
    cliffCollapsed = true;
    links = links.map((link) => link.nodeId === "residential" ? { ...link, broken: true } : link);
    lastEvent = "انهار جرف قرب الحي السكني — أوقف المسار وفعّل التحويل اليدوي عبر محطة الاتصالات";
  }

  if (bridgeEventActive && state.hazard === "none") {
    links = state.links.map((link) => (link.nodeId === "harbor" && !state.bridgePass ? { ...link, broken: true } : link));
    lastEvent = "انهار الجسر الشرقي — أصلح المسار أو اختر جسرًا مؤقتًا";
  }
  if (stormTriggered && state.hazard !== "storm") lastEvent = "العاصفة البحرية بدأت — القارب أصبح أبطأ";

  const emergencyRoute = state.emergencyRoute && nextElapsed < state.emergencyRoute.expiresAt ? state.emergencyRoute : null;
  if (state.emergencyRoute && !emergencyRoute && lastEvent === state.lastEvent) lastEvent = "انتهى مسار الطوارئ — عادت البطارية إلى الاستهلاك الطبيعي";
  const activeNodeIds = new Set(links.filter((link) => !link.broken).map((link) => link.nodeId));
  if (emergencyRoute) activeNodeIds.add(emergencyRoute.targetId);
  const tripProgress: Partial<Record<NodeId, number>> = { ...state.tripProgress };
  const completedTrips: string[] = [];
  const nodes = startingNodes.map((node) => {
    if (node.lost || node.rescued + node.casualties >= node.people) return node;
    if (!activeNodeIds.has(node.id) || state.battery <= 0) return node;
    const stormPenalty = stormTriggered && node.id === "harbor" ? 0.75 : 1;
    const floodPenalty = 1;
    const emergencyBoost = emergencyRoute?.targetId === node.id ? 1.75 : 1;
    let progress = (tripProgress[node.id] ?? 0) + delta * state.vehicleSpeed * stormPenalty * floodPenalty * emergencyBoost;
    let rescued = node.rescued;
    // لا تتغير السرعة أو مدة دورة الإنقاذ بسبب التحويل؛ ينعكس طول الطريق فقط في الحركة المرئية للمركبة.
    const detourDuration = state.tripDuration;
    while (progress >= detourDuration && rescued + node.casualties < node.people) {
      progress -= detourDuration;
      const saved = Math.min(state.ambulanceCapacity, node.people - rescued - node.casualties);
      rescued += saved;
      completedTrips.push(`${node.label}: تم إجلاء ${saved}`);
    }
    tripProgress[node.id] = progress;
    return { ...node, rescued };
  });

  const releasedLinks = links.filter((link) => {
    const node = nodes.find((item) => item.id === link.nodeId);
    return Boolean(node && node.rescued + node.casualties < node.people);
  });
  for (const nodeId of Object.keys(tripProgress) as NodeId[]) {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node || node.rescued + node.casualties >= node.people || node.lost) delete tripProgress[nodeId];
  }
  const activeEmergencyRoute = emergencyRoute && nodes.find((node) => node.id === emergencyRoute.targetId && node.rescued + node.casualties < node.people) ? emergencyRoute : null;
  if (emergencyRoute && !activeEmergencyRoute) lastEvent = "اكتمل الإخلاء عبر مسار الطوارئ — تم إيقافه تلقائيًا";
  const activeLinks = releasedLinks.filter((link) => !link.broken).length;
  const emergencyLoad = activeEmergencyRoute ? 1 : 0;
  const drainMultiplier = activeEmergencyRoute ? EMERGENCY_BATTERY_MULTIPLIER : 1;
  const battery = Math.max(0, state.battery - delta * (activeLinks + emergencyLoad) * state.batteryDrain * drainMultiplier);
  const allResolved = nodes.every((node) => node.rescued + node.casualties >= node.people);
  const currentWave = Math.min(4, Math.floor(nextElapsed / 45) + 1);
  const completedWave = Math.min(3, currentWave - 1);
  const shouldUpgrade = !allResolved && completedWave > 0 && !state.processedUpgradeWaves.includes(completedWave);
  const needsBridgeRepair = bridgeEventActive && state.hazard === "none" && links.some((link) => link.nodeId === "harbor" && link.broken);
  const reachedLandfall = nextElapsed >= GAME_DURATION;
  const finalNodes = reachedLandfall
    ? nodes.map((node) => (node.rescued + node.casualties < node.people ? { ...node, lost: true } : node))
    : nodes;
  if (reachedLandfall) lastEvent = "وصلت العاصفة إلى الجزيرة — فُقد كل من لم يصل إلى الإخلاء";
  if (allResolved) lastEvent = radioStrikeLosses > 0 ? "أُخلي جميع من بقي — سُجلت خسائر صعقة الاتصالات وعُرضت النتيجة" : "تم إخلاء جميع الأشخاص — توقفت شبكة الإنقاذ وعُرضت النتيجة";
  if (!reachedLandfall && !allResolved && completedTrips.length) lastEvent = completedTrips[completedTrips.length - 1];
  const phase: GamePhase = reachedLandfall || allResolved ? "finished" : needsBridgeRepair || shouldUpgrade ? "upgrade" : "running";
  const processedUpgradeWaves = shouldUpgrade ? [...state.processedUpgradeWaves, completedWave] : state.processedUpgradeWaves;

  return {
    ...state,
    elapsed: nextElapsed,
    nodes: finalNodes,
    links: allResolved ? [] : releasedLinks,
    battery,
    hazard: stormTriggered ? "storm" : bridgeEventActive ? "bridge" : cliffCollapsed ? "cliff" : "none",
    lastEvent,
    emergencyRoute: activeEmergencyRoute,
    tripProgress,
    phase,
    processedUpgradeWaves,
    radioStrikeApplied,
    radioStrikeLosses,
    floodedHarbor,
    cliffCollapsed,
  };
}
