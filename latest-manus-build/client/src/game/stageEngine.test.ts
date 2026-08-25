import { describe, expect, it } from "vitest";
import { connectNode, createMission, getLostCount, getRemainingTime, startMission, tickMission } from "./stageEngine";

describe("نظام مراحل الإنقاذ", () => {
  it("يبني مرحلتي البركان والثلوج بمدة خمس دقائق", () => {
    expect(getRemainingTime(createMission("volcano"))).toBe(300);
    expect(getRemainingTime(createMission("snow"))).toBe(300);
  });

  it("تبتلع اللاڤا قرية الفوهة إن لم تُخلَ قبل موعدها", () => {
    let mission = startMission(createMission("volcano"));
    mission = tickMission(mission, 93);
    expect(mission.nodes.find((node) => node.id === "crater-village")?.lost).toBe(true);
    expect(getLostCount(mission)).toBeGreaterThan(0);
  });

  it("يغلق الثلج طريقًا في بداية الحدث الدوري", () => {
    let mission = startMission(createMission("snow"));
    mission = tickMission(mission, 15.1);
    expect(mission.blockedRoadTarget).toBe("glacier-school");
  });

  it("يتطلب فتح المسار موادًا ويمنع تكرار الرابط", () => {
    let mission = startMission(createMission("snow"));
    const first = connectNode(mission, "west-lodges");
    mission = first.state;
    expect(mission.materials).toBe(14);
    expect(connectNode(mission, "west-lodges").message).toContain("يعمل بالفعل");
  });
});

/* ===== اختبارات مسار اللاڤا وقذائف البركان ===== */

import { describe, expect, it } from "vitest";
import {
  bombImpacts,
  bombPosition,
  bombsInFlight,
  bombScorches,
  BOMB_LANDING_BOUNDS,
  eruptedCount,
  getLavaFront,
  getLavaPath,
  makeBombSchedule,
  pathLength,
  pointAlongPath,
  trimPathToDistance,
  VOLCANO_CRATER,
} from "./stageEngine";
import { getStage } from "./stages";

const volcano = getStage("volcano");

describe("مسار اللاڤا", () => {
  it("يبدأ من فوهة البركان ويمر بكل الأحياء مرتبة زمنيًا", () => {
    const path = getLavaPath(volcano);
    expect(path[0]).toEqual(VOLCANO_CRATER);
    expect(path).toHaveLength(volcano.nodes.length + 1);
  });

  it("يجعل جبهة اللاڤا تصعد باستمرار وتبلغ 1 عند آخر حي", () => {
    expect(getLavaFront(volcano, 0)).toBe(0);
    let previous = 0;
    for (let time = 0; time <= 300; time += 5) {
      const front = getLavaFront(volcano, time);
      expect(front).toBeGreaterThanOrEqual(previous);
      expect(front).toBeLessThanOrEqual(1);
      previous = front;
    }
    expect(getLavaFront(volcano, 282)).toBeCloseTo(1, 5);
  });

  it("يحسب النقاط على المسار بطول صحيح", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    expect(pathLength(points)).toBe(150);
    expect(pointAlongPath(points, 0).x).toBe(0);
    expect(pointAlongPath(points, 100)).toMatchObject({ x: 100, y: 0 });
    expect(pointAlongPath(points, 125).y).toBe(25);
    expect(pointAlongPath(points, 999)).toMatchObject({ x: 100, y: 50 });
  });

  it("يقص المسار حتى مسافة محددة دون تجاوزها", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ];
    expect(trimPathToDistance(points, 150)).toHaveLength(3);
    const trimmed = trimPathToDistance(points, 125);
    expect(trimmed).toHaveLength(3);
    expect(trimmed[2]).toMatchObject({ x: 100, y: 25 });
    expect(trimPathToDistance(points, 0)).toHaveLength(1);
  });
});

describe("قذائف البركان", () => {
  it("يبني جدولًا حتميًا يعيد نفس النتيجة بنفس البذرة", () => {
    const first = makeBombSchedule(20260825, VOLCANO_CRATER, 300);
    const second = makeBombSchedule(20260825, VOLCANO_CRATER, 300);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(10);
    expect(first[0].launch).toBeGreaterThanOrEqual(20);
  });

  it("يُسقط كل قذيفة داخل حدود الجزيرة", () => {
    for (const bomb of makeBombSchedule(7, VOLCANO_CRATER, 300)) {
      expect(bomb.to.x).toBeGreaterThanOrEqual(BOMB_LANDING_BOUNDS.x0);
      expect(bomb.to.x).toBeLessThanOrEqual(BOMB_LANDING_BOUNDS.x1);
      expect(bomb.to.y).toBeGreaterThanOrEqual(BOMB_LANDING_BOUNDS.y0);
      expect(bomb.to.y).toBeLessThanOrEqual(BOMB_LANDING_BOUNDS.y1);
    }
  });

  it("يصنف القذائف طائرة وأثر ارتطام وحرقًا وفق الزمن", () => {
    const schedule = makeBombSchedule(11, VOLCANO_CRATER, 300);
    const bomb = schedule[0];
    expect(bombsInFlight(schedule, bomb.launch + 0.5)).toHaveLength(1);
    expect(bombsInFlight(schedule, bomb.launch + bomb.flight + 0.1)).toHaveLength(0);
    const landedAt = bomb.launch + bomb.flight;
    expect(bombImpacts(schedule, landedAt + 0.4)).toHaveLength(1);
    expect(bombScorches(schedule, landedAt + 5).some((item) => item.id === bomb.id)).toBe(true);
    expect(bombScorches(schedule, landedAt + 25).some((item) => item.id === bomb.id)).toBe(false);
    expect(eruptedCount(schedule, 0)).toBe(0);
    expect(eruptedCount(schedule, 400)).toBe(schedule.length);
  });

  it("يقوس القذيفة فوق الخط المستقيم بين الفوهة ومكان السقوط", () => {
    const bomb = makeBombSchedule(5, VOLCANO_CRATER, 300)[0];
    const mid = bombPosition(bomb, bomb.launch + bomb.flight / 2);
    expect(mid.height).toBeCloseTo(bomb.arc, 5);
    const straight = (bomb.from.y + bomb.to.y) / 2;
    expect(mid.y - mid.height).toBeLessThan(straight);
    const end = bombPosition(bomb, bomb.launch + bomb.flight);
    expect(end.x).toBeCloseTo(bomb.to.x, 5);
    expect(end.height).toBeCloseTo(0, 5);
  });
});
