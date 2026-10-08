import { describe, expect, it } from "vitest";
import { SANDSHIP } from "./sandship";
import { activeLocationDefinitions, LOCATION_BY_ID } from "./locationDefinitions";
import { activeMapAreas, MAP_AREA_BY_ID } from "./mapAreas";
import { activeHintMarkers, HINT_SOURCES } from "./hintMarkers";
import { CHECK_REGION } from "../domain/cannons";
import { emptyManualState, emptyRamState, setManualCompletion, deriveEffectiveCheckState, saveManualState, loadManualState } from "../state/trackerState";
import { emptyWorldState, loadWorldState, saveWorldState, setHintRead } from "../state/worldState";
import { countTrackerProgress } from "../logic/progress";
import { createLogicContext, evaluateArea, evaluateCheck } from "../logic/reachability";

describe("source-backed Sandship extension", () => {
  it("keeps Captain, Morie, boss and fixed reward identities separate", () => {
    expect(SANDSHIP).toMatchObject({ captainId: "sandship-captain", hintId: "sandship-morie-hint",
      plandoKey: "p_Sandship-Captain", captainEvent: 0x2a3, hintEvent: 0x2a2, deathEvent: 0x2a1,
      crewMap: 91, captainObject: 1, hintObject: 0, bossFlagAddress: 0x7ecf28, bossClearedValue: 15 });
    expect(LOCATION_BY_ID.get(SANDSHIP.captainId)?.events).toEqual([{ eventNumber: 0x2a3, requirePersistentFlag: true }]);
    expect(HINT_SOURCES.find((hint) => hint.id === SANDSHIP.hintId)?.name).toBe(SANDSHIP.hintName);
    expect(LOCATION_BY_ID.has(SANDSHIP.hintId as never)).toBe(false);
    expect(CHECK_REGION.get(SANDSHIP.captainId)).toBe("kakkara");
    expect(MAP_AREA_BY_ID.get("sandship")).toMatchObject({ x: 660, y: 1690, checkIds: [SANDSHIP.captainId] });
    expect(SANDSHIP.y).toBeGreaterThan(MAP_AREA_BY_ID.get("kakkara-desert-kakkara")!.y);
  });

  it.each([null, false, true])("gates areas, hints and totals on support=%s", (supported) => {
    const ram = emptyRamState(); ram.sandship.supported = supported; ram.sandship.bossDefeated = true;
    const manual = setManualCompletion(emptyManualState(), SANDSHIP.captainId, true);
    const context = createLogicContext(ram, new Set(), emptyWorldState());
    expect(activeLocationDefinitions(supported)).toHaveLength(supported ? 77 : 76);
    expect(countTrackerProgress(context, manual)).toMatchObject({ total: supported ? 77 : 76, completed: supported ? 1 : 0 });
    expect(activeMapAreas(supported).some((area) => area.id === "sandship")).toBe(supported === true);
    expect(activeHintMarkers(ram.sandship).some((hint) => hint.id === SANDSHIP.hintId)).toBe(supported === true);
    expect(evaluateCheck(SANDSHIP.captainId, context, manual).visible).toBe(supported === true);
  });

  it("reuses Kakkara-start travel without extra items, then gates Captain and Morie on boss clear", () => {
    const ram = emptyRamState(), world = emptyWorldState(), manual = emptyManualState();
    ram.sandship.supported = true; ram.sandship.bossDefeated = false;
    world.settings.cannonMode = "shuffle";
    world.settings.drumLogic = "random";
    const area = MAP_AREA_BY_ID.get("sandship")!;
    const context = () => createLogicContext(ram, new Set(), world);
    expect(evaluateArea(area, context(), manual).status).toBe("unreachable");
    world.settings.startingLocation = "kakkara";
    expect(evaluateArea(area, context(), manual).status).toBe("reachable");
    expect(evaluateCheck(SANDSHIP.captainId, context(), manual)).toMatchObject({ access: "unreachable", complete: false });
    expect(activeHintMarkers(ram.sandship).some((hint) => hint.id === SANDSHIP.hintId)).toBe(false);
    const before = countTrackerProgress(context(), manual).available;
    ram.sandship.bossDefeated = true;
    expect(evaluateCheck(SANDSHIP.captainId, context(), manual)).toMatchObject({ access: "reachable", complete: false });
    expect(countTrackerProgress(context(), manual).available).toBe(before + 1);
    expect(activeHintMarkers(ram.sandship).some((hint) => hint.id === SANDSHIP.hintId)).toBe(true);
    ram.checks[SANDSHIP.captainId] = true;
    expect(evaluateCheck(SANDSHIP.captainId, context(), manual).complete).toBe(true);
    ram.checks[SANDSHIP.captainId] = false; ram.sandship.bossDefeated = false;
    const permanent = setManualCompletion(manual, SANDSHIP.captainId, true);
    expect(deriveEffectiveCheckState(SANDSHIP.captainId, ram, permanent)).toEqual({ complete: true, completionSource: "manual" });
    expect(ram.sandship.bossDefeated).toBe(false);
  });

  it("persists Morie's manual read mark additively without invalidating old v3 data", () => {
    const entries = new Map<string, string>();
    const storage: Storage = { getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => { entries.set(key, value); },
      get length() { return entries.size; }, clear: () => entries.clear(),
      key: (index) => [...entries.keys()][index] ?? null, removeItem: (key) => { entries.delete(key); } };
    const previous = emptyWorldState();
    const { manualReadHints: _unused, ...oldV3 } = previous;
    storage.setItem("som-web-tracker:world-state:v3", JSON.stringify(oldV3));
    expect(loadWorldState(storage).manualReadHints).toEqual([]);
    saveWorldState(storage, setHintRead(loadWorldState(storage), SANDSHIP.hintId, true));
    expect(loadWorldState(storage).manualReadHints).toEqual([SANDSHIP.hintId]);
    const ram = emptyRamState(); ram.sandship.supported = true; ram.sandship.bossDefeated = false;
    expect(activeHintMarkers(ram.sandship).some((hint) => hint.id === SANDSHIP.hintId)).toBe(false);
    expect(loadWorldState(storage).manualReadHints).toEqual([SANDSHIP.hintId]);
    expect(setHintRead(loadWorldState(storage), SANDSHIP.hintId, false).manualReadHints).toEqual([]);
    const marks = setManualCompletion(setManualCompletion(emptyManualState(), "potos-chest", true), SANDSHIP.captainId, true);
    saveManualState(storage, marks);
    expect(loadManualState(storage).manualCompletedChecks).toEqual(["potos-chest", SANDSHIP.captainId]);
    expect(deriveEffectiveCheckState(SANDSHIP.captainId, ram, loadManualState(storage)).completionSource).toBe("manual");
  });
});
