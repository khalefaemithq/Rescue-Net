/** اتجاه التصميم: خلفيات واقعية كثيفة التفاصيل هي بطلة المشهد؛ شبكة إنقاذ حية بمركبات متحركة، وحمم تتزحف وقذائف بركانية، وثلج حقيقي متساقط. */
import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, ChevronRight, Flame, Pause, Play, RotateCcw, Snowflake, Volume2, VolumeX, Wrench, Zap } from "lucide-react";
import { StageAudio } from "@/game/stageAudio";
import {
  bombImpacts,
  bombPosition,
  bombsInFlight,
  bombScorches,
  connectNode,
  createMission,
  getLavaFront,
  getLavaPath,
  getLostCount,
  getRemainingTime,
  getRescuedCount,
  getStageForMission,
  getTotalPeople,
  getNodeStatus,
  isEmergencyActive,
  isRoadBlocked,
  isVehicleRepairing,
  makeBombSchedule,
  pathLength,
  pointAlongPath,
  restartMission,
  startMission,
  tickMission,
  toggleEmergency,
  togglePause,
  trimPathToDistance,
  VOLCANO_CRATER,
  type BombEvent,
  type FlowPoint,
  type MissionNode,
  type MissionState,
} from "@/game/stageEngine";
import type { StageId } from "@/game/stages";
import "./disaster-mission.css";

const FRAME_MS = 1000 / 30;
const SMOKE_SHEET = "/manus-storage/smoke-sheet_86702482.png";
const SNOWFLAKES = "/manus-storage/snowflakes_7775ae91.png";
const AMBULANCE = "/manus-storage/rescue-ambulance-premium_95925d8d.png";
const TUNNEL = "/manus-storage/rescue-evacuation-tunnel_6c38a21a.png";
const FIREBALL = "/manus-storage/rescue-fireball_kenney.png";
const IMPACT_GLOW = "/manus-storage/rescue-impact-glow_kenney.png";
const SPARK = "/manus-storage/rescue-spark_kenney.png";
const BOMB_SEED = 20260825;
const VIEW = { w: 1000, h: 640 };
const toPercent = (point: FlowPoint) => ({ left: `${(point.x / VIEW.w) * 100}%`, top: `${(point.y / VIEW.h) * 100}%` });

