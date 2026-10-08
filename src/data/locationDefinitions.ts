import type { LocationDefinition } from "../domain/tracker";

// Explicit stable IDs. PopTracker paths remain migration/debug metadata only.
export const LOCATION_DEFINITIONS = [
  { id: "elinees-castle-chest-688", name: "Elinee's Castle Chest 1", legacyPath: "@Elinee's Castle/Elinee's Castle Reward (Chests) - Spikey Tiger", completionMode: "any", events: [{ eventNumber: 0x688 }] },
  { id: "elinees-castle-chest-689", name: "Elinee's Castle Chest 2", legacyPath: "@Elinee's Castle/Elinee's Castle Reward (Chests) - Spikey Tiger", completionMode: "any", events: [{ eventNumber: 0x689 }] },
  { id: "dwarf-elder", name: "Dwarf Elder", legacyPath: "@Gaia's Navel/Dwarf Elder", completionMode: "any", events: [{ eventNumber: 0x366 }] },
  { id: "dwarf-village-boss-tropicallo", name: "Dwarf Village Boss - Tropicallo", legacyPath: "@Gaia's Navel/Dwarf Village Boss - Tropicallo", completionMode: "any", events: [{ eventNumber: 0x1b9 }] },
  { id: "earth-palace-mana-seed-fire-gigas", name: "Earth Palace Mana Seed - Fire Gigas", legacyPath: "@Gaia's Navel/Earth Palace Mana Seed - Fire Gigas", completionMode: "any", events: [{ eventNumber: 0x22e }] },
  { id: "gaias-navel-cave-chest", name: "Gaia's Navel Cave Chest", legacyPath: "@Gaia's Navel/Gaia's Navel Cave Chest", completionMode: "any", events: [{ eventNumber: 0x687 }] },
  { id: "underground-ship-boss-kilroy", name: "Underground Ship Boss - Kilroy", legacyPath: "@Gaia's Navel/Underground Ship Boss - Kilroy", completionMode: "any", events: [{ eventNumber: 0x36a }] },
  { id: "underground-ship-chest", name: "Underground Ship Chest", legacyPath: "@Gaia's Navel/Underground Ship Chest", completionMode: "any", events: [{ eventNumber: 0x68c }] },
  { id: "watts", name: "Watts", legacyPath: "@Gaia's Navel/Watts", completionMode: "any", events: [{ eventNumber: 0x1b0 }] },
  { id: "ice-castle-boss-1-biting-lizard-x3", name: "Ice Castle Boss 1 - Biting Lizard (x3)", legacyPath: "@Ice Country/Ice Castle/Ice Castle Boss 1 - Biting Lizard (x3)", completionMode: "any", events: [{ eventNumber: 0x66a }] },
  { id: "ice-castle-boss-2-frost-gigas", name: "Ice Castle Boss 2 - Frost Gigas", legacyPath: "@Ice Country/Ice Castle/Ice Castle Boss 2 - Frost Gigas", completionMode: "any", events: [{ eventNumber: 0x66d }] },
  { id: "ice-castle-chest", name: "Ice Castle Chest", legacyPath: "@Ice Country/Ice Castle/Ice Castle Chest", completionMode: "any", events: [{ eventNumber: 0x671 }] },
  { id: "santas-house-chest", name: "Santas House Chest", legacyPath: "@Ice Country/Santas House/Santas House Chest", completionMode: "any", events: [{ eventNumber: 0x67d }] },
  { id: "salamando", name: "Tropical Town After Boss - Stove", legacyPath: "@Ice Country/Tropical Town/Tropical Town Boss - Boreal Face/Salamando", completionMode: "any", events: [{ eventNumber: 0x38c }] },
  { id: "fire-palace-after-little-maze", name: "Fire Palace After Little Maze", legacyPath: "@Kakkara Desert/Fire Palace/Fire Palace After Little Maze", completionMode: "any", events: [{ eventNumber: 0x678 }] },
  { id: "fire-palace-near-entrance-chest", name: "Fire Palace Near Entrance Chest", legacyPath: "@Kakkara Desert/Fire Palace/Fire Palace Near Entrance Chest", completionMode: "any", events: [{ eventNumber: 0x68a }] },
  { id: "fire-palace-near-orb-2", name: "Fire Palace Near Orb 2", legacyPath: "@Kakkara Desert/Fire Palace/Fire Palace Near Orb 2", completionMode: "any", events: [{ eventNumber: 0x68b }] },
  { id: "fire-palace-reward-minotaur", name: "Fire Palace Reward - Minotaur", legacyPath: "@Kakkara Desert/Fire Palace/Fire Palace Reward - Minotaur", completionMode: "any", events: [{ eventNumber: 0x589 }] },
  { id: "kakkara-npc", name: "Kakkara NPC - Sea Hare Tail Trade", legacyPath: "@Kakkara Desert/Kakkara/Kakkara NPC", completionMode: "any", events: [{ eventNumber: 0x2b2, completedValue: 2 }] },
  { id: "moon-palace-seed", name: "Moon Palace Seed", legacyPath: "@Kakkara Desert/Moon Palace/Moon Palace Seed", completionMode: "any", events: [{ eventNumber: 0x584 }] },
  { id: "lighthouse-npc", name: "Lighthouse NPC", legacyPath: "@Lighthouse/Lighthouse NPC", completionMode: "any", events: [{ eventNumber: 0x0aa }] },
  { id: "doppelgangers", name: "Doppelgangers", legacyPath: "@Lofty Mountains/Joch's Cave/Doppelgangers", completionMode: "any", events: [{ eventNumber: 0x4e5 }] },
  { id: "palace-of-darkness-chest-behind-bars", name: "Palace of Darkness Chest behind bars", legacyPath: "@Lofty Mountains/Palace of Darkness/Palace of Darkness Chest behind bars", completionMode: "any", events: [{ eventNumber: 0x672 }] },
  { id: "palace-of-darkness-reward-lime-slime", name: "Palace of Darkness Reward - Lime Slime", legacyPath: "@Lofty Mountains/Palace of Darkness/Palace of Darkness Reward - Lime Slime", completionMode: "any", events: [{ eventNumber: 0x586 }] },
  { id: "palace-of-darkness-walkway-chest", name: "Palace of Darkness Walkway Chest", legacyPath: "@Lofty Mountains/Palace of Darkness/Palace of Darkness Walkway Chest", completionMode: "any", events: [{ eventNumber: 0x68e }] },
  { id: "grand-palace-boss-mech-rider-iii", name: "Grand Palace Boss - Mech Rider III", legacyPath: "@Lost Continent/Tree Palace/Grand Palace Boss - Mech Rider III", completionMode: "any", events: [{ eventNumber: 0x4a4 }] },
  { id: "grand-palace-chest", name: "Grand Palace Chest", legacyPath: "@Lost Continent/Tree Palace/Grand Palace Chest", completionMode: "any", events: [{ eventNumber: 0x675 }] },
  { id: "tree-palace-boss-2-after-seed-hexas", name: "Tree Palace Boss 2 (after seed) - Hexas", legacyPath: "@Lost Continent/Tree Palace/Tree Palace Boss 2 (after seed) - Hexas", completionMode: "any", events: [{ eventNumber: 0x4a2 }] },
  { id: "tree-palace-boss-3-aegagropilon", name: "Tree Palace Boss 3 - Aegagropilon", legacyPath: "@Lost Continent/Tree Palace/Tree Palace Boss 3 - Aegagropilon", completionMode: "any", events: [{ eventNumber: 0x4b4 }] },
  { id: "tree-palace-reward-mana-seed-snap-dragon", name: "Tree Palace Reward (Mana Seed) - Snap Dragon", legacyPath: "@Lost Continent/Tree Palace/Tree Palace Reward (Mana Seed) - Snap Dragon", completionMode: "any", events: [{ eventNumber: 0x4b6 }] },
  { id: "undergound-city-boss-kettle-kin", name: "Undergound City Boss - Kettle Kin", legacyPath: "@Lost Continent/Undersea Palace/Undergound City Boss - Kettle Kin", completionMode: "any", events: [{ eventNumber: 0x4ca }] },
  { id: "undersea-palace-boss-hydra", name: "Undersea Palace Boss - Hydra", legacyPath: "@Lost Continent/Undersea Palace/Undersea Palace Boss - Hydra", completionMode: "any", events: [{ eventNumber: 0x59b }] },
  { id: "undersea-palace-chest", name: "Undersea Palace Chest", legacyPath: "@Lost Continent/Undersea Palace/Undersea Palace Chest", completionMode: "any", events: [{ eventNumber: 0x691 }] },
  { id: "mana-fortress-boss-1-buffy", name: "Mana Fortress Boss 1 - Buffy", legacyPath: "@Mana Fortress/Mana Fortress Boss 1 - Buffy", completionMode: "any", events: [{ eventNumber: 0x422 }] },
  { id: "mana-fortress-boss-2-dread-slime", name: "Mana Fortress Boss 2 - Dread Slime", legacyPath: "@Mana Fortress/Mana Fortress Boss 2 - Dread Slime", completionMode: "any", events: [{ eventNumber: 0x425 }] },
  { id: "pandora-castle-chest-673", name: "Pandora Castle Chest 1", legacyPath: "@Pandora/Pandora Castle Chests", completionMode: "any", events: [{ eventNumber: 0x673 }] },
  { id: "pandora-castle-chest-67c", name: "Pandora Castle Chest 2", legacyPath: "@Pandora/Pandora Castle Chests", completionMode: "any", events: [{ eventNumber: 0x67c }] },
  { id: "pandora-castle-chest-683", name: "Pandora Castle Chest 3", legacyPath: "@Pandora/Pandora Castle Chests", completionMode: "any", events: [{ eventNumber: 0x683 }] },
  { id: "pandora-castle-chest-684", name: "Pandora Castle Chest 4", legacyPath: "@Pandora/Pandora Castle Chests", completionMode: "any", events: [{ eventNumber: 0x684 }] },
  { id: "pandora-castle-chest-685", name: "Pandora Castle Chest 5", legacyPath: "@Pandora/Pandora Castle Chests", completionMode: "any", events: [{ eventNumber: 0x685 }] },
  { id: "pandora-castle-chest-686", name: "Pandora Castle Chest 6", legacyPath: "@Pandora/Pandora Castle Chests", completionMode: "any", events: [{ eventNumber: 0x686 }] },
  { id: "pandora-castle-girl", name: "Pandora Castle Girl", legacyPath: "@Pandora/Pandora Castle Girl", completionMode: "any", events: [{ eventNumber: 0x188 }] },
  { id: "pandora-ruins-boss-wall-face", name: "Pandora Ruins Boss - Wall Face", legacyPath: "@Pandora/Pandora Ruins Boss - Wall Face", completionMode: "any", events: [{ eventNumber: 0x16e }] },
  { id: "mantis-ant", name: "Mantis Ant", legacyPath: "@Potos/Potos Boss - Mantis Ant", completionMode: "any", events: [{ eventNumber: 0x112 }] },
  { id: "potos-chest", name: "Potos Chest", legacyPath: "@Potos/Potos Chest", completionMode: "any", events: [{ eventNumber: 0x680 }] },
  { id: "sword-pedestal", name: "Sword Pedestal", legacyPath: "@Potos/Sword Pedestal", completionMode: "any", events: [{ eventNumber: 0x532 }] },
  { id: "pure-land-boss-1-dragon-worm", name: "Pure Land Boss 1 - Dragon Worm", legacyPath: "@Pure Land/Pure Land Boss 1 - Dragon Worm", completionMode: "any", events: [{ eventNumber: 0x5ed }] },
  { id: "pure-land-boss-2-snow-dragon", name: "Pure Land Boss 2 - Snow Dragon", legacyPath: "@Pure Land/Pure Land Boss 2 - Snow Dragon", completionMode: "any", events: [{ eventNumber: 0x5ef }] },
  { id: "pure-land-boss-3-axe-beak", name: "Pure Land Boss 3 - Axe Beak", legacyPath: "@Pure Land/Pure Land Boss 3 - Axe Beak", completionMode: "any", events: [{ eventNumber: 0x5f1 }] },
  { id: "pure-land-boss-4-red-dragon", name: "Pure Land Boss 4 - Red Dragon", legacyPath: "@Pure Land/Pure Land Boss 4 - Red Dragon", completionMode: "any", events: [{ eventNumber: 0x5f3 }] },
  { id: "pure-land-boss-5-thunder-gigas", name: "Pure Land Boss 5 - Thunder Gigas", legacyPath: "@Pure Land/Pure Land Boss 5 - Thunder Gigas", completionMode: "any", events: [{ eventNumber: 0x5f5 }] },
  { id: "pure-land-boss-6-blue-dragon", name: "Pure Land Boss 6 - Blue Dragon", legacyPath: "@Pure Land/Pure Land Boss 6 - Blue Dragon", completionMode: "any", events: [{ eventNumber: 0x5f7 }] },
  { id: "pure-land-mana-tree", name: "Pure Land Mana Tree", legacyPath: "@Pure Land/Pure Land Mana Tree", completionMode: "any", events: [{ eventNumber: 0x5f8 }] },
  { id: "tasnica-miniboss", name: "Tasnica Miniboss", legacyPath: "@Tasnica/Tasnica Miniboss", completionMode: "any", events: [{ eventNumber: 0x2d1 }] },
  { id: "turtle-island-npc", name: "Turtle Island NPC", legacyPath: "@Turtle Island/Turtle Island NPC", completionMode: "any", events: [{ eventNumber: 0x2f9 }] },
  { id: "flammie-great-viper", name: "Flammie - Great Viper", legacyPath: "@Upper Land/Matango/Flammie - Great Viper", completionMode: "any", events: [{ eventNumber: 0x4e4 }] },
  { id: "matango-palace-chest", name: "Matango Palace Chest", legacyPath: "@Upper Land/Matango/Matango Palace Chest", completionMode: "any", events: [{ eventNumber: 0x692 }] },
  { id: "moogle-village-chest-670", name: "Moogle Village Chest 1", legacyPath: "@Upper Land/Moogle Village/Moogle Village Double Chest", completionMode: "any", events: [{ eventNumber: 0x670 }] },
  { id: "moogle-village-chest-676", name: "Moogle Village Chest 2", legacyPath: "@Upper Land/Moogle Village/Moogle Village Double Chest", completionMode: "any", events: [{ eventNumber: 0x676 }] },
  { id: "wind-palace-reward-spring-beak", name: "Wind Palace Reward - Spring Beak", legacyPath: "@Upper Land/Sprite Village/Wind Palace Reward - Spring Beak", completionMode: "any", events: [{ eventNumber: 0x4e2 }] },
  { id: "gold-tower-chest-1", name: "Gold Tower Chest 1", legacyPath: "@Vandole Empire/Gold City/Gold Tower/Gold Tower Chest 1", completionMode: "any", events: [{ eventNumber: 0x67b }] },
  { id: "gold-tower-chest-2-blue-spike", name: "Gold Tower Chest 2 - Blue Spike", legacyPath: "@Vandole Empire/Gold City/Gold Tower/Gold Tower Chest 2 - Blue Spike", completionMode: "any", events: [{ eventNumber: 0x677 }] },
  { id: "gold-tower-reward-gorgon-bull", name: "Gold Tower After Boss - Lumina", legacyPath: "@Vandole Empire/Gold City/Gold Tower/Gold Tower Reward - Gorgon Bull", completionMode: "any", events: [{ eventNumber: 0x587 }] },
  { id: "castle-chest", name: "Castle Chest", legacyPath: "@Vandole Empire/North Town/North Town Castle/Castle Chest", completionMode: "any", events: [{ eventNumber: 0x68d }] },
  { id: "north-town-castle-paired-chest-679", name: "North Town Castle Paired Chest 1", legacyPath: "@Vandole Empire/North Town/North Town Castle/Castle Double Chest", completionMode: "any", events: [{ eventNumber: 0x679 }] },
  { id: "north-town-castle-paired-chest-68f", name: "North Town Castle Paired Chest 2", legacyPath: "@Vandole Empire/North Town/North Town Castle/Castle Double Chest", completionMode: "any", events: [{ eventNumber: 0x68f }] },
  { id: "inside-boss-metal-mantis", name: "Inside Boss - Metal Mantis", legacyPath: "@Vandole Empire/North Town/North Town Castle/Inside Boss - Metal Mantis", completionMode: "any", events: [{ eventNumber: 0x527 }] },
  { id: "outside-boss-mech-rider-ii", name: "Outside Boss - Mech Rider II", legacyPath: "@Vandole Empire/North Town/North Town Castle/Outside Boss - Mech Rider II", completionMode: "any", events: [{ eventNumber: 0x52f }] },
  { id: "north-town-ruins-boss-1-dooms-wall", name: "North Town Ruins Boss 1 - Doom's Wall", legacyPath: "@Vandole Empire/North Town/North Town Ruins/North Town Ruins Boss 1 - Doom's Wall", completionMode: "any", events: [{ eventNumber: 0x553 }] },
  { id: "north-town-ruins-boss-2-vampire", name: "North Town Ruins Boss 2 - Vampire", legacyPath: "@Vandole Empire/North Town/North Town Ruins/North Town Ruins Boss 2 - Vampire", completionMode: "any", events: [{ eventNumber: 0x559 }] },
  { id: "north-town-ruins-inner-chest", name: "North Town Ruins Inner Chest", legacyPath: "@Vandole Empire/North Town/North Town Ruins/North Town Ruins Inner Chest", completionMode: "any", events: [{ eventNumber: 0x674 }] },
  { id: "north-town-ruins-left-chest", name: "North Town Ruins Left Chest", legacyPath: "@Vandole Empire/North Town/North Town Ruins/North Town Ruins Left Chest", completionMode: "any", events: [{ eventNumber: 0x67a }] },
  { id: "north-town-ruins-right-chest", name: "North Town Ruins Right Chest", legacyPath: "@Vandole Empire/North Town/North Town Ruins/North Town Ruins Right Chest", completionMode: "any", events: [{ eventNumber: 0x690 }] },
  { id: "south-town-mara", name: "South Town Mara", legacyPath: "@Vandole Empire/South Town/South Town Mara", completionMode: "any", events: [{ eventNumber: 0x399 }] },
  { id: "undine-biting-lizard", name: "Undine - Biting Lizard", legacyPath: "@Water Palace/Undine - Biting Lizard", completionMode: "any", events: [{ eventNumber: 0x581 }] },
  { id: "water-palace-mana-seed-jabberwocky", name: "Water Palace Mana Seed - Jabberwocky", legacyPath: "@Water Palace/Water Palace Mana Seed - Jabberwocky", completionMode: "any", events: [{ eventNumber: 0x132 }] },
  { id: "sandship-captain", name: "Sandship - Captain", legacyPath: "@Sandship/Captain", feature: "sandship", completionMode: "any", events: [{ eventNumber: 0x2a3, requirePersistentFlag: true }] },
] as const satisfies readonly LocationDefinition[];

