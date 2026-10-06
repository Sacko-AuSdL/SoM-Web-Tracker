import type { InventoryDefinition } from "../domain/tracker";

export const ITEMS_BASE_ADDRESS = 0x7ecf00;
export const WEAPON_ORB_BASE_ADDRESS = ITEMS_BASE_ADDRESS + 0xb8;
export const WEAPON_OWNERSHIP_BASE_ADDRESS = ITEMS_BASE_ADDRESS + 0xc8;

export const decodePresent = (value: number): boolean => value > 0;
export const decodeStage = (value: number): number => value;

export const INVENTORY_DEFINITIONS = [
  { id: "boy", name: "Boy", category: "character", address: ITEMS_BASE_ADDRESS + 0x0c, valueKind: "boolean", decode: decodePresent },
  { id: "girl", name: "Girl", category: "character", address: ITEMS_BASE_ADDRESS + 0x0d, valueKind: "boolean", decode: decodePresent },
  { id: "sprite", name: "Sprite", category: "character", address: ITEMS_BASE_ADDRESS + 0x0e, valueKind: "boolean", decode: decodePresent },
  { id: "sea-hare-tail", name: "Sea Hare Tail", category: "key-item", address: ITEMS_BASE_ADDRESS + 0x29, valueKind: "boolean", decode: decodePresent },
  { id: "gold-tower-key", name: "Gold Tower Key", category: "key-item", address: ITEMS_BASE_ADDRESS + 0x37, valueKind: "boolean", decode: decodePresent },
  { id: "midge-mallet", name: "Midge Mallet", category: "key-item", address: ITEMS_BASE_ADDRESS + 0x5c, valueKind: "boolean", decode: decodePresent },
  { id: "moogle-belt", name: "Moogle Belt", category: "key-item", address: ITEMS_BASE_ADDRESS + 0x74, valueKind: "boolean", decode: decodePresent },
  { id: "flammie-drum", name: "Flammie Drum", category: "key-item", address: ITEMS_BASE_ADDRESS + 0x76, valueKind: "boolean", decode: decodePresent },
  { id: "seed-water", name: "Water Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x90, valueKind: "boolean", decode: decodePresent },
  { id: "seed-earth", name: "Earth Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x91, valueKind: "boolean", decode: decodePresent },
  { id: "seed-wind", name: "Wind Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x92, valueKind: "boolean", decode: decodePresent },
  { id: "seed-fire", name: "Fire Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x93, valueKind: "boolean", decode: decodePresent },
  { id: "seed-light", name: "Light Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x94, valueKind: "boolean", decode: decodePresent },
  { id: "seed-dark", name: "Dark Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x95, valueKind: "boolean", decode: decodePresent },
  { id: "seed-moon", name: "Moon Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x96, valueKind: "boolean", decode: decodePresent },
  { id: "seed-tree", name: "Tree Seed", category: "seed", address: ITEMS_BASE_ADDRESS + 0x97, valueKind: "boolean", decode: decodePresent },
  { id: "element-gnome", name: "Gnome", category: "element", address: ITEMS_BASE_ADDRESS + 0xa8, valueKind: "boolean", decode: decodePresent },
  { id: "element-undine", name: "Undine", category: "element", address: ITEMS_BASE_ADDRESS + 0xa9, valueKind: "boolean", decode: decodePresent },
  { id: "element-salamando", name: "Salamando", category: "element", address: ITEMS_BASE_ADDRESS + 0xaa, valueKind: "boolean", decode: decodePresent },
  { id: "element-sylphid", name: "Sylphid", category: "element", address: ITEMS_BASE_ADDRESS + 0xab, valueKind: "boolean", decode: decodePresent },
  { id: "element-lumina", name: "Lumina", category: "element", address: ITEMS_BASE_ADDRESS + 0xac, valueKind: "boolean", decode: decodePresent },
  { id: "element-shade", name: "Shade", category: "element", address: ITEMS_BASE_ADDRESS + 0xad, valueKind: "boolean", decode: decodePresent },
  { id: "element-luna", name: "Luna", category: "element", address: ITEMS_BASE_ADDRESS + 0xae, valueKind: "boolean", decode: decodePresent },
  { id: "element-dryad", name: "Dryad", category: "element", address: ITEMS_BASE_ADDRESS + 0xaf, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-orbs-gloves", name: "Glove Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x00, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-sword", name: "Sword Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x01, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-axe", name: "Axe Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x02, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-spear", name: "Spear Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x03, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-whip", name: "Whip Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x04, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-bow", name: "Bow Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x05, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-boomerang", name: "Boomerang Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x06, valueKind: "stage", decode: decodeStage },
  { id: "weapon-orbs-javelin", name: "Javelin Orbs", category: "weapon-orbs", address: WEAPON_ORB_BASE_ADDRESS + 0x07, valueKind: "stage", decode: decodeStage },
  { id: "weapon-gloves", name: "Gloves", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x00, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-sword", name: "Sword", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x01, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-axe", name: "Axe", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x02, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-spear", name: "Spear", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x03, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-whip", name: "Whip", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x04, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-bow", name: "Bow", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x05, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-boomerang", name: "Boomerang", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x06, valueKind: "boolean", decode: decodePresent },
  { id: "weapon-javelin", name: "Javelin", category: "weapon", address: WEAPON_OWNERSHIP_BASE_ADDRESS + 0x07, valueKind: "boolean", decode: decodePresent },
] as const satisfies readonly InventoryDefinition[];

export type InventoryId = (typeof INVENTORY_DEFINITIONS)[number]["id"];

export const INVENTORY_BY_ID = new Map<InventoryId, (typeof INVENTORY_DEFINITIONS)[number]>(
  INVENTORY_DEFINITIONS.map((definition) => [definition.id, definition]),
);
