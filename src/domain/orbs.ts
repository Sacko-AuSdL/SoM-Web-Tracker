import { ORB_SOURCE_DEFINITIONS } from "../data/sourceWorldData";

export const ELEMENTS = ["gnome", "undine", "sylphid", "salamando", "shade", "lumina", "luna", "dryad"] as const;
export const WEAPON_FAMILIES = ["gloves", "sword", "axe", "spear", "whip", "bow", "boomerang", "javelin"] as const;
export type Element = typeof ELEMENTS[number];
export type WeaponFamily = typeof WEAPON_FAMILIES[number];
export type CrystalOrbMode = "magic-only" | "mixed" | "weapon-only";
export type OrbRequirement = { kind: "unknown" } | { kind: "element"; element: Element } | { kind: "weapon-family"; weapon: WeaponFamily };
export type OrbId = typeof ORB_SOURCE_DEFINITIONS[number]["id"];

export function requirementAllowed(mode: CrystalOrbMode, requirement: OrbRequirement): boolean {
  return requirement.kind === "unknown" || mode === "mixed" ||
    (mode === "magic-only" && requirement.kind === "element") ||
    (mode === "weapon-only" && requirement.kind === "weapon-family");
}

export function requirementLabel(requirement: OrbRequirement): string {
  if (requirement.kind === "unknown") return "?";
  const value = requirement.kind === "element" ? requirement.element : requirement.weapon;
  return value === "gloves" ? "Glove" : value.charAt(0).toUpperCase() + value.slice(1);
}

export function requirementShortLabel(requirement: OrbRequirement): string {
  if (requirement.kind === "unknown") return "?";
  const value = requirement.kind === "element" ? requirement.element : requirement.weapon;
  const labels: Record<Element | WeaponFamily, string> = {
    gnome: "Gno", undine: "Und", sylphid: "Syl", salamando: "Sal", shade: "Sha",
    lumina: "Lum", luna: "Lun", dryad: "Dry", gloves: "Glv", sword: "Swd",
    axe: "Axe", spear: "Spr", whip: "Whp", bow: "Bow", boomerang: "Bmr", javelin: "Jav",
  };
  return labels[value];
}
