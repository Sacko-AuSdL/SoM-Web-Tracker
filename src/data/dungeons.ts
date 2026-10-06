import type { DungeonMode } from "../state/uiPreferences";

export interface DungeonDefinition {
  id: string;
  name: string;
  mapIds: readonly number[];
  imageUrl: string;
}

// PopTracker currently supplies only overworld/overworld_hints and one image.
// Add a dungeon here only when both its map IDs and licensed image are verified.
export const DUNGEON_DEFINITIONS: readonly DungeonDefinition[] = [];

export function resolveDungeonMap(mapId: number | null | undefined,
  definitions: readonly DungeonDefinition[] = DUNGEON_DEFINITIONS): DungeonDefinition | null {
  if (mapId === null || mapId === undefined) return null;
  return definitions.find((dungeon) => dungeon.mapIds.includes(mapId)) ?? null;
}

export function activeDungeon(mode: DungeonMode, mapId: number | null | undefined,
  definitions: readonly DungeonDefinition[] = DUNGEON_DEFINITIONS): DungeonDefinition | null {
  return mode === "hidden" ? null : resolveDungeonMap(mapId, definitions);
}
