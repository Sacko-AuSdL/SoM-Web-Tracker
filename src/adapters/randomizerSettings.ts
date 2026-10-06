import { CHARACTERS, emptyWorldState, setOrbMode, type Character, type WorldSettings, type WorldState } from "../state/worldState";

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
  enumValue("opLogic", { basic: "basic", restrictive: "restrictive" }, (v) => { settings.logic = v; });
  enumValue("opGoal", { vshort: "short", vlong: "long", mtr: "revive" }, (v) => { settings.goal = v; });
  enumValue("opNumSeeds", Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [String(n), String(n)])),
    (v) => { settings.reviveSeedCount = Number(v); });
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
    "opStartingLocation", "opLogic", "opGoal", "opNumSeeds", "opBoyRole", "opGirlRole", "opSpriteRole"]);
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
  return { ...modeAdjusted, settings: parsed.settings };
}
