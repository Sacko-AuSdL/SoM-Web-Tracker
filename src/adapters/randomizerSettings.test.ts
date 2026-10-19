import { describe, expect, it } from "vitest";
import { applyRandomizerSettings, parseRandomizerSettings } from "./randomizerSettings";
import { addCannonConnection, effectiveRole, emptyWorldState, setOrbCleared, setOrbMode, setOrbRequirement, setRoleIdentity } from "../state/worldState";
import { effectiveStartingLocation } from "../logic/travel";

// Exact key=value serialization from UiOptionsManager.getOptionsString(),
// with changed values from local OpenWorldSettings.cs (Randomizer 1.49).
const prefix = "version=1.49 mode=open";
describe("Randomizer settings adapter", () => {
  it("silently ignores spoilerLog and opStartGold", () => {
    expect(parseRandomizerSettings(`${prefix} spoilerLog=yes opStartGold=500`).diagnostics).toEqual([]);
  });
  it.each(["opCharacters=bogus", "opStartChar=warrior"])("rejects malformed character configuration: %s", (option) => {
    expect(parseRandomizerSettings(`${prefix} ${option}`).settings).toBeNull();
  });
  it("preserves compatible manually identified availability, but resets it when imported configuration changes", () => {
    const state = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(`${prefix} opCharacters=find1L1`));
    state.settings.additionalCharacter = "girl";
    expect(applyRandomizerSettings(state, parseRandomizerSettings(`${prefix} opCharacters=find1L1`)).settings.additionalCharacter).toBe("girl");
    expect(applyRandomizerSettings(state, parseRandomizerSettings(`${prefix} opCharacters=start1only`)).settings.additionalCharacter).toBeNull();
  });
  it("resets omitted options to source defaults, including canonical per-slot roles", () => {
    const parsed = parseRandomizerSettings(prefix);
    expect(parsed.settings).toMatchObject({ orbMode: "magic-only", cannonMode: "vanilla", drumLogic: "normal", startingLocation: "default", logic: "basic", goal: "short",
      roleModeBySlot: { boy: "normal", girl: "normal", sprite: "normal" }, fixedRoles: { boy: "boy", girl: "girl", sprite: "sprite" } });
    expect(parsed.diagnostics).toEqual([]);
    const old = emptyWorldState(); old.settings.cannonMode = "chaos";
    expect(applyRandomizerSettings(old, parsed).settings.cannonMode).toBe("vanilla");
  });
  it.each([["off", "magic-only"], ["on", "mixed"], ["weaponOnly", "weapon-only"]])("maps Orb %s", (value, expected) => {
    expect(parseRandomizerSettings(`${prefix} crystalOrbWeaponBreaking=${value}`).settings?.orbMode).toBe(expected);
  });
  it.each([["off", "vanilla"], ["open", "open"], ["shuffle", "shuffle"], ["chaos", "chaos"]])("maps Cannon %s", (value, expected) => {
    expect(parseRandomizerSettings(`${prefix} cannonTravelRandomization=${value}`).settings?.cannonMode).toBe(expected);
  });
  it.each(["yes", "true", "1", "YES", "True"])("maps source boolean %s to Drum in logic", (value) => {
    expect(parseRandomizerSettings(`${prefix} opFlammieDrumInLogic=${value}`).settings?.drumLogic).toBe("random");
  });
  it.each(["no", "false", "0"])("maps false Drum %s", (value) => {
    expect(parseRandomizerSettings(`${prefix} opFlammieDrumInLogic=${value}`).settings?.drumLogic).toBe("normal");
  });
  it("imports Kakkara only as an effective start when Drum is in logic", () => {
    const active = parseRandomizerSettings(`${prefix} opStartingLocation=kakkara opFlammieDrumInLogic=yes`);
    expect(effectiveStartingLocation(active.settings!)).toBe("kakkara");
    const inactive = parseRandomizerSettings(`${prefix} opStartingLocation=kakkara`);
    expect(inactive.settings?.startingLocation).toBe("kakkara");
    expect(effectiveStartingLocation(inactive.settings!)).toBe("default");
    expect(inactive.diagnostics[0].message).toContain("inactive");
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("imports fixed Revive seed count %s from source serialization", (count) => {
    expect(parseRandomizerSettings(`${prefix} opGoal=mtr opNumSeeds=${count}`).settings?.reviveSeedCount).toBe(count);
  });
  it("does not pretend a random Revive seed count is a known global value", () => {
    const parsed = parseRandomizerSettings(`${prefix} opGoal=mtr opNumSeeds=random`);
    expect(parsed.settings).toMatchObject({ goal: "revive", reviveSeedCount: null });
    expect(parsed.diagnostics.some((d) => d.level === "warning" && d.message.includes("seed-specific"))).toBe(true);
  });
  it("imports per-slot random/randomunique and fixed cross-slot roles without rolling identities", () => {
    const state = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(`${prefix} opBoyRole=random opGirlRole=OGsprite opSpriteRole=randomunique`));
    expect(state.settings.roleModeBySlot).toEqual({ boy: "random", girl: "normal", sprite: "random" });
    expect(effectiveRole(state, "boy")).toBe("unknown");
    expect(effectiveRole(state, "girl")).toBe("sprite");
    expect(effectiveRole(state, "sprite")).toBe("unknown");
  });
  it.each(["", "not-an-options-string", "mode=ancientcave", "opStartingLocation=moon", "crystalOrbWeaponBreaking=mixed", "opBoyRole=mage", "opFlammieDrumInLogic=maybe", "opGoal=gift"])("rejects malformed/unsupported input atomically: %s", (raw) => {
    const parsed = parseRandomizerSettings(raw);
    expect(parsed.settings).toBeNull();
    expect(parsed.diagnostics.some((d) => d.level === "error")).toBe(true);
    const state = emptyWorldState();
    expect(applyRandomizerSettings(state, parsed)).toBe(state);
  });
  it("diagnoses unknown keys/version, retains source duplicate behavior, and accepts whitespace", () => {
    const parsed = parseRandomizerSettings("version=9 mode=open\n unrelated=value\t cannonTravelRandomization=shuffle cannonTravelRandomization=open");
    expect(parsed.settings?.cannonMode).toBe("open");
    expect(parsed.diagnostics).toHaveLength(3);
    expect(parsed.diagnostics.every((d) => d.level === "warning")).toBe(true);
  });
  it("keeps seed-specific data independent, with usable manual overrides after import", () => {
    let state = setOrbMode(emptyWorldState(), "mixed");
    state = setOrbRequirement(state, "uf_orb", { kind: "weapon-family", weapon: "axe" });
    state = setOrbCleared(setRoleIdentity(state, "boy", "sprite"), "uf_orb", true);
    state = addCannonConnection(state, { from: "kakkara", to: "potos" });
    const imported = applyRandomizerSettings(state, parseRandomizerSettings(`${prefix} crystalOrbWeaponBreaking=on cannonTravelRandomization=chaos opBoyRole=random opLogic=restrictive opGoal=mtr`));
    expect(imported.orbs).toEqual(state.orbs);
    expect(imported.roles).toEqual(state.roles);
    expect(imported.manualClearedOrbs).toEqual(state.manualClearedOrbs);
    expect(imported.cannonConnections).toEqual(state.cannonConnections);
    expect(imported.settings).toMatchObject({ logic: "restrictive", goal: "revive" });
    expect(setOrbMode(imported, "weapon-only").orbs.uf_orb).toEqual(state.orbs.uf_orb);
    imported.settings.cannonMode = "vanilla";
    expect(imported.settings.cannonMode).toBe("vanilla");
    expect(imported.cannonConnections).toEqual(state.cannonConnections);
  });
});
