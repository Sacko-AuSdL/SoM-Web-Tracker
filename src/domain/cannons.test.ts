import { describe, expect, it } from "vitest";
import { CANNON_OFFICES, CANNON_TARGETS, OPEN_CANNON_CONNECTIONS, VANILLA_CANNON_CONNECTIONS, cannonNetwork, connectionId, validConnection } from "./cannons";
import { addCannonConnection, clearCannonConnections, emptyWorldState, loadWorldState, removeCannonConnection, replaceCannonConnection, saveWorldState, setOrbCleared } from "../state/worldState";

describe("authoritative directed Cannon networks", () => {
  it("preserves the 14 Vanilla region routes", () => {
    expect(VANILLA_CANNON_CONNECTIONS.map(connectionId)).toEqual([
      "upperLand:potos", "upperLand:gaiasNavel", "southtown:kakkara", "iceCountry:matango", "iceCountry:kakkara",
      "kakkara:matango", "kakkara:iceCountry", "kakkara:southtown", "matango:kakkara", "matango:iceCountry",
      "potos:waterPalace", "potos:upperLand", "gaiasNavel:waterPalace", "gaiasNavel:pandora",
    ]);
    expect(cannonNetwork("vanilla", [])).toBe(VANILLA_CANNON_CONNECTIONS);
  });
  it("Open automatically offers all nine landings except each office's home", () => {
    expect(CANNON_OFFICES).toHaveLength(7);
    expect(CANNON_TARGETS).toHaveLength(9);
    expect(OPEN_CANNON_CONNECTIONS).toHaveLength(56);
    for (const office of CANNON_OFFICES) {
      const routes = OPEN_CANNON_CONNECTIONS.filter((r) => r.from === office.id);
      expect(routes).toHaveLength(8);
      expect(routes.some((r) => r.to === office.id)).toBe(false);
      expect(routes.some((r) => r.to === "waterPalace")).toBe(true);
      expect(routes.some((r) => r.to === "pandora")).toBe(true);
    }
    expect(cannonNetwork("open", [])).toBe(OPEN_CANNON_CONNECTIONS);
  });
  it.each(["shuffle", "chaos"] as const)("%s manages manual edges without assuming reverse routes", (mode) => {
    let state = emptyWorldState(); state.settings.cannonMode = mode;
    state = addCannonConnection(state, { from: "kakkara", to: "iceCountry" });
    expect(addCannonConnection(state, state.cannonConnections[0])).toBe(state);
    expect(cannonNetwork(mode, state.cannonConnections)).toEqual([{ from: "kakkara", to: "iceCountry" }]);
    state = replaceCannonConnection(state, "kakkara:iceCountry", { from: "kakkara", to: "potos" });
    expect(state.cannonConnections).toEqual([{ from: "kakkara", to: "potos" }]);
    expect(removeCannonConnection(state, "kakkara:potos").cannonConnections).toEqual([]);
    expect(clearCannonConnections(state).cannonConnections).toEqual([]);
  });
  it("migrates v1, persists normalized settings/seed configuration, and filters invalid/duplicate routes", () => {
    const entries = new Map<string, string>();
    const storage: Storage = { get length() { return entries.size; }, clear: () => entries.clear(),
      key: (index) => [...entries.keys()][index] ?? null, removeItem: (key) => { entries.delete(key); },
      getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
    entries.set("som-web-tracker:world-state:v1", JSON.stringify({ ...emptyWorldState(), version: 1, settings: { drumLogic: "random", roleMode: "random" } }));
    let state = loadWorldState(storage);
    expect(state.version).toBe(3);
    expect(state.settings.cannonMode).toBe("vanilla");
    state.settings.startingLocation = "kakkara";
    state = setOrbCleared(addCannonConnection(state, { from: "kakkara", to: "potos" }), "uf_orb", true);
    saveWorldState(storage, state);
    expect(loadWorldState(storage)).toEqual(state);
    expect(entries.get("som-web-tracker:world-state:v3")).not.toContain("inventory");
    entries.set("som-web-tracker:world-state:v3", JSON.stringify({ ...state, cannonConnections: [...state.cannonConnections, ...state.cannonConnections, { from: "unknown", to: "potos" }, { from: "kakkara", to: "kakkara" }] }));
    expect(loadWorldState(storage).cannonConnections).toEqual(state.cannonConnections);
    expect(validConnection({ from: "waterPalace", to: "potos" })).toBe(false);
  });
});
