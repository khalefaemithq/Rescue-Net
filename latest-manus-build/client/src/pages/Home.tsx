/** اتجاه التصميم: تبدأ اللعبة بتحميل فعلي ومتحقق من أصول المراحل الثلاث، ثم شاشة اختيار تعتمد صور الخرائط الواقعية نفسها. */
import { useEffect, useMemo, useState } from "react";
import { Flame, Play, Snowflake, Waves } from "lucide-react";
import CoastalOriginal from "@/components/CoastalOriginal";
import DisasterMission from "@/components/DisasterMission";
import type { StageId } from "@/game/stages";
import "@/components/stage-bootstrap.css";

type AssetType = "image" | "audio";
type PreloadEntry = { url: string; type: AssetType; label: string };
type AssetStatus = "loading" | "ready" | "failed";

const STAGE_ASSETS: PreloadEntry[] = [
  { url: "/manus-storage/coastal-original-map_d020a7e1.webp", type: "image", label: "خريطة الساحل" },
  { url: "/manus-storage/rescue-volcano-island-realistic-v2_1255c9f0.png", type: "image", label: "خريطة البركان" },
  { url: "/manus-storage/rescue-snow-island-realistic-v2_7a67a7e9.png", type: "image", label: "خريطة الثلوج" },
  { url: "/manus-storage/rescue-evacuation-tunnel_6c38a21a.png", type: "image", label: "نفق الإخلاء" },
  { url: "/manus-storage/rescue-ambulance-premium_95925d8d.png", type: "image", label: "مركبات الإنقاذ" },
  { url: "/manus-storage/medical-target-sprite_b2e59a2f.png", type: "image", label: "المستشفى" },
  { url: "/manus-storage/school-target-sprite_9f30f792.png", type: "image", label: "المدرسة" },
  { url: "/manus-storage/harbor-target-sprite_d14d3173.png", type: "image", label: "الميناء" },
  { url: "/manus-storage/rescue-radio-premium_bf67c256.png", type: "image", label: "الاتصالات" },
  { url: "/manus-storage/rescue-residential-premium_558c6ecc.png", type: "image", label: "الأحياء" },
  { url: "/manus-storage/smoke-sheet_86702482.png", type: "image", label: "دخان البركان" },
  { url: "/manus-storage/snowflakes_7775ae91.png", type: "image", label: "ثلوج العاصفة" },
  { url: "/manus-storage/rescue-fireball_kenney.png", type: "image", label: "قذائف الحمم" },
  { url: "/manus-storage/rescue-impact-glow_kenney.png", type: "image", label: "أثر الارتطام" },
  { url: "/manus-storage/rescue-spark_kenney.png", type: "image", label: "شرر البركان" },
  { url: "/manus-storage/rescue-storm-real_aef36702.ogg", type: "audio", label: "رياح الساحل" },
  { url: "/manus-storage/rescue-ambulance-field-real_9c9f7683.ogg", type: "audio", label: "إسعاف ميداني" },
  { url: "/manus-storage/rescue-thunder-cc0_0aec8a64.ogg", type: "audio", label: "رعد" },
  { url: "/manus-storage/rescue-volcano-rumble_385098.ogg", type: "audio", label: "دمدمة البركان" },
  { url: "/manus-storage/rescue-eruption-blast_675739.ogg", type: "audio", label: "ثوران البركان" },
  { url: "/manus-storage/rescue-lava-flow_675730.ogg", type: "audio", label: "تدفق اللاڤا" },
  { url: "/manus-storage/rescue-winter-wind_438876.ogg", type: "audio", label: "رياح الشتاء" },
  { url: "/manus-storage/rescue-blizzard-wind_493680.ogg", type: "audio", label: "عاصفة الثلج" },
  { url: "/manus-storage/rescue-heavy-snowfall_22606.ogg", type: "audio", label: "تساقط الثلوج الكثيف" },
];

const STAGES = [
  { id: "coast" as const, number: "01", title: "الجزيرة الساحلية", subtitle: "عاصفة وممرات إخلاء", image: "/manus-storage/coastal-original-map_d020a7e1.webp", icon: Waves, difficulty: "متوسط" },
  { id: "volcano" as const, number: "02", title: "جزيرة البركان", subtitle: "حمم ودخان يقتربان من المدينة", image: "/manus-storage/rescue-volcano-island-realistic-v2_1255c9f0.png", icon: Flame, difficulty: "صعب" },
  { id: "snow" as const, number: "03", title: "جزيرة الثلوج", subtitle: "عاصفة وطرق تتجمد", image: "/manus-storage/rescue-snow-island-realistic-v2_7a67a7e9.png", icon: Snowflake, difficulty: "شديد" },
];

