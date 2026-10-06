import { describe, expect, it } from "vitest";
import { MAP_AREAS } from "../data/mapAreas";
import { LOCATION_DEFINITIONS } from "../data/locationDefinitions";
import { emptyManualState, emptyRamState, setManualCompletion } from "../state/trackerState";
import { emptyWorldState, setOrbMode, setOrbRequirement } from "../state/worldState";
import { createLogicContext, evaluateArea, evaluateCheck, evaluateOrbGate } from "./reachability";

const manual = emptyManualState();
describe("PopTracker-derived check reachability", () => {
  it("keeps free checks reachable and respects Basic versus Restrictive seed gates", () => {
    const ram = emptyRamState();
    const world = emptyWorldState();
    expect(evaluateCheck("potos-chest", createLogicContext(ram, new Set(), world), manual).access).toBe("reachable");
    expect(evaluateCheck("water-palace-mana-seed-jabberwocky", createLogicContext(ram, new Set(), world), manual).access).toBe("reachable");
    world.settings.logic = "restrictive";
    expect(evaluateCheck("water-palace-mana-seed-jabberwocky", createLogicContext(ram, new Set(), world), manual).access).toBe("unreachable");
    ram.inventory["seed-water"] = true;
    expect(evaluateCheck("water-palace-mana-seed-jabberwocky", createLogicContext(ram, new Set(), world), manual).access).toBe("reachable");
  });
  it("keeps Flammie Drum and Upper Land Orb paths independent", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    const check = () => evaluateCheck("matango-palace-chest", createLogicContext(ram, new Set(), world), manual).access;
    expect(check()).toBe("unreachable");
    ram.inventory["flammie-drum"] = true;
    expect(check()).toBe("reachable");
    ram.inventory["flammie-drum"] = false;
    ram.inventory["weapon-axe"] = true;
    ram.inventory.sprite = true;
    ram.inventory["element-gnome"] = true;
    const orbWorld = setOrbRequirement(world, "uf_orb", { kind: "element", element: "gnome" });
    expect(evaluateCheck("matango-palace-chest", createLogicContext(ram, new Set(), orbWorld), manual).access).toBe("reachable");
    expect(evaluateCheck("matango-palace-chest", createLogicContext(ram, new Set(), world), manual).access).toBe("unknown");
  });
  it("applies the PopTracker Drum visibility setting without changing other Potos checks", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    const context = createLogicContext(ram, new Set(), world);
    expect(evaluateCheck("sword-pedestal", context, manual).visible).toBe(false);
    expect(evaluateCheck("potos-chest", context, manual).visible).toBe(true);
    world.settings.drumLogic = "random";
    expect(evaluateCheck("sword-pedestal", createLogicContext(ram, new Set(), world), manual).visible).toBe(true);
  });
  it("applies known element role requirements and weapon-family requirements", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    ram.inventory["element-lumina"] = true;
    ram.inventory.sprite = true;
    let known = setOrbRequirement(world, "uf_orb", { kind: "element", element: "lumina" });
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("blocked");
    ram.inventory.girl = true;
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("passable");
    known = setOrbRequirement(setOrbMode(world, "mixed"), "uf_orb", { kind: "weapon-family", weapon: "spear" });
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("blocked");
    ram.inventory["weapon-spear"] = true;
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("passable");
  });
  it("uses assigned randomized roles and leaves hint data outside the evaluator", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    world.settings.roleMode = "random";
    world.roles.boy = "sprite";
    ram.inventory.boy = true;
    ram.inventory["element-gnome"] = true;
    const known = setOrbRequirement(world, "uf_orb", { kind: "element", element: "gnome" });
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("passable");
    world.roles.boy = "girl";
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("blocked");
  });
  it("uses per-slot random settings without confusing role identity with RAM presence", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    world.settings.roleModeBySlot = { boy: "random", girl: "normal", sprite: "random" };
    world.roles.boy = "girl";
    ram.inventory.boy = true;
    ram.inventory["element-lumina"] = true;
    const known = setOrbRequirement(world, "uf_orb", { kind: "element", element: "lumina" });
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("passable");
    ram.inventory.boy = false;
    expect(known.roles.boy).toBe("girl");
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), known), "uf_orb")).toBe("blocked");
  });
  it("keeps unknown gates unknown in every mode, even with all possible weapons owned", () => {
    const ram = emptyRamState();
    const weaponWorld = setOrbMode(emptyWorldState(), "weapon-only");
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), weaponWorld), "uf_orb")).toBe("unknown");
    for (const weapon of ["gloves", "sword", "axe", "spear", "whip", "bow", "boomerang", "javelin"] as const)
      ram.inventory[`weapon-${weapon}`] = true;
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), weaponWorld), "uf_orb")).toBe("unknown");
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), setOrbMode(emptyWorldState(), "mixed")), "uf_orb")).toBe("unknown");
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), emptyWorldState()), "uf_orb")).toBe("unknown");
  });
  it("propagates unknown, blocked and passable Upper Land Orb states downstream", () => {
    const ram = emptyRamState();
    const world = setOrbMode(emptyWorldState(), "weapon-only");
    const check = (state: typeof world) => evaluateCheck("south-town-mara", createLogicContext(ram, new Set(), state), manual).access;
    expect(check(world)).toBe("unknown");
    const axe = setOrbRequirement(world, "uf_orb", { kind: "weapon-family", weapon: "axe" });
    expect(check(axe)).toBe("unreachable");
    ram.inventory["weapon-axe"] = true;
    expect(check(axe)).toBe("reachable");
    const area = MAP_AREAS.find((entry) => entry.id === "vandole-empire-south-town")!;
    expect(evaluateArea(area, createLogicContext(ram, new Set(), axe), manual).status).toBe("reachable");
  });
  it("evaluates every migrated source rule without an unknown function", () => {
    const context = createLogicContext(emptyRamState(), new Set(), emptyWorldState());
    for (const check of LOCATION_DEFINITIONS) expect(() => evaluateCheck(check.id, context, manual)).not.toThrow();
  });
  it("aggregates check-level access and completion into useful area states", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    const area = MAP_AREAS.find((entry) => entry.id === "water-palace")!;
    let context = createLogicContext(ram, new Set(), world);
    expect(evaluateArea(area, context, manual).status).toBe("reachable");
    world.settings.logic = "restrictive";
    context = createLogicContext(ram, new Set(), world);
    expect(evaluateArea(area, context, manual).status).toBe("unreachable");
    const completed = setManualCompletion(manual, "water-palace-mana-seed-jabberwocky", true);
    expect(evaluateArea(area, context, completed)).toMatchObject({ status: "completed", completed: 1, total: 1 });
    const potos = MAP_AREAS.find((entry) => entry.id === "potos")!;
    expect(evaluateArea(potos, context, manual).status).toBe("reachable");
    ram.checks["potos-chest"] = true;
    expect(evaluateArea(potos, context, manual).completed).toBe(1);
  });
});
