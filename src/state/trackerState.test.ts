import { describe, expect, it } from "vitest";
import { LEGACY_CHECK_SPLITS } from "../data/locationDefinitions";
import {
  deriveEffectiveCheckState,
  emptyManualState,
  emptyRamState,
  loadManualState,
  saveManualState,
  setManualCompletion,
} from "./trackerState";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("generic completion state separation", () => {
  it("migrates all old aggregate marks to their independent chests and deduplicates existing marks", () => {
    const storage = new MemoryStorage();
    storage.setItem("som-web-tracker:manual-state", JSON.stringify({ version: 1,
      manualCompletedChecks: [...Object.keys(LEGACY_CHECK_SPLITS), "pandora-castle-chest-673", "potos-chest", "invalid", null] }));
    const migrated = loadManualState(storage);
    expect(new Set(migrated.manualCompletedChecks)).toEqual(new Set([...Object.values(LEGACY_CHECK_SPLITS).flat(), "potos-chest"]));
    expect(migrated.manualCompletedChecks).toHaveLength(13);
    const undone = setManualCompletion(migrated, "pandora-castle-chest-673", false);
    expect(undone.manualCompletedChecks).toContain("pandora-castle-chest-67c");
    expect(undone.manualCompletedChecks).not.toContain("pandora-castle-chest-673");
    saveManualState(storage, undone);
    expect(loadManualState(storage)).toEqual(undone);
  });
  it("persists an individual new chest mark without completing its siblings or inventory", () => {
    const storage = new MemoryStorage(), ram = emptyRamState();
    saveManualState(storage, setManualCompletion(emptyManualState(), "moogle-village-chest-670", true));
    const restored = loadManualState(storage);
    expect(deriveEffectiveCheckState("moogle-village-chest-670", ram, restored).complete).toBe(true);
    expect(deriveEffectiveCheckState("moogle-village-chest-676", ram, restored).complete).toBe(false);
    expect(ram.inventory["weapon-spear"]).toBeNull();
  });
  it("keeps Potos RAM behavior unchanged", () => {
    const ram = emptyRamState();
    ram.checks["potos-chest"] = true;
    expect(deriveEffectiveCheckState("potos-chest", ram, emptyManualState())).toEqual({
      complete: true,
      completionSource: "ram",
    });
    ram.checks["potos-chest"] = false;
    expect(deriveEffectiveCheckState("potos-chest", ram, emptyManualState()).complete).toBe(false);
  });

  it("keeps manual check completion separate from Spear inventory", () => {
    const ram = emptyRamState();
    ram.checks["potos-chest"] = false;
    ram.inventory["weapon-spear"] = false;
    const manual = setManualCompletion(emptyManualState(), "potos-chest", true);
    expect(deriveEffectiveCheckState("potos-chest", ram, manual)).toEqual({
      complete: true,
      completionSource: "manual",
    });
    expect(ram.inventory["weapon-spear"]).toBe(false);
  });

  it("clears an explicit manual completion", () => {
    const set = setManualCompletion(emptyManualState(), "mantis-ant", true);
    const cleared = setManualCompletion(set, "mantis-ant", false);
    expect(cleared.manualCompletedChecks).toEqual([]);
  });

  it("persists only the versioned stable check IDs", () => {
    const storage = new MemoryStorage();
    const manual = setManualCompletion(
      setManualCompletion(emptyManualState(), "potos-chest", true),
      "mantis-ant",
      true,
    );
    saveManualState(storage, manual);
    expect(loadManualState(storage)).toEqual({
      version: 1,
      manualCompletedChecks: ["potos-chest", "mantis-ant"],
    });
    expect(JSON.parse(storage.getItem("som-web-tracker:manual-state")!)).toEqual({
      version: 1,
      manualCompletedChecks: ["potos-chest", "mantis-ant"],
    });
  });

  it("does not persist RAM or execution-pointer session completion", () => {
    const storage = new MemoryStorage();
    const ram = emptyRamState();
    ram.checks["mantis-ant"] = true;
    ram.inventory["weapon-spear"] = true;
    saveManualState(storage, emptyManualState());
    expect(loadManualState(storage)).toEqual(emptyManualState());
    expect(storage.getItem("som-web-tracker:manual-state")).not.toContain("mantis-ant");
    expect(storage.getItem("som-web-tracker:manual-state")).not.toContain("weapon-spear");
  });

  it("migrates Mini v0.1 stable equivalents", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "som-web-tracker-mini:manual-state:v2",
      JSON.stringify({ completedChecks: { potosChest: true, mantisAnt: true } }),
    );
    expect(loadManualState(storage)).toEqual({
      version: 1,
      manualCompletedChecks: ["potos-chest", "mantis-ant"],
    });
  });

  it("migrates the legacy Potos completion", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "som-web-tracker-mvp:manual-state:v1",
      JSON.stringify({ potosChestComplete: true }),
    );
    expect(loadManualState(storage)).toEqual({
      version: 1,
      manualCompletedChecks: ["potos-chest"],
    });
  });
});
