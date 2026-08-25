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
