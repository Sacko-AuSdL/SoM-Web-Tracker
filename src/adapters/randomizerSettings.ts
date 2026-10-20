import { CHARACTERS, emptyWorldState, setOrbMode, type Character, type WorldSettings, type WorldState } from "../state/worldState";
import { allowedRevivalCounts, MANA_SEED_MIN, MANA_SEED_MAX } from "../domain/revival";

export interface SettingsDiagnostic { level: "warning" | "error"; message: string }
export interface ParsedRandomizerSettings { settings: WorldSettings | null; diagnostics: SettingsDiagnostic[]; sourceVersion: string | null }
// UiOptionsManager.getOptionsString/setOptions: whitespace-delimited key=value,
// omitted properties reset to source defaults. OpenWorldSettings.cs 1.49.
export function parseRandomizerSettings(raw: string): ParsedRandomizerSettings {
  const diagnostics: SettingsDiagnostic[] = [];
  const settings = emptyWorldState().settings;
  const entries = new Map<string, string>();
  const error = (message: string) => diagnostics.push({ level: "error", message });
  const warning = (message: string) => diagnostics.push({ level: "warning", message });
  if (!raw.trim()) error("Enter a Randomizer settings string.");
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const match = /^([^=\s]+)=([^\s]*)$/.exec(token);
    if (!match) { error(`Malformed option: ${token}`); continue; }
    if (entries.has(match[1])) warning(`Duplicate ${match[1]}: last value wins (Randomizer behavior).`);
    entries.set(match[1], match[2]);
  }
  const sourceVersion = entries.get("version") ?? null;
  if (sourceVersion && sourceVersion !== "1.49") warning(`Source version ${sourceVersion}; mappings verified against local Randomizer 1.49.`);
  const enumValue = <T extends string>(key: string, values: Record<string, T>, apply: (value: T) => void) => {
    const rawValue = entries.get(key);
    if (rawValue === undefined) return;
    if (!Object.hasOwn(values, rawValue)) error(`Unrecognized ${key}=${rawValue}; no settings applied.`);
    else apply(values[rawValue]);
  };
  enumValue("mode", { open: "open" }, () => {});
  enumValue("crystalOrbWeaponBreaking", { off: "magic-only", on: "mixed", weaponOnly: "weapon-only" }, (v) => { settings.orbMode = v; });
  enumValue("cannonTravelRandomization", { off: "vanilla", open: "open", shuffle: "shuffle", chaos: "chaos" }, (v) => { settings.cannonMode = v; });
  // StringValueSettings.getBool accepts case-insensitive true strings.
  if (entries.has("opFlammieDrumInLogic")) entries.set("opFlammieDrumInLogic", entries.get("opFlammieDrumInLogic")!.toLowerCase());
  enumValue("opFlammieDrumInLogic", { yes: "random", true: "random", "1": "random", no: "normal", false: "normal", "0": "normal" }, (v) => { settings.drumLogic = v; });
  enumValue("opStartingLocation", { default: "default", kakkara: "kakkara" }, (v) => { settings.startingLocation = v; });
  enumValue("opStartChar", { boy: "boy", girl: "girl", sprite: "sprite", random: "unresolved" }, (v) => { settings.startingCharacter = v; });
  enumValue("opCharacters", { findbothL1: "find-both-level-1", findbothCL: "find-both-current", startboth: "start-both",
    start1only: "start-one-only", start1find1: "start-one-find-one", find1L1: "find-one-level-1", find1CL: "find-one-current", none: "solo" },
    (v) => { settings.partyMode = v; });
  enumValue("opLogic", { basic: "basic", restrictive: "restrictive" }, (v) => { settings.logic = v; });
  enumValue("opGoal", { vshort: "short", vlong: "long", mtr: "revive" }, (v) => { settings.goal = v; });
  enumValue("spellShuffle", { off: "off", perCharacter: "perCharacter", party: "party" }, (v) => { settings.spellShuffle = v; });
  const seedOptions = Object.fromEntries(Array.from({ length: MANA_SEED_MAX - MANA_SEED_MIN + 1 }, (_, i) => [String(i + MANA_SEED_MIN), String(i + MANA_SEED_MIN)]));
  enumValue("opNumSeeds", { ...seedOptions, random: "random" },
    (v) => { settings.reviveSeedCount = v === "random" ? null : Number(v); });
  let seedMin = MANA_SEED_MIN, seedMax = MANA_SEED_MAX;
  enumValue("opMinSeeds", seedOptions, (v) => { seedMin = Number(v); });
  enumValue("opMaxSeeds", seedOptions, (v) => { seedMax = Number(v); });
  // Some live/export strings contain only the bounds. Honor that explicit
  // range rather than silently displaying the omitted source default (8).
  // An explicit opNumSeeds fixed value always remains authoritative.
  if (!entries.has("opNumSeeds") && (entries.has("opMinSeeds") || entries.has("opMaxSeeds"))) {
    settings.reviveSeedCount = null;
    warning("MTR bounds supplied without opNumSeeds; using the explicit range, not assuming an exact rolled count.");
  }
  if (settings.reviveSeedCount === null) {
    // OpenWorldMtrSeedNumSelection.cs clamps min to max, not a sorted range.
    if (seedMin > seedMax) { seedMin = seedMax; warning("Revival minimum exceeds maximum; source clamps minimum to maximum."); }
    settings.reviveSeedRange = { min: seedMin, max: seedMax };
    if (seedMin !== seedMax) warning("Random Revival seed count is seed-specific; resolve it directly at the Inventory Mana Seeds counter.");
  }
  for (const character of CHARACTERS) {
    const key = `op${character[0].toUpperCase()}${character.slice(1)}Role`;
    const value = entries.get(key) ?? `OG${character}`;
    if (value === "random" || value === "randomunique") settings.roleModeBySlot[character] = "random";
    else if (["OGboy", "OGgirl", "OGsprite"].includes(value)) {
      settings.roleModeBySlot[character] = "normal";
      settings.fixedRoles[character] = value.slice(2) as Character;
    } else error(`Unrecognized ${key}=${value}; no settings applied.`);
  }
  const recognized = new Set(["version", "mode", "crystalOrbWeaponBreaking", "cannonTravelRandomization", "opFlammieDrumInLogic",
    "opStartingLocation", "opStartChar", "opCharacters", "spoilerLog", "opStartGold", "opLogic", "opGoal", "opNumSeeds", "opMinSeeds", "opMaxSeeds", "opBoyRole", "opGirlRole", "opSpriteRole", "spellShuffle"]);
  for (const key of entries.keys()) if (!recognized.has(key)) warning(`${key} is not imported; use manual controls for any tracker-relevant effect.`);
  if (settings.startingLocation === "kakkara" && settings.drumLogic !== "random")
    warning("Kakkara is selected but inactive: the source requires Flammie Drum in logic. Effective start is Default.");
  return { settings: diagnostics.some((d) => d.level === "error") ? null : settings, diagnostics, sourceVersion };
}

