import { describe, expect, it } from "vitest";
import { DUNGEON_DEFINITIONS, activeDungeon, resolveDungeonMap, type DungeonDefinition } from "./dungeons";

describe("optional verified dungeon map resolution", () => {
  const fixture: DungeonDefinition = { id: "verified-fixture", name: "Fixture", mapIds: [0x123, 0x124], imageUrl: "/fixture.png" };
  it("ships no invented dungeon maps or map IDs", () => {
    expect(DUNGEON_DEFINITIONS).toEqual([]);
    expect(activeDungeon("auto", 0x123)).toBeNull();
  });
  it("resolves multiple room IDs only from supplied definitions", () => {
    expect(resolveDungeonMap(0x123, [fixture])).toEqual(fixture);
    expect(resolveDungeonMap(0x124, [fixture])).toEqual(fixture);
    expect(resolveDungeonMap(0x125, [fixture])).toBeNull();
    expect(resolveDungeonMap(null, [fixture])).toBeNull();
  });
  it("obeys Auto/Hidden without affecting the world map", () => {
    expect(activeDungeon("auto", 0x123, [fixture])).toEqual(fixture);
    expect(activeDungeon("hidden", 0x123, [fixture])).toBeNull();
  });
});
