import { ORB_SOURCE_DEFINITIONS } from "../data/sourceWorldData";
import { connectionId, validConnection, type CannonConnection, type CannonTravelMode, type StartingLocation } from "../domain/cannons";
import { ELEMENTS, WEAPON_FAMILIES, requirementAllowed,
  type CrystalOrbMode, type OrbId, type OrbRequirement } from "../domain/orbs";

export type Character = "boy" | "girl" | "sprite";
export type Role = Character | "unknown";
export const CHARACTERS = ["boy", "girl", "sprite"] as const;
export const ROLE_LABELS: Record<Role, string> = {
  unknown: "Unknown", boy: "Boy / Warrior", girl: "Girl / Light Mage", sprite: "Sprite / Dark Mage",
};
export interface WorldSettings {
  logic: "basic" | "restrictive";
  drumLogic: "normal" | "random";
  roleMode: "normal" | "random";
  // Per-slot Randomizer options can override the existing global PopTracker mode on import.
  roleModeBySlot: Partial<Record<Character, "normal" | "random">>;
  fixedRoles: Partial<Record<Character, Character>>;
  goal: "short" | "long" | "revive";
  reviveSeedCount: number;
  orbMode: CrystalOrbMode;
  cannonMode: CannonTravelMode;
  startingLocation: StartingLocation;
}
export interface WorldState {
  version: 2;
  settings: WorldSettings;
  roles: Record<Character, Role>;
  disabledCharacters: Character[];
  orbs: Record<OrbId, OrbRequirement>;
  manualClearedOrbs: OrbId[];
  cannonConnections: CannonConnection[];
}

const KEY = "som-web-tracker:world-state:v2";
const LEGACY_KEY = "som-web-tracker:world-state:v1";
export function emptyWorldState(): WorldState {
  return {
    version: 2,
    settings: { logic: "basic", drumLogic: "normal", roleMode: "normal", roleModeBySlot: {}, fixedRoles: {}, goal: "short", reviveSeedCount: 8, orbMode: "magic-only", cannonMode: "vanilla", startingLocation: "default" },
    roles: { boy: "unknown", girl: "unknown", sprite: "unknown" },
    disabledCharacters: [],
    orbs: Object.fromEntries(ORB_SOURCE_DEFINITIONS.map((orb) => [orb.id, { kind: "unknown" }])) as Record<OrbId, OrbRequirement>,
    manualClearedOrbs: [], cannonConnections: [],
  };
}

export function isRoleRandomized(state: WorldState, character: Character): boolean {
  return (state.settings.roleModeBySlot[character] ?? state.settings.roleMode) === "random";
}
export function effectiveRole(state: WorldState, character: Character): Role {
  return isRoleRandomized(state, character) ? state.roles[character] : state.settings.fixedRoles[character] ?? character;
}
export function setOrbCleared(state: WorldState, id: OrbId, cleared: boolean): WorldState {
  const marks = new Set(state.manualClearedOrbs);
  if (cleared) marks.add(id); else marks.delete(id);
  return { ...state, manualClearedOrbs: [...marks] };
}
export function addCannonConnection(state: WorldState, edge: CannonConnection): WorldState {
  if (!validConnection(edge) || state.cannonConnections.some((other) => connectionId(other) === connectionId(edge))) return state;
  return { ...state, cannonConnections: [...state.cannonConnections, { ...edge }] };
}
export function removeCannonConnection(state: WorldState, id: string): WorldState {
  return { ...state, cannonConnections: state.cannonConnections.filter((edge) => connectionId(edge) !== id) };
}
export function replaceCannonConnection(state: WorldState, id: string, edge: CannonConnection): WorldState {
  if (!validConnection(edge)) return state;
  return addCannonConnection(removeCannonConnection(state, id), edge);
}
export function clearCannonConnections(state: WorldState): WorldState { return { ...state, cannonConnections: [] }; }

export function setRoleIdentity(state: WorldState, character: Character, role: Role): WorldState {
  return { ...state, roles: { ...state.roles, [character]: role } };
}

export function setOrbMode(state: WorldState, mode: CrystalOrbMode): WorldState {
  return { ...state, settings: { ...state.settings, orbMode: mode }, orbs: Object.fromEntries(
    Object.entries(state.orbs).map(([id, requirement]) => [id, requirementAllowed(mode, requirement) ? requirement : { kind: "unknown" }]),
  ) as WorldState["orbs"] };
}

