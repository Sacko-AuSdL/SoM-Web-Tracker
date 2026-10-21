// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AutotrackerSnapshot } from "./autotracking/Autotracker";
import { emptyRamState } from "./state/trackerState";
import { emptyWorldState, loadWorldState, saveWorldState } from "./state/worldState";
import { loadUiPreferences } from "./state/uiPreferences";
import { applyRandomizerSettings, parseRandomizerSettings } from "./adapters/randomizerSettings";
import { LIVE_SETTINGS } from "./testFixtures/liveSettings";
import App from "./App";

const feed = vi.hoisted(() => ({ snapshot: null as AutotrackerSnapshot | null, listener: null as ((state: AutotrackerSnapshot) => void) | null }));
vi.mock("./autotracking/Autotracker", () => ({ Autotracker: class {
  getSnapshot() { return feed.snapshot!; }
  subscribe(listener: (snapshot: AutotrackerSnapshot) => void) { feed.listener = listener; return () => { feed.listener = null; }; }
  start() {} stop() {} selectDevice = vi.fn();
} }));
beforeEach(() => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/SoM-Web-Tracker/");
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const ram = emptyRamState(); ram.inventory.girl = true; ram.inventory["weapon-orbs-spear"] = 3;
  feed.snapshot = { sni: { phase: "attached", endpoint: "ws://localhost:23074", devices: ["mock"], attachedDevice: "mock", serverInfo: [], error: null },
    gameDetected: true, game: { detected: true, currentMap: 1, nmiFirstByte: 0, characterFlags: [0,0,0], partyMask: 2 }, ram,
    locations: {}, inventory: {}, orbs: {}, subsystemErrors: { locations: null, inventory: null, orbs: null }, error: null, lastPollAt: null };
  saveWorldState(window.localStorage, applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(LIVE_SETTINGS)));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

