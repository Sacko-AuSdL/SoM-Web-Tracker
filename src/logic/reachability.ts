import { CHECK_SOURCE_RULES, type SourceRule } from "../data/sourceWorldData";
import type { LocationId } from "../data/locationDefinitions";
import type { InventoryId } from "../data/inventoryDefinitions";
import type { MapArea } from "../data/mapAreas";
import { ELEMENTS, WEAPON_FAMILIES, requirementAllowed, requirementId, type Element, type OrbId, type OrbRequirement } from "../domain/orbs";
import { countManaSeeds } from "./inventory";
import { deriveEffectiveCheckState, type PersistentManualState, type RamState } from "../state/trackerState";
import { CHARACTERS, effectiveRole, isRoleRandomized, type Character, type WorldState } from "../state/worldState";
import { CHECK_REGION } from "../domain/cannons";
import { characterAvailability, characterPresent } from "../domain/characters";
import { reachableRegions, usesRegionTravel, type TravelAccess } from "./travel";

export type AccessLevel = "unreachable" | "checkable" | "unknown" | "reachable";
export type ReachabilityStatus = "unreachable" | "reachable" | "unknown" | "partial" | "completed";
export type OrbGateStatus = "unknown" | "blocked" | "passable";
type TruthValue = boolean | "unknown";
export interface CheckReachability { access: AccessLevel; visible: boolean; complete: boolean }
export interface AreaReachability { status: ReachabilityStatus; completed: number; total: number; reachable: number; unknown: number }

export interface LogicContext { ram: RamState; manualItems: ReadonlySet<InventoryId>; world: WorldState; travel?: ReturnType<typeof reachableRegions> }

export function createLogicContext(ram: RamState, manualItems: ReadonlySet<InventoryId>, world: WorldState): LogicContext {
  const context: LogicContext = { ram, manualItems, world };
  if (usesRegionTravel(world.settings)) {
    const gate = evaluateOrbTraversal(context, "uf_orb");
    context.travel = reachableRegions(world, world.settings.drumLogic === "normal" || item(context, "flammie-drum"),
      gate === "unknown" ? "unknown" : gate === "passable" ? "reachable" : "unreachable");
  }
  return context;
}

function item(context: LogicContext, id: InventoryId): boolean {
  return context.manualItems.has(id) || context.ram.inventory[id] === true;
}
function hasCharacter(context: LogicContext, character: Character): boolean {
  return characterPresent(context.world, context.ram, context.manualItems, character);
}
function hasRole(context: LogicContext, role: Character): boolean {
  return CHARACTERS.some((character) => hasCharacter(context, character) &&
    effectiveRole(context.world, character) === role);
}
function roleAvailable(context: LogicContext, role: Character): boolean {
  return CHARACTERS.some((character) =>
    (context.ram.inventory[character] === true || characterAvailability(context.world, character).exists !== "no") &&
    (!isRoleRandomized(context.world, character) ? effectiveRole(context.world, character) === role :
      context.world.roles[character] === "unknown" || context.world.roles[character] === role));
}
function roleDisabled(context: LogicContext, role: Character): boolean {
  return !hasRole(context, role) && !roleAvailable(context, role);
}
function hasElement(context: LogicContext, element: Element): boolean { return item(context, `element-${element}`); }
function all(values: readonly TruthValue[]): TruthValue {
  if (values.includes(false)) return false;
  return values.includes("unknown") ? "unknown" : true;
}
function any(values: readonly TruthValue[]): TruthValue {
  if (values.includes(true)) return true;
  return values.includes("unknown") ? "unknown" : false;
}

function evaluateRequirementGate(context: LogicContext, requirement: Exclude<OrbRequirement, { kind: "unknown" }>): OrbGateStatus {
  if ((context.world.settings.orbMode === "magic-only" && requirement.kind !== "element") ||
      (context.world.settings.orbMode === "weapon-only" && requirement.kind !== "weapon-family")) return "blocked";
  if (requirement.kind === "weapon-family") return item(context, `weapon-${requirement.weapon}`) ? "passable" : "blocked";
  // PopTracker bypasses magic orbs when neither magic role can exist.
  const magicBypassed = roleDisabled(context, "sprite") && roleDisabled(context, "girl");
  if (magicBypassed) return "passable";
  if (!hasElement(context, requirement.element)) return "blocked";
  if (requirement.element === "lumina") return hasRole(context, "girl") ? "passable" : "blocked";
  if (requirement.element === "sylphid" || requirement.element === "salamando")
    return hasRole(context, "sprite") || hasRole(context, "girl") ? "passable" : "blocked";
  return hasRole(context, "sprite") ? "passable" : "blocked";
}
export function evaluateOrbGate(context: LogicContext, id: OrbId): OrbGateStatus {
  const requirement = context.world.orbs[id];
  if (requirement.kind !== "unknown") return evaluateRequirementGate(context, requirement);
  if (!id.startsWith("gp_orb")) return "unknown";
  // PopTracker logic.lua hasAllElementsGP / orb.lua disabledStates: excluded
  // requirements narrow the unknown GP pool. Extend the same rule to weapons.
  // A known Orb identity stays authoritative, even if a GP badge conflicts.
  const pool: Exclude<OrbRequirement, { kind: "unknown" }>[] = [
    ...ELEMENTS.filter((element) => element === "lumina" ? !roleDisabled(context, "girl") :
      element === "sylphid" || element === "salamando" ? !(roleDisabled(context, "girl") && roleDisabled(context, "sprite")) :
      !roleDisabled(context, "sprite")).map((element) => ({ kind: "element" as const, element })),
    ...WEAPON_FAMILIES.map((weapon) => ({ kind: "weapon-family" as const, weapon })),
  ];
  const possible = pool.filter((candidate) => requirementAllowed(context.world.settings.orbMode, candidate) &&
    !context.world.gpNotNeeded.includes(requirementId(candidate)));
  return possible.every((candidate) => evaluateRequirementGate(context, candidate) === "passable") ? "passable" : "unknown";
}
export function orbCompletion(context: LogicContext, id: OrbId): "manual" | "ram" | "none" {
  if (context.world.manualClearedOrbs.includes(id)) return "manual";
  return context.ram.orbs[id] === true ? "ram" : "none";
}
export function evaluateOrbTraversal(context: LogicContext, id: OrbId): OrbGateStatus {
  return orbCompletion(context, id) !== "none" ? "passable" : evaluateOrbGate(context, id);
}

