import { describe, expect, it } from "vitest";
import { GP_REQUIREMENT_IDS } from "../domain/orbs";
import { allowedRevivalCounts, revivalRequiredCount } from "../domain/revival";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { cycleGpHint, emptyWorldState, gpHintState, loadWorldState, saveWorldState, setGpHint, setReviveSeedResolution } from "./worldState";
import { emptyManualState, emptyRamState } from "./trackerState";
import { resetTracking } from "./resetTracking";
import { createLogicContext, evaluateCode, evaluateOrbGate, orbCompletion } from "../logic/reachability";

function storage(): Storage {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); }, clear: () => data.clear(), key: (i) => [...data.keys()][i] ?? null, get length() { return data.size; } };
}
const imported = (options: string) => applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(`version=1.49 mode=open opGoal=mtr ${options}`));

describe("explicit per-item GP hint knowledge", () => {
  it.each(GP_REQUIREMENT_IDS)("%s defaults unknown and cycles through all states without changing ownership/Orb data", (id) => {
    let world = emptyWorldState(); const orbs = world.orbs, marks = world.manualClearedOrbs;
    expect(gpHintState(world, id)).toBe("unknown");
    world = cycleGpHint(world, id); expect(gpHintState(world, id)).toBe("required");
    world = cycleGpHint(world, id); expect(gpHintState(world, id)).toBe("not-required");
    world = cycleGpHint(world, id); expect(gpHintState(world, id)).toBe("unknown");
    expect(world.gpHints).toEqual({}); expect(world.orbs).toBe(orbs); expect(world.manualClearedOrbs).toBe(marks);
  });
  it.each([1, 2, 3])("migrates explicit old exclusions from v%s and never treats defaults/unmarked entries as hints", (version) => {
    const store = storage(), { gpHints: _unused, ...old } = emptyWorldState();
    store.setItem(`som-web-tracker:world-state:v${version}`, JSON.stringify({ ...old, version, gpNotNeeded: ["element-gnome", "weapon-axe", "bogus", false] }));
    const world = loadWorldState(store);
    expect(world.gpHints).toEqual({ "element-gnome": "not-required", "weapon-axe": "not-required" });
    expect(gpHintState(world, "element-undine")).toBe("unknown");
    saveWorldState(store, world); expect(loadWorldState(store)).toEqual(world);
  });
  it.each([true, false])("ambiguous legacy booleans (%s) are not evidence of received hints", (value) => {
    const store = storage(), state = emptyWorldState();
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...state, gpHints: { "element-gnome": value, "weapon-axe": !value } }));
    expect(loadWorldState(store).gpHints).toEqual({});
    const { gpHints: _unused, ...old } = state;
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...old, gpNotNeeded: { "element-gnome": value }, gpRequired: { "weapon-axe": value } }));
    expect(loadWorldState(store).gpHints).toEqual({});
  });
  it("persists confirmed states, ignores malformed entries, and does not resurrect exclusions after reset", () => {
    const store = storage(), world = emptyWorldState();
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...world, gpHints: {
      "element-gnome": "required", "weapon-axe": "not-required", "element-undine": "unknown", "seed-fire": "required", "element-dryad": 1,
    } }));
    const loaded = loadWorldState(store);
    expect(loaded.gpHints).toEqual({ "element-gnome": "required", "weapon-axe": "not-required" });
    const reset = resetTracking("orbs", { world: loaded, manual: emptyManualState(), manualItems: new Set() });
    saveWorldState(store, reset.world); expect(loadWorldState(store).gpHints).toEqual({});
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...reset.world, gpNotNeeded: ["element-gnome"] }));
    expect(loadWorldState(store).gpHints).toEqual({});
  });
  it.each(["orbs", "manual", "seed"] as const)("%s reset has the correct GP-knowledge boundary", (scope) => {
    const before = setGpHint(setGpHint(emptyWorldState(), "element-gnome", "required"), "weapon-axe", "not-required");
    const after = resetTracking(scope, { world: before, manual: emptyManualState(), manualItems: new Set() });
    expect(after.world.gpHints).toEqual(scope === "manual" ? before.gpHints : {});
  });
  it("unknown and confirmed required do not assign Orb identity or infer completion; known requirements win", () => {
    const ram = emptyRamState(); let world = emptyWorldState();
    const gate = () => evaluateOrbGate(createLogicContext(ram, new Set(), world), "gp_orb1");
    expect(gate()).toBe("unknown");
    world = setGpHint(world, "element-gnome", "required");
    expect(gate()).toBe("unknown"); expect(world.orbs.gp_orb1).toEqual({ kind: "unknown" });
    expect(orbCompletion(createLogicContext(ram, new Set(), world), "gp_orb1")).toBe("none");
    world.orbs.gp_orb1 = { kind: "element", element: "gnome" };
    world = setGpHint(world, "element-gnome", "not-required");
    expect(gate()).toBe("blocked"); expect(ram.inventory["element-gnome"]).toBeNull();
  });
});

