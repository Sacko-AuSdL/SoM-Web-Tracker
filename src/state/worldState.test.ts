import { describe, expect, it } from "vitest";
import { emptyWorldState, isRoleRandomized, loadWorldState, saveWorldState, setOrbMode, setOrbRequirement, setRoleIdentity } from "./worldState";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
describe("Crystal Orb mode and persistence", () => {
  it("accepts only elements in Magic Only and only weapons in Weapon Only", () => {
    const start = emptyWorldState();
    expect(setOrbRequirement(start, "uf_orb", { kind: "weapon-family", weapon: "axe" })).toBe(start);
    const magic = setOrbRequirement(start, "uf_orb", { kind: "element", element: "gnome" });
    expect(magic.orbs.uf_orb).toEqual({ kind: "element", element: "gnome" });
    const weapon = setOrbMode(magic, "weapon-only");
    expect(weapon.orbs.uf_orb).toEqual({ kind: "unknown" });
    expect(setOrbRequirement(weapon, "uf_orb", { kind: "element", element: "gnome" })).toBe(weapon);
    expect(setOrbRequirement(weapon, "uf_orb", { kind: "weapon-family", weapon: "axe" }).orbs.uf_orb)
      .toEqual({ kind: "weapon-family", weapon: "axe" });
  });
  it("allows both kinds in Mixed and preserves Unknown and selected requirements", () => {
    const storage = new MemoryStorage();
    let state = setOrbMode(emptyWorldState(), "mixed");
    state = setOrbRequirement(state, "uf_orb", { kind: "weapon-family", weapon: "spear" });
    state = setOrbRequirement(state, "gp_orb1", { kind: "element", element: "lumina" });
    state = setOrbRequirement(state, "gp_orb2", { kind: "unknown" });
    saveWorldState(storage, state);
    expect(loadWorldState(storage)).toEqual(state);
  });
});

describe("PopTracker character role identities", () => {
  it("keeps three assignments independent and supports per-slot Randomizer options", () => {
    const start = emptyWorldState();
    start.settings.roleModeBySlot = { boy: "random", girl: "normal", sprite: "random" };
    expect(isRoleRandomized(start, "boy")).toBe(true);
    expect(isRoleRandomized(start, "girl")).toBe(false);
    expect(isRoleRandomized(start, "sprite")).toBe(true);
    expect(start.roles).toEqual({ boy: "unknown", girl: "unknown", sprite: "unknown" });
    const chosen = setRoleIdentity(start, "boy", "sprite");
    expect(chosen.roles).toEqual({ boy: "sprite", girl: "unknown", sprite: "unknown" });
    expect(setRoleIdentity(chosen, "boy", "unknown").roles.boy).toBe("unknown");
  });
  it("persists role settings and identities separately from RAM presence", () => {
    const storage = new MemoryStorage();
    const state = setRoleIdentity(emptyWorldState(), "boy", "sprite");
    state.settings.roleModeBySlot = { boy: "random" };
    saveWorldState(storage, state);
    expect(loadWorldState(storage)).toEqual(state);
    expect(storage.getItem("som-web-tracker:world-state:v3")).not.toContain("inventory");
  });
  it("loads older saved global role mode without per-slot overrides", () => {
    const storage = new MemoryStorage();
    const state = emptyWorldState();
    state.settings.roleMode = "random";
    const legacy = { ...state, version: 1, settings: { ...state.settings, roleModeBySlot: undefined } };
    storage.setItem("som-web-tracker:world-state:v1", JSON.stringify(legacy));
    const loaded = loadWorldState(storage);
    expect(loaded.settings.roleModeBySlot).toEqual({});
    expect(isRoleRandomized(loaded, "boy")).toBe(true);
    expect(isRoleRandomized(loaded, "girl")).toBe(true);
  });
  it("keeps each Fire Palace Orb requirement independent", () => {
    let state = emptyWorldState();
    state = setOrbRequirement(state, "fp_orb1", { kind: "element", element: "gnome" });
    state = setOrbRequirement(state, "fp_orb2", { kind: "element", element: "undine" });
    state = setOrbRequirement(state, "fp_orb3", { kind: "element", element: "salamando" });
    expect([state.orbs.fp_orb1, state.orbs.fp_orb2, state.orbs.fp_orb3]).toEqual([
      { kind: "element", element: "gnome" }, { kind: "element", element: "undine" },
      { kind: "element", element: "salamando" },
    ]);
  });
});
