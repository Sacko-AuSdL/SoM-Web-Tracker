export type InventoryMode = "normal" | "compact" | "square" | "broadcast";
export type DungeonMode = "auto" | "hidden";
export interface UiPreferences { version: 1; inventoryMode: InventoryMode; dungeonMode: DungeonMode }

const KEY = "som-web-tracker:ui-preferences:v1";
export function emptyUiPreferences(): UiPreferences { return { version: 1, inventoryMode: "normal", dungeonMode: "auto" }; }
export function loadUiPreferences(storage: Storage): UiPreferences {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "null") as Partial<UiPreferences> | null;
    if (parsed?.version !== 1) return emptyUiPreferences();
    return { version: 1, inventoryMode: parsed.inventoryMode === "compact" || parsed.inventoryMode === "square" || parsed.inventoryMode === "broadcast" ? parsed.inventoryMode : "normal",
      dungeonMode: parsed.dungeonMode === "hidden" ? "hidden" : "auto" };
  } catch { return emptyUiPreferences(); }
}
export function saveUiPreferences(storage: Storage, value: UiPreferences): void {
  storage.setItem(KEY, JSON.stringify(value));
}
