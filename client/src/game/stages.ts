export type StageId = "coast" | "volcano" | "snow";
export type HazardKind = "storm" | "volcano" | "blizzard";
export type Point = { x: number; y: number };
export type TargetKind = "homes" | "hospital" | "school" | "radio" | "harbor" | "market" | "lodge";

export type StageNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  people: number;
  kind: TargetKind;
  lavaAt?: number;
};

export type StageDefinition = {
  id: StageId;
  number: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  objective: string;
  intro: string;
  duration: number;
  difficulty: "قياسية" | "صعبة" | "شديدة";
  hazard: HazardKind;
  image: string;
  hq: Point;
  hqName: string;
  nodes: StageNode[];
  routes: Record<string, Point[]>;
  maxLinks: number;
  materials: number;
  tripDuration: number;
  snowBlockSequence?: string[];
};

const coastNodes: StageNode[] = [
  { id: "residential", label: "الحي السكني", x: 250, y: 210, people: 36, kind: "homes" },
  { id: "hospital", label: "المستشفى", x: 440, y: 245, people: 24, kind: "hospital" },
  { id: "school", label: "المدرسة", x: 750, y: 190, people: 28, kind: "school" },
  { id: "harbor", label: "الميناء", x: 810, y: 485, people: 26, kind: "harbor" },
  { id: "radio", label: "الاتصالات", x: 290, y: 480, people: 10, kind: "radio" },
];

const volcanoNodes: StageNode[] = [
  { id: "crater-village", label: "قرية الفوهة", x: 165, y: 245, people: 30, kind: "homes", lavaAt: 92 },
  { id: "ash-clinic", label: "عيادة الرماد", x: 360, y: 220, people: 28, kind: "hospital", lavaAt: 146 },
  { id: "pine-market", label: "سوق الصنوبر", x: 410, y: 400, people: 38, kind: "market", lavaAt: 177 },
  { id: "ridge-school", label: "مدرسة السفح", x: 610, y: 185, people: 34, kind: "school", lavaAt: 218 },
  { id: "north-radio", label: "برج الإنذار", x: 590, y: 455, people: 18, kind: "radio", lavaAt: 238 },
  { id: "garden-homes", label: "حي الحدائق", x: 725, y: 350, people: 42, kind: "homes", lavaAt: 263 },
  { id: "east-harbor", label: "رصيف الإجلاء", x: 850, y: 460, people: 30, kind: "harbor", lavaAt: 282 },
];

const snowNodes: StageNode[] = [
  { id: "west-lodges", label: "نُزل الغرب", x: 190, y: 205, people: 30, kind: "lodge" },
  { id: "frost-clinic", label: "مستشفى الصقيع", x: 360, y: 165, people: 32, kind: "hospital" },
  { id: "glacier-school", label: "مدرسة الجليد", x: 540, y: 230, people: 38, kind: "school" },
  { id: "fir-homes", label: "حي التنوب", x: 350, y: 395, people: 42, kind: "homes" },
  { id: "summit-radio", label: "برج القمة", x: 685, y: 130, people: 20, kind: "radio" },
  { id: "ice-market", label: "سوق الجسر", x: 705, y: 390, people: 44, kind: "market" },
  { id: "north-harbor", label: "ميناء الجليد", x: 850, y: 500, people: 34, kind: "harbor" },
];