function checkFunction(name: string, context: LogicContext): TruthValue {
  const { world } = context;
  const matchOrb = /^canDestroy(ET|UF|MC|MP|FP|GP)Orb([1-7])?$/.exec(name);
  if (matchOrb) {
    const id = `${matchOrb[1].toLowerCase()}_orb${matchOrb[2] ?? ""}`;
    const gate = evaluateOrbTraversal(context, id as OrbId);
    return gate === "unknown" ? "unknown" : gate === "passable";
  }
  const accessSeed = /^has(Water|Earth|Wind|Fire|Dark|Light|Moon|Tree)PalaceAccess$/.exec(name);
  if (accessSeed) return world.settings.logic === "basic" || item(context, `seed-${accessSeed[1].toLowerCase()}` as InventoryId);
  const itemFunction: Record<string, InventoryId> = {
    hasKey: "gold-tower-key", hasTail: "sea-hare-tail", hasDrum: "flammie-drum", hasWhip: "weapon-whip", hasAxe: "weapon-axe",
  };
  if (name === "hasDrum" && context.travel && world.settings.drumLogic === "normal") return true;
  if (name in itemFunction) return item(context, itemFunction[name]);
  if (name === "canCutStuff") return item(context, "weapon-axe") || item(context, "weapon-sword");
  if (name === "always") return true;
  if (name === "isVanillaShort") return world.settings.goal === "short";
  if (name === "isVanillaLong") return world.settings.goal === "long";
  if (name === "isReviveTheTree") return world.settings.goal === "revive";
  if (name === "isBasicLogic") return world.settings.logic === "basic";
  if (name === "isRestrictedLogic") return world.settings.logic === "restrictive";
  if (name === "hasBoy") return hasCharacter(context, "boy");
  if (name === "hasGirl") return hasCharacter(context, "girl");
  if (name === "hasSprite") return hasCharacter(context, "sprite");
  if (name === "hasBoyRole") return hasRole(context, "boy");
  if (name === "hasGirlRole") return hasRole(context, "girl");
  if (name === "hasSpriteRole") return hasRole(context, "sprite");
  if (name === "canCrossUpperLandForest") return any([item(context, "flammie-drum"), checkFunction("canDestroyUFOrb", context)]);
  if (name === "grandPalaceBoss") return all([item(context, "weapon-whip"),
    ...([1, 2, 3, 4, 5, 6, 7] as const).map((number) => checkFunction(`canDestroyGPOrb${number}`, context))]);
  if (name === "manaTreeRevive") return world.settings.reviveSeedCount === null ? "unknown" :
    countManaSeeds(context.ram, context.manualItems) >= world.settings.reviveSeedCount;
  if (name === "hasManaFortressAccess") return all([world.settings.goal !== "revive", checkFunction("canCutStuff", context),
    item(context, "weapon-whip"), any([world.settings.goal === "short", checkFunction("grandPalaceBoss", context)])]);
  if (name === "hasManaTreeAccess") return all([checkFunction("canCutStuff", context),
    any([world.settings.goal !== "revive", checkFunction("manaTreeRevive", context)])]);
  throw new Error(`Unported PopTracker logic function: ${name}`);
}

export function evaluateCode(code: string, context: LogicContext): TruthValue {
  if (code === "drum_logic_random") return context.world.settings.drumLogic === "random";
  if (code === "drum_logic_normal") return context.world.settings.drumLogic === "normal";
  if (code === "basic") return context.world.settings.logic === "basic";
  if (code === "restricted") return context.world.settings.logic === "restrictive";
  if (code.startsWith("$")) return checkFunction(code.slice(1), context);
  throw new Error(`Unported PopTracker provider code: ${code}`);
}

