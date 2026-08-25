/** اتجاه التصميم: خلفيات واقعية كثيفة التفاصيل هي بطلة المشهد؛ مؤشرات الإنقاذ خفيفة وتطفو فوق طرق ومبانٍ حقيقية. */
import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, ChevronRight, Flame, Pause, Play, RotateCcw, Snowflake, Volume2, VolumeX, Wrench, Zap } from "lucide-react";
import { StageAudio } from "@/game/stageAudio";
import {
  connectNode,
  createMission,
  getLostCount,
  getRemainingTime,
  getRescuedCount,
  getStageForMission,
  getTotalPeople,
  getNodeStatus,
  isEmergencyActive,
  isRoadBlocked,
  isVehicleRepairing,
  restartMission,
  startMission,
  tickMission,
  toggleEmergency,
  togglePause,
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
const SNOW = Array.from({ length: 76 }, (_, index) => ({ left: (index * 47) % 101, top: -12 - (index * 19) % 94, duration: 3 + (index % 6) * .45, delay: -((index % 10) * .28), size: 5 + (index % 4) * 2 }));

function clock(seconds: number) {
  const rounded = Math.ceil(seconds);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
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
  const stage = getStageForMission(mission);
  const rescued = getRescuedCount(mission);
  const lost = getLostCount(mission);
  const total = getTotalPeople(mission);

  useEffect(() => {
    setMission(createMission(stageId));
    setEmergencyArmed(false);
  }, [stageId]);

  useEffect(() => {
    let cancelled = false;
    const urls = [stage.image, SMOKE_SHEET, SNOWFLAKES, TUNNEL, AMBULANCE];
    setAssetsReady(false);
    setProgress(0);
    let completed = 0;
    const load = (url: string) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => { completed += 1; if (!cancelled) setProgress(Math.round(completed / urls.length * 100)); resolve(); };
      image.onerror = () => reject(new Error(url));
      image.src = url;
    });
    Promise.all(urls.map(load)).finally(() => { if (!cancelled) setAssetsReady(true); });
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
    if (mission.phase !== "intro") audio.current.setEnvironment(stage.hazard, stageId === "volcano" ? .42 + mission.lavaProgress * .4 : .55);
  }, [mission.elapsed, mission.lavaProgress, mission.phase, soundOn, stage.hazard, stageId]);

  const start = () => {
    if (!assetsReady) return;
    audio.current ??= new StageAudio();
    void audio.current.unlock().then(() => audio.current?.setEnvironment(stage.hazard, .52));
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
  const isVolcano = stageId === "volcano";

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
      {isVolcano ? <VolcanoLayer progress={mission.lavaProgress} /> : <SnowLayer elapsed={mission.elapsed} />}
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

function MissionResults({ rescued, lost, total, onRestart, onCoast }: { rescued: number; lost: number; total: number; onRestart: () => void; onCoast: () => void }) { return <section className="disaster-intro results"><span>نتيجة المهمة</span><h1>{lost ? "انتهت العاصفة" : "إخلاء مكتمل"}</h1><div className="result-stats"><b>{rescued}<small>تم إنقاذهم</small></b><b>{lost}<small>فُقدوا</small></b><b>{total}<small>الإجمالي</small></b></div><button onClick={onRestart}><RotateCcw size={16} />أعد المهمة</button><button className="ghost" onClick={onCoast}>العودة إلى الساحل</button></section>; }

function VolcanoLayer({ progress }: { progress: number }) { const height = `${Math.max(9, progress * 63)}%`; return <><div className="volcano-smoke"><img src={SMOKE_SHEET} alt="" /></div><div className="lava-flow" style={{ height }}><i /></div><div className="lava-warning"><Flame size={14} /> جبهة اللاڤا تقترب من المدينة</div></>; }

function SnowLayer({ elapsed }: { elapsed: number }) { const density = Math.min(76, 34 + Math.floor(elapsed / 55) * 14); return <><div className="snow-storm">{SNOW.slice(0, density).map((flake, index) => <i key={index} style={{ left: `${flake.left}%`, top: `${flake.top}%`, width: flake.size, height: flake.size, animationDuration: `${flake.duration}s`, animationDelay: `${flake.delay}s` }} />)}</div><div className="snow-badge"><Snowflake size={14} /> تتكاثف العاصفة كلما اقترب الوقت</div></>; }
