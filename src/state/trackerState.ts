import { INVENTORY_DEFINITIONS, type InventoryId } from "../data/inventoryDefinitions";
import { LEGACY_CHECK_SPLITS, LOCATION_BY_ID, LOCATION_DEFINITIONS, type LocationId } from "../data/locationDefinitions";
import type { InventoryValue } from "../domain/tracker";
import { emptyOrbRamState, type OrbRamState } from "../autotracking/OrbAutotracker";
import { emptySandshipState, type SandshipRamState } from "../data/sandship";

export type CheckRamState = Record<LocationId, boolean | null>;
export type InventoryRamState = Record<InventoryId, InventoryValue | null>;

export interface RamState {
  checks: CheckRamState;
  inventory: InventoryRamState;
  orbs: OrbRamState;
  sandship: SandshipRamState;
}

export interface PersistentManualState {
  version: 1;
  manualCompletedChecks: LocationId[];
}

export interface EffectiveCheckState {
  complete: boolean;
  completionSource: "manual" | "ram" | "none";
}

const STORAGE_KEY = "som-web-tracker:manual-state";
const MINI_STORAGE_KEY = "som-web-tracker-mini:manual-state:v2";
// Retain the original browser key solely to migrate existing Potos marks.
const LEGACY_POTOS_STORAGE_KEY = "som-web-tracker-mvp:manual-state:v1";

export function emptyRamState(): RamState {
  return {
    checks: Object.fromEntries(LOCATION_DEFINITIONS.map((definition) => [definition.id, null])) as CheckRamState,
    inventory: Object.fromEntries(INVENTORY_DEFINITIONS.map((definition) => [definition.id, null])) as InventoryRamState,
    orbs: emptyOrbRamState(),
    sandship: emptySandshipState(),
  };
}

export function emptyManualState(): PersistentManualState {
  return { version: 1, manualCompletedChecks: [] };
}

export function isManuallyCompleted(state: PersistentManualState, locationId: LocationId): boolean {
  return state.manualCompletedChecks.includes(locationId);
}

export function setManualCompletion(state: PersistentManualState, locationId: LocationId, complete: boolean): PersistentManualState {
  const completed = new Set(state.manualCompletedChecks);
  if (complete) completed.add(locationId);
  else completed.delete(locationId);
  return { version: 1, manualCompletedChecks: [...completed] };
}

export function deriveEffectiveCheckState(check: LocationId, ram: RamState, manual: PersistentManualState): EffectiveCheckState {
  if (isManuallyCompleted(manual, check)) return { complete: true, completionSource: "manual" };
  if (ram.checks[check] === true) return { complete: true, completionSource: "ram" };
  return { complete: false, completionSource: "none" };
}

export function loadManualState(storage: Storage): PersistentManualState {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current) as { version?: number; manualCompletedChecks?: unknown[] };
      if (parsed.version === 1 && Array.isArray(parsed.manualCompletedChecks)) {
        return {
          version: 1,
          manualCompletedChecks: [...new Set(parsed.manualCompletedChecks.flatMap((id): LocationId[] => {
            if (typeof id !== "string") return [];
            if (Object.hasOwn(LEGACY_CHECK_SPLITS, id)) return [...LEGACY_CHECK_SPLITS[id as keyof typeof LEGACY_CHECK_SPLITS]];
            return LOCATION_BY_ID.has(id as LocationId) ? [id as LocationId] : [];
          }))],
        };
      }
    }

    const mini = storage.getItem(MINI_STORAGE_KEY);
    if (mini) {
      const parsed = JSON.parse(mini) as { completedChecks?: { potosChest?: boolean; mantisAnt?: boolean } };
      const migrated: LocationId[] = [];
      if (parsed.completedChecks?.potosChest === true) migrated.push("potos-chest");
      if (parsed.completedChecks?.mantisAnt === true) migrated.push("mantis-ant");
      return { version: 1, manualCompletedChecks: migrated };
    }

    const legacyPotos = storage.getItem(LEGACY_POTOS_STORAGE_KEY);
    if (legacyPotos) {
      const parsed = JSON.parse(legacyPotos) as { potosChestComplete?: boolean };
      return { version: 1, manualCompletedChecks: parsed.potosChestComplete ? ["potos-chest"] : [] };
    }
  } catch {
    // Malformed persisted data falls back to a clean versioned state.
  }
  return emptyManualState();
}

export function saveManualState(storage: Storage, state: PersistentManualState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
