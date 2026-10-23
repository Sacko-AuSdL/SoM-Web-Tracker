export type InventoryMode = "normal" | "compact" | "square";
export type PresentationMode = "normal" | "broadcast";
export type DungeonMode = "auto" | "hidden";
export interface UiPreferences { version: 1; inventoryMode: InventoryMode; dungeonMode: DungeonMode; presentation?: PresentationMode }

const KEY = "som-web-tracker:ui-preferences:v1";
const POPOUT_KEY = "som-web-tracker:inventory-popout:v1";
export function isInventoryMode(value: unknown): value is InventoryMode { return value === "normal" || value === "compact" || value === "square"; }
export function emptyUiPreferences(): UiPreferences { return { version: 1, inventoryMode: "normal", dungeonMode: "auto", presentation: "normal" }; }
export function loadUiPreferences(storage: Storage): UiPreferences {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "null") as (Partial<Omit<UiPreferences, "inventoryMode">> & { inventoryMode?: string }) | null;
    if (parsed?.version !== 1) return emptyUiPreferences();
    return { version: 1, inventoryMode: isInventoryMode(parsed.inventoryMode) ? parsed.inventoryMode : "normal",
      dungeonMode: parsed.dungeonMode === "hidden" ? "hidden" : "auto",
      presentation: parsed.presentation === "broadcast" || parsed.inventoryMode === "broadcast" ? "broadcast" : "normal" };
  } catch { return emptyUiPreferences(); }
}
export function loadPopoutInventoryMode(storage: Storage): InventoryMode {
  try {
    const parsed = JSON.parse(storage.getItem(POPOUT_KEY) ?? "null");
    if (parsed?.version === 1 && isInventoryMode(parsed.inventoryMode)) return parsed.inventoryMode;
  } catch { /* A malformed pop-out preference does not affect the main tracker. */ }
  return loadUiPreferences(storage).inventoryMode;
}
export function savePopoutInventoryMode(storage: Storage, inventoryMode: InventoryMode): void {
  storage.setItem(POPOUT_KEY, JSON.stringify({ version: 1, inventoryMode }));
}
export function saveUiPreferences(storage: Storage, value: UiPreferences): void {
  storage.setItem(KEY, JSON.stringify(value));
}