describe("MTR imported definition versus inline manual resolution", () => {
  it.each([1, 5, 8])("preserves fixed import %s unless explicitly overridden, and Reset restores it", (count) => {
    const original = imported(`opNumSeeds=${count}`);
    expect(revivalRequiredCount(original)).toBe(count); expect(allowedRevivalCounts(original.settings)).toEqual([1,2,3,4,5,6,7,8]);
    const overridden = setReviveSeedResolution(original, 6);
    expect(overridden.settings.reviveSeedCount).toBe(count); expect(overridden.manualReviveSeedCount).toBe(6);
    expect(revivalRequiredCount(overridden)).toBe(6);
    const reset = setReviveSeedResolution(overridden, null);
    expect(reset.manualReviveSeedCount).toBeNull(); expect(revivalRequiredCount(reset)).toBe(count);
  });
  it("imports inclusive 5..8, validates manual choices, and persists the rolled value/range separately", () => {
    let world = imported("opNumSeeds=random opMinSeeds=5 opMaxSeeds=8");
    expect(world.settings.reviveSeedCount).toBeNull(); expect(world.settings.reviveSeedRange).toEqual({ min: 5, max: 8 });
    expect(allowedRevivalCounts(world.settings)).toEqual([5,6,7,8]); expect(revivalRequiredCount(world)).toBeNull();
    for (const invalid of [0, 4, 9, 6.5, NaN]) expect(setReviveSeedResolution(world, invalid)).toBe(world);
    world = setReviveSeedResolution(world, 7); const store = storage(); saveWorldState(store, world);
    world = loadWorldState(store); expect(revivalRequiredCount(world)).toBe(7); expect(world.settings.reviveSeedCount).toBeNull();
    expect(world.settings.reviveSeedRange).toEqual({ min: 5, max: 8 });
    expect(revivalRequiredCount(setReviveSeedResolution(world, null))).toBeNull();
  });
  it("mirrors source range defaults and min>max clamp, and ignores random-only bounds for a fixed count", () => {
    expect(allowedRevivalCounts(imported("opNumSeeds=random").settings)).toEqual([1,2,3,4,5,6,7,8]);
    const clamped = imported("opNumSeeds=random opMinSeeds=8 opMaxSeeds=5");
    expect(clamped.settings.reviveSeedRange).toEqual({ min: 5, max: 5 }); expect(revivalRequiredCount(clamped)).toBe(5);
    const fixed = imported("opNumSeeds=3 opMinSeeds=5 opMaxSeeds=8");
    expect(fixed.settings.reviveSeedRange).toBeNull(); expect(revivalRequiredCount(fixed)).toBe(3);
  });
  it.each(["opMinSeeds=0", "opMaxSeeds=9", "opMinSeeds=bad"])("rejects range options outside authoritative limits: %s", (bad) => {
    expect(parseRandomizerSettings(`opGoal=mtr opNumSeeds=random ${bad}`).settings).toBeNull();
  });
  it("keeps a compatible resolution on reimport, but clears it when the imported MTR definition changes", () => {
    const raw = "opGoal=mtr opNumSeeds=random opMinSeeds=5 opMaxSeeds=8";
    const world = setReviveSeedResolution(imported("opNumSeeds=random opMinSeeds=5 opMaxSeeds=8"), 6);
    expect(applyRandomizerSettings(world, parseRandomizerSettings(raw)).manualReviveSeedCount).toBe(6);
    expect(applyRandomizerSettings(world, parseRandomizerSettings(`${raw} opMinSeeds=7`)).manualReviveSeedCount).toBeNull();
    const fixed = applyRandomizerSettings(world, parseRandomizerSettings("opGoal=mtr opNumSeeds=5"));
    expect(fixed.manualReviveSeedCount).toBeNull(); expect(revivalRequiredCount(fixed)).toBe(5);
  });
  it.each(["orbs", "manual", "seed"] as const)("%s reset preserves/clears manual MTR resolution as seed configuration", (scope) => {
    const world = setReviveSeedResolution(imported("opNumSeeds=random opMinSeeds=5 opMaxSeeds=8"), 6);
    const reset = resetTracking(scope, { world, manual: emptyManualState(), manualItems: new Set() });
    expect(reset.world.manualReviveSeedCount).toBe(scope === "seed" ? null : 6);
  });
  it("legacy fixed values survive reload; invalid out-of-range manual values are discarded", () => {
    const store = storage(), world = imported("opNumSeeds=random opMinSeeds=5 opMaxSeeds=8");
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...world, manualReviveSeedCount: 4 }));
    expect(loadWorldState(store).manualReviveSeedCount).toBeNull();
    const { manualReviveSeedCount: _unused, ...old } = emptyWorldState();
    const { reviveSeedRange: _oldRange, ...oldSettings } = old.settings;
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...old, settings: { ...oldSettings, reviveSeedCount: 5 } }));
    expect(revivalRequiredCount(loadWorldState(store))).toBe(5); expect(loadWorldState(store).manualReviveSeedCount).toBeNull();
  });
  it("inline resolution recalculates MTR logic without changing acquisition, and Reset restores Unknown", () => {
    const ram = emptyRamState(); ram.inventory["seed-water"] = true;
    let world = imported("opNumSeeds=random");
    const gate = () => evaluateCode("$manaTreeRevive", createLogicContext(ram, new Set(), world));
    expect(gate()).toBe("unknown"); world = setReviveSeedResolution(world, 1); expect(gate()).toBe(true);
    world = setReviveSeedResolution(world, 2); expect(gate()).toBe(false);
    world = setReviveSeedResolution(world, null); expect(gate()).toBe("unknown"); expect(ram.inventory["seed-water"]).toBe(true);
  });
});
