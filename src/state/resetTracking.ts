import type { InventoryId } from "../data/inventoryDefinitions";
import { emptyManualState, type PersistentManualState } from "./trackerState";
import { emptyWorldState, type WorldState } from "./worldState";

export type ResetScope = "orbs" | "manual" | "seed";
export interface ManualTrackingData {
  world: WorldState; manual: PersistentManualState; manualItems: ReadonlySet<InventoryId>;
}
// Deliberately has no RAM, transport, UI-preference, or storage-clear access.
// The normal versioned writers persist empty current records, masking legacy data.
export function resetTracking(scope: ResetScope, data: ManualTrackingData): ManualTrackingData {
  if (scope === "orbs") return { ...data, world: { ...data.world,
    orbs: emptyWorldState().orbs, manualClearedOrbs: [], gpNotNeeded: [] } };
  return { manual: emptyManualState(), manualItems: new Set(), world: scope === "seed" ? emptyWorldState() :
    { ...data.world, manualClearedOrbs: [], manualReadHints: [] } };
}
