import { describe, expect, it, vi } from "vitest";
import { INVENTORY_BY_ID, INVENTORY_DEFINITIONS } from "../data/inventoryDefinitions";
import { InventoryAutotracker } from "./InventoryAutotracker";
import { detectSecretOfMana } from "./potosEvent";
import type { SniClient } from "./SniClient";
import { emptyRamState } from "../state/trackerState";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { emptyWorldState } from "../state/worldState";
import { characterPresent } from "../domain/characters";
import { LIVE_SETTINGS } from "../testFixtures/liveSettings";

// Independent tables: PopTracker magic.lua/weapons.lua, EventFlags.cs,
// OpenWorldPrizes.cs. These are RAM order, NOT the presentation arrays.
const elements = ["gnome", "undine", "salamando", "sylphid", "lumina", "shade", "luna", "dryad"] as const;
const weapons = ["gloves", "sword", "axe", "spear", "whip", "bow", "boomerang", "javelin"] as const;
function memory() {
  const bytes = new Map<number, number>();
  const readMemory = vi.fn(async (address: number, length: number) => Uint8Array.from({ length }, (_, i) => bytes.get(address + i) ?? 0));
  return { bytes, readMemory, tracker: new InventoryAutotracker({ readMemory }, INVENTORY_DEFINITIONS) };
}
describe("source-backed live inventory audit", () => {
  it.each(elements)("decodes %s alone using its event flag, not its UI index", async (element) => {
    const { bytes, tracker } = memory(), index = elements.indexOf(element);
    expect(INVENTORY_BY_ID.get(`element-${element}`)!.address).toBe(0x7ecfa8 + index);
    bytes.set(0xf5cfa8 + index, 1);
    const result = await tracker.poll();
    for (const other of elements) expect(result.values[`element-${other}`]).toBe(other === element);
  });
  it.each(weapons)("decodes %s ownership and Orb stage independently, then rolls back", async (weapon) => {
    const { bytes, tracker } = memory(), index = weapons.indexOf(weapon);
    expect(INVENTORY_BY_ID.get(`weapon-${weapon}`)!.address).toBe(0x7ecfc8 + index);
    expect(INVENTORY_BY_ID.get(`weapon-orbs-${weapon}`)!.address).toBe(0x7ecfb8 + index);
    bytes.set(0xf5cfc8 + index, 1); bytes.set(0xf5cfb8 + index, 6);
    const acquired = await tracker.poll();
    for (const other of weapons) expect(acquired.values[`weapon-${other}`]).toBe(other === weapon);
    expect(acquired.values[`weapon-orbs-${weapon}`]).toBe(6);
    bytes.clear(); expect((await tracker.poll()).values[`weapon-${weapon}`]).toBe(false);
  });
  // StartingCharacterRandomizer.cs writes Girl=02, Sprite=04 to $00D9;
  // its original Boy initialization uses 01. Combinations are bitwise, not roles.
  it.each([0,1,2,3,4,5,6,7])("decodes physical party mask %s and keeps roles separate", async (mask) => {
    const { bytes, tracker, readMemory } = memory(); bytes.set(0xf500d9, mask);
    bytes.set(0xf5cf0c, 1); // deliberately disagreeing old reward flag
    const result = await tracker.poll();
    const ram = emptyRamState(); ram.inventory = result.values as typeof ram.inventory;
    const world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(LIVE_SETTINGS));
    for (const [slot, bit] of [["boy",1],["girl",2],["sprite",4]] as const) {
      expect(result.values[slot]).toBe(Boolean(mask & bit));
      expect(characterPresent(world, ram, new Set(), slot)).toBe(Boolean(mask & bit));
    }
    expect(readMemory.mock.calls.every(([, size]) => size <= 0x101)).toBe(true);
    expect(readMemory).toHaveBeenCalledWith(0xf500d9, 1);
  });
  it("detects a Girl-start game before reward flags initialize, then follows rollback and reconnect", async () => {
    const { bytes, tracker, readMemory } = memory(); bytes.set(0xf500d9, 2); bytes.set(0xf500dc, 1);
    const game = await detectSecretOfMana({ readMemory } as unknown as SniClient);
    expect(game).toMatchObject({ detected: true, partyMask: 2, characterFlags: [0,0,0] });
    expect((await tracker.poll()).values).toMatchObject({ boy: false, girl: true, sprite: false });
    bytes.set(0xf500d9, 6); expect((await tracker.poll()).values.sprite).toBe(true);
    bytes.set(0xf500d9, 2); expect((await tracker.poll()).values.sprite).toBe(false);
    const reconnected = new InventoryAutotracker({ readMemory }, INVENTORY_DEFINITIONS);
    expect((await reconnected.poll()).values.girl).toBe(true);
  });
  it("isolates a failed native party read from ordinary inventory", async () => {
    const { readMemory, bytes } = memory(); bytes.set(0xf5cfcb, 1);
    const tracker = new InventoryAutotracker({ readMemory: async (address, size) => {
      if (address === 0xf500d9) throw new Error("party unavailable");
      return readMemory(address, size);
    } }, INVENTORY_DEFINITIONS);
    const result = await tracker.poll();
    expect(result.values.girl).toBeNull(); expect(result.diagnostics.girl.error).toBe("party unavailable");
    expect(result.values["weapon-spear"]).toBe(true);
  });
  it("rejects garbage party/flag bytes and retains original game detection if the supplemental party read fails", async () => {
    const { bytes, readMemory } = memory(); bytes.set(0xf500dc, 1); bytes.set(0xf500d9, 0xff); bytes.set(0xf5cf0c, 0xff);
    expect((await detectSecretOfMana({ readMemory } as unknown as SniClient)).detected).toBe(false);
    bytes.set(0xf5cf0c, 1);
    const client = { readMemory: async (address: number, size: number) => {
      if (address === 0xf500d9) throw new Error("temporary party failure");
      return readMemory(address, size);
    } };
    expect((await detectSecretOfMana(client as unknown as SniClient)).detected).toBe(true);
  });
});
