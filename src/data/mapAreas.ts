import { MAP_GROUPS } from "./mapGroups";
import type { LocationId } from "./locationDefinitions";

export interface MapArea {
  id: string;
  name: string;
  path: string;
  x: number;
  y: number;
  checkIds: readonly LocationId[];
  screenOffset?: { x: number; y: number };
  sourceNote?: string;
}

// UI grouping only. PopTracker gives these one regional coordinate; the visible
// palace building and the waterfall cave have separate landmarks on its map PNG.
export const MAP_AREAS: readonly MapArea[] = MAP_GROUPS.flatMap<MapArea>((group) => group.id === "water-palace" ? [
  { ...group, x: 2125, y: 2925, checkIds: ["water-palace-mana-seed-jabberwocky"] },
  { ...group, id: "undine-cave", name: "Undine Cave", x: 2207, y: 2895,
    screenOffset: { x: 10, y: -8 },
    checkIds: ["undine-biting-lizard"], sourceNote: "PopTracker lists one check with two reward slots." },
] : [{ ...group,
  ...(group.id === "elinee-s-castle" ? { screenOffset: { x: -7, y: 3 } } : {}),
  ...(group.id === "lofty-mountains-joch-s-cave" ? { screenOffset: { x: 16, y: 0 } } : {}),
  ...(group.id === "ice-country-tropical-town-tropical-town-boss-boreal-face" ? { name: "Tropical Town After Boss - Stove" } : {}),
}]);

export const MAP_AREA_BY_ID = new Map(MAP_AREAS.map((area) => [area.id, area]));