// Global settings do not invent or overwrite seed-specific Cannon routes or
// rolled role identities. Existing Orb mode compatibility rules still apply.
export function applyRandomizerSettings(state: WorldState, parsed: ParsedRandomizerSettings): WorldState {
  if (!parsed.settings) return state;
  const modeAdjusted = setOrbMode(state, parsed.settings.orbMode);
  const settings = { ...parsed.settings };
  if (settings.startingCharacter === state.settings.startingCharacter) settings.resolvedStartingCharacter = state.settings.resolvedStartingCharacter;
  if (settings.startingCharacter === state.settings.startingCharacter && settings.partyMode === state.settings.partyMode)
    settings.additionalCharacter = state.settings.additionalCharacter;
  const sameRevivalDefinition = state.settings.goal === settings.goal && state.settings.reviveSeedCount === settings.reviveSeedCount &&
    state.settings.reviveSeedRange?.min === settings.reviveSeedRange?.min && state.settings.reviveSeedRange?.max === settings.reviveSeedRange?.max;
  const manualReviveSeedCount = sameRevivalDefinition && state.manualReviveSeedCount !== null && allowedRevivalCounts(settings).includes(state.manualReviveSeedCount) ? state.manualReviveSeedCount : null;
  return { ...modeAdjusted, settings, manualReviveSeedCount };
}