export function setOrbRequirement(state: WorldState, id: OrbId, requirement: OrbRequirement): WorldState {
  if (!requirementAllowed(state.settings.orbMode, requirement)) return state;
  return { ...state, orbs: { ...state.orbs, [id]: requirement } };
}

function validRequirement(value: unknown, mode: CrystalOrbMode): value is OrbRequirement {
  if (!value || typeof value !== "object") return false;
  const requirement = value as Partial<OrbRequirement>;
  if (requirement.kind === "unknown") return true;
  if (requirement.kind === "element") return ELEMENTS.includes(requirement.element as typeof ELEMENTS[number]) && requirementAllowed(mode, requirement as OrbRequirement);
  if (requirement.kind === "weapon-family") return WEAPON_FAMILIES.includes(requirement.weapon as typeof WEAPON_FAMILIES[number]) && requirementAllowed(mode, requirement as OrbRequirement);
  return false;
}

export function loadWorldState(storage: Storage): WorldState {
  const fallback = emptyWorldState();
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? storage.getItem(LEGACY_KEY) ?? "null") as (Partial<Omit<WorldState, "version">> & { version?: number }) | null;
    if ((parsed?.version !== 1 && parsed?.version !== 2) || !parsed.settings) return fallback;
    const s = parsed.settings;
    const settings: WorldSettings = {
      logic: s.logic === "restrictive" ? "restrictive" : "basic",
      drumLogic: s.drumLogic === "random" ? "random" : "normal",
      roleMode: s.roleMode === "random" ? "random" : "normal",
      roleModeBySlot: {},
      fixedRoles: {},
      goal: s.goal === "long" || s.goal === "revive" ? s.goal : "short",
      reviveSeedCount: Number.isInteger(s.reviveSeedCount) && s.reviveSeedCount! >= 1 && s.reviveSeedCount! <= 8 ? s.reviveSeedCount! : 8,
      orbMode: s.orbMode === "mixed" || s.orbMode === "weapon-only" ? s.orbMode : "magic-only",
      cannonMode: s.cannonMode === "open" || s.cannonMode === "shuffle" || s.cannonMode === "chaos" ? s.cannonMode : "vanilla",
      startingLocation: s.startingLocation === "kakkara" ? "kakkara" : "default",
    };
    for (const character of CHARACTERS) {
      const mode = s.roleModeBySlot?.[character];
      if (mode === "normal" || mode === "random") settings.roleModeBySlot[character] = mode;
      const fixed = s.fixedRoles?.[character];
      if (CHARACTERS.includes(fixed as Character)) settings.fixedRoles[character] = fixed;
    }
    const roles = { ...fallback.roles };
    for (const character of ["boy", "girl", "sprite"] as const) {
      const value = parsed.roles?.[character];
      if (value === "boy" || value === "girl" || value === "sprite" || value === "unknown") roles[character] = value;
    }
    const disabledCharacters = Array.isArray(parsed.disabledCharacters) ? parsed.disabledCharacters.filter(
      (value): value is Character => value === "boy" || value === "girl" || value === "sprite",
    ) : [];
    const orbs = { ...fallback.orbs };
    for (const orb of ORB_SOURCE_DEFINITIONS) {
      const value = parsed.orbs?.[orb.id];
      if (validRequirement(value, settings.orbMode)) orbs[orb.id] = value;
    }
    const manualClearedOrbs = Array.isArray(parsed.manualClearedOrbs) ? [...new Set(parsed.manualClearedOrbs.filter(
      (id): id is OrbId => ORB_SOURCE_DEFINITIONS.some((orb) => orb.id === id)))] : [];
    let state: WorldState = { version: 2, settings, roles, disabledCharacters, orbs, manualClearedOrbs, cannonConnections: [] };
    if (Array.isArray(parsed.cannonConnections)) for (const edge of parsed.cannonConnections) if (validConnection(edge)) state = addCannonConnection(state, edge);
    return state;
  } catch { return fallback; }
}

export function saveWorldState(storage: Storage, state: WorldState): void {
  storage.setItem(KEY, JSON.stringify(state));
}
