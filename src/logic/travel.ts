import { cannonNetwork, CANNON_OFFICE_BY_ID, CANNON_TARGET_BY_ID, type RegionId } from "../domain/cannons";
import type { WorldSettings, WorldState } from "../state/worldState";

export type TravelAccess = "unreachable" | "unknown" | "reachable";
export function effectiveStartingLocation(settings: WorldSettings): "default" | "kakkara" {
  return settings.startingLocation === "kakkara" && settings.drumLogic === "random" ? "kakkara" : "default";
}
export function usesRegionTravel(settings: WorldSettings): boolean {
  return settings.cannonMode !== "vanilla" || effectiveStartingLocation(settings) === "kakkara";
}
export function initialRegions(settings: WorldSettings): readonly RegionId[] {
  return [effectiveStartingLocation(settings) === "kakkara" ? "kakkara" : "potos"];
}
export function reachableRegions(world: WorldState, hasFlammie: boolean, upperLandGate: TravelAccess): Record<RegionId, TravelAccess> {
  const regions: Record<RegionId, TravelAccess> = {
    potos: "unreachable", upperLand: "unreachable", matango: "unreachable", kakkara: "unreachable",
    iceCountry: "unreachable", empire: "unreachable", flammieOnly: "unreachable",
  };
  for (const start of initialRegions(world.settings)) regions[start] = "reachable";
  if (hasFlammie) { for (const region of Object.keys(regions) as RegionId[]) regions[region] = "reachable"; return regions; }
  const rank = { unreachable: 0, unknown: 1, reachable: 2 };
  const improve = (target: RegionId, access: TravelAccess): boolean => {
    if (rank[access] <= rank[regions[target]]) return false;
    regions[target] = access;
    return true;
  };
  const combine = (a: TravelAccess, b: TravelAccess): TravelAccess =>
    a === "unreachable" || b === "unreachable" ? "unreachable" : a === "unknown" || b === "unknown" ? "unknown" : "reachable";
  let changed: boolean;
  do {
    changed = false;
    // CannonTravelRegions.cs explicitly permits BOTH walking directions under
    // the same UF gate. Do not synthesize reverse Cannon edges.
    changed = improve("upperLand", combine(regions.matango, upperLandGate)) || changed;
    changed = improve("matango", combine(regions.upperLand, upperLandGate)) || changed;
    for (const edge of cannonNetwork(world.settings.cannonMode, world.cannonConnections)) {
      if (world.settings.cannonMode === "chaos" && world.closedCannonOffices.includes(edge.from)) continue;
      const source = CANNON_OFFICE_BY_ID.get(edge.from)!, target = CANNON_TARGET_BY_ID.get(edge.to)!;
      changed = improve(target.region, regions[source.region]) || changed;
    }
  } while (changed);
  return regions;
}
