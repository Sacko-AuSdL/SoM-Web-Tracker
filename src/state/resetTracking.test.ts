import { describe, expect, it } from "vitest";
import { emptyManualState, emptyRamState, loadManualState, saveManualState, setManualCompletion } from "./trackerState";
import { addCannonConnection, emptyWorldState, loadWorldState, saveWorldState, setGpHint } from "./worldState";
import { resetTracking } from "./resetTracking";
import type { InventoryId } from "../data/inventoryDefinitions";
import { countManaSeeds } from "../logic/inventory";
import { createLogicContext, evaluateCode } from "../logic/reachability";

function storage(): Storage {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); }, clear: () => data.clear(), key: (index) => [...data.keys()][index] ?? null,
    get length() { return data.size; } };
}
function fixture() {
  let world = addCannonConnection(emptyWorldState(), { from: "kakkara", to: "potos" });
  world.settings.orbMode = "mixed"; world.settings.goal = "revive"; world.settings.reviveSeedCount = 5;
  world.manualReviveSeedCount = 4;
  world.settings.startingCharacter = "unresolved"; world.settings.resolvedStartingCharacter = "girl";
  world.settings.additionalCharacter = "boy"; world.roles.boy = "sprite"; world.disabledCharacters = ["sprite"];
  world.closedCannonOffices = ["matango"];
  for (const id of Object.keys(world.orbs) as (keyof typeof world.orbs)[]) world.orbs[id] = { kind: "weapon-family", weapon: "axe" };
  world.manualClearedOrbs = Object.keys(world.orbs) as (keyof typeof world.orbs)[];
  world.manualReadHints = ["sandship-morie-hint"];
  world = setGpHint(world, "weapon-axe", "not-required");
  return { world, manual: setManualCompletion(emptyManualState(), "potos-chest", true), manualItems: new Set<InventoryId>(["boy", "weapon-axe"]) };
}
describe("scoped manual tracking resets and additive persistence", () => {
  it("resets exactly all 14 requirements, manual Orb marks and GP choices", () => {
    const before = fixture(), after = resetTracking("orbs", before);
    expect(Object.values(after.world.orbs)).toHaveLength(14);
    expect(Object.values(after.world.orbs).every((value) => value.kind === "unknown")).toBe(true);
    expect(after.world.manualClearedOrbs).toEqual([]); expect(after.world.gpHints).toEqual({});
    expect(after.world.manualReviveSeedCount).toBe(4);
    expect(after.manual).toBe(before.manual); expect(after.manualItems).toBe(before.manualItems);
    expect(after.world.settings).toBe(before.world.settings); expect(after.world.roles).toBe(before.world.roles);
    expect(after.world.cannonConnections).toEqual(before.world.cannonConnections);
    expect(after.world.manualReadHints).toEqual(before.world.manualReadHints);
    expect(before.world.manualClearedOrbs).toHaveLength(14);
  });
  it("manual reset clears all actual progress categories but retains seed configuration", () => {
    const before = fixture(), after = resetTracking("manual", before);
    expect(after.manual).toEqual(emptyManualState()); expect(after.manualItems.size).toBe(0);
    expect(after.world).toEqual({ ...before.world, manualClearedOrbs: [], manualReadHints: [] });
  });
  it("new-seed reset additionally resets imported settings, role/availability identities and Cannon configuration", () => {
    const after = resetTracking("seed", fixture());
    expect(after.world).toEqual(emptyWorldState()); expect(after.manual).toEqual(emptyManualState()); expect(after.manualItems.size).toBe(0);
  });
  it.each(["orbs", "manual", "seed"] as const)("%s reset survives reload without reviving legacy manual records or touching unrelated storage", (scope) => {
    const store = storage(), before = fixture();
    store.setItem("som-web-tracker-mvp:manual-state:v1", JSON.stringify({ potosChestComplete: true }));
    store.setItem("som-web-tracker-mini:manual-state:v2", JSON.stringify({ completedChecks: { potosChest: true } }));
    store.setItem("som-web-tracker:world-state:v1", JSON.stringify(before.world));
    store.setItem("som-web-tracker:ui-preferences:v1", "keep-layout"); store.setItem("connection-preferences", "keep-connection");
    const after = resetTracking(scope, before); saveWorldState(store, after.world); saveManualState(store, after.manual);
    expect(loadWorldState(store)).toEqual(after.world); expect(loadManualState(store)).toEqual(after.manual);
    expect(store.getItem("som-web-tracker:ui-preferences:v1")).toBe("keep-layout");
    expect(store.getItem("connection-preferences")).toBe("keep-connection");
  });
  it.each([1, 2, 3])("loads existing world version %s without GP data, and validates additive GP selections", (version) => {
    const store = storage(), state = emptyWorldState();
    const { gpHints: _unused, ...old } = state;
    store.setItem(`som-web-tracker:world-state:v${version}`, JSON.stringify({ ...old, version }));
    expect(loadWorldState(store).gpHints).toEqual({});
    store.setItem("som-web-tracker:world-state:v3", JSON.stringify({ ...old, gpNotNeeded: ["weapon-axe", "weapon-axe", "bogus", null] }));
    expect(loadWorldState(store).gpHints).toEqual({ "weapon-axe": "not-required" });
  });
  it("persists GP exclusions and unknown Revival count independently from manual progress", () => {
    const store = storage(), before = fixture(); before.world.settings.reviveSeedCount = null; before.world.manualReviveSeedCount = null;
    saveWorldState(store, before.world);
    const loaded = loadWorldState(store);
    expect(loaded.gpHints).toEqual({ "weapon-axe": "not-required" }); expect(loaded.settings.reviveSeedCount).toBeNull();
    expect(resetTracking("manual", { ...before, world: loaded }).world.gpHints).toEqual({ "weapon-axe": "not-required" });
  });
  it("counts acquired seeds once from RAM plus manual inventory and follows rollback", () => {
    const ram = emptyRamState(); ram.inventory["seed-water"] = true; ram.inventory["seed-fire"] = true;
    const marks = new Set<InventoryId>(["seed-fire", "seed-earth", "weapon-axe"]);
    expect(countManaSeeds(ram, marks)).toBe(3);
    ram.inventory["seed-water"] = false;
    expect(countManaSeeds(ram, marks)).toBe(2);
    expect(countManaSeeds(ram, new Set())).toBe(1);
  });
  it("unknown Revival requirements remain unknown in logic until identified instead of inventing a count", () => {
    const ram = emptyRamState(), world = emptyWorldState(); world.settings.reviveSeedCount = null;
    ram.inventory["seed-water"] = true;
    expect(evaluateCode("$manaTreeRevive", createLogicContext(ram, new Set(), world))).toBe("unknown");
    world.settings.reviveSeedCount = 2;
    expect(evaluateCode("$manaTreeRevive", createLogicContext(ram, new Set(), world))).toBe(false);
    ram.inventory["seed-fire"] = true;
    expect(evaluateCode("$manaTreeRevive", createLogicContext(ram, new Set(), world))).toBe(true);
  });
});