export const STAGES: StageDefinition[] = [
  {
    id: "coast",
    number: 1,
    title: "الجزيرة الساحلية",
    shortTitle: "الموجة الأولى",
    subtitle: "عاصفة بحرية تقترب",
    objective: "أخلِ السكان قبل وصول العاصفة.",
    intro: "تبدأ المهمة من نفق الإخلاء. افتح مسارات الإنقاذ للأحياء التي تراها على الخريطة، ولا تترك ميناءً بلا مراقبة.",
    duration: 180,
    difficulty: "قياسية",
    hazard: "storm",
    image: "/manus-storage/coastal-original-map_d020a7e1.webp",
    hq: { x: 555, y: 360 },
    hqName: "نفق الإخلاء",
    nodes: coastNodes,
    routes: {
      residential: [{ x: 555, y: 360 }, { x: 484, y: 417 }, { x: 370, y: 478 }, { x: 290, y: 480 }, { x: 250, y: 390 }, { x: 250, y: 210 }],
      hospital: [{ x: 555, y: 360 }, { x: 510, y: 318 }, { x: 472, y: 285 }, { x: 440, y: 245 }],
      school: [{ x: 555, y: 360 }, { x: 620, y: 322 }, { x: 680, y: 264 }, { x: 750, y: 190 }],
      harbor: [{ x: 555, y: 360 }, { x: 550, y: 402 }, { x: 646, y: 455 }, { x: 730, y: 474 }, { x: 810, y: 485 }],
      radio: [{ x: 555, y: 360 }, { x: 476, y: 441 }, { x: 385, y: 478 }, { x: 290, y: 480 }],
    },
    maxLinks: 3,
    materials: 12,
    tripDuration: 4.4,
  },
  {
    id: "volcano",
    number: 2,
    title: "جزيرة البركان",
    shortTitle: "الخط الأحمر",
    subtitle: "الحمم تزحف نحو المدينة",
    objective: "أنقذ المدينة قبل أن تصلها جبهة اللاڤا.",
    intro: "البركان في أعلى اليسار يطلق الرماد والحمم. ستفقد أي منطقة تصل إليها اللاڤا، لذا اعمل من الممرات القريبة إلى النفق الجنوبي الشرقي.",
    duration: 300,
    difficulty: "صعبة",
    hazard: "volcano",
    image: "/manus-storage/rescue-volcano-island-realistic-v2_1255c9f0.png",
    hq: { x: 885, y: 550 },
    hqName: "نفق الجنوب الشرقي",
    nodes: volcanoNodes,
    routes: {
      "crater-village": [{ x: 885, y: 550 }, { x: 760, y: 500 }, { x: 620, y: 465 }, { x: 480, y: 390 }, { x: 330, y: 300 }, { x: 165, y: 245 }],
      "ash-clinic": [{ x: 885, y: 550 }, { x: 748, y: 508 }, { x: 655, y: 398 }, { x: 535, y: 300 }, { x: 360, y: 220 }],
      "pine-market": [{ x: 885, y: 550 }, { x: 760, y: 500 }, { x: 610, y: 465 }, { x: 410, y: 400 }],
      "ridge-school": [{ x: 885, y: 550 }, { x: 790, y: 470 }, { x: 705, y: 320 }, { x: 610, y: 185 }],
      "north-radio": [{ x: 885, y: 550 }, { x: 760, y: 520 }, { x: 650, y: 480 }, { x: 590, y: 455 }],
      "garden-homes": [{ x: 885, y: 550 }, { x: 830, y: 488 }, { x: 780, y: 405 }, { x: 725, y: 350 }],
      "east-harbor": [{ x: 885, y: 550 }, { x: 870, y: 515 }, { x: 850, y: 460 }],
    },
    maxLinks: 4,
    materials: 16,
    tripDuration: 5.25,
  },
  {
    id: "snow",
    number: 3,
    title: "جزيرة الثلوج",
    shortTitle: "البياض العاصف",
    subtitle: "العاصفة تغلق الطرق",
    objective: "أخلِ الجميع قبل انغلاق الجزيرة تحت العاصفة.",
    intro: "تساقط الثلج يتكاثف كلما اقتربت العاصفة. يُغلق طريق كل 15 ثانية، وقد تتعطل المركبات لعشر ثوانٍ، فراقب التنبيهات واستثمر مساراتك بعناية.",
    duration: 300,
    difficulty: "شديدة",
    hazard: "blizzard",
    image: "/manus-storage/rescue-snow-island-realistic-v2_7a67a7e9.png",
    hq: { x: 94, y: 470 },
    hqName: "نفق الشاطئ الغربي",
    nodes: snowNodes,
    routes: {
      "west-lodges": [{ x: 94, y: 470 }, { x: 120, y: 380 }, { x: 160, y: 295 }, { x: 190, y: 205 }],
      "frost-clinic": [{ x: 94, y: 470 }, { x: 170, y: 420 }, { x: 260, y: 280 }, { x: 360, y: 165 }],
      "glacier-school": [{ x: 94, y: 470 }, { x: 210, y: 430 }, { x: 340, y: 345 }, { x: 450, y: 255 }, { x: 540, y: 230 }],
      "fir-homes": [{ x: 94, y: 470 }, { x: 180, y: 450 }, { x: 270, y: 430 }, { x: 350, y: 395 }],
      "summit-radio": [{ x: 94, y: 470 }, { x: 260, y: 420 }, { x: 410, y: 275 }, { x: 530, y: 170 }, { x: 685, y: 130 }],
      "ice-market": [{ x: 94, y: 470 }, { x: 260, y: 450 }, { x: 425, y: 420 }, { x: 575, y: 395 }, { x: 705, y: 390 }],
      "north-harbor": [{ x: 94, y: 470 }, { x: 260, y: 450 }, { x: 440, y: 455 }, { x: 650, y: 480 }, { x: 850, y: 500 }],
    },
    maxLinks: 4,
    materials: 16,
    tripDuration: 5.5,
    snowBlockSequence: ["glacier-school", "north-harbor", "fir-homes", "summit-radio", "ice-market", "frost-clinic", "west-lodges"],
  },
];

export function getStage(id: StageId) {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0];
}