function clock(seconds: number) {
  const rounded = Math.ceil(seconds);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function routePoints(stageRoutes: Record<string, FlowPoint[]>, nodeId: string): FlowPoint[] {
  return stageRoutes[nodeId] ?? [];
}

function vehicleRate(points: FlowPoint[]) {
  return 2 / Math.max(5, Math.min(11, pathLength(points) / 95));
}

export default function DisasterMission({ stageId, onChooseStage }: { stageId: Extract<StageId, "volcano" | "snow">; onChooseStage: (stage: StageId) => void }) {
  const [mission, setMission] = useState<MissionState>(() => createMission(stageId));
  const [soundOn, setSoundOn] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [emergencyArmed, setEmergencyArmed] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<StageAudio | null>(null);
  const lastFrame = useRef(performance.now());
  const accumulator = useRef(0);
  const eruptionSeen = useRef(0);
  const snowEventSeen = useRef(0);
  const stage = getStageForMission(mission);
  const rescued = getRescuedCount(mission);
  const lost = getLostCount(mission);
  const total = getTotalPeople(mission);
  const isVolcano = stageId === "volcano";
  const lavaPath = useMemo(() => (isVolcano ? getLavaPath(stage) : []), [stage, isVolcano]);
  const bombSchedule = useMemo<BombEvent[]>(() => (isVolcano ? makeBombSchedule(BOMB_SEED, VOLCANO_CRATER, stage.duration) : []), [stage, isVolcano]);

  useEffect(() => {
    setMission(createMission(stageId));
    setEmergencyArmed(false);
    eruptionSeen.current = 0;
    snowEventSeen.current = 0;
  }, [stageId]);

  useEffect(() => {
    let cancelled = false;
    const urls = [stage.image, SMOKE_SHEET, SNOWFLAKES, TUNNEL, AMBULANCE, FIREBALL, IMPACT_GLOW, SPARK];
    setAssetsReady(false);
    setProgress(0);
    let completed = 0;
    const load = (url: string) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => { completed += 1; if (!cancelled) setProgress(Math.round(completed / urls.length * 100)); resolve(); };
      image.onerror = () => reject(new Error(url));
      image.src = url;
    });
    Promise.all(urls.map((url) => load(url).catch(() => { completed += 1; if (!cancelled) setProgress(Math.round(completed / urls.length * 100)); }))).finally(() => { if (!cancelled) setAssetsReady(true); });
    return () => { cancelled = true; };
  }, [stage.image]);

  useEffect(() => {
    if (mission.phase !== "running") return;
    let handle = 0;
    const tick = (now: number) => {
      accumulator.current += Math.min(100, now - lastFrame.current);
      lastFrame.current = now;
      while (accumulator.current >= FRAME_MS) {
        setMission((current) => tickMission(current, FRAME_MS / 1000 * speed));
        accumulator.current -= FRAME_MS;
      }
      handle = requestAnimationFrame(tick);
    };
    lastFrame.current = performance.now();
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [mission.phase, speed]);

  useEffect(() => () => audio.current?.dispose(), []);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.setMuted(!soundOn);
    if (mission.phase !== "intro") audio.current.setEnvironment(stage.hazard, stageId === "volcano" ? 0.42 + mission.lavaProgress * 0.4 : 0.55);
  }, [mission.elapsed, mission.lavaProgress, mission.phase, soundOn, stage.hazard, stageId]);

  useEffect(() => {
    if (!isVolcano || mission.phase !== "running") return;
    const count = Math.min(bombSchedule.length, bombSchedule.filter((bomb) => bomb.launch <= mission.elapsed).length);
    if (count > eruptionSeen.current) {
      eruptionSeen.current = count;
      audio.current?.playEruption(0.7 + Math.min(0.3, mission.lavaProgress * 0.4));
    }
  }, [bombSchedule, isVolcano, mission.elapsed, mission.lavaProgress, mission.phase]);

  useEffect(() => {
    if (isVolcano || mission.phase !== "running") return;
    if (mission.lastSnowEventIndex > snowEventSeen.current) {
      snowEventSeen.current = mission.lastSnowEventIndex;
      audio.current?.gust();
    }
  }, [isVolcano, mission.lastSnowEventIndex, mission.phase]);

  const start = () => {
    if (!assetsReady) return;
    audio.current ??= new StageAudio();
    void audio.current.unlock().then(() => audio.current?.setEnvironment(stage.hazard, 0.52));
    setMission((current) => startMission(current));
  };

  const handleNode = (node: MissionNode) => {
    if (emergencyArmed) {
      const result = toggleEmergency(mission, node.id);
      setMission(result.state);
      setEmergencyArmed(false);
      audio.current?.cue("hazard");
      return;
    }
    const result = connectNode(mission, node.id);
    setMission(result.state);
    if (result.state !== mission) audio.current?.cue("connect");
  };

  const missionClass = `disaster-shell ${stageId} phase-${mission.phase}`;
  const isPaused = mission.phase === "paused";
  const repair = isVehicleRepairing(mission);

  return <main className={missionClass} dir="rtl">
    {!assetsReady && <AssetLoader progress={progress} label={isVolcano ? "تجهيز جزيرة البركان" : "تجهيز جزيرة الثلوج"} />}
    <header className="disaster-hud">
      <button className="stage-back" onClick={() => onChooseStage("coast")}><ChevronRight size={17} /> الساحل</button>
      <div className="mission-heading"><span>{isVolcano ? <Flame size={15} /> : <Snowflake size={15} />}</span><div><small>المرحلة {stage.number} · {stage.difficulty}</small><strong>{stage.title}</strong></div></div>
      <div className="mission-clock"><small>{isVolcano ? "تقدم اللاڤا" : "وصول العاصفة"}</small><b>{clock(getRemainingTime(mission))}</b></div>
    </header>
    <aside className="disaster-stats"><Stat label="البطارية" value={`${Math.round(mission.battery)}%`} icon={<BatteryCharging size={16} />} /><Stat label="الإنقاذ" value={`${rescued}/${total}`} icon={<span>●</span>} /><Stat label="المواد" value={mission.materials} icon={<span>◆</span>} /></aside>

    <section className="disaster-map" aria-label={stage.title}>
      <img className="real-map-art" src={stage.image} alt="" />
      <div className="map-grade" />
      <svg className="mission-overlay" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="none" aria-hidden="true" pointerEvents="none">
        <defs>
          <filter id="lava-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {isRoadBlocked(mission, mission.blockedRoadTarget ?? "") && mission.blockedRoadTarget && (() => {
          const points = routePoints(stage.routes, mission.blockedRoadTarget);
          if (points.length < 2) return null;
          return <polyline className="frost-route" points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" />;
        })()}
        {isVolcano && (() => {
          const front = getLavaFront(stage, mission.elapsed);
          const consumed = trimPathToDistance(lavaPath, front * pathLength(lavaPath));
          if (consumed.length < 2) return null;
          const tip = consumed[consumed.length - 1];
          const drawn = consumed.map((point) => `${point.x},${point.y}`).join(" ");
          return <g className="lava-front" filter="url(#lava-glow)">
            <polyline points={drawn} fill="none" stroke="#2b0f08" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
            <polyline points={drawn} fill="none" stroke="#c23c14" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <polyline className="lava-core" points={drawn} fill="none" stroke="#ffb23d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="lava-pulse" cx={tip.x} cy={tip.y} r="13" fill="#ffd27a" />
            <circle cx={tip.x} cy={tip.y} r="26" fill="#ff7a26" opacity=".28" />
          </g>;
        })()}
        {mission.links.map((link, index) => {
          const node = mission.nodes.find((item) => item.id === link.nodeId);
          if (!node) return null;
          const points = routePoints(stage.routes, link.nodeId);
          if (points.length < 2) return null;
          const drawn = points.map((point) => `${point.x},${point.y}`).join(" ");
          const rate = vehicleRate(points);
          const travelPhase = (mission.elapsed * rate + index * 0.9) % 2;
          const outbound = travelPhase <= 1;
          const totalLength = pathLength(points);
          const vehicle = pointAlongPath(points, (outbound ? travelPhase : 2 - travelPhase) * totalLength);
          const angle = vehicle.angle + (outbound ? 0 : 180);
          return <g key={link.nodeId} className="rescue-route-group" data-route={link.nodeId}>
            <polyline className={`rescue-route ${stageId}`} points={drawn} fill="none" filter="url(#route-glow)" />
            <g transform={`translate(${vehicle.x} ${vehicle.y}) rotate(${angle})`}><image className="rescue-vehicle" href={AMBULANCE} x="-27" y="-18" width="54" height="36" preserveAspectRatio="xMidYMid meet" /></g>
          </g>;
        })}
        {isVolcano && bombsInFlight(bombSchedule, mission.elapsed).map((bomb) => {
          const position = bombPosition(bomb, mission.elapsed);
          return <g key={`bomb-${bomb.id}`} transform={`translate(${position.x} ${position.y - position.height})`}><image href={FIREBALL} x="-16" y="-16" width="32" height="32" className="lava-bomb" /></g>;
        })}
      </svg>
      {isVolcano ? <VolcanoLayer progress={mission.lavaProgress} schedule={bombSchedule} elapsed={mission.elapsed} /> : <SnowLayer elapsed={mission.elapsed} />}
      <div className="map-vignette" />
      <div className="evacuation-hq" style={{ left: `${stage.hq.x / 10}%`, top: `${stage.hq.y / 6.4}%` }}><img src={TUNNEL} alt="نفق الإخلاء" /><span>{stage.hqName}</span></div>
      {mission.nodes.map((node) => <RescueMarker key={node.id} node={node} state={mission} onClick={() => handleNode(node)} />)}
      {repair && <div className="repair-alert"><Wrench size={17} /> المركبات تحت الإصلاح — {Math.ceil(mission.vehicleRepairUntil - mission.elapsed)} ث</div>}
      {mission.phase === "intro" && <MissionIntro stageName={stage.title} copy={stage.intro} onStart={start} ready={assetsReady} />}
      {mission.phase === "finished" && <MissionResults rescued={rescued} lost={lost} total={total} onRestart={() => { setMission(restartMission(mission)); setSpeed(1); }} onCoast={() => onChooseStage("coast")} />}
      {mission.phase === "running" && <div className={`mission-notice ${emergencyArmed ? "armed" : ""}`}>{emergencyArmed ? "اختر موقعًا لتوجيه مسار الطوارئ" : mission.lastEvent}</div>}
      {isPaused && <div className="paused-card">المهمة متوقفة مؤقتًا</div>}
    </section>

    <footer className="disaster-controls">
      <button className={emergencyArmed || isEmergencyActive(mission) ? "danger" : ""} onClick={() => { if (isEmergencyActive(mission)) { setMission(toggleEmergency(mission).state); } else setEmergencyArmed((value) => !value); }} disabled={mission.phase !== "running"}><Zap size={17} /> طوارئ</button>
      <button onClick={() => setMission((current) => togglePause(current))} disabled={mission.phase === "intro" || mission.phase === "finished"}>{isPaused ? <Play size={17} /> : <Pause size={17} />}{isPaused ? "متابعة" : "إيقاف"}</button>
      <button className={speed === 2 ? "active" : ""} onClick={() => setSpeed((value) => value === 1 ? 2 : 1)}><span>×{speed}</span> سرعة</button>
      <button onClick={() => { setMission(restartMission(mission)); setSpeed(1); }}><RotateCcw size={17} /> جديدة</button>
      <button onClick={() => setSoundOn((value) => !value)}>{soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}{soundOn ? "الصوت" : "صامت"}</button>
    </footer>
  </main>;
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) { return <div className="disaster-stat">{icon}<span>{label}</span><b>{value}</b></div>; }

