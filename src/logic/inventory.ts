import { INVENTORY_DEFINITIONS, type InventoryId } from "../data/inventoryDefinitions";
import type { RamState } from "../state/trackerState";

export function countManaSeeds(ram: RamState, manualItems: ReadonlySet<InventoryId>): number {
  return INVENTORY_DEFINITIONS.filter(({ category, id }) => category === "seed" &&
    (ram.inventory[id] === true || manualItems.has(id))).length;
}
