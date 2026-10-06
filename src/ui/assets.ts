import type { InventoryId } from "../data/inventoryDefinitions";
import type { Role } from "../state/worldState";
import type { OrbRequirement } from "../domain/orbs";

// Vite copies only these referenced PNGs from the authoritative PopTracker package.
const imageUrls = import.meta.glob<string>(
  "../../../SoM-Open_Mode-Tracker/images/{overworld_map,boy,girl,sprite,boy_overlay,girl_overlay,sprite_overlay,overlay_unknown,gnome,undine,salamando,sylphid,lumina,shade,luna,dryad,gloves,sword,axe,spear,whip,bow,boomerang,javelin,sea_hare_tail,gold_tower_key,midge_mallet,moogle_belt,flammie_drum,water_seed,earth_seed,wind_seed,fire_seed,light_seed,dark_seed,moon_seed,tree_seed,orb}.png",
  { eager: true, query: "?url", import: "default" },
);

function image(name: string): string {
  const entry = Object.entries(imageUrls).find(([path]) => path.endsWith(`/${name}.png`));
  if (!entry) throw new Error(`Missing PopTracker image: ${name}`);
  return entry[1];
}

export const overworldImage = image("overworld_map");
export const orbImage = image("orb");
export function characterRoleOverlay(role: Role): string {
  return image(role === "unknown" ? "overlay_unknown" : `${role}_overlay`);
}

const inventoryImages: Partial<Record<InventoryId, string>> = {
  boy: "boy", girl: "girl", sprite: "sprite",
  "element-gnome": "gnome", "element-undine": "undine", "element-salamando": "salamando",
  "element-sylphid": "sylphid", "element-lumina": "lumina", "element-shade": "shade",
  "element-luna": "luna", "element-dryad": "dryad",
  "weapon-gloves": "gloves", "weapon-sword": "sword", "weapon-axe": "axe", "weapon-spear": "spear",
  "weapon-whip": "whip", "weapon-bow": "bow", "weapon-boomerang": "boomerang", "weapon-javelin": "javelin",
  "sea-hare-tail": "sea_hare_tail", "gold-tower-key": "gold_tower_key",
  "midge-mallet": "midge_mallet", "moogle-belt": "moogle_belt", "flammie-drum": "flammie_drum",
  "seed-water": "water_seed", "seed-earth": "earth_seed", "seed-wind": "wind_seed", "seed-fire": "fire_seed",
  "seed-light": "light_seed", "seed-dark": "dark_seed", "seed-moon": "moon_seed", "seed-tree": "tree_seed",
  "weapon-orbs-gloves": "orb", "weapon-orbs-sword": "orb", "weapon-orbs-axe": "orb", "weapon-orbs-spear": "orb",
  "weapon-orbs-whip": "orb", "weapon-orbs-bow": "orb", "weapon-orbs-boomerang": "orb", "weapon-orbs-javelin": "orb",
};

export function inventoryImage(id: InventoryId): string | null {
  const name = inventoryImages[id];
  return name ? image(name) : null;
}
export function orbRequirementImage(requirement: OrbRequirement): string | null {
  return requirement.kind === "unknown" ? null : inventoryImage(requirement.kind === "element" ?
    `element-${requirement.element}` : `weapon-${requirement.weapon}`);
}
