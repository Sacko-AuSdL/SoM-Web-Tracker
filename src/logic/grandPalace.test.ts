import { describe, expect, it } from "vitest";
import { ELEMENTS, GP_REQUIREMENT_IDS, WEAPON_FAMILIES } from "../domain/orbs";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { emptyWorldState, setGpHint } from "../state/worldState";
import { createLogicContext, evaluateCheck, evaluateOrbGate, orbCompletion } from "./reachability";

describe("Grand Palace needed/not-needed (PopTracker unknown-pool semantics)", () => {
  it("excludes an unneeded element without changing acquisition, known identity, completion or non-GP gates", () => {
    const ram = emptyRamState(); let world = emptyWorldState();
    ram.inventory.girl = true; ram.inventory.sprite = true;
    for (const element of ELEMENTS) ram.inventory[`element-${element}`] = element !== "gnome";
    const gate = (id: "gp_orb1" | "fp_orb1") => evaluateOrbGate(createLogicContext(ram, new Set(), world), id);
    expect(gate("gp_orb1")).toBe("unknown");
    world = setGpHint(world, "element-gnome", "not-required");
    expect(gate("gp_orb1")).toBe("passable");
    expect(gate("fp_orb1")).toBe("unknown");
    expect(ram.inventory["element-gnome"]).toBe(false);
    expect(world.orbs.gp_orb1).toEqual({ kind: "unknown" });
    expect(orbCompletion(createLogicContext(ram, new Set(), world), "gp_orb1")).toBe("none");
    world.orbs.gp_orb1 = { kind: "element", element: "gnome" };
    expect(gate("gp_orb1")).toBe("blocked");
    expect(world.gpHints["element-gnome"]).toBe("not-required");
  });
  it.each(["weapon-only", "mixed"] as const)("supports applicable weapon exclusions in %s while preserving the GP boss Whip gate", (mode) => {
    const ram = emptyRamState(); let world = emptyWorldState(); world.settings.orbMode = mode;
    for (const id of GP_REQUIREMENT_IDS) world = setGpHint(world, id, "not-required");
    world = setGpHint(world, "weapon-spear", "required");
    ram.inventory["flammie-drum"] = true;
    const context = () => createLogicContext(ram, new Set(), world);
    expect(evaluateOrbGate(context(), "gp_orb1")).toBe("unknown");
    ram.inventory["weapon-spear"] = true;
    expect(evaluateOrbGate(context(), "gp_orb1")).toBe("passable");
    expect(evaluateCheck("grand-palace-boss-mech-rider-iii", context(), emptyManualState()).access).toBe("unreachable");
    ram.inventory["weapon-whip"] = true;
    expect(evaluateCheck("grand-palace-boss-mech-rider-iii", context(), emptyManualState())).toMatchObject({ access: "reachable", complete: false });
    for (let i = 1; i <= 7; i++) expect(world.manualClearedOrbs).not.toContain(`gp_orb${i}`);
  });
  it("still requires the appropriate caster role for remaining needed magic", () => {
    const ram = emptyRamState(); const world = emptyWorldState();
    for (const element of ELEMENTS) ram.inventory[`element-${element}`] = true;
    const context = () => createLogicContext(ram, new Set(), world);
    expect(evaluateOrbGate(context(), "gp_orb1")).toBe("unknown");
    ram.inventory.sprite = true; ram.inventory.girl = true;
    expect(evaluateOrbGate(context(), "gp_orb1")).toBe("passable");
    expect(WEAPON_FAMILIES).toHaveLength(8);
  });
});
