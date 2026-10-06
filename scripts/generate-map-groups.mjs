import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { LOCATION_DEFINITIONS } from "../src/data/locationDefinitions.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const poptrackerRoot = resolve(projectRoot, "source/poptracker");
const maps = JSON.parse(readFileSync(resolve(poptrackerRoot, "maps/maps.json"), "utf8"));
const locationTree = JSON.parse(
  readFileSync(resolve(poptrackerRoot, "locations/locations.json"), "utf8")
    .replace(/\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1"),
);
const overworld = maps.find((map) => map.name === "overworld");
if (overworld?.img !== "images/overworld_map.png") {
  throw new Error("The authoritative overworld image changed; inspect the new map before regenerating");
}

const image = readFileSync(resolve(projectRoot, "src/assets/poptracker/overworld_map.png"));
const width = image.readUInt32BE(16);
const height = image.readUInt32BE(20);
const checksByPath = new Map(LOCATION_DEFINITIONS.map((check) => [check.legacyPath, check]));
const matched = new Set();
const groups = [];
const unmatchedSections = [];
const checkRules = [];
const orbs = [];

function slug(path) {
  return path.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function visit(nodes, path = [], inheritedAccess = [], inheritedVisibility = []) {
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    const areaPath = nextPath.slice(1);
    const accessTiers = node.access_rules ? [...inheritedAccess, node.access_rules] : inheritedAccess;
    const visibilityTiers = node.visibility_rules ? [...inheritedVisibility, node.visibility_rules] : inheritedVisibility;
    if (node.map_locations) {
      const checks = [];
      for (const section of node.sections ?? []) {
        const sectionAccess = section.access_rules ? [...accessTiers, section.access_rules] : accessTiers;
        const sectionVisibility = section.visibility_rules ? [...visibilityTiers, section.visibility_rules] : visibilityTiers;
        if (section.hosted_item?.endsWith("_orb") || /^(?:fp|gp)_orb\d+$/.test(section.hosted_item ?? "")) {
          const pin = node.map_locations.find((location) => location.map === "overworld");
          if (!pin) throw new Error(`Orb has no overworld pin: ${section.name}`);
          orbs.push({ id: section.hosted_item, name: section.name, areaPath: areaPath.join("/"), x: pin.x, y: pin.y,
            accessTiers: sectionAccess, visibilityTiers: sectionVisibility });
        }
        if (!section.item_count) continue;
        const legacyPath = `@${[...areaPath, section.name].join("/")}`;
        const check = checksByPath.get(legacyPath);
        if (!check) unmatchedSections.push(legacyPath);
        else {
          checks.push(check.id);
          matched.add(check.id);
          checkRules.push({ id: check.id, accessTiers: sectionAccess, visibilityTiers: sectionVisibility });
        }
      }
      if (checks.length > 0) {
        const pins = node.map_locations.filter((pin) => pin.map === "overworld");
        if (pins.length !== 1) throw new Error(`Expected one overworld pin for ${areaPath.join("/")}`);
        const [{ x, y }] = pins;
        if (x < 0 || x > width || y < 0 || y > height) throw new Error(`Pin outside map: ${areaPath.join("/")}`);
        groups.push({ id: slug(areaPath), name: node.name, path: areaPath.join("/"), x, y, checkIds: checks });
      }
    }
    if (node.children) visit(node.children, nextPath, accessTiers, visibilityTiers);
  }
}

visit(locationTree);
const missing = LOCATION_DEFINITIONS.filter((check) => !matched.has(check.id));
if (unmatchedSections.length || missing.length) {
  throw new Error(`Unmatched PopTracker sections: ${unmatchedSections.join(", ")}; unmapped checks: ${missing.map((check) => check.id).join(", ")}`);
}
const lines = [
  'import type { LocationId } from "./locationDefinitions";',
  "",
  "// Generated from bundled source/poptracker maps and locations snapshots.",
  "// Run `npm run generate:map` after updating the authoritative snapshots.",
  "export const MAP_IMAGE_SIZE = " + JSON.stringify({ width, height }) + " as const;",
  "",
  "export interface MapGroup {",
  "  id: string;",
  "  name: string;",
  "  path: string;",
  "  x: number;",
  "  y: number;",
  "  checkIds: readonly LocationId[];",
  "}",
  "",
  "export const MAP_GROUPS = [",
  ...groups.map((group) => `  ${JSON.stringify(group)},`),
  "] as const satisfies readonly MapGroup[];",
  "",
  "export type MapGroupId = (typeof MAP_GROUPS)[number][\"id\"];",
  "",
  "export const MAP_GROUP_BY_ID = new Map<MapGroupId, (typeof MAP_GROUPS)[number]>(",
  "  MAP_GROUPS.map((group) => [group.id, group]),",
  ");",
  "",
];
writeFileSync(resolve(projectRoot, "src/data/mapGroups.ts"), lines.join("\n"));

const hintTree = JSON.parse(
  readFileSync(resolve(poptrackerRoot, "locations/hints.json"), "utf8")
    .replace(/\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1"),
);
const hints = [];
function visitHints(nodes, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    if (node.map_locations) {
      const sources = (node.sections ?? []).filter((section) => section.item_count).map((section) => section.name);
      const pin = node.map_locations.find((location) => location.map === "overworld_hints");
      if (sources.length && pin) hints.push({ id: slug(nextPath.slice(1)), name: node.name, x: pin.x, y: pin.y, sources });
    }
    if (node.children) visitHints(node.children, nextPath);
  }
}
visitHints(hintTree);

const sourceLines = [
  'import type { LocationId } from "./locationDefinitions";',
  "",
  "// Generated from PopTracker locations/locations.json and locations/hints.json.",
  "// accessTiers preserve each ancestor/section layer; alternatives within a tier are ORed.",
  "export interface SourceRule { accessTiers: readonly (readonly string[])[]; visibilityTiers: readonly (readonly string[])[] }",
  "export const CHECK_SOURCE_RULES = {",
  ...checkRules.map((entry) => `  ${JSON.stringify(entry.id)}: ${JSON.stringify({ accessTiers: entry.accessTiers, visibilityTiers: entry.visibilityTiers })},`),
  "} as const satisfies Record<LocationId, SourceRule>;",
  "",
  "export interface OrbSourceDefinition extends SourceRule { id: string; name: string; areaPath: string; x: number; y: number }",
  "export const ORB_SOURCE_DEFINITIONS = [",
  ...orbs.map((orb) => `  ${JSON.stringify(orb)},`),
  "] as const satisfies readonly OrbSourceDefinition[];",
  "",
  "export interface HintSourceGroup { id: string; name: string; x: number; y: number; sources: readonly string[] }",
  "export const HINT_SOURCE_GROUPS = [",
  ...hints.map((hint) => `  ${JSON.stringify(hint)},`),
  "] as const satisfies readonly HintSourceGroup[];",
  "",
];
writeFileSync(resolve(projectRoot, "src/data/sourceWorldData.ts"), sourceLines.join("\n"));
console.log(`Generated ${groups.length} source groups, ${matched.size} check rules, ${orbs.length} orbs, ${hints.length} hint pins (${hints.reduce((n, hint) => n + hint.sources.length, 0)} sources)`);