const RETRY_DELAYS = [600, 1600];

async function downloadAndVerify(entry: PreloadEntry, attempt = 0): Promise<void> {
  try {
    const response = await fetch(entry.url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`${entry.label} (${response.status})`);
    const blob = await response.blob();
    if (!blob.size) throw new Error(`${entry.label} فارغ`);
    if (entry.type === "image") {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  } catch (error) {
    if (attempt >= RETRY_DELAYS.length) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAYS[attempt]));
    return downloadAndVerify(entry, attempt + 1);
  }
}

export default function Home() {
  const requested = new URLSearchParams(window.location.search).get("stage");
  const directStage: StageId | null = requested === "coast" || requested === "volcano" || requested === "snow" ? requested : null;
  const [stage, setStage] = useState<StageId>(directStage ?? "coast");
  const [screen, setScreen] = useState<"loading" | "menu" | "game">("loading");
  const [status, setStatus] = useState<Record<string, AssetStatus>>({});
  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  const completed = Object.values(status).filter((value) => value === "ready").length;
  const loadingLabel = useMemo(() => STAGE_ASSETS.find((asset) => status[asset.url] === "loading")?.label ?? "الأصول الميدانية", [status]);

  useEffect(() => {
    let cancelled = false;
    setStatus(Object.fromEntries(STAGE_ASSETS.map((asset) => [asset.url, "loading"])));
    setFailures([]);
    Promise.all(STAGE_ASSETS.map(async (asset) => {
      try {
        await downloadAndVerify(asset);
        if (!cancelled) setStatus((current) => ({ ...current, [asset.url]: "ready" }));
        return null;
      } catch {
        if (!cancelled) setStatus((current) => ({ ...current, [asset.url]: "failed" }));
        return asset.label;
      }
    })).then((results) => {
      if (cancelled) return;
      const failed = results.filter((value): value is string => Boolean(value));
      setFailures(failed);
      if (!failed.length) setScreen(directStage ? "game" : "menu");
    });
    return () => { cancelled = true; };
  }, [attempt, directStage]);

  if (screen === "loading") return <AssetLoader completed={completed} label={loadingLabel} failures={failures} onRetry={() => setAttempt((value) => value + 1)} />;
  if (screen === "menu") return <StageChooser onChoose={(selected) => { setStage(selected); setScreen("game"); }} />;
  if (stage === "coast") return <CoastalOriginal />;
  return <DisasterMission stageId={stage} onChooseStage={() => setScreen("menu")} />;
}

function AssetLoader({ completed, label, failures, onRetry }: { completed: number; label: string; failures: string[]; onRetry: () => void }) {
  const percent = Math.round(completed / STAGE_ASSETS.length * 100);
  const hasFailed = failures.length > 0;
  return <main className="stage-bootstrap" dir="rtl"><section><span className="bootstrap-mark">✦</span><small>شبكة الإنقاذ</small><h1>{hasFailed ? "تعذر التحقق من بعض الأصول" : "تجهيز الجزر الثلاث"}</h1><p>{hasFailed ? `الأصول غير المكتملة: ${failures.join("، ")}` : `تنزيل وفحص ${label}…`}</p><div className="bootstrap-track"><i style={{ width: `${percent}%` }} /></div><b>{completed}/{STAGE_ASSETS.length} · {percent}%</b>{hasFailed && <button className="bootstrap-retry" onClick={onRetry}>أعد تنزيل الأصول</button>}</section></main>;
}

function StageChooser({ onChoose }: { onChoose: (stage: StageId) => void }) {
  return <main className="stage-chooser" dir="rtl"><header><span className="chooser-mark">✦</span><div><small>شبكة الإنقاذ</small><h1>اختر جزيرة الإنقاذ</h1></div></header><p className="chooser-copy">تم تنزيل أصول الخرائط والمركبات والمؤثرات قبل هذه الشاشة. اختر مهمة لبدء اللعب.</p><section className="stage-cards">{STAGES.map((stage) => { const Icon = stage.icon; return <button key={stage.id} className={`stage-choice ${stage.id}`} onClick={() => onChoose(stage.id)}><img src={stage.image} alt="" /><span className="choice-gradient" /><span className="choice-number">{stage.number}</span><span className="choice-icon"><Icon size={19} /></span><span className="choice-copy"><strong>{stage.title}</strong><small>{stage.subtitle}</small></span><span className="choice-difficulty">{stage.difficulty}</span><span className="choice-play"><Play size={16} fill="currentColor" /> ابدأ المهمة</span></button>; })}</section></main>;
}