// PopTracker alternatives are ORed inside each tier; inherited tiers are ANDed.
// Unknown is distinct from a known blocked gate and never counts as available.
function andAccess(values: readonly AccessLevel[]): AccessLevel {
  if (values.includes("unreachable")) return "unreachable";
  if (values.includes("unknown")) return "unknown";
  if (values.includes("checkable")) return "checkable";
  return "reachable";
}
function orAccess(values: readonly AccessLevel[]): AccessLevel {
  if (values.includes("reachable")) return "reachable";
  if (values.includes("unknown")) return "unknown";
  if (values.includes("checkable")) return "checkable";
  return "unreachable";
}
function evaluateAlternative(alternative: string, context: LogicContext): AccessLevel {
  if (alternative === "{}") return "checkable";
  if (alternative.startsWith("{") && alternative.endsWith("}")) {
    const inner = evaluateAlternative(alternative.slice(1, -1), context);
    return inner === "reachable" ? "checkable" : inner;
  }
  const terms: AccessLevel[] = [];
  for (const raw of alternative.split(",")) {
    const term = raw.trim();
    const optional = term.startsWith("[") && term.endsWith("]");
    const code = optional ? term.slice(1, -1).trim() : term;
    if (!code) continue;
    const value = evaluateCode(code, context);
    terms.push(value === "unknown" ? "unknown" : value ? "reachable" : optional ? "checkable" : "unreachable");
  }
  return andAccess(terms);
}

function evaluateTiers(tiers: SourceRule["accessTiers"], context: LogicContext): AccessLevel {
  return andAccess(tiers.map((alternatives) => orAccess(alternatives.map((alternative) => evaluateAlternative(alternative, context)))));
}

export function evaluateCheck(id: LocationId, context: LogicContext, manual: PersistentManualState): CheckReachability {
  if (id === "sandship-captain") {
    // The Kakkara route includes the normal boss challenge, with no extra item
    // dependency. Already defeating it is not a logical access requirement.
    // Only the Captain's independent prize flag/manual mark completes the check.
    return { visible: context.ram.sandship.supported === true,
      access: sandshipEntranceAccess(context),
      complete: deriveEffectiveCheckState(id, context.ram, manual).complete };
  }
  const rule = CHECK_SOURCE_RULES[id];
  // Source snapshots retain an optional FP1/checkable alternative. These four
  // checks actually lie behind FP1 (OpenWorldLocations.cs 114-120,152,155-156).
  // Remove only that fallback; preserve travel, Whip, and Basic/Restrictive seeds.
  const tiers = id.startsWith("fire-palace-") ? rule.accessTiers.map((tier) =>
    tier.filter((alternative) => !alternative.includes("[$canDestroyFPOrb1]"))) : rule.accessTiers;
  let access = evaluateTiers(tiers, context);
  if (context.travel) {
    // Replace ONLY the inherited continent access tier, not local Orb/weapon/
    // seed gates. Matches PrizeLocation.getLockedByPrizes(region model).
    const coarse = tiers[0]?.some((alternative) => alternative.includes("$hasDrum"));
    const local = coarse ? tiers.slice(1) : tiers;
    let localAccess = evaluateTiers(local, context);
    if (id === "matango-palace-chest" && context.world.settings.drumLogic === "random")
      localAccess = item(context, "weapon-axe") || item(context, "flammie-drum") ? "reachable" : "unreachable";
    if (id === "flammie-great-viper" && context.world.settings.drumLogic === "random")
      localAccess = andAccess([localAccess, item(context, "weapon-axe") ? "reachable" : "unreachable"]);
    const travel: TravelAccess = context.travel[CHECK_REGION.get(id)!];
    access = andAccess([travel, localAccess]);
  }
  const visible = rule.visibilityTiers.every((tier) => orAccess(tier.map((alternative) => evaluateAlternative(alternative, context))) !== "unreachable");
  return { access,
    visible, complete: deriveEffectiveCheckState(id, context.ram, manual).complete };
}

export function evaluateArea(area: MapArea, context: LogicContext, manual: PersistentManualState): AreaReachability {
  const checks = area.checkIds.map((id) => evaluateCheck(id, context, manual)).filter((check) => check.visible);
  const completed = checks.filter((check) => check.complete).length;
  const remaining = checks.filter((check) => !check.complete);
  const reachable = remaining.filter((check) => check.access === "reachable").length;
  const unknown = remaining.filter((check) => check.access === "unknown").length;
  const checkable = remaining.filter((check) => check.access === "checkable").length;
  const status: ReachabilityStatus = remaining.length === 0 ? "completed" : reachable > 0 ?
    reachable === remaining.length ? "reachable" : "partial" : unknown > 0 ? "unknown" :
      checkable > 0 ? "partial" : "unreachable";
  return { status, completed, total: checks.length, reachable, unknown };
}

export function sandshipEntranceAccess(context: LogicContext): AccessLevel {
  // Reuse the Kakkara travel region, or its inherited source access tier.
  // Exclude the Sea Hare Tail trade gate: it does not gate the desert route.
  return context.travel?.kakkara ?? evaluateTiers(CHECK_SOURCE_RULES["kakkara-npc"].accessTiers.slice(0, 1), context);
}
