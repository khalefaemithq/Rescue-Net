/** اتجاه التصميم: الخريطة الساحلية الأصلية هي المصدر البصري لبنية كل مرحلة، ولا تستبدل بتضاريس مجردة. */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import "@/map-controls.css";
import { BatteryCharging, Copy, FastForward, Info, Pause, Play, RotateCcw, ShieldAlert, UsersRound, Volume2, VolumeX, Wrench, Zap, ZoomIn, ZoomOut } from "lucide-react";
import {
  activateEmergencyRoute,
  activateDetour,
  cancelEmergencyRoute,
  UPGRADE_OPTIONS,
  chooseUpgrade,
  connectNode,
  createDemoGame,
  createGame,
  createResultDemo,
  createVictoryDemo,
  getNodeStatus,
  getEmergencySecondsLeft,
  getLostCount,
  getRemainingTime,
  getRescuedCount,
  getRainDensityMultiplier,
  getRoadRoute,
  getScore,
  getShareSummary,
  isEmergencyActive,
  startGame,
  tickGame,
  type NodeId,
} from "@/game/engine";
import { getStormIntensityForStage, getStormStage, getStormVolumeForStage, getThunderCue, getThunderIntervalForStage, REAL_AUDIO_ASSETS, RescueAudio, type RescueSound } from "@/game/audio";
import type { StageId } from "@/game/stages";

const HQ = { x: 555, y: 360 };
const FRAME_INTERVAL_MS = 1000 / 30;
const MAP_WORLD_WIDTH = 1000;
const MAP_WORLD_HEIGHT = 640;
const MIN_MAP_ZOOM = 1;
const DEFAULT_MAP_ZOOM = typeof window !== "undefined" && window.innerWidth <= 620 ? 2.58 : 1;
const MAX_MAP_ZOOM = 2.78;
const MAP_ZOOM_STEP = 0.28;
const EVACUATION_TUNNEL = "/manus-storage/rescue-evacuation-tunnel_6c38a21a.png";
const ISLAND_CITY_ART = "/manus-storage/coastal-original-map_d020a7e1.webp";
const AMBULANCE_PREMIUM = "/manus-storage/rescue-ambulance-premium_95925d8d.png";
const LIGHTNING_ARTS = ["/manus-storage/rescue-lightning-calinou-alpha_5b2e083f.webp"] as const;
const TARGET_ASSETS: Partial<Record<NodeId, string>> = {
  residential: "/manus-storage/rescue-residential-premium_558c6ecc.png",
  hospital: "/manus-storage/medical-target-sprite_b2e59a2f.png",
  school: "/manus-storage/school-target-sprite_9f30f792.png",
  harbor: "/manus-storage/harbor-target-sprite_d14d3173.png",
  radio: "/manus-storage/rescue-radio-premium_bf67c256.png",
};
const PRELOAD_IMAGE_ASSETS = [EVACUATION_TUNNEL, ISLAND_CITY_ART, AMBULANCE_PREMIUM, ...LIGHTNING_ARTS, ...Object.values(TARGET_ASSETS)];
const PRELOAD_AUDIO_ASSETS = Object.values(REAL_AUDIO_ASSETS);
const PRELOAD_ASSET_COUNT = PRELOAD_IMAGE_ASSETS.length + PRELOAD_AUDIO_ASSETS.length;
const NORMAL_ROUTE_RATE = 2.3;
const SECONDARY_ROUTE_RATE = 1.15;
const LIGHTNING_VARIANTS = [
  { x: 150, y: 18, width: 118, height: 306, art: 0, flash: 0.32 },
  { x: 358, y: 12, width: 132, height: 354, art: 0, flash: 0.64 },
  { x: 708, y: 0, width: 148, height: 396, art: 0, flash: 0.94 },
  { x: 512, y: 28, width: 106, height: 278, art: 0, flash: 0.28 },
  { x: 470, y: 0, width: 156, height: 418, art: 0, flash: 1.12, double: { x: 94, y: 8, width: 96, height: 254, art: 0 } },
  { x: 850, y: 16, width: 126, height: 338, art: 0, flash: 0.56 },
  { x: 274, y: 8, width: 144, height: 382, art: 0, flash: 0.72 },
  { x: 586, y: 32, width: 96, height: 248, art: 0, flash: 0.26 },
  { x: 770, y: 0, width: 162, height: 426, art: 0, flash: 1.24, double: { x: -96, y: 8, width: 102, height: 270, art: 0 } },
  { x: 426, y: 12, width: 132, height: 354, art: 0, flash: 0.62 },
] as const;
const RAIN_DROPS = Array.from({ length: 128 }, (_, index) => ({ x: ((index * 67) % 1060) - 30, y: ((index * 113) % 480) + 125, length: 11 + (index % 5) * 5, drift: 12 + (index % 4) * 4, travel: 138 + (index % 6) * 11, duration: 0.62 + (index % 7) * 0.1, delay: -((index % 11) * 0.12) }));

function formatTime(value: number) {
  const seconds = Math.ceil(value);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function pathFromRoad(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function getMapViewSize(zoom: number) {
  return { width: MAP_WORLD_WIDTH / zoom, height: MAP_WORLD_HEIGHT / zoom };
}

function clampMapView(view: { x: number; y: number }, zoom: number) {
  const size = getMapViewSize(zoom);
  return {
    x: Math.max(0, Math.min(MAP_WORLD_WIDTH - size.width, view.x)),
    y: Math.max(0, Math.min(MAP_WORLD_HEIGHT - size.height, view.y)),
  };
}

function centeredMapView(zoom: number) {
  const size = getMapViewSize(zoom);
  return clampMapView({ x: HQ.x - size.width / 2, y: HQ.y - size.height / 2 }, zoom);
}

function pointOnRoad(points: { x: number; y: number }[], progress: number) {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return { start, end: point, length: Math.hypot(point.x - start.x, point.y - start.y) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length ? remaining / segment.length : 0;
      return { x: segment.start.x + (segment.end.x - segment.start.x) * ratio, y: segment.start.y + (segment.end.y - segment.start.y) * ratio, angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x) * 180 / Math.PI };
    }
    remaining -= segment.length;
  }
  const last = segments[segments.length - 1];
  return { x: last.end.x, y: last.end.y, angle: Math.atan2(last.end.y - last.start.y, last.end.x - last.start.x) * 180 / Math.PI };
}