it("broadcast URL renders shared icons and a minimal exit hint, without map/status chrome", () => {
  window.history.replaceState(null, "", "/SoM-Web-Tracker/?view=broadcast"); render(<App />);
  expect(screen.getAllByRole("region")).toHaveLength(5);
  for (const name of ["Characters","Elements","Weapons","Key items","Mana seeds"]) expect(screen.getByRole("region", { name })).toBeDefined();
  expect(screen.queryByRole("banner")).toBeNull(); expect(screen.queryByRole("contentinfo")).toBeNull();
  expect(screen.queryByRole("region", { name: "World map" })).toBeNull(); expect(screen.queryAllByRole("heading")).toHaveLength(0);
  expect(document.querySelectorAll(".item-card")).toHaveLength(32); expect(document.querySelectorAll(".item-panel")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Exit Broadcast to Normal inventory" }).textContent).toBe("N/C/S · Esc to return");
  expect(document.querySelector(".map-footnote,.map-help,.map-context,.cannon-status")).toBeNull();
  expect(document.querySelectorAll(".gp-badge,.availability-badge,.manual-indicator,.panel-note,.revival-count")).toHaveLength(0);
  expect(screen.getByRole("button", { name: /Girl slot: present/ }).closest(".inventory-slot")?.classList.contains("acquired")).toBe(true);
  expect(screen.getByRole("button", { name: /Spear: not acquired/ }).querySelector(".weapon-stage")?.textContent).toBe("3");
  expect(loadUiPreferences(window.localStorage).inventoryMode).toBe("broadcast");
});
it("returns from Broadcast by the visible hint or N, restoring the unchanged map layouts", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Broadcast inventory" }));
  fireEvent.click(screen.getByRole("button", { name: "Exit Broadcast to Normal inventory" }));
  expect(loadUiPreferences(window.localStorage).inventoryMode).toBe("normal");
  expect(screen.queryByText("N/C/S · Esc to return")).toBeNull();
  expect(screen.getByRole("region", { name: "World map" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Broadcast inventory" }));
  fireEvent.keyDown(window, { key: "n" });
  expect(loadUiPreferences(window.localStorage).inventoryMode).toBe("normal");
});
it("one live snapshot and the same manual state update Broadcast immediately, then survive layout switching", () => {
  window.history.replaceState(null, "", "/?view=broadcast"); render(<App />);
  act(() => { feed.snapshot = { ...feed.snapshot!, ram: { ...feed.snapshot!.ram, inventory: { ...feed.snapshot!.ram.inventory, "weapon-spear": true } } }; feed.listener!(feed.snapshot); });
  expect(screen.getByRole("button", { name: /Spear: acquired; Auto/ })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /Axe: not acquired/ }));
  expect(screen.getByRole("button", { name: /Axe: acquired; Manual/ })).toBeDefined();
  fireEvent.keyDown(window, { key: "c" });
  expect(screen.getByRole("region", { name: "World map" })).toBeDefined(); expect(window.location.search).toBe("");
  expect(loadUiPreferences(window.localStorage).inventoryMode).toBe("compact");
  expect(screen.getByRole("button", { name: /Axe: acquired; Manual/ })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Broadcast inventory" }));
  expect(screen.queryByRole("banner")).toBeNull(); expect(screen.getByRole("button", { name: /Spear: acquired; Auto/ })).toBeDefined();
  fireEvent.keyDown(window, { key: "s" }); expect(loadUiPreferences(window.localStorage).inventoryMode).toBe("square");
  fireEvent.click(screen.getByRole("button", { name: "Broadcast inventory" }));
  fireEvent.keyDown(window, { key: "Escape" }); expect(loadUiPreferences(window.localStorage).inventoryMode).toBe("normal");
});
it("persists Broadcast on reload and preserves meaningful unknown role overlays", () => {
  const world = loadWorldState(window.localStorage); world.settings.roleModeBySlot.girl = "random"; saveWorldState(window.localStorage, world);
  const first = render(<App />); fireEvent.click(screen.getByRole("button", { name: "Broadcast inventory" })); first.unmount(); render(<App />);
  expect(screen.queryByRole("banner")).toBeNull();
  expect(screen.getByRole("button", { name: /Girl slot: present/ }).querySelector('[data-role="unknown"]')).not.toBeNull();
});
it("uses canonical presentation without changing the native RAM binding or stable IDs", () => {
  render(<App />);
  const names = (region: string) => [...screen.getByRole("region", { name: region }).querySelectorAll('.item-card')].map(e => e.getAttribute('aria-label')?.split(':')[0]);
  expect(names("Elements")).toEqual(["Undine","Gnome","Sylphid","Salamando","Shade","Lumina","Luna","Dryad"]);
  expect(names("Weapons")).toEqual(["Sword","Spear","Gloves","Boomerang","Bow","Axe","Whip","Javelin"]);
  fireEvent.click(screen.getByRole("button", { name: "Broadcast inventory" }));
  expect(names("Weapons")).toEqual(["Sword","Spear","Gloves","Boomerang","Bow","Axe","Whip","Javelin"]);
});
it("restores the Pandora Girl row from fresh RAM after reload, without greying its seven unfinished siblings", () => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 900, height: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  feed.snapshot!.ram.checks["pandora-castle-girl"] = true;
  for (let reload = 0; reload < 2; reload++) {
    const app = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^Pandora:/ }));
    expect(screen.getByRole("button", { name: "Pandora Castle Girl" }).classList.contains("complete")).toBe(true);
    expect(screen.getByRole("button", { name: /^Pandora:/ }).getAttribute("aria-label")).toContain("1 of 8 complete");
    expect(screen.getByRole("button", { name: /^Pandora:/ }).classList.contains("pin-completed")).toBe(false);
    app.unmount();
  }
});
it("edits the exact live MTR range in the existing compact dropdown without changing acquired seeds", () => {
  render(<App />);
  expect(screen.getByRole("status", { name: "Mana Seeds: 0 / 5–7" })).toBeDefined();
  const select = screen.getByRole("combobox", { name: "Required Mana Seeds" }) as HTMLSelectElement;
  expect([...select.options].map(o => o.value)).toEqual(["", "5", "6", "7"]);
  fireEvent.click(screen.getByRole("button", { name: /Water Seed: not acquired/ }));
  fireEvent.click(screen.getByRole("button", { name: /Earth Seed: not acquired/ }));
  fireEvent.click(screen.getByRole("button", { name: /Wind Seed: not acquired/ }));
  expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 5–7" })).toBeDefined();
  fireEvent.change(select, { target: { value: "6" } }); expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 6" })).toBeDefined();
  fireEvent.change(select, { target: { value: "" } }); expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 5–7" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  for (const name of ["Reset Crystal Orbs","Reset Manual Tracking","New Seed Reset"]) expect(within(screen.getByRole("region", { name: "Reset tracking" })).getByRole("button", { name })).toBeDefined();
});
