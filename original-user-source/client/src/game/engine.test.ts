import { describe, expect, it } from "vitest";
import { EMERGENCY_BATTERY_MULTIPLIER, GAME_DURATION, ROAD_GRAPH_EDGES, activateDetour, activateEmergencyRoute, cancelEmergencyRoute, chooseUpgrade, connectNode, createGame, createResultDemo, findRoadGraphPath, getLostCount, getRainDensityMultiplier, getRoadRoute, getShareSummary, startGame, tickGame } from "./engine";
import { getStormIntensityForStage, getStormStage, getStormVolumeForStage, getThunderCue, getThunderIntervalForStage, REAL_AUDIO_ASSETS } from "./audio";

describe("rescue network game engine", () => {
  it("publishes five stone-road corridors and two distinct disaster connectors", () => {
    expect(ROAD_GRAPH_EDGES).toHaveLength(7);
    expect(ROAD_GRAPH_EDGES.map((edge) => edge.id)).toEqual([
      "main-residential",
      "main-hospital",
      "main-school",
      "main-harbor",
      "main-radio",
      "flood-school-harbor",
      "cliff-radio-residential",
    ]);
    expect(ROAD_GRAPH_EDGES.find((edge) => edge.id === "flood-school-harbor")?.condition).toBe("flood_connector");
    expect(ROAD_GRAPH_EDGES.find((edge) => edge.id === "cliff-radio-residential")?.condition).toBe("cliff_connector");
    expect(ROAD_GRAPH_EDGES.every((edge) => edge.points.length >= 11)).toBe(true);
    const radioRoute = findRoadGraphPath(createGame(), "hq", "radio");
    expect(radioRoute.length).toBeGreaterThan(4);
    expect(radioRoute.at(-1)).toEqual({ x: 290, y: 480 });
  });

  it("routes every target over its explicit stone corridor and swaps only to the matching disaster connector", () => {
    const normal = createGame();
    for (const nodeId of ["residential", "hospital", "school", "harbor", "radio"] as const) {
      const route = getRoadRoute(normal, nodeId);
      expect(route[0]).toEqual({ x: 555, y: 360 });
      expect(route.at(-1)).toEqual(normal.nodes.find((node) => node.id === nodeId && node.id !== "residential")?.id === "hospital" ? { x: 440, y: 245 } : normal.nodes.find((node) => node.id === nodeId && node.id !== "hospital") ? ROAD_GRAPH_EDGES.find((edge) => edge.id === `main-${nodeId}`)?.points.at(-1) : undefined);
    }
    const flood = activateDetour({ ...normal, floodedHarbor: true }, "harbor");
    expect(getRoadRoute(flood, "harbor")).toContainEqual({ x: 750, y: 190 });
    expect(getRoadRoute(flood, "harbor")).toContainEqual({ x: 792, y: 327 });
    const cliff = activateDetour({ ...normal, cliffCollapsed: true }, "residential");
    expect(getRoadRoute(cliff, "residential")).toContainEqual({ x: 250, y: 379 });
    expect(getRoadRoute(cliff, "residential")).toContainEqual({ x: 250, y: 210 });
  });

  it("creates a paid network line and prevents duplicate lines", () => {
    const game = createGame();
    const first = connectNode(game, "hospital");
    expect(first.state.materials).toBe(10);
    expect(first.state.links).toHaveLength(1);
    expect(connectNode(first.state, "hospital").state.links).toHaveLength(1);
  });

  it("breaks the harbor route when the eastern bridge collapses", () => {
    const game = connectNode(connectNode(createGame(), "harbor").state, "hospital").state;
    const afterHazard = tickGame(startGame(game), 96);
    expect(afterHazard.links.find((link) => link.nodeId === "harbor")?.broken).toBe(true);
    expect(afterHazard.phase).toBe("upgrade");
    const repaired = chooseUpgrade(afterHazard, "bridge");
    expect(repaired.phase).toBe("running");
    expect(repaired.bridgePass).toBe(true);
    expect(repaired.links.find((link) => link.nodeId === "harbor")?.broken).toBe(false);
    expect(repaired.lastEvent).toContain("الجسر الميداني");
  });

  it("applies a selected upgrade and resumes the round", () => {
    const game = tickGame(startGame(createGame()), 46);
    const upgraded = chooseUpgrade(game, "network");
    expect(upgraded.phase).toBe("running");
    expect(upgraded.maxLinks).toBe(4);
  });

  it("increases ambulance capacity through the capacity upgrade", () => {
    const game = tickGame(startGame(createGame()), 46);
    const upgraded = chooseUpgrade(game, "capacity");
    expect(upgraded.ambulanceCapacity).toBe(3);
  });

  it("opens one temporary emergency route and applies doubled battery drain", () => {
    const game = startGame(createGame());
    const emergency = activateEmergencyRoute(game, "hospital");
    const afterOneSecond = tickGame(emergency.state, 1);
    expect(afterOneSecond.emergencyRoute?.targetId).toBe("hospital");
    expect(afterOneSecond.battery).toBeLessThanOrEqual(100 - 0.18 * EMERGENCY_BATTERY_MULTIPLIER);
    expect(activateEmergencyRoute(afterOneSecond, "school").state.emergencyRoute?.targetId).toBe("hospital");
  });

  it("creates a shareable summary that includes the bridge event and player decision", () => {
    const state = activateEmergencyRoute(startGame(createGame()), "hospital").state;
    expect(getShareSummary(state)).toContain("انهيار الجسر");
    expect(getShareSummary(state)).toContain("مسار الطوارئ");
  });

  it("allows the player to cancel an active emergency route", () => {
    const active = activateEmergencyRoute(startGame(createGame()), "school").state;
    const cancelled = cancelEmergencyRoute(active);
    expect(cancelled.emergencyRoute).toBeNull();
    expect(cancelled.lastEvent).toContain("إلغاء");
  });

  it("marks anyone not evacuated as lost when the final storm reaches the island", () => {
    const state = tickGame(startGame(createGame()), GAME_DURATION);
    expect(state.phase).toBe("finished");
    expect(state.nodes.every((node) => node.lost)).toBe(true);
    expect(getLostCount(state)).toBeGreaterThan(0);
    expect(state.lastEvent).toContain("وصلت العاصفة");
  });

  it("finishes immediately and releases all lines when every person has been evacuated", () => {
    const connected = connectNode(startGame(createGame()), "hospital").state;
    const almostDone = { ...connected, ambulanceCapacity: 100, tripDuration: 0.1, tripProgress: { hospital: 0.09 }, nodes: connected.nodes.map((node) => node.id === "hospital" ? { ...node, rescued: node.people - 1 } : { ...node, rescued: node.people }) };
    const finished = tickGame(almostDone, 0.02);
    expect(finished.phase).toBe("finished");
    expect(finished.links).toHaveLength(0);
    expect(finished.lastEvent).toContain("جميع الأشخاص");
  });

  it("rescues a whole number only after an ambulance completes a round trip", () => {
    const connected = connectNode(startGame(createGame()), "hospital").state;
    const prepared = { ...connected, tripDuration: 1, nodes: connected.nodes.map((node) => node.id === "hospital" ? node : { ...node, rescued: node.people }) };
    const beforeArrival = tickGame(prepared, 0.95);
    const afterArrival = tickGame(beforeArrival, 0.1);
    const hospitalBefore = beforeArrival.nodes.find((node) => node.id === "hospital");
    const hospitalAfter = afterArrival.nodes.find((node) => node.id === "hospital");
    expect(hospitalBefore?.rescued).toBe(0);
    expect(hospitalAfter?.rescued).toBe(1);
  });

  it("reports losses as an integer even when a final evacuation is partially complete", () => {
    const demo = createResultDemo();
    expect(getLostCount(demo)).toBe(40);
    expect(Number.isInteger(getLostCount(demo))).toBe(true);
  });

  it("adds 32 residents while keeping the communications station evacuable before the 45-second strike", () => {
    const fresh = createGame();
    expect(fresh.nodes.reduce((total, node) => total + node.people, 0)).toBe(124);
    const connected = connectNode(startGame(fresh), "radio").state;
    const protectedBeforeStrike = tickGame(connected, 42);
    expect(protectedBeforeStrike.nodes.find((node) => node.id === "radio")?.rescued).toBe(10);
    expect(tickGame(protectedBeforeStrike, 3).radioStrikeLosses).toBe(0);
  });

  it("raises the storm in six clear 30-second stages toward the final 30 seconds", () => {
    expect(getStormStage(0)).toBe(1);
    expect(getStormStage(31)).toBe(2);
    expect(getStormStage(92)).toBe(4);
    expect(getStormStage(151)).toBe(6);
    expect(getStormIntensityForStage(6)).toBeGreaterThan(getStormIntensityForStage(1));
    expect(getStormVolumeForStage(6)).toBeGreaterThan(getStormVolumeForStage(1));
    expect(REAL_AUDIO_ASSETS.storm).toContain("rescue-storm-real");
    expect(REAL_AUDIO_ASSETS.ambulance).toContain("rescue-ambulance-field-real");
    expect(REAL_AUDIO_ASSETS.thunder).toContain("rescue-thunder-cc0");
  });

  it("schedules thunder at 15/10/6/5/5/3 second intervals and lightning 2 seconds later", () => {
    expect([1, 2, 3, 4, 5, 6].map(getThunderIntervalForStage)).toEqual([15, 10, 6, 5, 5, 3]);
    expect(getThunderCue(0)).toMatchObject({ index: 0, thunderAt: 0, lightningAt: 2, stage: 1 });
    expect(getThunderCue(15)).toMatchObject({ index: 1, thunderAt: 15, lightningAt: 17, stage: 1 });
    expect(getThunderCue(30)).toMatchObject({ thunderAt: 30, lightningAt: 32, stage: 2 });
    expect(getThunderCue(60)).toMatchObject({ thunderAt: 60, lightningAt: 62, stage: 3 });
    expect(getThunderCue(90)).toMatchObject({ thunderAt: 90, lightningAt: 92, stage: 4 });
    expect(getThunderCue(120)).toMatchObject({ thunderAt: 120, lightningAt: 122, stage: 5 });
    expect(getThunderCue(150)).toMatchObject({ thunderAt: 150, lightningAt: 152, stage: 6 });
  });

  it("keeps existing evacuations active while blocking only new routes in the final 10 seconds", () => {
    const beforeLock = { ...startGame(createGame()), elapsed: 169 };
    expect(connectNode(beforeLock, "school").message).toBe("خط الإنقاذ نشط");
    const locked = tickGame({ ...startGame(createGame()), elapsed: 169 }, 1);
    expect(locked.nodes.every((node) => !node.lost)).toBe(true);
    expect(connectNode(locked, "school").message).toContain("10 ثوانٍ");
    const active = connectNode({ ...startGame(createGame()), elapsed: 165 }, "hospital").state;
    expect(tickGame(active, 6).nodes.find((node) => node.id === "hospital")?.lost).toBe(false);
  });

  it("requires the field bridge before reopening or creating the harbor route after collapse", () => {
    const linked = connectNode(startGame(createGame()), "harbor").state;
    const collapsed = tickGame(linked, 96);
    expect(connectNode(collapsed, "harbor").message).toContain("الجسر الشرقي");
    const repaired = chooseUpgrade(collapsed, "bridge");
    expect(repaired.bridgePass).toBe(true);
    expect(repaired.links.find((link) => link.nodeId === "harbor")?.broken).toBe(false);
  });

  it("applies exactly one or two radio casualties at 45 seconds when radio was not among the first three routes", () => {
    let state = startGame(createGame());
    for (const nodeId of ["hospital", "school", "harbor"] as const) state = connectNode(state, nodeId).state;
    const struck = tickGame({ ...state, tripDuration: 100 }, 45);
    const radio = struck.nodes.find((node) => node.id === "radio");
    expect(struck.radioStrikeApplied).toBe(true);
    expect(struck.radioStrikeLosses).toBeGreaterThanOrEqual(1);
    expect(struck.radioStrikeLosses).toBeLessThanOrEqual(2);
    expect(radio?.casualties).toBe(struck.radioStrikeLosses);
  });

  it("prevents radio casualties when communications is protected by one of the first three routes", () => {
    let state = startGame(createGame());
    for (const nodeId of ["radio", "hospital", "school"] as const) state = connectNode(state, nodeId).state;
    const protectedState = tickGame({ ...state, tripDuration: 100 }, 45);
    expect(protectedState.radioStrikeApplied).toBe(true);
    expect(protectedState.radioStrikeLosses).toBe(0);
    expect(protectedState.nodes.find((node) => node.id === "radio")?.casualties).toBe(0);
  });

  it("arms the radio strike again for every newly created mission", () => {
    const struck = tickGame(startGame(createGame()), 45);
    expect(struck.radioStrikeApplied).toBe(true);
    expect(createGame().radioStrikeApplied).toBe(false);
  });

  it("closes the direct harbor route at 110 seconds and only redirects through the school after a manual decision", () => {
    const connected = connectNode(startGame(createGame()), "harbor").state;
    const collapsed = tickGame({ ...connected, tripDuration: 100 }, 95);
    const repaired = chooseUpgrade(collapsed, "bridge");
    const flooded = tickGame(repaired, 15);
    expect(flooded.floodedHarbor).toBe(true);
    expect(flooded.links.find((link) => link.nodeId === "harbor")?.broken).toBe(true);
    expect(flooded.manualDetours.harbor).toBeUndefined();
    const rerouted = activateDetour(flooded, "harbor");
    expect(rerouted.links.find((link) => link.nodeId === "harbor")?.detour).toBe(true);
    expect(getRoadRoute(rerouted, "harbor")).toContainEqual({ x: 750, y: 190 });
  });

  it("collapses a residential cliff between 80 and 100 seconds and only routes the neighborhood via communications after a manual decision", () => {
    const game = startGame({ ...createGame(), cliffCollapseAt: 84, processedUpgradeWaves: [1] });
    expect(game.cliffCollapseAt).toBeGreaterThanOrEqual(80);
    expect(game.cliffCollapseAt).toBeLessThanOrEqual(100);
    const beforeCollapse = tickGame(game, 83);
    expect(beforeCollapse.cliffCollapsed).toBe(false);
    const afterCollapse = tickGame(beforeCollapse, 1);
    expect(afterCollapse.cliffCollapsed).toBe(true);
    expect(afterCollapse.lastEvent).toContain("فعّل التحويل اليدوي عبر محطة الاتصالات");
    expect(afterCollapse.links.find((link) => link.nodeId === "residential")?.broken).toBeUndefined();
    const rerouted = activateDetour(afterCollapse, "residential");
    expect(getRoadRoute(rerouted, "residential")).toContainEqual({ x: 290, y: 480 });
  });

  it("keeps vehicle speed and evacuation cadence fixed when a manual detour is activated", () => {
    const linked = connectNode(startGame({ ...createGame(), tripDuration: 1 }), "harbor").state;
    const direct = tickGame(linked, 1.1);
    const detour = activateDetour({ ...linked, floodedHarbor: true }, "harbor");
    const delayed = tickGame(detour, 1.1);
    expect(direct.nodes.find((node) => node.id === "harbor")?.rescued).toBe(1);
    expect(delayed.nodes.find((node) => node.id === "harbor")?.rescued).toBe(1);
    expect(delayed.vehicleSpeed).toBe(linked.vehicleSpeed);
  });

  it("raises rainfall by 50 percent in minute two and 100 percent in minute three", () => {
    expect(getRainDensityMultiplier(0)).toBe(1);
    expect(getRainDensityMultiplier(59.9)).toBe(1);
    expect(getRainDensityMultiplier(60)).toBe(1.5);
    expect(getRainDensityMultiplier(119.9)).toBe(1.5);
    expect(getRainDensityMultiplier(120)).toBe(2);
  });

  it("removes the bridge event and rejects its upgrade when harbor evacuation is already complete", () => {
    const linked = connectNode(startGame(createGame()), "harbor").state;
    const evacuated = { ...linked, nodes: linked.nodes.map((node) => node.id === "harbor" ? { ...node, rescued: node.people } : node) };
    const afterBridgeTime = tickGame(evacuated, 96);
    expect(afterBridgeTime.hazard).not.toBe("bridge");
    expect(afterBridgeTime.links.some((link) => link.nodeId === "harbor" && link.broken)).toBe(false);
    expect(chooseUpgrade({ ...afterBridgeTime, phase: "upgrade" }, "bridge").bridgePass).toBe(false);
  });
});
