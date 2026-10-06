import { describe, expect, it } from "vitest";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { emptyRamState } from "../state/trackerState";
import { emptyWorldState, setOrbRequirement, setRoleIdentity } from "../state/worldState";
import { characterAvailability, characterPresent, resolvedStart } from "./characters";
import { createLogicContext, evaluateOrbGate } from "../logic/reachability";

const imported = (options: string) => applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(`version=1.49 mode=open ${options}`));
describe("authoritative character availability (independent of roles)", () => {
  it.each(["boy", "girl", "sprite"] as const)("imports %s as configured starting slot without SNI", (slot) => {
    const world = imported(`opStartChar=${slot}`), ram = emptyRamState();
    expect(resolvedStart(world)).toBe(slot);
    expect(characterAvailability(world, slot).disposition).toBe("starting");
    expect(characterPresent(world, ram, new Set(), slot)).toBe(true);
  });
  it("uses omitted source defaults: Boy and findbothL1", () => {
    const world = imported("");
    expect(world.settings).toMatchObject({ startingCharacter: "boy", partyMode: "find-both-level-1" });
    expect(characterAvailability(world, "girl")).toEqual({ exists: "yes", disposition: "findable", joinLevel: "level-1" });
    expect(characterPresent(world, emptyRamState(), new Set(), "girl")).toBe(false);
  });
  it.each([
    ["start1only", "start-one-only", "unresolved", "starting", "absent", null],
    ["startboth", "start-both", "starting", "starting", "starting", null],
    ["findbothL1", "find-both-level-1", "findable", "findable", "findable", "level-1"],
    ["findbothCL", "find-both-current", "findable", "findable", "findable", "current"],
    ["start1find1", "start-one-find-one", "unresolved", "starting", "findable", "level-1"],
    ["find1L1", "find-one-level-1", "unresolved", "findable", "absent", "level-1"],
    ["find1CL", "find-one-current", "unresolved", "findable", "absent", "current"],
    ["none", "solo", "absent", "absent", "absent", null],
  ])("maps %s without guessing the selected additional identity", (raw, mode, before, chosen, other, level) => {
    const world = imported(`opCharacters=${raw}`);
    expect(world.settings.partyMode).toBe(mode);
    expect(world.settings.additionalCharacter).toBeNull();
    expect(characterAvailability(world, "girl").disposition).toBe(before);
    world.settings.additionalCharacter = "girl";
    expect(characterAvailability(world, "girl").disposition).toBe(chosen);
    expect(characterAvailability(world, "sprite").disposition).toBe(other);
    if (level) expect(characterAvailability(world, chosen === "starting" ? "sprite" : "girl").joinLevel).toBe(level);
  });
  it("random starting identity is explicitly unresolved; manual resolution does not set roles", () => {
    const world = imported("opStartChar=random opCharacters=none opBoyRole=random");
    expect(resolvedStart(world)).toBeNull();
    expect(characterAvailability(world, "boy").exists).toBe("unresolved");
    expect(characterPresent(world, emptyRamState(), new Set(), "boy")).toBe(false);
    world.settings.resolvedStartingCharacter = "girl";
    expect(characterAvailability(world, "boy").exists).toBe("no");
    expect(characterPresent(world, emptyRamState(), new Set(), "girl")).toBe(true);
    expect(world.roles).toEqual({ boy: "unknown", girl: "unknown", sprite: "unknown" });
  });
  it("keeps live RAM authoritative over initial presence, absence and session marks, including rollback", () => {
    const world = imported("opCharacters=none"), ram = emptyRamState();
    expect(characterPresent(world, ram, new Set(["girl"]), "girl")).toBe(false);
    ram.inventory.boy = false;
    expect(characterPresent(world, ram, new Set(["boy"]), "boy")).toBe(false);
    ram.inventory.girl = true;
    expect(characterPresent(world, ram, new Set(), "girl")).toBe(true);
    ram.inventory.girl = false;
    expect(characterPresent(world, ram, new Set(), "girl")).toBe(false);
  });
  it("does not assume a nonexistent caster is obtainable; retains canonical no-magic bypass", () => {
    const world = setOrbRequirement(imported("opCharacters=none"), "uf_orb", { kind: "element", element: "lumina" });
    expect(evaluateOrbGate(createLogicContext(emptyRamState(), new Set(), world), "uf_orb")).toBe("passable");
  });
  it("findable is not owned; starting/configured roles and live rollback correctly gate casting", () => {
    let world = setOrbRequirement(imported("opBoyRole=OGgirl"), "uf_orb", { kind: "element", element: "lumina" });
    const ram = emptyRamState(); ram.inventory["element-lumina"] = true;
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), world), "uf_orb")).toBe("passable");
    ram.inventory.boy = false;
    expect(evaluateOrbGate(createLogicContext(ram, new Set(), world), "uf_orb")).toBe("blocked");
    world = setRoleIdentity(imported("opBoyRole=random"), "boy", "sprite");
    const availability = characterAvailability(world, "boy");
    expect(setRoleIdentity(world, "boy", "girl").settings).toEqual(world.settings);
    expect(characterAvailability(setRoleIdentity(world, "boy", "girl"), "boy")).toEqual(availability);
  });
});
