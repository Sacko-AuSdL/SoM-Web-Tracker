import { describe, expect, it } from "vitest";
import { activeLocationDefinitions } from "../data/locationDefinitions";
import { emptyManualState, emptyRamState, setManualCompletion } from "../state/trackerState";
import { emptyWorldState, setOrbRequirement } from "../state/worldState";
import { countTrackerProgress } from "./progress";
import { createLogicContext } from "./reachability";

describe("global logical-check counters", () => {
  it("derives total from definitions and counts RAM/manual completion without reward slots", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    let manual = emptyManualState();
    const count = () => countTrackerProgress(createLogicContext(ram, new Set(), world), manual);
    expect(count().total).toBe(activeLocationDefinitions(ram.sandship.supported).length);
    expect(count().completed).toBe(0);
    ram.checks["potos-chest"] = true;
    expect(count().completed).toBe(1);
    ram.checks["potos-chest"] = false;
    expect(count().completed).toBe(0);
    manual = setManualCompletion(manual, "potos-chest", true);
    expect(count().completed).toBe(1);
    ram.checks["potos-chest"] = true;
    expect(count().completed).toBe(1);
  });
  it("counts only reachable, visible, unfinished checks as available", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    const count = () => countTrackerProgress(createLogicContext(ram, new Set(), world), emptyManualState());
    const initial = count();
    expect(initial.available).toBeGreaterThan(0);
    ram.checks["potos-chest"] = true;
    expect(count().available).toBe(initial.available - 1);
    ram.checks["potos-chest"] = false;
    expect(count().available).toBe(initial.available);
    expect(count().availableAreas).toBeGreaterThan(0);
    expect(count().available).toBeLessThan(count().total);
  });
  it("excludes unknown Orb-gated paths until their requirement is known and satisfied", () => {
    const ram = emptyRamState(), world = emptyWorldState();
    ram.inventory["weapon-axe"] = true;
    const before = countTrackerProgress(createLogicContext(ram, new Set(), world), emptyManualState());
    const knownBlocked = setOrbRequirement(world, "uf_orb", { kind: "element", element: "gnome" });
    expect(countTrackerProgress(createLogicContext(ram, new Set(), knownBlocked), emptyManualState()).available).toBe(before.available);
    ram.inventory["element-gnome"] = true;
    ram.inventory.sprite = true;
    const after = countTrackerProgress(createLogicContext(ram, new Set(), knownBlocked), emptyManualState());
    expect(after.available).toBeGreaterThan(before.available);
  });
});
