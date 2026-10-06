import type { Character, WorldState } from "../state/worldState";
import type { RamState } from "../state/trackerState";

// OpenWorldSettings.cs / OpenWorldCharacterSelection.cs, Randomizer 1.49.
// Selection among the two remaining slots is a seed roll, not a role roll.
export const PARTY_MODES = {
  "find-both-level-1": "Find both · Level 1",
  "find-both-current": "Find both · Current Level",
  "start-both": "Start with both",
  "start-one-only": "Start with one · other absent",
  "start-one-find-one": "Start with one · find the other",
  "find-one-level-1": "Find one · Level 1 · other absent",
  "find-one-current": "Find one · Current Level · other absent",
  "solo": "Only starting character",
} as const;
export type PartyMode = keyof typeof PARTY_MODES;
export type CharacterAvailability = {
  exists: "yes" | "no" | "unresolved";
  disposition: "starting" | "findable" | "absent" | "unresolved";
  joinLevel: "level-1" | "current" | null;
};
export function resolvedStart(world: WorldState): Character | null {
  return world.settings.startingCharacter === "unresolved" ? world.settings.resolvedStartingCharacter : world.settings.startingCharacter;
}
export function needsAdditionalIdentity(mode: PartyMode): boolean {
  return ["start-one-only", "start-one-find-one", "find-one-level-1", "find-one-current"].includes(mode);
}
export function characterAvailability(world: WorldState, slot: Character): CharacterAvailability {
  const start = resolvedStart(world), mode = world.settings.partyMode;
  const absent: CharacterAvailability = { exists: "no", disposition: "absent", joinLevel: null };
  const starting: CharacterAvailability = { exists: "yes", disposition: "starting", joinLevel: null };
  const findable: CharacterAvailability = { exists: "yes", disposition: "findable", joinLevel:
    mode === "find-one-current" || mode === "find-both-current" ? "current" : "level-1" };
  if (world.disabledCharacters.includes(slot)) return absent;
  if (mode === "start-both" || start === slot) return starting;
  if (!start) return { exists: mode === "find-both-level-1" || mode === "find-both-current" || mode === "start-one-find-one" ? "yes" : "unresolved", disposition: "unresolved", joinLevel: null };
  if (mode === "solo") return absent;
  if (!needsAdditionalIdentity(mode)) return findable;
  const chosen = world.settings.additionalCharacter;
  if (!chosen || chosen === start) return { exists: mode === "start-one-find-one" ? "yes" : "unresolved", disposition: "unresolved", joinLevel: null };
  if (chosen === slot) return mode.startsWith("start-") ? starting : findable;
  return mode === "start-one-find-one" ? findable : absent;
}
export function characterPresent(world: WorldState, ram: RamState, manual: ReadonlySet<string>, slot: Character): boolean {
  const live = ram.inventory[slot];
  // A valid live presence byte is authoritative, including rollback to false.
  if (live !== null) return live === true;
  const availability = characterAvailability(world, slot);
  return availability.exists !== "no" && (manual.has(slot) || availability.disposition === "starting");
}
export function availabilityLabel(value: CharacterAvailability): string {
  if (value.disposition === "starting") return "Configured starting party";
  if (value.disposition === "absent") return "Does not exist in configured seed";
  if (value.disposition === "findable") return `Findable · joins at ${value.joinLevel === "current" ? "Current Level" : "Level 1"}`;
  return "Seed-specific availability unresolved · identify in Settings";
}
