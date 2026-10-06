import { describe, expect, it } from "vitest";
import { addCannonConnection, chaosOfficeState, emptyWorldState, loadWorldState, saveWorldState, setCannonOfficeClosed } from "./worldState";
import { reachableRegions } from "../logic/travel";
function storage(): Storage {
  const entries = new Map<string, string>();
  return { get length() { return entries.size; }, clear: () => entries.clear(), key: (i) => [...entries.keys()][i] ?? null,
    removeItem: (key) => { entries.delete(key); }, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
}
describe("v3 safe persistence and closed office logic", () => {
  it.each([1, 2])("migrates v%s without losing routes, roles, or Orb marks", (version) => {
    const local = storage();
    const old = addCannonConnection(emptyWorldState(), { from: "potos", to: "southtown" });
    old.manualClearedOrbs = ["uf_orb"]; old.roles.girl = "sprite";
    local.setItem(`som-web-tracker:world-state:v${version}`, JSON.stringify({ ...old, version, closedCannonOffices: undefined,
      settings: { ...old.settings, startingCharacter: undefined, partyMode: undefined } }));
    const loaded = loadWorldState(local);
    expect(loaded.version).toBe(3);
    expect(loaded.cannonConnections).toEqual(old.cannonConnections);
    expect(loaded.roles).toEqual(old.roles);
    expect(loaded.manualClearedOrbs).toEqual(old.manualClearedOrbs);
    expect(loaded.closedCannonOffices).toEqual([]);
    expect(loaded.settings.startingCharacter).toBe("boy");
    expect(loaded.settings.partyMode).toBe("find-both-level-1");
  });
  it("persists Closed and identified availability, not interaction state or derived reachability", () => {
    const local = storage();
    let world = addCannonConnection(emptyWorldState(), { from: "potos", to: "southtown" });
    world = setCannonOfficeClosed(world, "potos", true);
    world.settings.partyMode = "find-one-current"; world.settings.additionalCharacter = "girl";
    saveWorldState(local, world);
    expect(loadWorldState(local)).toEqual(world);
    expect(local.getItem("som-web-tracker:world-state:v3")).not.toMatch(/hover|selected|editing|reachability|inventory/);
    expect(chaosOfficeState(loadWorldState(local), "potos")).toBe("closed");
    expect(chaosOfficeState(world, "kakkara")).toBe("unknown");
  });
  it("Closed prevents only that office's outgoing Chaos traversal; unmarking restores known routes immediately", () => {
    let world = addCannonConnection(emptyWorldState(), { from: "potos", to: "southtown" });
    world.settings.cannonMode = "chaos"; world.settings.drumLogic = "random";
    expect(reachableRegions(world, false, "unreachable").empire).toBe("reachable");
    world = setCannonOfficeClosed(world, "potos", true);
    expect(reachableRegions(world, false, "unreachable").empire).toBe("unreachable");
    expect(world.cannonConnections).toHaveLength(1);
    expect(reachableRegions(setCannonOfficeClosed(world, "potos", false), false, "unreachable").empire).toBe("reachable");
    world.settings.cannonMode = "shuffle";
    expect(reachableRegions(world, false, "unreachable").empire).toBe("reachable");
  });
  it("Unknown does not invent traversal; entering a known route reopens an explicitly closed office", () => {
    let world = emptyWorldState(); world.settings.cannonMode = "chaos";
    expect(reachableRegions(world, false, "unreachable").empire).toBe("unreachable");
    world = addCannonConnection(setCannonOfficeClosed(world, "potos", true), { from: "potos", to: "southtown" });
    expect(chaosOfficeState(world, "potos")).toBe("open");
    world = addCannonConnection(setCannonOfficeClosed(world, "potos", true), world.cannonConnections[0]);
    expect(chaosOfficeState(world, "potos")).toBe("open");
    expect(world.cannonConnections).toHaveLength(1);
  });
});
