import { describe, expect, it } from "vitest";
import { LOCATION_BY_ID } from "../data/locationDefinitions";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { emptyWorldState, setOrbCleared } from "../state/worldState";
import { createLogicContext, evaluateArea, evaluateCheck, evaluateOrbTraversal } from "./reachability";
import { MAP_AREA_BY_ID } from "../data/mapAreas";

const checks = ["fire-palace-near-entrance-chest", "fire-palace-near-orb-2", "fire-palace-after-little-maze", "fire-palace-reward-minotaur"] as const;
const orbs = ["fp_orb1", "fp_orb2", "fp_orb3"] as const;
const weapons = ["sword", "axe", "spear"] as const;
const manual = emptyManualState();
function setup() {
  const ram = emptyRamState(), world = emptyWorldState();
  world.settings.startingLocation = "kakkara"; world.settings.drumLogic = "random"; world.settings.orbMode = "weapon-only";
  ram.inventory["weapon-whip"] = true; ram.inventory["seed-fire"] = true;
  for (const id of checks) ram.checks[id] = false;
  return { ram, world };
}
const combinations = ["blocked", "unknown", "passable"].flatMap((a) => ["blocked", "unknown", "passable"].flatMap((b) =>
  ["blocked", "unknown", "passable"].map((c) => [a, b, c])));
describe("source-backed Fire Palace gates (no optional FP1 fallback)", () => {
  it("preserves all four event mappings and Whip/seed progression", () => {
    expect(checks.map((id) => LOCATION_BY_ID.get(id)!.events[0].eventNumber)).toEqual([0x68a, 0x68b, 0x678, 0x589]);
  });
  for (const logic of ["basic", "restrictive"] as const) {
    it.each(combinations)(`${logic}: FP gates %s / %s / %s respect known blocks over unknowns`, (a, b, c) => {
      const { ram, world } = setup(); world.settings.logic = logic;
      const states = [a, b, c];
      orbs.forEach((id, i) => {
        world.orbs[id] = states[i] === "unknown" ? { kind: "unknown" } : { kind: "weapon-family", weapon: weapons[i] };
        ram.inventory[`weapon-${weapons[i]}`] = states[i] === "passable";
      });
      const context = createLogicContext(ram, new Set(), world);
      checks.forEach((id, i) => {
        const gates = states.slice(0, [1, 2, 2, 3][i]);
        const expected = gates.includes("blocked") ? "unreachable" : gates.includes("unknown") ? "unknown" : "reachable";
        expect(evaluateCheck(id, context, manual)).toMatchObject({ access: expected, complete: false });
      });
    });
  }
  it.each(["basic", "restrictive"] as const)("preserves %s Fire Seed semantics and the real Whip gate", (logic) => {
    const { ram, world } = setup(); world.settings.logic = logic;
    for (const id of orbs) world.orbs[id] = { kind: "weapon-family", weapon: "whip" };
    ram.inventory["seed-fire"] = false;
    const access = () => evaluateCheck(checks[3], createLogicContext(ram, new Set(), world), manual).access;
    expect(access()).toBe(logic === "basic" ? "reachable" : "unreachable");
    ram.inventory["seed-fire"] = true;
    expect(access()).toBe("reachable");
    ram.inventory["weapon-whip"] = false;
    for (const id of orbs) ram.orbs[id] = true;
    expect(access()).toBe("unreachable");
  });
  it("known blocks override an unknown route, and absent genuine travel blocks all four checks", () => {
    const { ram, world } = setup(); world.settings.startingLocation = "default";
    world.orbs.fp_orb1 = { kind: "weapon-family", weapon: "axe" }; ram.inventory["weapon-axe"] = false;
    expect(evaluateCheck(checks[0], createLogicContext(ram, new Set(), world), manual).access).toBe("unreachable");
    world.settings.cannonMode = "shuffle";
    for (const id of checks) expect(evaluateCheck(id, createLogicContext(ram, new Set(), world), manual).access).toBe("unreachable");
  });
  it("authoritative RAM clearing bypasses missing ownership, follows rollback, and is not location completion", () => {
    const { ram, world } = setup();
    for (const id of orbs) { world.orbs[id] = { kind: "weapon-family", weapon: "axe" }; ram.orbs[id] = true; }
    const context = () => createLogicContext(ram, new Set(), world);
    for (const id of checks) expect(evaluateCheck(id, context(), manual)).toMatchObject({ access: "reachable", complete: false });
    ram.checks[checks[0]] = true;
    expect(evaluateCheck(checks[0], context(), manual).complete).toBe(true);
    for (const id of checks) ram.checks[id] = true;
    expect(evaluateArea(MAP_AREA_BY_ID.get("kakkara-desert-fire-palace")!, context(), manual).status).toBe("completed");
    ram.checks[checks[0]] = false; ram.orbs.fp_orb1 = false;
    expect(evaluateCheck(checks[0], context(), manual)).toMatchObject({ access: "unreachable", complete: false });
    const marked = setOrbCleared(world, "fp_orb1", true);
    expect(evaluateOrbTraversal(createLogicContext(ram, new Set(), marked), "fp_orb1")).toBe("passable");
    expect(ram.orbs.fp_orb1).toBe(false);
  });
});
