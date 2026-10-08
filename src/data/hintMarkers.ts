import { HINT_SOURCE_GROUPS } from "./sourceWorldData";
import { SANDSHIP, type SandshipRamState } from "./sandship";

// PopTracker locations/hints.json supplies only regional map_locations, never
// per-section sign/NPC coordinates. Keep every identity without inventing pins.
export const HINT_SOURCES = [...HINT_SOURCE_GROUPS.flatMap((group) => group.sources.map((name, index) => ({
  id: `${group.id}:${index}`,
  name,
  regionId: group.id,
  x: group.x,
  y: group.y,
  coordinatePrecision: "regional" as const,
}))), { id: SANDSHIP.hintId, name: SANDSHIP.hintName, regionId: SANDSHIP.areaId,
  x: SANDSHIP.x, y: SANDSHIP.y, coordinatePrecision: "regional" as const }];

export const HINT_MAP_MARKERS = [...HINT_SOURCE_GROUPS.map((group) => ({
  id: group.id,
  name: group.sources.length === 1 ? group.sources[0] : group.name,
  x: group.x,
  y: group.y,
  screenOffset: group.id === "water-palace-hints" ? { x: -26, y: -16 } : { x: 20, y: 14 },
  sources: HINT_SOURCES.filter((source) => source.regionId === group.id),
})), { id: SANDSHIP.hintId, name: SANDSHIP.hintName, x: SANDSHIP.x, y: SANDSHIP.y,
  // Right of Captain and boss status; clear of the nearby Cannon/Orb pins.
  screenOffset: { x: 56, y: 0 }, sources: HINT_SOURCES.filter((source) => source.id === SANDSHIP.hintId) }];

export function activeHintMarkers(sandship: SandshipRamState) {
  return HINT_MAP_MARKERS.filter((hint) => hint.id !== SANDSHIP.hintId ||
    (sandship.supported === true && sandship.bossDefeated === true));
}