function RescueMarker({ node, state, onClick }: { node: MissionNode; state: MissionState; onClick: () => void }) {
  const status = getNodeStatus(state, node);
  const pending = Math.max(0, node.people - node.rescued - node.casualties);
  return <button className={`disaster-target ${status}`} style={{ left: `${node.x / 10}%`, top: `${node.y / 6.4}%` }} onClick={onClick} disabled={state.phase !== "running" || node.lost}>
    <span className="marker-count">{node.lost ? "!" : pending}</span><span className="marker-core">{node.kind === "hospital" ? "✚" : node.kind === "radio" ? "⌁" : node.kind === "harbor" ? "⚓" : node.kind === "school" ? "▣" : "⌂"}</span><small>{node.label}</small>{isRoadBlocked(state, node.id) && <i>طريق مغلق</i>}
  </button>;
}

function AssetLoader({ progress, label }: { progress: number; label: string }) { return <section className="mission-loader"><div className="loader-mark">✦</div><strong>{label}</strong><small>تحميل الخريطة والأصول الميدانية</small><div className="loader-bar"><i style={{ width: `${progress}%` }} /></div><b>{progress}%</b></section>; }

function MissionIntro({ stageName, copy, onStart, ready }: { stageName: string; copy: string; onStart: () => void; ready: boolean }) { return <section className="disaster-intro"><span>مهمة الإخلاء</span><h1>{stageName}</h1><p>{copy}</p><button onClick={onStart} disabled={!ready}><Play size={17} fill="currentColor" />ابدأ المهمة</button></section>; }

