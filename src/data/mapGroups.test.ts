import { describe, expect, it } from "vitest";
import { LOCATION_DEFINITIONS } from "./locationDefinitions";
import { MAP_GROUPS, MAP_IMAGE_SIZE } from "./mapGroups";
import raw from "../../source/poptracker/locations/locations.json?raw";

interface SourceNode {
  name: string;
  map_locations?: { map: string; x: number; y: number }[];
  sections?: { name: string; item_count?: number }[];
  children?: SourceNode[];
}

const source = JSON.parse(raw.replace(/\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")) as SourceNode[];

function sourceAreas(nodes: SourceNode[], path: string[] = []): Map<string, SourceNode> {
  const areas = new Map<string, SourceNode>();
  for (const node of nodes) {
    const next = [...path, node.name];
    if (node.map_locations) areas.set(next.slice(1).join("/"), node);
    if (node.children) for (const [key, value] of sourceAreas(node.children, next)) areas.set(key, value);
  }
  return areas;
}

describe("PopTracker overworld conversion", () => {
  it("uses the source image dimensions and maps every standard check once", () => {
    expect(MAP_IMAGE_SIZE).toEqual({ width: 4096, height: 4096 });
    expect(MAP_GROUPS).toHaveLength(27);
    const ids = MAP_GROUPS.flatMap((group) => group.checkIds);
    expect(new Set(ids).size).toBe(LOCATION_DEFINITIONS.length);
    expect(ids).toHaveLength(LOCATION_DEFINITIONS.length);
    expect(new Set(ids)).toEqual(new Set(LOCATION_DEFINITIONS.map((check) => check.id)));
  });

  it("keeps authoritative coordinates and hierarchy for every pin", () => {
    const sourceByPath = sourceAreas(source);
    const checksByPath = new Map<string, string[]>();
    for (const check of LOCATION_DEFINITIONS) checksByPath.set(check.legacyPath, [...(checksByPath.get(check.legacyPath) ?? []), check.id]);
    for (const group of MAP_GROUPS) {
      const area = sourceByPath.get(group.path);
      expect(area, group.path).toBeDefined();
      const pin = area!.map_locations!.find((location) => location.map === "overworld");
      expect({ x: group.x, y: group.y }, group.path).toEqual({ x: pin?.x, y: pin?.y });
      const expected = area!.sections?.filter((section) => section.item_count)
        .flatMap((section) => checksByPath.get(`@${group.path}/${section.name}`) ?? []);
      expect(group.checkIds, group.path).toEqual(expected);
      expect(group.x).toBeGreaterThanOrEqual(0);
      expect(group.x).toBeLessThanOrEqual(MAP_IMAGE_SIZE.width);
      expect(group.y).toBeGreaterThanOrEqual(0);
      expect(group.y).toBeLessThanOrEqual(MAP_IMAGE_SIZE.height);
    }
  });

  it("counts logical checks rather than PopTracker item slots", () => {
    expect(MAP_GROUPS.find((group) => group.id === "potos")?.checkIds).toEqual([
      "sword-pedestal", "potos-chest", "mantis-ant",
    ]);
    expect(MAP_GROUPS.find((group) => group.id === "pandora")?.checkIds).toHaveLength(8);
    expect(MAP_GROUPS.find((group) => group.id === "gaia-s-navel")?.checkIds).toHaveLength(7);
  });
});