export default function CoastalMission({ onChooseStage }: { onChooseStage: (stage: StageId) => void }) {
  const showRoadDebug = new URLSearchParams(window.location.search).has("roads");
  const [game, setGame] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const roadTarget = params.get("road");
    if (roadTarget && ["residential", "hospital", "school", "harbor", "radio"].includes(roadTarget)) {
      return connectNode(startGame(createGame()), roadTarget as NodeId).state;
    }
    if (params.has("win")) return createVictoryDemo();
    if (params.has("result")) return createResultDemo();
    if (params.has("strike")) return tickGame({ ...createDemoGame(), elapsed: 44 }, 1);
    if (params.has("bridge")) {
      const collapsed = tickGame({ ...createDemoGame(), elapsed: 94 }, 2);
      return chooseUpgrade(collapsed, "bridge");
    }
    if (params.has("flood")) {
      const collapsed = tickGame({ ...createDemoGame(), elapsed: 94, cliffCollapseAt: 999 }, 2);
      const repaired = chooseUpgrade(collapsed, "bridge");
      return tickGame({ ...repaired, elapsed: 109, processedUpgradeWaves: [1, 2] }, 1);
    }
    if (params.has("cliff")) {
      let demo = startGame(createGame());
      demo = connectNode(demo, "residential").state;
      demo = connectNode(demo, "radio").state;
      return tickGame({ ...demo, elapsed: 79, cliffCollapseAt: 80, tripDuration: 20, processedUpgradeWaves: [1] }, 1);
    }
    if (params.has("storm")) {
      const demo = createDemoGame();
      return { ...demo, elapsed: 126, hazard: "storm" as const, processedUpgradeWaves: [1, 2], lastEvent: "عاصفة قوية تضرب الساحل — استمر في الإخلاء" };
    }
    return params.has("demo") ? createDemoGame() : createGame();
  });
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState("اضغط مبنى خطر لفتح مسار إنقاذ، واسحب الخريطة لاستكشاف الجزيرة");
  const [drawing, setDrawing] = useState(false);
  const [preview, setPreview] = useState({ x: HQ.x, y: HQ.y });
  const [compactMap, setCompactMap] = useState(() => window.innerWidth <= 620);
  const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [assetFailure, setAssetFailure] = useState<string | null>(null);
  const [assetAttempt, setAssetAttempt] = useState(0);
  const drawingRef = useRef(false);
  const panRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef({ active: false, distance: 0, zoom: DEFAULT_MAP_ZOOM, view: centeredMapView(DEFAULT_MAP_ZOOM), size: getMapViewSize(DEFAULT_MAP_ZOOM), centerX: 0, centerY: 0 });
  const audioRef = useRef<RescueAudio | null>(null);
  const thunderCueRef = useRef(-1);
  const lightningCueRef = useRef(-1);
  const forcedLightningRef = useRef(new URLSearchParams(window.location.search).has("flash"));
  const suppressLightningRef = useRef(new URLSearchParams(window.location.search).has("cliff"));
  const forcedRadioStrikeRef = useRef(new URLSearchParams(window.location.search).has("strike"));
  const [lightningCue, setLightningCue] = useState<number | null>(() => {
    const flash = new URLSearchParams(window.location.search).get("flash");
    return flash === null ? null : Number.isFinite(Number(flash)) ? Number(flash) : 0;
  });
  const radioStrikeRef = useRef(false);
  const [radioStrikeVisible, setRadioStrikeVisible] = useState(false);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [mapView, setMapView] = useState(() => centeredMapView(DEFAULT_MAP_ZOOM));
  const [detourTarget, setDetourTarget] = useState<"harbor" | "residential" | null>(null);
  const [detourVia, setDetourVia] = useState<"school" | "radio" | null>(null);

  const playSound = (sound: RescueSound) => {
    if (!soundOn) return;
    audioRef.current ??= new RescueAudio();
    audioRef.current.play(sound);
  };

  const requestLandscape = () => {
    const orientation = window.screen.orientation as ScreenOrientation & { lock?: (mode: "landscape") => Promise<void> };
    orientation?.lock?.("landscape").catch(() => undefined);
  };

  useEffect(() => {
    let animationFrame = 0;
    let previousTime = performance.now();
    let accumulated = 0;
    const update = (now: number) => {
      accumulated += Math.min(100, now - previousTime);
      previousTime = now;
      while (accumulated >= FRAME_INTERVAL_MS) {
        setGame((current) => tickGame(current, (FRAME_INTERVAL_MS / 1000) * speed));
        accumulated -= FRAME_INTERVAL_MS;
      }
      animationFrame = requestAnimationFrame(update);
    };
    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [speed]);

  useEffect(() => {
    const updateViewport = () => {
      setCompactMap(window.innerWidth <= 620);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    requestLandscape();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    let cancelled = false;
    setAssetsReady(false);
    setAssetFailure(null);
    setLoadingProgress(0);
    let completed = 0;
    const markComplete = () => {
      completed += 1;
      if (!cancelled) setLoadingProgress(Math.round((completed / PRELOAD_ASSET_COUNT) * 100));
    };
    const preloadImage = (url: string) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        try {
          await image.decode();
          markComplete();
          resolve();
        } catch {
          reject(new Error(url));
        }
      };
      image.onerror = () => reject(new Error(url));
      image.src = url;
    });
    const preloadAudio = (url: string) => new Promise<void>((resolve) => {
      const audio = new Audio();
      audio.preload = "auto";
      let settled = false;
      const ready = () => {
        if (settled) return;
        settled = true;
        audio.oncanplaythrough = null;
        audio.onloadeddata = null;
        audio.onerror = null;
        markComplete();
        resolve();
      };
      audio.oncanplaythrough = ready;
      audio.onloadeddata = ready;
      audio.onerror = ready;
      audio.src = url;
      audio.load();
      window.setTimeout(ready, 1800);
    });
    Promise.all([...PRELOAD_IMAGE_ASSETS.map(preloadImage), ...PRELOAD_AUDIO_ASSETS.map(preloadAudio)])
      .then(() => !cancelled && setAssetsReady(true))
      .catch((error: Error) => !cancelled && setAssetFailure(error.message));
    return () => { cancelled = true; };
  }, [assetAttempt]);

  useEffect(() => {
    const activeVehicles = game.links.some((link) => !link.broken) || isEmergencyActive(game);
    if (!soundOn) {
      audioRef.current?.setAmbulanceActive(false);
      return;
    }
    audioRef.current ??= new RescueAudio();
    audioRef.current.setAmbulanceActive(game.phase === "running" && activeVehicles);
  }, [game.links, game.phase, game.emergencyRoute, soundOn]);

  const rescued = getRescuedCount(game);
  const totalPeople = game.nodes.reduce((sum, node) => sum + node.people, 0);
  const remaining = getRemainingTime(game);
  const bridgeUpgradeRequired = game.links.some((link) => link.nodeId === "harbor" && link.broken) && !game.bridgePass;
  const availableUpgrades = useMemo(
    () => bridgeUpgradeRequired
      ? UPGRADE_OPTIONS.filter((upgrade) => upgrade.id === "bridge")
      : UPGRADE_OPTIONS.filter((upgrade) => upgrade.id !== "bridge" && !game.upgrades.includes(upgrade.id)).slice(0, 3),
    [bridgeUpgradeRequired, game.upgrades],
  );

  const start = () => {
    if (!assetsReady || assetFailure) return;
    requestLandscape();
    audioRef.current ??= new RescueAudio();
    audioRef.current.unlock();
    audioRef.current.startStormImmediately();
    setGame((current) => startGame(current));
    setNotice("اضغط أي نقطة خطر لإنشاء خط إنقاذ بتكلفة مادتين، واسحب الخريطة للتنقل");
    playSound("start");
  };

  const handleNode = (nodeId: NodeId) => {
    if (game.phase !== "running" || !assetsReady) return;
    const needsManualDetour = (nodeId === "harbor" && game.floodedHarbor && !game.manualDetours.harbor) || (nodeId === "residential" && cliffCollapsed && !game.manualDetours.residential);
    if (needsManualDetour) {
      setDetourTarget(nodeId);
      setDetourVia(null);
      setNotice(nodeId === "harbor" ? "طريق الميناء مقطوع: اضغط المدرسة، ثم نفق الإخلاء" : "طريق الحي مقطوع: اضغط محطة الاتصالات، ثم نفق الإخلاء");
      playSound("tap");
      return;
    }
    if (detourTarget) {
      const expectedVia = detourTarget === "harbor" ? "school" : "radio";
      if (nodeId === expectedVia) {
        setDetourVia(expectedVia);
        setNotice(`تم اختيار ${expectedVia === "school" ? "المدرسة" : "محطة الاتصالات"} كنقطة عبور — اضغط نفق الإخلاء لتأكيد المسار`);
        playSound("tap");
      } else {
        setNotice(`اختر ${expectedVia === "school" ? "المدرسة" : "محطة الاتصالات"} أولًا لإكمال التحويل`);
      }
      return;
    }
    if (emergencyMode) {
      const result = activateEmergencyRoute(game, nodeId);
      setGame(result.state);
      setEmergencyMode(false);
      setNotice(result.message);
      playSound("emergency");
      return;
    }
    const result = connectNode(game, nodeId);
    setGame(result.state);
    setNotice(result.message);
    if (result.state !== game) playSound("connect");
  };

  const pointerToMap = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: HQ.x, y: HQ.y };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  };

  const beginDrawing = (event: ReactPointerEvent<SVGGElement>) => {
    if (game.phase !== "running" || !assetsReady) return;
    if (detourTarget && detourVia) return;
    event.stopPropagation();
    drawingRef.current = true;
    setDrawing(true);
    setPreview({ x: HQ.x, y: HQ.y });
    setNotice("اسحب الخط إلى دائرة هدف مضيئة ثم ارفع إصبعك");
  };

  const finishDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return;
    const point = pointerToMap(event);
    const target = game.nodes.find((node) => Math.hypot(node.x - point.x, node.y - point.y) < 74);
    drawingRef.current = false;
    setDrawing(false);
    if (target) handleNode(target.id);
    else setNotice("أفلت الخط فوق دائرة هدف لإنشاء وصلة");
  };

  const selectUpgrade = (id: (typeof UPGRADE_OPTIONS)[number]["id"]) => {
    setGame((current) => chooseUpgrade(current, id));
    setNotice(id === "bridge" ? "تم نشر الجسر المؤقت — عاد طريق الميناء للعمل" : "تمت الترقية — استمر في إعادة توجيه شبكة الإنقاذ");
    playSound("upgrade");
  };

  const enableDetour = (nodeId: "harbor" | "residential") => {
    setGame((current) => activateDetour(current, nodeId));
    setDetourTarget(null);
    setDetourVia(null);
    setNotice(nodeId === "harbor" ? "تم التحويل يدويًا عبر المدرسة — المسافة أطول" : "تم التحويل يدويًا عبر الاتصالات — المركبة تتجنب الجرف والمسافة أطول");
    playSound("tap");
  };

  const confirmManualDetour = () => {
    if (!detourTarget || !detourVia) return;
    const expectedVia = detourTarget === "harbor" ? "school" : "radio";
    if (detourVia !== expectedVia) return;
    enableDetour(detourTarget);
  };

  const mapViewSize = getMapViewSize(mapZoom);

  const setZoomAround = (nextZoom: number, focus?: { x: number; y: number }) => {
    const clampedZoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, Number(nextZoom.toFixed(2))));
    const nextSize = getMapViewSize(clampedZoom);
    const currentSize = getMapViewSize(mapZoom);
    const focalPoint = focus ?? { x: mapView.x + currentSize.width / 2, y: mapView.y + currentSize.height / 2 };
    const relativeX = currentSize.width ? (focalPoint.x - mapView.x) / currentSize.width : .5;
    const relativeY = currentSize.height ? (focalPoint.y - mapView.y) / currentSize.height : .5;
    setMapZoom(clampedZoom);
    setMapView(clampMapView({ x: focalPoint.x - nextSize.width * relativeX, y: focalPoint.y - nextSize.height * relativeY }, clampedZoom));
  };

  const beginPinch = (svg: SVGSVGElement) => {
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) return;
    const [first, second] = points;
    const box = svg.getBoundingClientRect();
    const centerX = (first.x + second.x) / 2;
    const centerY = (first.y + second.y) / 2;
    const size = getMapViewSize(mapZoom);
    pinchRef.current = { active: true, distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)), zoom: mapZoom, view: mapView, size, centerX: (centerX - box.left) / box.width, centerY: (centerY - box.top) / box.height };
    panRef.current.active = false;
  };

  const handleMapPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingRef.current || (event.target as Element).closest(".target-node, .hq-node")) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      beginPinch(event.currentTarget);
      return;
    }
    panRef.current = { active: true, startX: event.clientX, startY: event.clientY, originX: mapView.x, originY: mapView.y };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable for certain synthetic touch events; movement still uses the SVG handler.
    }
  };

  const handleMapPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingRef.current) {
      setPreview(pointerToMap(event));
      return;
    }
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current.active && pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const scale = Math.hypot(first.x - second.x, first.y - second.y) / pinchRef.current.distance;
      const nextZoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, pinchRef.current.zoom * scale));
      const nextSize = getMapViewSize(nextZoom);
      const focalPoint = { x: pinchRef.current.view.x + pinchRef.current.size.width * pinchRef.current.centerX, y: pinchRef.current.view.y + pinchRef.current.size.height * pinchRef.current.centerY };
      setMapZoom(nextZoom);
      setMapView(clampMapView({ x: focalPoint.x - nextSize.width * pinchRef.current.centerX, y: focalPoint.y - nextSize.height * pinchRef.current.centerY }, nextZoom));
      return;
    }
    if (!panRef.current.active) return;
    const box = event.currentTarget.getBoundingClientRect();
    const nextX = panRef.current.originX - ((event.clientX - panRef.current.startX) / box.width) * mapViewSize.width;
    const nextY = panRef.current.originY - ((event.clientY - panRef.current.startY) / box.height) * mapViewSize.height;
    setMapView(clampMapView({ x: nextX, y: nextY }, mapZoom));
  };

  const finishMapPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingRef.current) {
      finishDrawing(event);
      return;
    }
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current.active = false;
    const remainingPointer = Array.from(pointersRef.current.values())[0];
    if (remainingPointer) panRef.current = { active: true, startX: remainingPointer.x, startY: remainingPointer.y, originX: mapView.x, originY: mapView.y };
    else panRef.current.active = false;
  };

  const restart = () => {
    setGame(createGame());
    setSpeed(1);
    setNotice("جولة جديدة جاهزة — اضغط مبنى خطر لفتح أول خط إنقاذ");
    setEmergencyMode(false);
    setCopied(false);
    setShowDetails(false);
    setMapZoom(DEFAULT_MAP_ZOOM);
    setMapView(centeredMapView(DEFAULT_MAP_ZOOM));
    setDetourTarget(null);
    setDetourVia(null);
    thunderCueRef.current = -1;
    lightningCueRef.current = -1;
    radioStrikeRef.current = false;
    setRadioStrikeVisible(false);
    setLightningCue(null);
    audioRef.current?.setAmbulanceActive(false);
    audioRef.current?.setStormIntensity(0);
  };

  const useEmergencyRoute = () => {
    if (isEmergencyActive(game)) {
      setGame((current) => cancelEmergencyRoute(current));
      setEmergencyMode(false);
      setNotice("تم إلغاء مسار الطوارئ — عادت البطارية إلى الاستهلاك الطبيعي");
      playSound("tap");
      return;
    }
    setEmergencyMode((current) => !current);
    setNotice(emergencyMode ? "تم إلغاء اختيار الطوارئ" : "اختر هدفًا لتشغيل مسار طوارئ لمدة 15 ثانية — بطارية ×2");
    playSound("tap");
  };

  const copyShareSummary = async () => {
    try {
      await navigator.clipboard.writeText(getShareSummary(game));
      setCopied(true);
      setNotice("تم نسخ بطاقة المشاركة");
      playSound("tap");
    } catch {
      setNotice("تعذر النسخ التلقائي؛ يمكنك نسخ النص يدويًا");
    }
  };

  const isRunning = game.phase === "running";
  const cliffCollapsed = game.cliffCollapsed;
  const emergencyActive = isEmergencyActive(game);
  const emergencySeconds = getEmergencySecondsLeft(game);
  const shareSummary = getShareSummary(game);
  const lost = getLostCount(game);
  const stormActive = game.hazard === "storm";
  const weatherActive = game.phase !== "intro" && game.phase !== "finished";
  const finaleActive = game.phase === "finished" && lost === 0;
  const stormStage = game.phase === "intro" ? 0 : getStormStage(game.elapsed);
  const rainMultiplier = game.phase === "intro" ? 0 : getRainDensityMultiplier(game.elapsed);
  const thunderCue = getThunderCue(game.elapsed);

  useEffect(() => {
    if (!soundOn || game.phase === "intro") {
      audioRef.current?.setStormIntensity(0);
      return;
    }
    audioRef.current ??= new RescueAudio();
    audioRef.current.setStormIntensity(getStormIntensityForStage(stormStage));
  }, [game.phase, soundOn, stormStage]);

  useEffect(() => {
    if (!thunderCue || game.phase !== "running" || game.elapsed < thunderCue.thunderAt || thunderCue.index === thunderCueRef.current) return;
    thunderCueRef.current = thunderCue.index;
    if (!soundOn) return;
    audioRef.current ??= new RescueAudio();
    audioRef.current.playThunder(thunderCue.intensity);
  }, [game.elapsed, game.phase, soundOn, thunderCue]);

  useEffect(() => {
    if (forcedLightningRef.current || suppressLightningRef.current || !thunderCue || game.phase === "intro" || game.elapsed < thunderCue.lightningAt || thunderCue.index === lightningCueRef.current) return;
    lightningCueRef.current = thunderCue.index;
    setLightningCue(thunderCue.index);
  }, [game.elapsed, game.phase, thunderCue]);

  useEffect(() => {
    if (!game.radioStrikeApplied || radioStrikeRef.current) return;
    radioStrikeRef.current = true;
    setRadioStrikeVisible(true);
    if (forcedRadioStrikeRef.current) return;
    const timer = window.setTimeout(() => setRadioStrikeVisible(false), 1700);
    return () => window.clearTimeout(timer);
  }, [game.radioStrikeApplied]);

  return (
    <main className={`game-shell landscape-shell ${isLandscape ? "is-landscape" : "is-portrait"}`} dir="rtl" data-phase={game.phase} data-storm-stage={stormStage} data-storm-volume={getStormVolumeForStage(stormStage)} data-thunder-interval={getThunderIntervalForStage(stormStage)} data-forced-lightning={forcedLightningRef.current ? "true" : undefined} data-forced-radio-strike={forcedRadioStrikeRef.current ? "true" : undefined} data-real-audio="cc0">
      <section className="orientation-gate" aria-live="polite"><span>↻</span><strong>دوّر الجهاز أفقيًا</strong><small>تعمل شبكة الإنقاذ في وضع Landscape فقط.</small></section>
      <section className="game-frame" aria-label="لعبة شبكة الإنقاذ">
        <nav className="stage-switcher" aria-label="اختيار المرحلة"><button className="selected" onClick={() => onChooseStage("coast")}>01 الساحل</button><button onClick={() => onChooseStage("volcano")}>02 البركان</button><button onClick={() => onChooseStage("snow")}>03 الثلوج</button></nav>
        <header className="game-header">
          <div className="time-readout">
            <span>العاصفة تصل خلال</span>
            <strong>{formatTime(remaining)}</strong>
          </div>
        </header>

        {game.phase === "intro" && <aside className="reference-instruction-panel"><span>مهمة اليوم</span><h2>اجعل الطرق تصل قبل أن يصل الخطر</h2><p>اسحب الخريطة لرؤية الأحياء، ثم اضغط مبنى خطر لإطلاق مركبة. كل رحلة ذهاب وإياب تُجلي أشخاصًا إلى النفق، واستخدم «مسار طوارئ» لدفعة أسرع تستهلك البطارية ×2.</p><button className="primary-action" onClick={start} disabled={!assetsReady || Boolean(assetFailure)}><Play size={18} fill="currentColor" /> {assetFailure ? "تعذر تحميل أصل" : assetsReady ? "ابدأ المهمة" : "يتم تجهيز المدينة"}</button></aside>}

        <section className="status-row" aria-label="مؤشرات المهمة">
          <StatusChip icon={<BatteryCharging size={17} />} label="البطارية" value={`${Math.round(game.battery)}%`} tone="cyan" />
          <StatusChip icon={<UsersRound size={17} />} label="تم إنقاذهم" value={`${rescued} / ${totalPeople}`} tone="light" />
        </section>

        <section className="playfield">
          <svg className={`rescue-map ${stormActive ? "storm-active" : ""} ${weatherActive ? "weather-active" : ""} ${game.phase === "finished" ? "storm-landfall" : ""} ${finaleActive ? "mission-complete" : ""}`} viewBox={`${mapView.x} ${mapView.y} ${mapViewSize.width} ${mapViewSize.height}`} preserveAspectRatio="xMidYMid slice" data-map-zoom={mapZoom.toFixed(2)} data-map-default-zoom={DEFAULT_MAP_ZOOM} data-map-view={`${mapView.x},${mapView.y}`} role="img" aria-label="خريطة تفاعلية قابلة للتكبير لمدينة ساحلية أثناء عاصفة" onPointerDown={handleMapPointerDown} onPointerMove={handleMapPointerMove} onPointerUp={finishMapPointer} onPointerCancel={(event) => { pointersRef.current.delete(event.pointerId); drawingRef.current = false; setDrawing(false); panRef.current.active = false; pinchRef.current.active = false; }}>
            <defs>
              <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#101b31" />
                <stop offset="55%" stopColor="#273b61" />
                <stop offset="100%" stopColor="#8a5864" />
              </linearGradient>
              <radialGradient id="sea" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#1d5772" />
                <stop offset="100%" stopColor="#0c2139" />
              </radialGradient>
              <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="lightningGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feFlood floodColor="#d9f8ff" floodOpacity=".92" result="tint" /><feComposite in="tint" in2="blur" operator="in" result="glow" /><feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <clipPath id="rain-map-bounds"><rect x="0" y="118" width="1000" height="522" /></clipPath>
            </defs>
            <rect width="1000" height="640" fill="url(#sky)" />
            <path d="M0 185 H1000 V640 H0Z" fill="url(#sea)" />
            <image className="island-city-art" href={ISLAND_CITY_ART} x="0" y="0" width="1000" height="640" preserveAspectRatio="xMidYMid slice" pointerEvents="none" />
            {weatherActive && <Rainfall multiplier={rainMultiplier} />}
            {stormActive && <g className="storm-scene" aria-hidden="true"><path className="storm-water" d="M605 538 q34 -18 68 0t68 0t68 0t68 0t68 0t68 0" /></g>}
            {lightningCue !== null && <LightningStrike key={`lightning-${lightningCue}`} cue={lightningCue} stage={stormStage} />}
            {radioStrikeVisible && <RadioStrike losses={game.radioStrikeLosses} />}
            {showRoadDebug && <g data-road-debug="visible" pointerEvents="none">{game.links.map((link) => <polyline key={`debug-${link.id}`} points={getRoadRoute(game, link.nodeId).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#fff4a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".92" />)}</g>}
            <g className="network-layer">
              {game.links.map((link, index) => {
                const node = game.nodes.find((item) => item.id === link.nodeId);
                if (!node) return null;
                const road = getRoadRoute(game, link.nodeId);
                // الطرق الأساسية تحتفظ بمعدلها الطبيعي؛ التحويلان فقط أبطأ، ومعدلهما ثابت طوال الرحلة.
                const isSecondaryRoute = link.detour || (link.nodeId === "residential" && cliffCollapsed);
                const travelRate = isSecondaryRoute ? SECONDARY_ROUTE_RATE : NORMAL_ROUTE_RATE;
                const travelPhase = (game.elapsed * travelRate + index * 1.7) % 2;
                const outbound = travelPhase <= 1;
                const vehicle = pointOnRoad(road, outbound ? travelPhase : 2 - travelPhase);
                const angle = vehicle.angle + (outbound ? 0 : 180);
                return (
                  <g key={link.id} data-road-route={link.nodeId} data-road-waypoints={road.length} data-vehicle-rate={travelRate} data-detour={link.detour ? "school" : undefined} data-cliff-detour={link.nodeId === "residential" && cliffCollapsed ? "radio" : undefined}>
                    {!link.broken && <g transform={`translate(${vehicle.x} ${vehicle.y}) rotate(${angle})`}><AmbulanceSprite /></g>}
                  </g>
                );
              })}
            </g>
            {finaleActive && <g className="evacuation-finale" pointerEvents="none"><circle cx={HQ.x} cy={HQ.y} r="104" className="finale-ring outer" /><circle cx={HQ.x} cy={HQ.y} r="76" className="finale-ring inner" />{game.nodes.map((node, index) => <circle key={`evacuee-${node.id}`} r="6" className="evacuee-dot"><animateMotion dur={`${1.45 + index * 0.12}s`} begin={`${index * 0.14}s`} repeatCount="indefinite" path={`M ${node.x} ${node.y} L ${HQ.x} ${HQ.y}`} /></circle>)}</g>}
            <g className={`hq-node ${detourTarget && detourVia ? "detour-confirm" : ""}`} filter="url(#glow)" onPointerDown={beginDrawing} onClick={confirmManualDetour} role="button" tabIndex={0}>
              <circle cx={HQ.x} cy={HQ.y} r="62" fill="#15455c" stroke="#ffcf82" strokeWidth="5" />
              <image href={EVACUATION_TUNNEL} x="493" y="298" width="124" height="124" preserveAspectRatio="xMidYMid meet" pointerEvents="none" />
              <circle cx={555} cy={429} r="5" fill="#ffd077" />
            </g>
            {game.nodes.map((node) => {
              const status = getNodeStatus(game, node);
              const expectedVia = detourTarget === "harbor" ? "school" : "radio";
              const statusClass = `target-node ${status} ${emergencyActive && game.emergencyRoute?.targetId === node.id ? "emergency-active" : ""} ${detourTarget && node.id === expectedVia ? "detour-via-target" : ""}`;
              const value = Math.max(0, Math.ceil(node.people - node.rescued - node.casualties));
              return (
                <g key={node.id} className={statusClass} data-node-id={node.id} onClick={() => !drawingRef.current && handleNode(node.id)} role="button" tabIndex={0}>
                  <ellipse cx={node.x} cy={node.y + 30} rx="44" ry="10" className="target-ground" />
                  <circle cx={node.x} cy={node.y} r="39" className="target-halo" />
                  <circle cx={node.x} cy={node.y} r="31" className="target-core" />
                  {TARGET_ASSETS[node.id] && <image className="target-sprite" href={TARGET_ASSETS[node.id]} x={node.x - 48} y={node.y - 50} width="96" height="96" preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
                  <g className="target-count-badge" transform={`translate(${node.x} ${node.y - 106})`} pointerEvents="none"><circle r="17" /><text y="6" textAnchor="middle">{node.lost ? "!" : value}</text></g>
                  {node.casualties > 0 && <text x={node.x + 32} y={node.y - 100} className="casualty-note" pointerEvents="none">−{node.casualties}</text>}
                  <rect x={node.x - 74} y={node.y - 88} width="148" height="24" rx="9" className="map-label-bg" />
                  <text x={node.x} y={node.y - 71} textAnchor="middle" className="map-label">{node.label}</text>
                </g>
              );
            })}
            {game.phase === "finished" && <rect className="landfall-veil" width="1000" height="640" fill="#10223d" opacity={lost ? ".52" : ".26"} pointerEvents="none" />}
          </svg>

          {stormActive && <div className={`storm-banner ${game.phase === "finished" ? "landfall" : ""}`}><Zap size={15} /> {game.phase === "finished" ? `وصلت العاصفة: فُقد ${lost} من السكان` : "العاصفة تقترب — أكمل الإخلاء قبل الوصول"}</div>}
          {(game.floodedHarbor && !game.manualDetours.harbor) || (cliffCollapsed && !game.manualDetours.residential) ? <aside className="detour-panel" aria-label="تحويل المسارات" data-detour-guide="active"><strong>طريق مقطوع — ارسم التحويل بنفسك</strong><ol><li className={!detourTarget ? "active" : "done"}>اضغط المبنى المقطوع</li><li className={detourTarget && !detourVia ? "active" : detourVia ? "done" : ""}>اضغط {detourTarget === "residential" || (!detourTarget && cliffCollapsed) ? "محطة الاتصالات" : "المدرسة"}</li><li className={detourVia ? "active" : ""}>اضغط نفق الإخلاء لتأكيد الطريق</li></ol>{detourTarget && <button className="detour-cancel" onClick={() => { setDetourTarget(null); setDetourVia(null); setNotice("اختر المبنى المقطوع لبدء التحويل اليدوي"); }}>إلغاء الاختيار</button>}</aside> : null}
          {game.phase === "running" && <div className="map-notice" aria-live="polite">{notice}</div>}

          <div className="details-dock">
            <button className="event-toggle" onClick={() => setShowDetails((current) => !current)} aria-expanded={showDetails}><Info size={16} /> {showDetails ? "إخفاء التفاصيل" : "تفاصيل المهمة"}</button>
            {showDetails && <aside className="event-card" aria-live="polite"><ShieldAlert size={18} /><div><span>آخر تحديث</span><strong>{game.lastEvent}</strong><small>خط عادي: مادتان · الطوارئ: بطارية ×2</small><small>الصوت: تسجيل إسعاف ميداني، مطر ورياح، ورعد يتكثف تدريجيًا. زر «الصوت» يكتمها.</small></div></aside>}
          </div>

          <div className="map-zoom-controls" aria-label="تكبير وتصغير الخريطة">
            <button type="button" data-map-zoom-control="in" onClick={() => setZoomAround(mapZoom + MAP_ZOOM_STEP)} disabled={mapZoom >= MAX_MAP_ZOOM}><ZoomIn size={17} /><span>تكبير</span></button>
            <button type="button" data-map-zoom-control="out" onClick={() => setZoomAround(mapZoom - MAP_ZOOM_STEP)} disabled={mapZoom <= MIN_MAP_ZOOM}><ZoomOut size={17} /><span>تصغير</span></button>
          </div>

          {game.phase === "upgrade" && (
            <section className="upgrade-panel" aria-label="اختر ترقية">
              <div className="panel-title"><span>{bridgeUpgradeRequired ? "انهيار الجسر" : "اختَر ترقية"}</span><small>{bridgeUpgradeRequired ? "طريق الميناء متوقف — أصلحه الآن" : "توقفت المحاكاة حتى تقرر"}</small></div>
              {availableUpgrades.map((upgrade) => (
                <button key={upgrade.id} className="upgrade-card" onClick={() => selectUpgrade(upgrade.id)}>
                  <b>{upgrade.icon}</b><span><strong>{upgrade.title}</strong><small>{upgrade.description}</small></span>
                </button>
              ))}
            </section>
          )}

          {game.phase === "intro" && (
            <section className="intro-card">
              <span className="intro-kicker">مهمة اليوم</span>
              <h2>اجعل الطرق تصل قبل أن يصل الخطر</h2>
              <p>اسحب الخريطة لرؤية الأحياء، ثم اضغط مبنى خطر لإطلاق مركبة. كل رحلة ذهاب وإياب تُجلي أشخاصًا إلى النفق، واستخدم «مسار طوارئ» لدفعة أسرع تستهلك البطارية ×2.</p>
              <button className="primary-action" onClick={start} disabled={!assetsReady || Boolean(assetFailure)}><Play size={18} fill="currentColor" /> {assetFailure ? "تعذر تحميل أصل" : assetsReady ? "ابدأ المهمة" : "يتم تجهيز المدينة"}</button>
            </section>
          )}

          {!assetsReady && <section className="asset-loader" aria-live="polite" aria-label={assetFailure ? "تعذر تحميل الأصول" : "جار التحميل"}>{assetFailure ? <button type="button" className="asset-retry" onClick={() => setAssetAttempt((attempt) => attempt + 1)}>إعادة المحاولة</button> : <><strong>{loadingProgress}%</strong><div><i style={{ width: `${loadingProgress}%` }} /></div></>}</section>}

          {game.phase === "finished" && (
            <section className="intro-card results-card">
              <span className="intro-kicker">اكتملت المهمة</span>
              <h2>{finaleActive ? "إخلاء ناجح" : rescued >= 15 ? "شبكة صامدة" : "المدينة تحتاج خطة أفضل"}</h2>
              {finaleActive && <p className="finale-copy">وصلت آخر مركبات الإنقاذ إلى النفق. أُخليت الجزيرة قبل وصول العاصفة.</p>}
              {finaleActive && <svg className="finale-journey" viewBox="0 0 240 46" role="img" aria-label="مركبات الإنقاذ تصل إلى نفق الإخلاء"><path d="M13 24 H190" className="finale-route" /><g className="finale-mini-ambulance"><rect x="-10" y="-7" width="20" height="13" rx="3" fill="#f8fbfb" stroke="#18364c" strokeWidth="2" /><path d="M-7 -1 H8" stroke="#e43c45" strokeWidth="4" /><circle cx="-5" cy="7" r="3" fill="#1a2938" /><circle cx="6" cy="7" r="3" fill="#1a2938" /><animateMotion dur="1.8s" repeatCount="indefinite" path="M 14 24 H 181" /></g><g transform="translate(204 7)" className="finale-tunnel-icon"><path d="M0 32 V12 Q16 -2 32 12 V32Z" fill="#1a5364" stroke="#9cfff0" strokeWidth="2" /><path d="M8 32 V16 Q16 8 24 16 V32" fill="#071d31" /><path d="M13 24 H19" stroke="#ffd37d" strokeWidth="3" strokeLinecap="round" /></g></svg>}
              {!finaleActive && lost > 0 && <LossJourney lost={lost} />}
              <div className="result-grid"><span><b>{rescued}</b>تم إنقاذهم</span><span className={lost ? "loss-stat" : "success-stat"}><b>{lost}</b>{lost ? "فُقدوا مع العاصفة" : "أُخليت الجزيرة"}</span><span><b>{getScore(game)}</b>نقطة المهمة</span></div>
              <blockquote className="share-card"><span>بطاقة المهمة</span><p>{shareSummary}</p><button className="copy-share" onClick={copyShareSummary}><Copy size={15} /> {copied ? "تم النسخ" : "انسخ البطاقة"}</button></blockquote>
              <button className="primary-action" onClick={restart}><RotateCcw size={18} /> أعد المهمة</button>
            </section>
          )}
        </section>

        <footer className="control-dock reference-controls">
          <p>{notice}</p>
          <div className="controls">
            <button className={emergencyMode || emergencyActive ? "control emergency active" : "control emergency"} onClick={useEmergencyRoute} disabled={!isRunning} aria-label={emergencyActive ? `إيقاف مسار الطوارئ، ${emergencySeconds} ثانية متبقية` : "مسار طوارئ"}>
              <Zap size={17} fill="currentColor" /> {emergencyActive ? `أوقف الطوارئ ${emergencySeconds}ث` : "مسار طوارئ ×2"}
            </button>
            <button className={isRunning ? "control active" : "control"} onClick={() => setGame((current) => ({ ...current, phase: current.phase === "running" ? "paused" : "running" }))} disabled={game.phase === "finished" || game.phase === "upgrade" || game.phase === "intro"} aria-label={isRunning ? "إيقاف مؤقت" : "متابعة"}>
              {isRunning ? <Pause size={17} /> : <Play size={17} />} {isRunning ? "إيقاف" : "متابعة"}
            </button>
            <button className={speed === 2 ? "control active" : "control"} onClick={() => setSpeed((current) => (current === 1 ? 2 : 1))} disabled={game.phase === "finished"} aria-label={`سرعة المحاكاة ×${speed}`}>
              <FastForward size={17} /> سرعة ×{speed}
            </button>
            <button className="control" onClick={restart} aria-label="مهمة جديدة"><Wrench size={17} /> مهمة جديدة</button>
            <button className="control sound-control" onClick={() => { setSoundOn((current) => !current); playSound("tap"); }} aria-label={soundOn ? "كتم المؤثرات الصوتية" : "تشغيل المؤثرات الصوتية"}>{soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />} {soundOn ? "الصوت" : "صامت"}</button>
          </div>
        </footer>
        <div className="reference-desktop-controls" aria-label="تحكمات المهمة المرجعية">
          <button className={emergencyMode || emergencyActive ? "emergency active" : "emergency"} onClick={useEmergencyRoute} disabled={!isRunning}><Zap size={19} fill="currentColor" /> {emergencyActive ? `أوقف الطوارئ ${emergencySeconds}ث` : "مسار طوارئ ×2"}</button>
          <button onClick={() => setGame((current) => ({ ...current, phase: current.phase === "running" ? "paused" : "running" }))} disabled={game.phase === "finished" || game.phase === "upgrade" || game.phase === "intro"}>{isRunning ? <Pause size={19} /> : <Play size={19} />}{isRunning ? "إيقاف" : "متابعة"}</button>
          <button className={speed === 2 ? "active" : ""} onClick={() => setSpeed((current) => (current === 1 ? 2 : 1))} disabled={game.phase === "finished"}><FastForward size={19} /> سرعة ×{speed}</button>
          <button onClick={restart}><Wrench size={19} /> مهمة جديدة</button>
          <button onClick={() => { setSoundOn((current) => !current); playSound("tap"); }}>{soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}{soundOn ? "الصوت" : "صامت"}</button>
        </div>
      </section>
    </main>
  );
}

function StatusChip({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string | number; tone: "cyan" | "orange" | "light" }) {
  return <div className={`status-chip ${tone}`}>{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function LightningStrike({ cue, stage }: { cue: number; stage: number }) {
  const index = ((cue % LIGHTNING_VARIANTS.length) + LIGHTNING_VARIANTS.length) % LIGHTNING_VARIANTS.length;
  const variant = LIGHTNING_VARIANTS[index];
  const stormStrength = getStormIntensityForStage(stage);
  const flashPower = variant.flash * (0.72 + stormStrength * 0.64);
  return <g className={`lightning-strike lightning-variant-${index + 1}`} data-lightning-variant={index + 1} data-lightning-cue={cue} data-lightning-double={"double" in variant ? "true" : "false"} filter="url(#lightningGlow)" style={{ "--lightning-strength": String(0.54 + stormStrength * 0.86), "--lightning-flash": String(flashPower) } as React.CSSProperties} aria-hidden="true">
    <rect width="1000" height="640" className="lightning-flash" />
    <image className="lightning-art" href={LIGHTNING_ARTS[variant.art]} x={variant.x} y={variant.y} width={variant.width} height={variant.height} preserveAspectRatio="xMidYMin slice" data-lightning-art={variant.art + 1} />
    {"double" in variant && <image className="lightning-art lightning-art-secondary" href={LIGHTNING_ARTS[variant.double.art]} x={variant.x + variant.double.x} y={variant.y + variant.double.y} width={variant.double.width} height={variant.double.height} preserveAspectRatio="xMidYMin slice" data-lightning-art={variant.double.art + 1} />}
  </g>;
}

function Rainfall({ multiplier }: { multiplier: number }) {
  const count = Math.round(48 * multiplier);
  return <g className="rainfall" data-rainfall="active" data-rain-multiplier={multiplier} data-rain-count={count} clipPath="url(#rain-map-bounds)" aria-hidden="true" opacity={0.34 + multiplier * 0.15}>{RAIN_DROPS.slice(0, count).map((drop, index) => <line key={index} x1={drop.x} y1={drop.y} x2={drop.x - 3} y2={drop.y + drop.length} className={`rain-drop rain-drop-${index % 3}`}><animateTransform attributeName="transform" type="translate" values={`${-drop.drift} ${-drop.travel}; ${drop.drift} ${drop.travel}`} dur={`${drop.duration}s`} begin={`${drop.delay}s`} repeatCount="indefinite" /></line>)}</g>;
}

function RadioStrike({ losses }: { losses: number }) {
  return <g className="radio-strike" data-radio-strike="active" aria-label="صعقة مباشرة أصابت محطة الاتصالات"><rect width="1000" height="640" className="radio-strike-flash" /><path d="M320 -8 L274 142 L310 129 L270 292 L335 172 L302 181 L292 470" className="radio-strike-bolt" /><circle cx="290" cy="480" r="66" className="radio-strike-impact" /><text x="290" y="548" textAnchor="middle" className="radio-strike-caption">صعقة اتصالات −{losses}</text></g>;
}

function AmbulanceSprite() {
  return <image className="vehicle-sprite premium-ambulance" href={AMBULANCE_PREMIUM} x="-27" y="-18" width="54" height="36" preserveAspectRatio="xMidYMid meet" aria-label="سيارة إسعاف متحركة" pointerEvents="none" />;
}

function LossJourney({ lost }: { lost: number }) {
  return <div className="loss-journey" aria-label={`خسارة ${lost} من السكان`}><svg viewBox="0 0 240 48" role="img"><path d="M12 34 H198" className="loss-route" /><g className="loss-wave"><path d="M0 28 q12 -10 24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0" /></g><g className="loss-people"><circle cx="170" cy="29" r="4" /><circle cx="184" cy="24" r="4" /><circle cx="196" cy="31" r="4" /></g><path className="loss-cloud" d="M204 10 q8 -10 16 0 q15 -4 16 10 h-40 q-4 -11 8 -10Z" /></svg><small>ابتلعت العاصفة مسارات لم تصل إلى النفق</small></div>;
}
