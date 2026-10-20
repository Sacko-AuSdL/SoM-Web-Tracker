import { ORB_SOURCE_DEFINITIONS } from "../data/sourceWorldData";
import { SANDSHIP } from "../data/sandship";
import { CANNON_OFFICE_BY_ID, connectionId, validConnection, type CannonNodeId, type CannonConnection, type CannonTravelMode, type StartingLocation } from "../domain/cannons";
import { PARTY_MODES, type PartyMode } from "../domain/characters";
import { ELEMENTS, WEAPON_FAMILIES, GP_REQUIREMENT_IDS, requirementAllowed,
  type CrystalOrbMode, type GpHintState, type GpRequirementId, type OrbId, type OrbRequirement } from "../domain/orbs";
import { allowedRevivalCounts, validSeedCount, validSeedRange, type RevivalSeedRange } from "../domain/revival";

export type Character = "boy" | "girl" | "sprite";
export type Role = Character | "unknown";
export const CHARACTERS = ["boy", "girl", "sprite"] as const;
export const ROLE_LABELS: Record<Role, string> = {
  unknown: "Unknown", boy: "Boy", girl: "Girl", sprite: "Sprite",
};
export interface WorldSettings {
  logic: "basic" | "restrictive";
  drumLogic: "normal" | "random";
  roleMode: "normal" | "random";
  // Per-slot Randomizer options can override the existing global PopTracker mode on import.
  roleModeBySlot: Partial<Record<Character, "normal" | "random">>;
  fixedRoles: Partial<Record<Character, Character>>;
  goal: "short" | "long" | "revive";
  reviveSeedCount: number | null;
  reviveSeedRange: RevivalSeedRange | null;
  orbMode: CrystalOrbMode;
  cannonMode: CannonTravelMode;
  startingLocation: StartingLocation;
  startingCharacter: Character | "unresolved";
  resolvedStartingCharacter: Character | null;
  partyMode: PartyMode;
  additionalCharacter: Character | null;
}
export interface WorldState {
  version: 3;
  settings: WorldSettings;
  roles: Record<Character, Role>;
  disabledCharacters: Character[];
  orbs: Record<OrbId, OrbRequirement>;
  manualClearedOrbs: OrbId[];
  manualReadHints: string[];
  // Explicit seed hint knowledge; missing entries are UNKNOWN, not required.
  gpHints: Partial<Record<GpRequirementId, Exclude<GpHintState, "unknown">>>;
  manualReviveSeedCount: number | null;
  cannonConnections: CannonConnection[];
  closedCannonOffices: CannonNodeId[];
}

