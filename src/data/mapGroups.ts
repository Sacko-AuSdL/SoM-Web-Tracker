import type { LocationId } from "./locationDefinitions";

// Generated from SoM-Open_Mode-Tracker/maps/maps.json and locations/locations.json.
// Run `npm run generate:map` after updating the authoritative package.
export const MAP_IMAGE_SIZE = {"width":4096,"height":4096} as const;

export interface MapGroup {
  id: string;
  name: string;
  path: string;
  x: number;
  y: number;
  checkIds: readonly LocationId[];
}

export const MAP_GROUPS = [
  {"id":"potos","name":"Potos","path":"Potos","x":2425,"y":3045,"checkIds":["sword-pedestal","potos-chest","mantis-ant"]},
  {"id":"pandora","name":"Pandora","path":"Pandora","x":2425,"y":3475,"checkIds":["pandora-castle-girl","pandora-ruins-boss-wall-face","pandora-castle-chests"]},
  {"id":"water-palace","name":"Water Palace","path":"Water Palace","x":2125,"y":2925,"checkIds":["water-palace-mana-seed-jabberwocky","undine-biting-lizard"]},
  {"id":"gaia-s-navel","name":"Gaia's Navel","path":"Gaia's Navel","x":2180,"y":3235,"checkIds":["gaias-navel-cave-chest","watts","dwarf-elder","dwarf-village-boss-tropicallo","underground-ship-chest","underground-ship-boss-kilroy","earth-palace-mana-seed-fire-gigas"]},
  {"id":"elinee-s-castle","name":"Elinee's Castle","path":"Elinee's Castle","x":2010,"y":2955,"checkIds":["elinees-castle-reward-chests-spikey-tiger"]},
  {"id":"upper-land-moogle-village","name":"Moogle Village","path":"Upper Land/Moogle Village","x":2280,"y":2550,"checkIds":["moogle-village-double-chest"]},
  {"id":"upper-land-sprite-village","name":"Sprite Village","path":"Upper Land/Sprite Village","x":1930,"y":2695,"checkIds":["wind-palace-reward-spring-beak"]},
  {"id":"upper-land-matango","name":"Matango","path":"Upper Land/Matango","x":1685,"y":2165,"checkIds":["matango-palace-chest","flammie-great-viper"]},
  {"id":"kakkara-desert-kakkara","name":"Kakkara","path":"Kakkara Desert/Kakkara","x":660,"y":1484,"checkIds":["kakkara-npc"]},
  {"id":"kakkara-desert-fire-palace","name":"Fire Palace","path":"Kakkara Desert/Fire Palace","x":415,"y":1690,"checkIds":["fire-palace-near-entrance-chest","fire-palace-near-orb-2","fire-palace-after-little-maze","fire-palace-reward-minotaur"]},
  {"id":"kakkara-desert-moon-palace","name":"Moon Palace","path":"Kakkara Desert/Moon Palace","x":925,"y":1435,"checkIds":["moon-palace-seed"]},
  {"id":"vandole-empire-south-town","name":"South Town","path":"Vandole Empire/South Town","x":3530,"y":1660,"checkIds":["south-town-mara"]},
  {"id":"vandole-empire-north-town-north-town-castle","name":"North Town Castle","path":"Vandole Empire/North Town/North Town Castle","x":3195,"y":1075,"checkIds":["castle-double-chest","inside-boss-metal-mantis","castle-chest","outside-boss-mech-rider-ii"]},
  {"id":"vandole-empire-north-town-north-town-ruins","name":"North Town Ruins","path":"Vandole Empire/North Town/North Town Ruins","x":3420,"y":1075,"checkIds":["north-town-ruins-left-chest","north-town-ruins-right-chest","north-town-ruins-inner-chest","north-town-ruins-boss-1-dooms-wall","north-town-ruins-boss-2-vampire"]},
  {"id":"vandole-empire-gold-city-gold-tower","name":"Gold Tower","path":"Vandole Empire/Gold City/Gold Tower","x":2200,"y":1400,"checkIds":["gold-tower-chest-1","gold-tower-chest-2-blue-spike","gold-tower-reward-gorgon-bull"]},
  {"id":"ice-country-santas-house","name":"Santas House","path":"Ice Country/Santas House","x":2625,"y":625,"checkIds":["santas-house-chest"]},
  {"id":"ice-country-tropical-town-tropical-town-boss-boreal-face","name":"Tropical Town Boss - Boreal Face","path":"Ice Country/Tropical Town/Tropical Town Boss - Boreal Face","x":2280,"y":420,"checkIds":["salamando"]},
  {"id":"ice-country-ice-castle","name":"Ice Castle","path":"Ice Country/Ice Castle","x":2395,"y":220,"checkIds":["ice-castle-chest","ice-castle-boss-1-biting-lizard-x3","ice-castle-boss-2-frost-gigas"]},
  {"id":"lighthouse","name":"Lighthouse","path":"Lighthouse","x":2459,"y":3987,"checkIds":["lighthouse-npc"]},
  {"id":"tasnica","name":"Tasnica","path":"Tasnica","x":388,"y":3203,"checkIds":["tasnica-miniboss"]},
  {"id":"turtle-island","name":"Turtle Island","path":"Turtle Island","x":412,"y":2459,"checkIds":["turtle-island-npc"]},
  {"id":"lofty-mountains-palace-of-darkness","name":"Palace of Darkness","path":"Lofty Mountains/Palace of Darkness","x":1260,"y":2915,"checkIds":["palace-of-darkness-walkway-chest","palace-of-darkness-chest-behind-bars","palace-of-darkness-reward-lime-slime"]},
  {"id":"lofty-mountains-joch-s-cave","name":"Joch's Cave","path":"Lofty Mountains/Joch's Cave","x":1360,"y":2915,"checkIds":["doppelgangers"]},
  {"id":"lost-continent-tree-palace","name":"Tree Palace","path":"Lost Continent/Tree Palace","x":3500,"y":3450,"checkIds":["tree-palace-reward-mana-seed-snap-dragon","tree-palace-boss-2-after-seed-hexas","tree-palace-boss-3-aegagropilon","grand-palace-chest","grand-palace-boss-mech-rider-iii"]},
  {"id":"lost-continent-undersea-palace","name":"Undersea Palace","path":"Lost Continent/Undersea Palace","x":3400,"y":3575,"checkIds":["undersea-palace-chest","undersea-palace-boss-hydra","undergound-city-boss-kettle-kin"]},
  {"id":"pure-land","name":"Pure Land","path":"Pure Land","x":660,"y":410,"checkIds":["pure-land-boss-1-dragon-worm","pure-land-boss-2-snow-dragon","pure-land-boss-3-axe-beak","pure-land-boss-4-red-dragon","pure-land-boss-5-thunder-gigas","pure-land-boss-6-blue-dragon","pure-land-mana-tree"]},
  {"id":"mana-fortress","name":"Mana Fortress","path":"Mana Fortress","x":3850,"y":250,"checkIds":["mana-fortress-boss-1-buffy","mana-fortress-boss-2-dread-slime"]},
] as const satisfies readonly MapGroup[];

export type MapGroupId = (typeof MAP_GROUPS)[number]["id"];

export const MAP_GROUP_BY_ID = new Map<MapGroupId, (typeof MAP_GROUPS)[number]>(
  MAP_GROUPS.map((group) => [group.id, group]),
);
