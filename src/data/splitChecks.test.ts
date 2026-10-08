import { describe, expect, it } from "vitest";
import raw from "../../source/poptracker/locations.lua?raw";
import { LEGACY_CHECK_SPLITS, LOCATION_BY_ID, activeLocationDefinitions } from "./locationDefinitions";
const LOCATION_DEFINITIONS = activeLocationDefinitions(false);
import { MAP_AREAS } from "./mapAreas";
import { CHECK_SOURCE_RULES } from "./sourceWorldData";
import { emptyManualState, emptyRamState, setManualCompletion } from "../state/trackerState";
import { emptyWorldState } from "../state/worldState";
import { countTrackerProgress } from "../logic/progress";
import { createLogicContext, evaluateArea, evaluateCheck } from "../logic/reachability";

// Independent event identity and clearAll=false are source evidence, not guesses
// based on item_count. Frozen Lua is provenance/test input, never runtime code.
const sourceEvents = [...raw.matchAll(/\[0x([\da-f]+)\]\s*=\s*\{\s*"([^"]+)",\s*(true|false)/gi)]
  .map((match) => ({ event: Number.parseInt(match[1], 16), path: match[2], clearAll: match[3] === "true" }));
const cases = [
  ["pandora-castle-chests", [0x673, 0x67c, 0x683, 0x684, 0x685, 0x686], "pandora", 8],
  ["moogle-village-double-chest", [0x670, 0x676], "upper-land-moogle-village", 2],
  ["castle-double-chest", [0x679, 0x68f], "vandole-empire-north-town-north-town-castle", 5],
  ["elinees-castle-reward-chests-spikey-tiger", [0x688, 0x689], "elinee-s-castle", 2],
] as const;
describe("authoritative independent chest audit", () => {
  it.each(cases)("splits %s only into its existing independent source events", (oldId, expected, areaId, total) => {
    const ids = LEGACY_CHECK_SPLITS[oldId];
    const checks = ids.map((id) => LOCATION_BY_ID.get(id)!);
    expect(checks.map((check) => check.events[0].eventNumber)).toEqual(expected);
    const source = sourceEvents.filter((entry) => entry.path === checks[0].legacyPath);
    expect(source.map((entry) => entry.event).sort()).toEqual([...expected].sort());
    expect(source.every((entry) => !entry.clearAll)).toBe(true);
    expect(checks.every((check) => check.events.length === 1)).toBe(true);
    expect(MAP_AREAS.find((area) => area.id === areaId)?.checkIds).toHaveLength(total);
    for (const id of ids) expect(CHECK_SOURCE_RULES[id]).toEqual(CHECK_SOURCE_RULES[ids[0]]);
  });
  it("leaves Undine as one verified event with two metadata reward slots in its own area", () => {
    const check = LOCATION_BY_ID.get("undine-biting-lizard")!;
    expect(sourceEvents.filter((entry) => entry.path === check.legacyPath)).toEqual([
      { event: 0x581, path: check.legacyPath, clearAll: true },
    ]);
    expect(check.events).toEqual([{ eventNumber: 0x581 }]);
    const area = MAP_AREAS.find((entry) => entry.id === "undine-cave")!;
    expect(area.checkIds).toEqual(["undine-biting-lizard"]);
    expect(area.sourceNote).toContain("two reward slots");
    expect(MAP_AREAS.find((entry) => entry.id === "water-palace")?.checkIds).not.toContain(check.id);
  });
  it("counts 76 independent checks without adding or duplicating any event binding", () => {
    expect(LOCATION_DEFINITIONS).toHaveLength(76);
    expect(LOCATION_DEFINITIONS.reduce((sum, check) => sum + check.events.length, 0)).toBe(76);
    expect(new Set(LOCATION_DEFINITIONS.flatMap((check) => check.events.map((event) => event.eventNumber))).size).toBe(76);
    expect(new Set(sourceEvents.map((entry) => entry.event))).toEqual(new Set(LOCATION_DEFINITIONS.flatMap((check) => check.events.map((event) => event.eventNumber))));
  });
  it("tracks partial chest completion, availability, rollback and per-chest manual marks independently", () => {
    const ram = emptyRamState(), world = emptyWorldState(), area = MAP_AREAS.find((entry) => entry.id === "pandora")!;
    let manual = emptyManualState();
    const context = () => createLogicContext(ram, new Set(), world);
    const progress = () => countTrackerProgress(context(), manual);
    const first = "pandora-castle-chest-673", second = "pandora-castle-chest-67c";
    expect(evaluateCheck(first, context(), manual).access).toBe("reachable");
    const before = progress();
    ram.checks[first] = true;
    expect(progress()).toMatchObject({ total: 76, completed: before.completed + 1, available: before.available - 1 });
    expect(evaluateArea(area, context(), manual)).toMatchObject({ completed: 1, total: 8 });
    expect(evaluateCheck(second, context(), manual).complete).toBe(false);
    ram.checks[first] = false;
    expect(progress()).toEqual(before);
    manual = setManualCompletion(manual, second, true);
    expect(progress().completed).toBe(1);
    expect(evaluateCheck(first, context(), manual).complete).toBe(false);
    expect(evaluateCheck(second, context(), manual).complete).toBe(true);
  });
  it("keeps clarified reward labels on the original events and targets", () => {
    expect(LOCATION_BY_ID.get("kakkara-npc")).toMatchObject({ name: "Kakkara NPC - Sea Hare Tail Trade", events: [{ eventNumber: 0x2b2, completedValue: 2 }] });
    expect(LOCATION_BY_ID.get("salamando")).toMatchObject({ name: "Tropical Town After Boss - Stove", events: [{ eventNumber: 0x38c }] });
    expect(MAP_AREAS.find((area) => area.checkIds.includes("salamando"))?.name).toBe("Tropical Town After Boss - Stove");
  });
});