const KEY = "som-web-tracker:world-state:v3";
const V2_KEY = "som-web-tracker:world-state:v2";
const LEGACY_KEY = "som-web-tracker:world-state:v1";
export function emptyWorldState(): WorldState {
  return {
    version: 3,
    settings: { logic: "basic", drumLogic: "normal", roleMode: "normal", roleModeBySlot: {}, fixedRoles: {}, goal: "short", reviveSeedCount: 8, reviveSeedRange: null, orbMode: "magic-only", cannonMode: "vanilla", startingLocation: "default", startingCharacter: "boy", resolvedStartingCharacter: null, partyMode: "find-both-level-1", additionalCharacter: null },
    roles: { boy: "unknown", girl: "unknown", sprite: "unknown" },
    disabledCharacters: [],
    orbs: Object.fromEntries(ORB_SOURCE_DEFINITIONS.map((orb) => [orb.id, { kind: "unknown" }])) as Record<OrbId, OrbRequirement>,
    manualClearedOrbs: [], manualReadHints: [], gpHints: {}, manualReviveSeedCount: null, cannonConnections: [], closedCannonOffices: [],
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
export function gpHintState(state: WorldState, id: GpRequirementId): GpHintState {
  return state.gpHints[id] ?? "unknown";
}
export function setGpHint(state: WorldState, id: GpRequirementId, hint: GpHintState): WorldState {
  const gpHints = { ...state.gpHints };
  if (hint === "unknown") delete gpHints[id]; else gpHints[id] = hint;
  return { ...state, gpHints };
}
export function cycleGpHint(state: WorldState, id: GpRequirementId): WorldState {
  const hint = gpHintState(state, id);
  return setGpHint(state, id, hint === "unknown" ? "required" : hint === "required" ? "not-required" : "unknown");
}
export function setReviveSeedResolution(state: WorldState, count: number | null): WorldState {
  if (count !== null && !allowedRevivalCounts(state.settings).includes(count)) return state;
  return { ...state, manualReviveSeedCount: count };
}
export function setHintRead(state: WorldState, id: string, read: boolean): WorldState {
  if (id !== SANDSHIP.hintId) return state;
  const marks = new Set(state.manualReadHints);
  if (read) marks.add(id); else marks.delete(id);
  return { ...state, manualReadHints: [...marks] };
}
export function addCannonConnection(state: WorldState, edge: CannonConnection): WorldState {
  if (!validConnection(edge)) return state;
  if (state.cannonConnections.some((other) => connectionId(other) === connectionId(edge)))
    return state.closedCannonOffices.includes(edge.from) ? setCannonOfficeClosed(state, edge.from, false) : state;
  return { ...state, cannonConnections: [...state.cannonConnections, { ...edge }],
    closedCannonOffices: state.closedCannonOffices.filter((id) => id !== edge.from) };
}
export type ChaosCannonOfficeState = "unknown" | "open" | "closed";
export function chaosOfficeState(state: WorldState, id: CannonNodeId): ChaosCannonOfficeState {
  return state.closedCannonOffices.includes(id) ? "closed" : state.cannonConnections.some((edge) => edge.from === id) ? "open" : "unknown";
}
export function setCannonOfficeClosed(state: WorldState, id: CannonNodeId, closed: boolean): WorldState {
  if (!CANNON_OFFICE_BY_ID.has(id)) return state;
  return { ...state, closedCannonOffices: closed ? [...new Set([...state.closedCannonOffices, id])] : state.closedCannonOffices.filter((other) => other !== id) };
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
    const parsed = JSON.parse(storage.getItem(KEY) ?? storage.getItem(V2_KEY) ?? storage.getItem(LEGACY_KEY) ?? "null") as (Partial<Omit<WorldState, "version">> & { version?: number; gpNotNeeded?: unknown }) | null;
    if (![1, 2, 3].includes(parsed?.version ?? 0) || !parsed?.settings) return fallback;
    const s = parsed.settings;
    const settings: WorldSettings = {
      logic: s.logic === "restrictive" ? "restrictive" : "basic",
      drumLogic: s.drumLogic === "random" ? "random" : "normal",
      roleMode: s.roleMode === "random" ? "random" : "normal",
      roleModeBySlot: {},
      fixedRoles: {},
      goal: s.goal === "long" || s.goal === "revive" ? s.goal : "short",
      reviveSeedCount: s.reviveSeedCount === null ? null : validSeedCount(s.reviveSeedCount) ? s.reviveSeedCount : 8,
      reviveSeedRange: validSeedRange(s.reviveSeedRange) ? { min: s.reviveSeedRange.min, max: s.reviveSeedRange.max } : null,
      orbMode: s.orbMode === "mixed" || s.orbMode === "weapon-only" ? s.orbMode : "magic-only",
      cannonMode: s.cannonMode === "open" || s.cannonMode === "shuffle" || s.cannonMode === "chaos" ? s.cannonMode : "vanilla",
      startingLocation: s.startingLocation === "kakkara" ? "kakkara" : "default",
      startingCharacter: CHARACTERS.includes(s.startingCharacter as Character) || s.startingCharacter === "unresolved" ? s.startingCharacter : "boy",
      resolvedStartingCharacter: CHARACTERS.includes(s.resolvedStartingCharacter as Character) ? s.resolvedStartingCharacter : null,
      partyMode: Object.hasOwn(PARTY_MODES, s.partyMode ?? "") ? s.partyMode : "find-both-level-1",
      additionalCharacter: CHARACTERS.includes(s.additionalCharacter as Character) ? s.additionalCharacter : null,
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
    const manualReadHints = Array.isArray(parsed.manualReadHints) && parsed.manualReadHints.includes(SANDSHIP.hintId) ? [SANDSHIP.hintId] : [];
    const gpHints: WorldState["gpHints"] = {};
    if (Object.hasOwn(parsed, "gpHints")) {
      for (const id of GP_REQUIREMENT_IDS) {
        const hint: unknown = parsed.gpHints?.[id];
        // Legacy booleans carry no proof of an actual hint; never promote them.
        if (hint === "required" || hint === "not-required") gpHints[id] = hint;
      }
    } else if (Array.isArray(parsed.gpNotNeeded)) {
      // Old explicit exclusion entries are evidence; absence/default isn't.
      for (const id of GP_REQUIREMENT_IDS) if (parsed.gpNotNeeded.includes(id)) gpHints[id] = "not-required";
    }
    const manualReviveSeedCount = validSeedCount(parsed.manualReviveSeedCount) && allowedRevivalCounts(settings).includes(parsed.manualReviveSeedCount) ? parsed.manualReviveSeedCount : null;
    let state: WorldState = { version: 3, settings, roles, disabledCharacters, orbs, manualClearedOrbs, manualReadHints, gpHints, manualReviveSeedCount, cannonConnections: [], closedCannonOffices: [] };
    if (Array.isArray(parsed.cannonConnections)) for (const edge of parsed.cannonConnections) if (validConnection(edge)) state = addCannonConnection(state, edge);
    if (Array.isArray(parsed.closedCannonOffices)) state.closedCannonOffices = [...new Set(parsed.closedCannonOffices.filter((id) => CANNON_OFFICE_BY_ID.has(id)))];
    return state;
  } catch { return fallback; }
}

export function saveWorldState(storage: Storage, state: WorldState): void {
  storage.setItem(KEY, JSON.stringify(state));
}
