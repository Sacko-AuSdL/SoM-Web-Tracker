import type { WorldSettings, WorldState } from "../state/worldState";

// OpenWorldSettings.cs and OpenWorldMtrSeedNumSelection.cs: inclusive 1..8.
export const MANA_SEED_MIN = 1, MANA_SEED_MAX = 8;
export interface RevivalSeedRange { min: number; max: number }
export function validSeedCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MANA_SEED_MIN && value <= MANA_SEED_MAX;
}
export function validSeedRange(value: unknown): value is RevivalSeedRange {
  if (!value || typeof value !== "object") return false;
  const range = value as Partial<RevivalSeedRange>;
  return validSeedCount(range.min) && validSeedCount(range.max) && range.min <= range.max;
}
export function allowedRevivalCounts(settings: WorldSettings): number[] {
  const range = settings.reviveSeedRange ?? { min: MANA_SEED_MIN, max: MANA_SEED_MAX };
  return Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index);
}
export function revivalRequiredCount(world: WorldState): number | null {
  const range = world.settings.reviveSeedRange;
  return world.manualReviveSeedCount ?? world.settings.reviveSeedCount ?? (range && range.min === range.max ? range.min : null);
}
