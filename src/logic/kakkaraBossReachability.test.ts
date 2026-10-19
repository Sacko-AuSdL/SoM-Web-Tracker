import { describe, expect, it } from "vitest";
import { LOCATION_DEFINITIONS } from "../data/locationDefinitions";
import { MAP_AREA_BY_ID } from "../data/mapAreas";
import { SANDSHIP } from "../data/sandship";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { addCannonConnection, emptyWorldState, removeCannonConnection } from "../state/worldState";
import { createLogicContext, evaluateArea, evaluateCheck } from "./reachability";
import { countTrackerProgress } from "./progress";

const manual = emptyManualState();
const area = MAP_AREA_BY_ID.get(SANDSHIP.areaId)!;
function setup() {
  const ram = emptyRamState(), world = emptyWorldState();
  ram.sandship.supported = true; ram.sandship.bossDefeated = false;
  ram.sandship.bossFlagValue = 0x0e; ram.checks[SANDSHIP.captainId] = false;
  world.settings.startingLocation = "kakkara";
  world.settings.drumLogic = "random"; world.settings.cannonMode = "shuffle";
  return { ram, world };
}

describe("Kakkara boss challenges versus actual reward completion", () => {
  it.each([null, false, true] as const)("Captain is logically reachable with boss RAM=%s and remains unclaimed", (bossDefeated) => {
    const { ram, world } = setup(); ram.sandship.bossDefeated = bossDefeated;
    const context = createLogicContext(ram, new Set(), world);
    expect(evaluateCheck(SANDSHIP.captainId, context, manual)).toEqual({ visible: true, access: "reachable", complete: false });
    expect(evaluateArea(area, context, manual)).toMatchObject({ status: "reachable", reachable: 1, completed: 0, total: 1 });
    expect(countTrackerProgress(context, manual)).toMatchObject({ total: 77, completed: 0 });
  });

  it("boss defeat does not change access; claim and save-state rollback change only actual completion", () => {
    const { ram, world } = setup();
    const context = () => createLogicContext(ram, new Set(), world);
    const check = () => evaluateCheck(SANDSHIP.captainId, context(), manual);
    const before = countTrackerProgress(context(), manual);
    expect(check()).toMatchObject({ access: "reachable", complete: false });
    ram.sandship.bossDefeated = true; ram.sandship.bossFlagValue = 0x0f;
    expect(check()).toMatchObject({ access: "reachable", complete: false });
    expect(countTrackerProgress(context(), manual)).toEqual(before);
    ram.checks[SANDSHIP.captainId] = true;
    expect(check()).toMatchObject({ access: "reachable", complete: true });
    expect(evaluateArea(area, context(), manual).status).toBe("completed");
    expect(countTrackerProgress(context(), manual)).toMatchObject({ total: 77, completed: 1, available: before.available - 1 });
    ram.checks[SANDSHIP.captainId] = false;
    expect(check()).toMatchObject({ access: "reachable", complete: false });
    ram.sandship.bossDefeated = false; ram.sandship.bossFlagValue = 0x0e;
    expect(check()).toMatchObject({ access: "reachable", complete: false });
    expect(evaluateArea(area, context(), manual).status).toBe("reachable");
    expect(countTrackerProgress(context(), manual)).toEqual(before);
  });

  it("preserves missing directed travel gates even after boss defeat, and follows route removal", () => {
    const { ram, world: initial } = setup(); let world = initial;
    world.settings.startingLocation = "default";
    const check = () => evaluateCheck(SANDSHIP.captainId, createLogicContext(ram, new Set(), world), manual);
    expect(check().access).toBe("unreachable");
    ram.sandship.bossDefeated = true;
    expect(check().access).toBe("unreachable");
    ram.sandship.bossDefeated = false;
    world = addCannonConnection(world, { from: "potos", to: "kakkara" });
    expect(check()).toMatchObject({ access: "reachable", complete: false });
    world = removeCannonConnection(world, "potos:kakkara");
    expect(check().access).toBe("unreachable");
  });

  it("preserves Default/Vanilla's Drum or Upper Land Orb progression, including unknown requirements", () => {
    const { ram } = setup(), world = emptyWorldState();
    world.settings.orbMode = "weapon-only";
    const check = () => evaluateCheck(SANDSHIP.captainId, createLogicContext(ram, new Set(), world), manual);
    expect(createLogicContext(ram, new Set(), world).travel).toBeUndefined();
    expect(check().access).toBe("unknown");
    world.orbs.uf_orb = { kind: "weapon-family", weapon: "axe" };
    expect(check().access).toBe("unreachable");
    ram.inventory["weapon-axe"] = true;
    expect(check().access).toBe("reachable");
    ram.inventory["weapon-axe"] = false; ram.inventory["flammie-drum"] = true;
    expect(check().access).toBe("reachable");
    ram.inventory["flammie-drum"] = false;
    expect(check().access).toBe("unreachable");
    expect(evaluateCheck("mantis-ant", createLogicContext(ram, new Set(), world), manual).access).toBe("reachable");
  });

  it("keeps real Whip, Fire Palace Orb and restrictive Fire Seed requirements", () => {
    const { ram, world } = setup(); world.settings.cannonMode = "vanilla"; world.settings.orbMode = "weapon-only";
    for (const orb of ["fp_orb1", "fp_orb2", "fp_orb3"] as const)
      world.orbs[orb] = { kind: "weapon-family", weapon: "axe" };
    const access = (id: "fire-palace-reward-minotaur" | "ice-castle-boss-2-frost-gigas") =>
      evaluateCheck(id, createLogicContext(ram, new Set(), world), manual).access;
    ram.sandship.bossDefeated = true;
    expect(access("fire-palace-reward-minotaur")).toBe("unreachable");
    expect(access("ice-castle-boss-2-frost-gigas")).toBe("unreachable");
    ram.inventory["weapon-whip"] = true;
    expect(access("ice-castle-boss-2-frost-gigas")).toBe("reachable");
    expect(access("fire-palace-reward-minotaur")).toBe("unreachable");
    ram.inventory["weapon-axe"] = true;
    expect(access("fire-palace-reward-minotaur")).toBe("reachable");
    world.settings.logic = "restrictive";
    expect(access("fire-palace-reward-minotaur")).toBe("unreachable");
    ram.inventory["seed-fire"] = true;
    expect(access("fire-palace-reward-minotaur")).toBe("reachable");
  });

  it("leaves every unrelated check unchanged and already allows reachable post-boss rewards", () => {
    const { ram, world } = setup(); world.settings.cannonMode = "vanilla";
    const context = () => createLogicContext(ram, new Set(), world);
    for (const id of ["salamando", "ice-castle-boss-1-biting-lizard-x3", "inside-boss-metal-mantis", "outside-boss-mech-rider-ii"] as const) {
      ram.checks[id] = false;
      expect(evaluateCheck(id, context(), manual)).toMatchObject({ access: "reachable", complete: false });
    }
    const unrelated = () => LOCATION_DEFINITIONS.filter(({ id }) => id !== SANDSHIP.captainId)
      .map(({ id }) => [id, evaluateCheck(id, context(), manual)]);
    const before = unrelated();
    ram.sandship.bossDefeated = true; ram.checks[SANDSHIP.captainId] = true;
    expect(unrelated()).toEqual(before);
    ram.sandship.bossDefeated = false; ram.checks[SANDSHIP.captainId] = false;
    expect(unrelated()).toEqual(before);
  });
});
