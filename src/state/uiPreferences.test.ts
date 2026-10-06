import { describe, expect, it } from "vitest";
import { emptyUiPreferences, loadUiPreferences, saveUiPreferences } from "./uiPreferences";

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
