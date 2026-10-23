import { describe, expect, it } from "vitest";
import { emptyUiPreferences, loadUiPreferences, saveUiPreferences, loadPopoutInventoryMode, savePopoutInventoryMode } from "./uiPreferences";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
describe("UI-only preferences", () => {
  it.each(["normal", "compact", "square"] as const)("preserves %s using the existing v1 preference key", (inventoryMode) => {
    const storage = new MemoryStorage();
    storage.setItem("som-web-tracker:ui-preferences:v1", JSON.stringify({ version: 1, inventoryMode, dungeonMode: "hidden" }));
    const loaded = loadUiPreferences(storage);
    expect(loaded).toEqual({ version: 1, inventoryMode, dungeonMode: "hidden", presentation: "normal" });
    saveUiPreferences(storage, loaded);
    expect(loadUiPreferences(storage)).toEqual(loaded);
    expect(storage.length).toBe(1);
  });
  it("migrates the old Broadcast layout into black presentation without guessing a previous N/C/S choice", () => {
    const storage = new MemoryStorage();
    storage.setItem("som-web-tracker:ui-preferences:v1", JSON.stringify({ version: 1, inventoryMode: "broadcast", dungeonMode: "hidden" }));
    expect(loadUiPreferences(storage)).toEqual({ version: 1, inventoryMode: "normal", dungeonMode: "hidden", presentation: "broadcast" });
  });
  it("persists presentation independently and keeps pop-out layout separate from main layout", () => {
    const storage = new MemoryStorage();
    const main = { ...emptyUiPreferences(), inventoryMode: "square" as const, presentation: "broadcast" as const };
    saveUiPreferences(storage, main);
    expect(loadPopoutInventoryMode(storage)).toBe("square");
    savePopoutInventoryMode(storage, "compact");
    expect(loadUiPreferences(storage)).toEqual(main);
    expect(loadPopoutInventoryMode(storage)).toBe("compact");
    saveUiPreferences(storage, { ...main, presentation: "normal" });
    expect(loadPopoutInventoryMode(storage)).toBe("compact");
  });
  it("persists Normal/Compact and Auto/Hidden separately from tracker state", () => {
    const storage = new MemoryStorage();
    const prefs = { ...emptyUiPreferences(), inventoryMode: "compact" as const, dungeonMode: "hidden" as const };
    saveUiPreferences(storage, prefs);
    expect(loadUiPreferences(storage)).toEqual(prefs);
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe("som-web-tracker:ui-preferences:v1");
  });
  it("falls back on malformed or unsupported data", () => {
    const storage = new MemoryStorage();
    storage.setItem("som-web-tracker:ui-preferences:v1", "{");
    expect(loadUiPreferences(storage)).toEqual(emptyUiPreferences());
  });
});
