import { HINT_SOURCE_GROUPS } from "./sourceWorldData";

// PopTracker locations/hints.json supplies only regional map_locations, never
// per-section sign/NPC coordinates. Keep every identity without inventing pins.
export const HINT_SOURCES = HINT_SOURCE_GROUPS.flatMap((group) => group.sources.map((name, index) => ({
  id: `${group.id}:${index}`,
  name,
  regionId: group.id,
  x: group.x,
  y: group.y,
  coordinatePrecision: "regional" as const,
})));

export const HINT_MAP_MARKERS = HINT_SOURCE_GROUPS.map((group) => ({
  id: group.id,
  name: group.sources.length === 1 ? group.sources[0] : group.name,
  x: group.x,
  y: group.y,
  screenOffset: group.id === "water-palace-hints" ? { x: -26, y: -16 } : { x: 20, y: 14 },
  sources: HINT_SOURCES.filter((source) => source.regionId === group.id),
}));
