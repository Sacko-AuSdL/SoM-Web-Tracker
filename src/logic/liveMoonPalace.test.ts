import { describe, expect, it } from "vitest";
import { LIVE_SETTINGS } from "../testFixtures/liveSettings";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { addCannonConnection, emptyWorldState, setOrbCleared } from "../state/worldState";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { createLogicContext, evaluateCheck, evaluateOrbTraversal, moonPalaceDiagnostics } from "./reachability";
import { OrbAutotracker } from "../autotracking/OrbAutotracker";
import { INVENTORY_DEFINITIONS } from "../data/inventoryDefinitions";

function setup() {
  const world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(LIVE_SETTINGS));
  world.orbs.mp_orb = { kind: "element", element: "undine" };
  const ram = emptyRamState(); ram.inventory.girl = true; ram.inventory["flammie-drum"] = true; ram.inventory["seed-moon"] = true;
  return { world, ram };
}
const manual = emptyManualState();
describe("Moon Palace live report: independent gates, not a forced green", () => {
  it.each(["undine","gnome","sylphid","salamando","shade","lumina","luna","dryad"] as const)("evaluates %s identity independently of native RAM/UI order", (element) => {
    const { world, ram } = setup(); world.settings.spellShuffle = "off"; world.settings.fixedRoles.sprite = "sprite";
    ram.inventory.sprite = true; world.orbs.mp_orb = { kind: "element", element };
    const gate = () => evaluateOrbTraversal(createLogicContext(ram, new Set(), world), "mp_orb");
    expect(gate()).toBe("blocked"); ram.inventory[`element-${element}`] = true; expect(gate()).toBe("passable");
    ram.inventory[`element-${element}`] = false; ram.orbs.mp_orb = true; expect(gate()).toBe("passable");
  });
  it("preserves missing/owned uncleared magic distinctions without guessing perCharacter effects", () => {
    const { world, ram } = setup();
    const context = () => createLogicContext(ram, new Set(), world);
    expect(evaluateCheck("moon-palace-seed", context(), manual).access).toBe("unreachable");
    ram.inventory["element-undine"] = true;
    // Girl can own shuffled Undine offensive effects; vanilla Sprite-only is invalid.
    expect(evaluateOrbTraversal(context(), "mp_orb")).toBe("unknown");
    expect(evaluateCheck("moon-palace-seed", context(), manual).access).toBe("unknown");
    ram.orbs.mp_orb = true;
    expect(evaluateCheck("moon-palace-seed", context(), manual)).toMatchObject({ access: "reachable", complete: false });
  });
  it("keeps an unresolved present caster role unknown rather than inventing a definite shuffled-magic block", () => {
    const { world, ram } = setup(); ram.inventory["element-undine"] = true;
    // A findable magic caster keeps the intentional no-magic-seed bypass out
    // of this case; only the presently owned Girl's role is unresolved.
    world.settings.additionalCharacter = "sprite"; world.settings.fixedRoles.sprite = "sprite";
    world.settings.roleModeBySlot.girl = "random";
    const gate = () => evaluateOrbTraversal(createLogicContext(ram, new Set(), world), "mp_orb");
    expect(gate()).toBe("unknown");
    world.roles.girl = "boy"; expect(gate()).toBe("blocked");
    ram.orbs.mp_orb = true; expect(gate()).toBe("passable");
  });
  it("reads the actual Moon open flag, bypasses absent spells, and follows rollback/reconnect", async () => {
    const { world, ram } = setup();
    const flags = new Uint8Array(0xd7);
    const client = { readMemory: async () => flags };
    const poll = async () => { ram.orbs = (await new OrbAutotracker(client).poll()).values; };
    flags[0x3b - 0x18] = 2; await poll();
    ram.inventory.girl = false; ram.inventory["element-undine"] = false;
    const access = () => evaluateCheck("moon-palace-seed", createLogicContext(ram, new Set(), world), manual);
    expect(access()).toMatchObject({ access: "reachable", complete: false });
    flags[0x3b - 0x18] = 1; await poll(); expect(access().access).toBe("unreachable");
    flags[0x3b - 0x18] = 2; await poll(); expect(access().access).toBe("reachable");
    ram.checks["moon-palace-seed"] = true; expect(access().complete).toBe(true);
  });
  it("retains source-backed Flammie-only travel even with a cleared Orb and Chaos route to Kakkara", () => {
    let { world, ram } = setup(); ram.orbs.mp_orb = true; ram.inventory["flammie-drum"] = false;
    world = addCannonConnection(world, { from: "potos", to: "kakkara" });
    const context = createLogicContext(ram, new Set(), world);
    expect(context.travel?.kakkara).toBe("reachable");
    expect(evaluateCheck("moon-palace-seed", context, manual).access).toBe("unreachable");
    expect(moonPalaceDiagnostics(context)[0].access).toBe("unreachable");
  });
  it("retains Restrictive Moon Seed and reports its exact blocker; Basic does not require it", () => {
    const { world, ram } = setup(); ram.orbs.mp_orb = true; ram.inventory["seed-moon"] = false;
    const context = () => createLogicContext(ram, new Set(), world);
    expect(evaluateCheck("moon-palace-seed", context(), manual).access).toBe("unreachable");
    expect(moonPalaceDiagnostics(context())[2]).toMatchObject({ label: "Moon Seed (Restrictive only)", access: "unreachable" });
    world.settings.logic = "basic";
    expect(evaluateCheck("moon-palace-seed", context(), manual).access).toBe("reachable");
  });
  it("full inventory and valid travel never turn a confirmed-clear Moon Palace red", () => {
    const { world, ram } = setup();
    for (const item of INVENTORY_DEFINITIONS) if (item.valueKind === "boolean") ram.inventory[item.id] = true;
    ram.orbs.mp_orb = true;
    expect(evaluateCheck("moon-palace-seed", createLogicContext(ram, new Set(), world), manual).access).toBe("reachable");
    ram.orbs.mp_orb = false;
    const manualClear = setOrbCleared(world, "mp_orb", true);
    expect(evaluateCheck("moon-palace-seed", createLogicContext(ram, new Set(), manualClear), manual).access).toBe("reachable");
  });
  it("off-mode Undine/Gnome identities and all weapon-family requirements remain independent", () => {
    const { world, ram } = setup(); world.settings.spellShuffle = "off"; world.settings.fixedRoles.sprite = "sprite"; ram.inventory.sprite = true;
    ram.inventory["element-undine"] = true; ram.inventory["element-gnome"] = false;
    const gate = () => evaluateOrbTraversal(createLogicContext(ram, new Set(), world), "mp_orb");
    expect(gate()).toBe("passable"); world.orbs.mp_orb = { kind: "element", element: "gnome" }; expect(gate()).toBe("blocked");
    for (const weapon of ["sword","spear","gloves","boomerang","bow","axe","whip","javelin"] as const) {
      world.orbs.mp_orb = { kind: "weapon-family", weapon }; ram.inventory[`weapon-${weapon}`] = false; expect(gate()).toBe("blocked");
      ram.inventory[`weapon-${weapon}`] = true; expect(gate()).toBe("passable"); ram.inventory[`weapon-${weapon}`] = false;
    }
  });
});
