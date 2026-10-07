import { MAP_AREAS } from "../data/mapAreas";
import type { LocationId } from "../data/locationDefinitions";

export type CannonTravelMode = "vanilla" | "open" | "shuffle" | "chaos";
export type StartingLocation = "default" | "kakkara";
export type RegionId = "potos" | "upperLand" | "matango" | "kakkara" | "iceCountry" | "empire" | "flammieOnly";
export type CannonNodeId = "upperLand" | "southtown" | "iceCountry" | "kakkara" | "matango" | "potos" | "gaiasNavel";
export type CannonDestinationId = CannonNodeId | "waterPalace" | "pandora";
export interface CannonConnection { from: CannonNodeId; to: CannonDestinationId }
export interface CannonPoint { id: CannonDestinationId; name: string; region: RegionId; x: number; y: number; screenOffset?: { x: number; y: number } }

// CannonTravelModel.cs OFFICES: original world coordinates scaled to the
// 4096px world illustration. Display anchors are approximate, not room maps.
export const CANNON_OFFICES = [
  { id: "upperLand", name: "Upper Land", region: "upperLand", x: 0x9F * 16, y: 0xAA * 16 },
  { id: "southtown", name: "Southtown", region: "empire", x: 0xE4 * 16, y: 0x65 * 16 },
  { id: "iceCountry", name: "Ice Country", region: "iceCountry", x: 0xB1 * 16, y: 0x26 * 16 },
  { id: "kakkara", name: "Kakkara", region: "kakkara", x: 0x2B * 16, y: 0x5D * 16 },
  { id: "matango", name: "Matango", region: "matango", x: 0x7A * 16, y: 0x8B * 16 },
  { id: "potos", name: "Potos", region: "potos", x: 0x9B * 16, y: 0xBF * 16 },
  { id: "gaiasNavel", name: "Gaia's Navel", region: "potos", x: 0x7F * 16, y: 0xC2 * 16 },
] as const satisfies readonly (CannonPoint & { id: CannonNodeId })[];
// An office button is also its home landing-region target. Water Palace and
// Pandora have no office, but are valid landing targets in the source model.
export const CANNON_TARGETS: readonly CannonPoint[] = [...CANNON_OFFICES,
  { id: "waterPalace", name: "Water Palace", region: "potos", x: 2125, y: 2925 },
  { id: "pandora", name: "Pandora", region: "potos", x: 2425, y: 3475 },
];
export const CANNON_OFFICE_BY_ID = new Map<CannonNodeId, typeof CANNON_OFFICES[number]>(CANNON_OFFICES.map((n) => [n.id, n]));
export const CANNON_TARGET_BY_ID = new Map(CANNON_TARGETS.map((n) => [n.id, n]));
// CannonTravelModel.getVanillaRegionNetwork(), 14 directed routes.
const VANILLA_DESTINATIONS: Record<CannonNodeId, readonly CannonDestinationId[]> = {
  upperLand: ["potos", "gaiasNavel"], southtown: ["kakkara"], iceCountry: ["matango", "kakkara"],
  kakkara: ["matango", "iceCountry", "southtown"], matango: ["kakkara", "iceCountry"],
  potos: ["waterPalace", "upperLand"], gaiasNavel: ["waterPalace", "pandora"],
};
export const VANILLA_CANNON_CONNECTIONS: readonly CannonConnection[] = CANNON_OFFICES.flatMap((office) =>
  VANILLA_DESTINATIONS[office.id].map((to) => ({ from: office.id, to })));
// resolveAndStore(Open): every destination except the source's own home.
export const OPEN_CANNON_CONNECTIONS: readonly CannonConnection[] = CANNON_OFFICES.flatMap((office) =>
  CANNON_TARGETS.filter((to) => to.id !== office.id).map((to) => ({ from: office.id, to: to.id })));
export function cannonNetwork(mode: CannonTravelMode, manual: readonly CannonConnection[]): readonly CannonConnection[] {
  return mode === "vanilla" ? VANILLA_CANNON_CONNECTIONS : mode === "open" ? OPEN_CANNON_CONNECTIONS : manual;
}
export function connectionId(edge: CannonConnection): string { return `${edge.from}:${edge.to}`; }
export function validConnection(value: unknown): value is CannonConnection {
  if (!value || typeof value !== "object") return false;
  const edge = value as CannonConnection;
  return CANNON_OFFICE_BY_ID.has(edge.from) && CANNON_TARGET_BY_ID.has(edge.to) && edge.from !== edge.to;
}

// CannonTravelRegions.cs ownership; all other source regions are Flammie-only.
function areaRegion(id: string): RegionId {
  if (["potos", "pandora", "water-palace", "undine-cave", "gaia-s-navel", "elinee-s-castle"].includes(id)) return "potos";
  if (id === "upper-land-matango") return "matango";
  if (id.startsWith("upper-land-")) return "upperLand";
  if (["kakkara-desert-kakkara", "kakkara-desert-fire-palace"].includes(id)) return "kakkara";
  if (id.startsWith("ice-country-")) return "iceCountry";
  if (id.startsWith("vandole-empire-south-town") || id.startsWith("vandole-empire-north-town")) return "empire";
  return "flammieOnly";
}
export const CHECK_REGION = new Map<LocationId, RegionId>(MAP_AREAS.flatMap((area) =>
  area.checkIds.map((id) => [id, areaRegion(area.id)] as const)));
