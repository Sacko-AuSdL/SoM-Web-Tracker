import { describe, expect, it } from "vitest";
import {
  INVENTORY_BY_ID,
  INVENTORY_DEFINITIONS,
  ITEMS_BASE_ADDRESS,
  WEAPON_ORB_BASE_ADDRESS,
  WEAPON_OWNERSHIP_BASE_ADDRESS,
} from "./inventoryDefinitions";
import {
  LOCATION_BY_ID,
  LOCATION_DEFINITIONS,
  LOCATION_EVENT_BINDING_COUNT,
  activeLocationDefinitions,
} from "./locationDefinitions";

describe("PopTracker data migration", () => {
  it("uses explicit unique stable IDs for all definitions", () => {
    expect(new Set(LOCATION_DEFINITIONS.map((definition) => definition.id)).size)
      .toBe(LOCATION_DEFINITIONS.length);
    expect(new Set(INVENTORY_DEFINITIONS.map((definition) => definition.id)).size)
      .toBe(INVENTORY_DEFINITIONS.length);
  });

  it("loads Potos and Mantis from the generic location mapping", () => {
    expect(LOCATION_BY_ID.get("potos-chest")).toMatchObject({
      legacyPath: "@Potos/Potos Chest",
      events: [{ eventNumber: 0x680 }],
    });
    expect(LOCATION_BY_ID.get("mantis-ant")).toMatchObject({
      legacyPath: "@Potos/Potos Boss - Mantis Ant",
      events: [{ eventNumber: 0x112 }],
    });
  });

  it("ports all 76 independent standard checks and preserves 76 event bindings", () => {
    expect(activeLocationDefinitions(false)).toHaveLength(76);
    expect(LOCATION_EVENT_BINDING_COUNT).toBe(77);
  });

  it("represents PopTracker's independent Pandora events and target-value special cases as data", () => {
    expect(LOCATION_DEFINITIONS.filter((check) => check.legacyPath === "@Pandora/Pandora Castle Chests")
      .map((check) => check.events[0].eventNumber)).toEqual([0x673, 0x67c, 0x683, 0x684, 0x685, 0x686]);
    expect(LOCATION_BY_ID.get("kakkara-npc")?.events).toEqual([
      { eventNumber: 0x2b2, completedValue: 2 },
    ]);
  });

  it("ports all 40 authoritative inventory mappings", () => {
    expect(INVENTORY_DEFINITIONS).toHaveLength(40);
    expect(ITEMS_BASE_ADDRESS).toBe(0x7ecf00);
    expect(INVENTORY_BY_ID.get("midge-mallet")?.address).toBe(0x7ecf5c);
    expect(WEAPON_OWNERSHIP_BASE_ADDRESS).toBe(0x7ecfc8);
    expect(INVENTORY_BY_ID.get("weapon-spear")?.address).toBe(0x7ecfcb);
    expect(WEAPON_ORB_BASE_ADDRESS).toBe(0x7ecfb8);
    expect(INVENTORY_BY_ID.get("weapon-orbs-spear")?.address).toBe(0x7ecfbb);
  });

  it("preserves PopTracker RAM order for seeds, elements, and weapons", () => {
    const expected: Record<string, number> = {
      boy: 0x7e00d9, girl: 0x7e00d9, sprite: 0x7e00d9,
      "sea-hare-tail": 0x7ecf29, "gold-tower-key": 0x7ecf37,
      "midge-mallet": 0x7ecf5c, "moogle-belt": 0x7ecf74,
      "flammie-drum": 0x7ecf76,
      "seed-water": 0x7ecf90, "seed-earth": 0x7ecf91,
      "seed-wind": 0x7ecf92, "seed-fire": 0x7ecf93,
      "seed-light": 0x7ecf94, "seed-dark": 0x7ecf95,
      "seed-moon": 0x7ecf96, "seed-tree": 0x7ecf97,
      "element-gnome": 0x7ecfa8, "element-undine": 0x7ecfa9,
      "element-salamando": 0x7ecfaa, "element-sylphid": 0x7ecfab,
      "element-lumina": 0x7ecfac, "element-shade": 0x7ecfad,
      "element-luna": 0x7ecfae, "element-dryad": 0x7ecfaf,
      "weapon-orbs-gloves": 0x7ecfb8, "weapon-orbs-sword": 0x7ecfb9,
      "weapon-orbs-axe": 0x7ecfba, "weapon-orbs-spear": 0x7ecfbb,
      "weapon-orbs-whip": 0x7ecfbc, "weapon-orbs-bow": 0x7ecfbd,
      "weapon-orbs-boomerang": 0x7ecfbe, "weapon-orbs-javelin": 0x7ecfbf,
      "weapon-gloves": 0x7ecfc8, "weapon-sword": 0x7ecfc9,
      "weapon-axe": 0x7ecfca, "weapon-spear": 0x7ecfcb,
      "weapon-whip": 0x7ecfcc, "weapon-bow": 0x7ecfcd,
      "weapon-boomerang": 0x7ecfce, "weapon-javelin": 0x7ecfcf,
    };
    expect(Object.fromEntries(
      INVENTORY_DEFINITIONS.map((definition) => [definition.id, definition.address]),
    )).toEqual(expected);
  });
});