function MissionResults({ rescued, lost, total, onRestart, onCoast }: { rescued: number; lost: number; total: number; onRestart: () => void; onCoast: () => void }) { return <section className="disaster-intro results"><span>نتيجة المهمة</span><h1>{lost ? "انتهت العاصفة" : "إخلاء مكتمل"}</h1><div className="result-stats"><b>{rescued}<small>تم إنقاذهم</small></b><b>{lost}<small>فُقدوا</small></b><b>{total}<small>الإجمالي</small></b></div><button onClick={onRestart}><RotateCcw size={16} />أعد المهمة</button><button className="ghost" onClick={onCoast}>العودة إلى اختيار الجزر</button></section>; }

function VolcanoLayer({ progress, schedule, elapsed }: { progress: number; schedule: BombEvent[]; elapsed: number }) {
  const crater = toPercent(VOLCANO_CRATER);
  return <>
    <div className="crater-glow" style={crater} />
    <div className="crater-smoke" style={crater}>{[0, 1, 2].map((index) => <span key={index} className="smoke-puff" style={{ animationDelay: `${index * 2.3}s` }}><img src={SMOKE_SHEET} alt="" /></span>)}</div>
    {bombImpacts(schedule, elapsed).map((bomb) => {
      const spot = toPercent(bomb.to);
      const age = (elapsed - bomb.launch - bomb.flight) / 0.9;
      return <span key={`impact-${bomb.id}`} className="impact-glow" style={{ ...spot, opacity: 1 - age }}><img src={IMPACT_GLOW} alt="" /></span>;
    })}
    {bombScorches(schedule, elapsed).map((bomb) => {
      const spot = toPercent(bomb.to);
      const age = elapsed - bomb.launch - bomb.flight;
      const fade = Math.max(0, Math.min(1, (20 - age) / 6));
      return <span key={`scorch-${bomb.id}`} className="scorch-mark" style={{ ...spot, opacity: 0.55 * fade }} />;
    })}
    {bombImpacts(schedule, elapsed).flatMap((bomb) => [0, 1, 2].map((spark) => {
      const spot = toPercent(bomb.to);
      const angle = (bomb.id * 47 + spark * 120) % 360;
      return <span key={`spark-${bomb.id}-${spark}`} className="bomb-spark" style={{ ...spot, ["--spark-angle" as string]: `${angle}deg` }}><img src={SPARK} alt="" /></span>;
    }))}
    <div className="lava-warning"><Flame size={14} /> جبهة اللاڤا تقترب من المدينة</div>
    <div className="lava-progress-track" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
  </>;
}

function SnowLayer({ elapsed }: { elapsed: number }) {
  const density = Math.min(3, 1 + Math.floor(elapsed / 55) / 1.4);
  return <>
    <div className="snowfield far" style={{ opacity: 0.14 * density }} />
    <div className="snowfield near" style={{ opacity: 0.2 * density }} />
    <div className="wind-gust" key={Math.floor(elapsed / 13)} />
    <div className="snow-badge"><Snowflake size={14} /> تتكاثف العاصفة كلما اقترب الوقت</div>
  </>;
}