export type LocationId = (typeof LOCATION_DEFINITIONS)[number]["id"];
export type PopTrackerLocationId = Exclude<LocationId, "sandship-captain">;

export function activeLocationDefinitions(supportsSandship: boolean | null = false) {
  return LOCATION_DEFINITIONS.filter((definition) => !("feature" in definition) || supportsSandship === true);
}

// Old permanent aggregate marks meant the whole group was complete. Preserve
// that intent for every independent chest; new chest marks remain independent.
export const LEGACY_CHECK_SPLITS = {
  "elinees-castle-reward-chests-spikey-tiger": ["elinees-castle-chest-688", "elinees-castle-chest-689"],
  "pandora-castle-chests": ["pandora-castle-chest-673", "pandora-castle-chest-67c", "pandora-castle-chest-683", "pandora-castle-chest-684", "pandora-castle-chest-685", "pandora-castle-chest-686"],
  "moogle-village-double-chest": ["moogle-village-chest-670", "moogle-village-chest-676"],
  "castle-double-chest": ["north-town-castle-paired-chest-679", "north-town-castle-paired-chest-68f"],
} as const satisfies Record<string, readonly LocationId[]>;

export const LOCATION_BY_ID = new Map<LocationId, (typeof LOCATION_DEFINITIONS)[number]>(
  LOCATION_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const LOCATION_EVENT_BINDING_COUNT = LOCATION_DEFINITIONS.reduce(
  (count, definition) => count + definition.events.length,
  0,
);
