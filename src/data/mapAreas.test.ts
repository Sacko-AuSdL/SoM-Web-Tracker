import { describe, expect, it } from "vitest";
import { LOCATION_DEFINITIONS, activeLocationDefinitions } from "./locationDefinitions";
import { MAP_AREAS } from "./mapAreas";
import { HINT_MAP_MARKERS, HINT_SOURCES } from "./hintMarkers";
import { FIRE_PALACE_ORB_LAYOUT, GRAND_PALACE_ORB_LAYOUT, UPPER_LAND_ORB_POSITION } from "./orbLayout";
import { CHECK_SOURCE_RULES, HINT_SOURCE_GROUPS, ORB_SOURCE_DEFINITIONS } from "./sourceWorldData";

describe("explicit browser map areas", () => {
  it("assigns every existing stable check ID once without creating new autotracking IDs", () => {
    const assigned = MAP_AREAS.flatMap((area) => area.checkIds);
    expect(assigned).toHaveLength(LOCATION_DEFINITIONS.length);
    expect(new Set(assigned).size).toBe(LOCATION_DEFINITIONS.length);
    expect([...assigned].sort()).toEqual(LOCATION_DEFINITIONS.map((check) => check.id).sort());
    expect(Object.keys(CHECK_SOURCE_RULES)).toHaveLength(activeLocationDefinitions(false).length);
  });
  it("separates Water Palace and Undine Cave using the verified PopTracker check", () => {
    expect(MAP_AREAS.find((area) => area.id === "water-palace")?.checkIds).toEqual(["water-palace-mana-seed-jabberwocky"]);
    const undine = MAP_AREAS.find((area) => area.id === "undine-cave");
    expect(undine?.checkIds).toEqual(["undine-biting-lizard"]);
    expect(undine?.sourceNote).toContain("two reward slots");
    const water = MAP_AREAS.find((area) => area.id === "water-palace")!;
    expect({ x: water.x, y: water.y }).toEqual({ x: 2125, y: 2925 });
    const elinee = MAP_AREAS.find((area) => area.id === "elinee-s-castle")!;
    expect(water.x).toBeGreaterThan(elinee.x + 100);
    expect(water.y).toBeLessThan(elinee.y);
    expect({ x: undine!.x, y: undine!.y }).toEqual({ x: 2207, y: 2895 });
    expect(undine!.x).toBeGreaterThan(water.x);
    expect(water.screenOffset).toBeUndefined();
    expect(undine!.screenOffset).toEqual({ x: 10, y: -8 });
    expect(LOCATION_DEFINITIONS.find((check) => check.id === "undine-biting-lizard")?.events[0].eventNumber).toBe(0x581);
  });
  it("anchors Upper Land lower and closer to Sprite Village's forest gate and keeps three Fire Palace Orbs below the palace", () => {
    const upperSource = ORB_SOURCE_DEFINITIONS.find((orb) => orb.id === "uf_orb")!;
    const matango = MAP_AREAS.find((area) => area.id === "upper-land-matango")!;
    const sprite = MAP_AREAS.find((area) => area.id === "upper-land-sprite-village")!;
    expect(UPPER_LAND_ORB_POSITION.x).toBeLessThan(sprite.x);
    expect(UPPER_LAND_ORB_POSITION.y).toBeGreaterThan(2325);
    expect(UPPER_LAND_ORB_POSITION.y).toBeLessThan(sprite.y);
    expect(Math.hypot(sprite.x - UPPER_LAND_ORB_POSITION.x, sprite.y - UPPER_LAND_ORB_POSITION.y))
      .toBeLessThan(Math.hypot(sprite.x - 1705, sprite.y - 2325));
    expect(UPPER_LAND_ORB_POSITION.y).toBeGreaterThan(matango.y);
    expect([UPPER_LAND_ORB_POSITION.x, UPPER_LAND_ORB_POSITION.y]).not.toEqual([upperSource.x, upperSource.y]);
    expect(FIRE_PALACE_ORB_LAYOUT.map((orb) => orb.id)).toEqual(["fp_orb1", "fp_orb2", "fp_orb3"]);
    expect(new Set(FIRE_PALACE_ORB_LAYOUT.map((orb) => `${orb.x},${orb.y}`)).size).toBe(3);
    expect(FIRE_PALACE_ORB_LAYOUT.map((orb) => orb.x)).toEqual([-48, 0, 48]);
    expect(FIRE_PALACE_ORB_LAYOUT.every((orb) => orb.y === 30)).toBe(true);
    for (let i = 0; i < FIRE_PALACE_ORB_LAYOUT.length; i++) for (let j = i + 1; j < FIRE_PALACE_ORB_LAYOUT.length; j++) {
      const a = FIRE_PALACE_ORB_LAYOUT[i], b = FIRE_PALACE_ORB_LAYOUT[j];
      expect(Math.abs(a.x - b.x) >= 44 || Math.abs(a.y - b.y) >= 24).toBe(true);
    }
  });
  it("gives all seven Grand Palace Orbs distinct positions in deterministic 4+3 rows", () => {
    expect(GRAND_PALACE_ORB_LAYOUT.map((orb) => orb.id))
      .toEqual(["gp_orb1", "gp_orb2", "gp_orb3", "gp_orb4", "gp_orb5", "gp_orb6", "gp_orb7"]);
    expect(new Set(GRAND_PALACE_ORB_LAYOUT.map((orb) => `${orb.x},${orb.y}`)).size).toBe(7);
    expect(GRAND_PALACE_ORB_LAYOUT.filter((orb) => orb.y === GRAND_PALACE_ORB_LAYOUT[0].y)).toHaveLength(4);
    expect(GRAND_PALACE_ORB_LAYOUT.filter((orb) => orb.y === GRAND_PALACE_ORB_LAYOUT[4].y)).toHaveLength(3);
  });
  it("migrates map Orb and hint sources without hint contents", () => {
    expect(ORB_SOURCE_DEFINITIONS).toHaveLength(14);
    expect(ORB_SOURCE_DEFINITIONS.map((orb) => orb.id)).toContain("uf_orb");
    expect(ORB_SOURCE_DEFINITIONS.filter((orb) => orb.id.startsWith("gp_orb"))).toHaveLength(7);
    expect(HINT_SOURCE_GROUPS).toHaveLength(7);
    expect(HINT_SOURCE_GROUPS.reduce((count, group) => count + group.sources.length, 0)).toBe(16);
    expect(HINT_SOURCE_GROUPS.every((group) => Object.keys(group).sort().join(",") === "id,name,sources,x,y")).toBe(true);
  });
  it("preserves each hint identity at its authoritative regional fallback, without gameplay rules", () => {
    const sources = HINT_SOURCES.filter((source) => source.regionId !== "sandship");
    expect(sources).toHaveLength(16);
    expect(new Set(sources.map((source) => source.id)).size).toBe(16);
    expect(sources.map((source) => source.name)).toEqual(HINT_SOURCE_GROUPS.flatMap((group) => [...group.sources]));
    expect(HINT_MAP_MARKERS.filter((marker) => marker.id !== "sandship-morie-hint")).toHaveLength(7);
    for (const source of sources) {
      const region = HINT_SOURCE_GROUPS.find((group) => group.id === source.regionId)!;
      expect([source.x, source.y]).toEqual([region.x, region.y]);
      expect(source.coordinatePrecision).toBe("regional");
      expect(Object.keys(source).sort()).toEqual(["coordinatePrecision", "id", "name", "regionId", "x", "y"]);
    }
  });
});
