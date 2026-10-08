import { describe, expect, it } from "vitest";
import { LOCATION_DEFINITIONS, activeLocationDefinitions } from "../data/locationDefinitions";
import { CHECK_REGION, type CannonTravelMode } from "../domain/cannons";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { addCannonConnection, emptyWorldState, removeCannonConnection, setOrbCleared, setOrbMode, setOrbRequirement } from "../state/worldState";
import { createLogicContext, evaluateCheck, evaluateOrbGate, evaluateOrbTraversal, orbCompletion } from "./reachability";
import { countTrackerProgress } from "./progress";
import { effectiveStartingLocation, initialRegions, reachableRegions, usesRegionTravel } from "./travel";

function kakkara(mode: CannonTravelMode = "vanilla") {
  const world = setOrbMode(emptyWorldState(), "weapon-only");
  world.settings.drumLogic = "random"; world.settings.startingLocation = "kakkara"; world.settings.cannonMode = mode;
  return world;
}
const manual = emptyManualState();
describe("starting frontier and directed region travel", () => {
  it("keeps existing Default/Vanilla logic, and requires Drum in logic for alternate start", () => {
    const world = emptyWorldState();
    expect(initialRegions(world.settings)).toEqual(["potos"]);
    expect(usesRegionTravel(world.settings)).toBe(false);
    expect(evaluateCheck("potos-chest", createLogicContext(emptyRamState(), new Set(), world), manual).access).toBe("reachable");
    world.settings.startingLocation = "kakkara";
    expect(effectiveStartingLocation(world.settings)).toBe("default");
    expect(initialRegions(world.settings)).toEqual(["potos"]);
  });
  it("Kakkara replaces the Default frontier, not adds to it", () => {
    const world = kakkara("shuffle");
    expect(initialRegions(world.settings)).toEqual(["kakkara"]);
    const context = createLogicContext(emptyRamState(), new Set(["sea-hare-tail"]), world);
    expect(evaluateCheck("kakkara-npc", context, manual).access).toBe("reachable");
    expect(evaluateCheck("potos-chest", context, manual).access).toBe("unreachable");
    expect(evaluateCheck("undine-biting-lizard", context, manual).access).toBe("unreachable");
  });
  it("Vanilla Kakkara reaches desert-side offices but approaches UF from Matango", () => {
    const world = kakkara();
    const unknown = reachableRegions(world, false, "unknown");
    expect(unknown).toMatchObject({ kakkara: "reachable", matango: "reachable", iceCountry: "reachable", empire: "reachable", upperLand: "unknown", potos: "unknown", flammieOnly: "unreachable" });
    expect(reachableRegions(world, false, "unreachable")).toMatchObject({ upperLand: "unreachable", potos: "unreachable" });
    expect(reachableRegions(world, false, "reachable")).toMatchObject({ upperLand: "reachable", potos: "reachable" });
  });
  it("propagates unknown, blocked, passable UF and actual open-state without requiring Axe on the walking edge", () => {
    const ram = emptyRamState(), world = kakkara();
    expect(evaluateCheck("potos-chest", createLogicContext(ram, new Set(), world), manual).access).toBe("unknown");
    const spear = setOrbRequirement(world, "uf_orb", { kind: "weapon-family", weapon: "spear" });
    expect(evaluateCheck("potos-chest", createLogicContext(ram, new Set(), spear), manual).access).toBe("unreachable");
    ram.inventory["weapon-spear"] = true;
    const passable = createLogicContext(ram, new Set(), spear);
    expect(evaluateCheck("potos-chest", passable, manual).access).toBe("reachable");
    // Source DEPENDENCY_MATANGO_ENTRY is Axe OR Flammie, separate from UF walk.
    expect(evaluateCheck("matango-palace-chest", passable, manual).access).toBe("unreachable");
    ram.inventory["weapon-axe"] = true;
    expect(evaluateCheck("matango-palace-chest", createLogicContext(ram, new Set(), spear), manual).access).toBe("reachable");
    ram.inventory["weapon-spear"] = false; ram.orbs.uf_orb = true;
    expect(evaluateCheck("potos-chest", createLogicContext(ram, new Set(), spear), manual).access).toBe("reachable");
    ram.orbs.uf_orb = false;
    expect(evaluateCheck("potos-chest", createLogicContext(ram, new Set(), spear), manual).access).toBe("unreachable");
  });
  it.each(["shuffle", "chaos"] as const)("%s uses only entered directed routes from reachable sources", (mode) => {
    let world = kakkara(mode);
    world = addCannonConnection(world, { from: "potos", to: "iceCountry" });
    expect(reachableRegions(world, false, "unreachable").iceCountry).toBe("unreachable");
    world = addCannonConnection(world, { from: "kakkara", to: "potos" });
    expect(reachableRegions(world, false, "unreachable")).toMatchObject({ potos: "reachable", iceCountry: "reachable", matango: "unreachable" });
    world.settings.startingLocation = "default";
    expect(reachableRegions(world, false, "unreachable").kakkara).toBe("unreachable");
    world.settings.startingLocation = "kakkara";
    world = removeCannonConnection(world, "kakkara:potos");
    expect(reachableRegions(world, false, "unreachable").potos).toBe("unreachable");
  });
  it("Open changes reachability without any manually entered edge; Flammie remains independent", () => {
    const world = kakkara("open");
    expect(world.cannonConnections).toEqual([]);
    expect(reachableRegions(world, false, "unreachable")).toEqual({ potos: "reachable", upperLand: "reachable", matango: "reachable", kakkara: "reachable", iceCountry: "reachable", empire: "reachable", flammieOnly: "unreachable" });
    world.settings.cannonMode = "chaos";
    expect(Object.values(reachableRegions(world, true, "unreachable")).every((v) => v === "reachable")).toBe(true);
    world.settings.drumLogic = "normal";
    expect(createLogicContext(emptyRamState(), new Set(), world).travel?.flammieOnly).toBe("reachable");
  });
  it("updates AVAILABLE for network/start/Orb changes without changing total/completed", () => {
    const ram = emptyRamState();
    let world = kakkara("shuffle");
    const count = () => countTrackerProgress(createLogicContext(ram, new Set(), world), manual);
    const before = count();
    world = addCannonConnection(world, { from: "kakkara", to: "potos" });
    expect(count().available).toBeGreaterThan(before.available);
    expect(count()).toMatchObject({ total: activeLocationDefinitions(false).length, completed: 0 });
    world = removeCannonConnection(world, "kakkara:potos");
    expect(count()).toEqual(before);
    world.settings.cannonMode = "vanilla";
    const unknown = count();
    world = setOrbCleared(world, "uf_orb", true);
    expect(count().available).toBeGreaterThan(unknown.available);
    world.settings.startingLocation = "default";
    expect(evaluateCheck("potos-chest", createLogicContext(ram, new Set(), world), manual).access).toBe("reachable");
  });
  it("maps every existing check to a region and evaluates all modes without missing gates", () => {
    expect(CHECK_REGION.size).toBe(LOCATION_DEFINITIONS.length);
    for (const mode of ["vanilla", "open", "shuffle", "chaos"] as const) {
      const context = createLogicContext(emptyRamState(), new Set(), kakkara(mode));
      for (const location of LOCATION_DEFINITIONS) expect(() => evaluateCheck(location.id, context, manual)).not.toThrow();
    }
  });
});
describe("Orb requirement, passability and actual completion are independent", () => {
  it("ownership alone never marks completion; manual clear survives RAM rollback and is undoable", () => {
    const ram = emptyRamState();
    let world = setOrbRequirement(setOrbMode(emptyWorldState(), "weapon-only"), "uf_orb", { kind: "weapon-family", weapon: "axe" });
    const context = () => createLogicContext(ram, new Set(), world);
    expect(evaluateOrbGate(context(), "uf_orb")).toBe("blocked");
    ram.inventory["weapon-axe"] = true;
    expect(evaluateOrbGate(context(), "uf_orb")).toBe("passable");
    expect(orbCompletion(context(), "uf_orb")).toBe("none");
    ram.orbs.uf_orb = true;
    expect(orbCompletion(context(), "uf_orb")).toBe("ram");
    world = setOrbCleared(world, "uf_orb", true);
    ram.orbs.uf_orb = false; ram.inventory["weapon-axe"] = false;
    expect(evaluateOrbGate(context(), "uf_orb")).toBe("blocked");
    expect(evaluateOrbTraversal(context(), "uf_orb")).toBe("passable");
    expect(orbCompletion(context(), "uf_orb")).toBe("manual");
    world = setOrbCleared(world, "uf_orb", false);
    expect(evaluateOrbTraversal(context(), "uf_orb")).toBe("blocked");
  });
});
