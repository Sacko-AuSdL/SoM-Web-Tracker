// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AutotrackerSnapshot } from "./autotracking/Autotracker";
import { emptyRamState, MANUAL_STORAGE_KEY, saveManualState } from "./state/trackerState";
import { emptyWorldState, loadWorldState, saveWorldState, WORLD_STORAGE_KEY } from "./state/worldState";
import { loadUiPreferences, saveUiPreferences, loadPopoutInventoryMode } from "./state/uiPreferences";
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
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 900, height: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  const ram = emptyRamState(); ram.inventory.girl = true; ram.inventory["weapon-orbs-spear"] = 3;
  feed.snapshot = { sni: { phase: "attached", endpoint: "ws://localhost:23074", devices: ["mock"], attachedDevice: "mock", serverInfo: [], error: null },
    gameDetected: true, game: { detected: true, currentMap: 1, nmiFirstByte: 0, characterFlags: [0,0,0], partyMask: 2 }, ram,
    locations: {}, inventory: {}, orbs: {}, subsystemErrors: { locations: null, inventory: null, orbs: null }, error: null, lastPollAt: null };
  saveWorldState(window.localStorage, applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(LIVE_SETTINGS)));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
const url = (view: string) => window.history.replaceState(null, "", `/SoM-Web-Tracker/?view=${view}`);
const broadcast = () => screen.getByRole("button", { name: "Broadcast presentation" });

it("normal full application retains map, inventory, checks, help, settings, GP and MTR controls", () => {
  render(<App />);
  expect(screen.getByRole("banner")).toBeDefined(); expect(screen.getByRole("region", { name: "World map" })).toBeDefined();
  expect(document.querySelectorAll(".item-card")).toHaveLength(32);
  expect(screen.getByRole("combobox", { name: "Required Mana Seeds" })).toBeDefined();
  expect(screen.getByLabelText("Map help").closest("details")?.hasAttribute("open")).toBe(false);
  expect(screen.getByRole("button", { name: "Open Inventory Window" })).toBeDefined();
  expect(broadcast().getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByRole("button", { name: "Broadcast inventory" })).toBeNull();
});
it("broadcast URL keeps the entire tracker and existing inventory layout", () => {
  saveUiPreferences(window.localStorage, { version: 1, inventoryMode: "square", dungeonMode: "hidden" });
  url("broadcast"); render(<App />);
  expect(document.querySelector(".presentation-broadcast.inventory-square")).not.toBeNull();
  expect(screen.getByRole("banner")).toBeDefined(); expect(screen.getByRole("contentinfo")).toBeDefined();
  expect(screen.getByRole("region", { name: "World map" })).toBeDefined();
  expect(screen.getByRole("button", { name: /^Moon Palace Orb:/ })).toBeDefined();
  expect(screen.getByRole("button", { name: "Settings" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Dryad: Grand Palace hint unknown" })).toBeDefined();
});
it("N/C/S switching in Broadcast changes only inventory, and Escape preserves the chosen layout", () => {
  url("broadcast"); render(<App />);
  for (const [label, mode] of [["Compact", "compact"], ["Normal", "normal"], ["Square", "square"]]) {
    fireEvent.click(screen.getByRole("button", { name: `${label} inventory` }));
    expect(loadUiPreferences(window.localStorage)).toMatchObject({ inventoryMode: mode, presentation: "broadcast" });
    expect(window.location.search).toBe("?view=broadcast");
    expect(screen.getByRole("region", { name: "World map" })).toBeDefined();
  }
  fireEvent.keyDown(window, { key: "Escape" });
  expect(loadUiPreferences(window.localStorage)).toMatchObject({ inventoryMode: "square", presentation: "normal" });
  expect(window.location.search).toBe("");
});
it("retains settings interactions in Broadcast and does not exit it when Escape closes a panel", () => {
  render(<App />); fireEvent.click(broadcast()); fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  expect(broadcast().getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(broadcast()); expect(broadcast().getAttribute("aria-pressed")).toBe("false");
});
it("persists presentation independently through reload and keeps role overlays", () => {
  const world = loadWorldState(window.localStorage); world.settings.roleModeBySlot.girl = "random"; saveWorldState(window.localStorage, world);
  const first = render(<App />); fireEvent.click(screen.getByRole("button", { name: "Square inventory" })); fireEvent.click(broadcast()); first.unmount();
  render(<App />); expect(document.querySelector(".presentation-broadcast.inventory-square")).not.toBeNull();
  expect(screen.getByRole("button", { name: /Girl slot: present/ }).querySelector('[data-role="unknown"]')).not.toBeNull();
});
it("opens a dedicated same-origin window from Broadcast without changing its presentation or layout", () => {
  const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
  url("broadcast"); render(<App />); fireEvent.click(screen.getByRole("button", { name: "Compact inventory" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Inventory Window" }));
  const opened = new URL(open.mock.calls[0][0] as string);
  expect(opened.pathname).toBe("/SoM-Web-Tracker/"); expect(opened.searchParams.get("view")).toBe("inventory-popout");
  expect(opened.searchParams.get("layout")).toBe("compact"); expect(open.mock.calls[0][2]).toContain("popup,width=");
  expect(broadcast().getAttribute("aria-pressed")).toBe("true");
});
it("provides a direct link if the browser blocks window.open", () => {
  vi.spyOn(window, "open").mockReturnValue(null); render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open Inventory Window" }));
  expect(screen.getByRole("link", { name: "Open Inventory Window" }).getAttribute("href")).toContain("view=inventory-popout");
});
it("direct pop-out reuses inventory, GP and MTR without app header, map, settings or Broadcast controls", () => {
  url("inventory-popout"); render(<App />);
  expect(document.querySelector(".inventory-popout")).not.toBeNull();
  expect(screen.queryByRole("banner")).toBeNull(); expect(screen.queryByRole("region", { name: "World map" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Settings" })).toBeNull(); expect(screen.queryByRole("button", { name: "Broadcast presentation" })).toBeNull();
  expect(screen.getByRole("button", { name: "Close inventory window" })).toBeDefined();
  expect(screen.getByRole("combobox", { name: "Required Mana Seeds" })).toBeDefined();
  expect(document.querySelectorAll(".item-card")).toHaveLength(32);
  expect(screen.getByText("SNI Connected · Game Detected")).toBeDefined();
});
it("switches and reloads pop-out N/C/S without changing the main window's preferences", () => {
  const main = { version: 1 as const, inventoryMode: "square" as const, dungeonMode: "hidden" as const, presentation: "broadcast" as const };
  saveUiPreferences(window.localStorage, main); url("inventory-popout"); const first = render(<App />);
  for (const mode of ["Normal", "Square", "Compact"]) fireEvent.click(screen.getByRole("button", { name: `${mode} inventory` }));
  expect(loadPopoutInventoryMode(window.localStorage)).toBe("compact"); expect(loadUiPreferences(window.localStorage)).toEqual(main);
  first.unmount(); render(<App />); expect(document.querySelector(".inventory-popout.inventory-compact")).not.toBeNull();
});
it("closes script-opened pop-outs and explains the browser restriction for direct tabs", () => {
  const close = vi.spyOn(window, "close").mockImplementation(() => {}); url("inventory-popout"); render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Close inventory window" })); expect(close).toHaveBeenCalled();
  expect(screen.getByText(/If this tab was opened directly/)).toBeDefined();
});
it("updates live SNI inventory in the pop-out and keeps manual ownership separate from RAM", () => {
  url("inventory-popout"); render(<App />);
  act(() => { feed.snapshot = { ...feed.snapshot!, ram: { ...feed.snapshot!.ram, inventory: { ...feed.snapshot!.ram.inventory, "weapon-spear": true } } }; feed.listener!(feed.snapshot); });
  expect(screen.getByRole("button", { name: /Spear: acquired; Auto/ }).querySelector(".weapon-stage")?.textContent).toBe("3");
  fireEvent.click(screen.getByRole("button", { name: /Axe: not acquired/ }));
  expect(screen.getByRole("button", { name: /Axe: acquired; Manual/ })).toBeDefined();
  expect(feed.snapshot!.ram.inventory["weapon-axe"]).toBeNull();
  act(() => { feed.snapshot = { ...feed.snapshot!, ram: { ...feed.snapshot!.ram, inventory: { ...feed.snapshot!.ram.inventory, "weapon-spear": false } } }; feed.listener!(feed.snapshot); });
  expect(screen.getByRole("button", { name: /Spear: not acquired/ })).toBeDefined();
});
it("receives saved GP/MTR knowledge and manual checks through storage events using existing validators", () => {
  url("inventory-popout"); render(<App />);
  const world = loadWorldState(window.localStorage); world.gpHints["element-undine"] = "not-required"; world.manualReviveSeedCount = 6;
  saveWorldState(window.localStorage, world); fireEvent(window, new StorageEvent("storage", { key: WORLD_STORAGE_KEY, storageArea: window.localStorage }));
  expect(screen.getByRole("button", { name: "Undine: not required for Grand Palace" })).toBeDefined();
  expect(screen.getByRole("status", { name: "Mana Seeds: 0 / 6" })).toBeDefined();
  saveManualState(window.localStorage, { version: 1, manualCompletedChecks: ["potos-chest"] });
  fireEvent(window, new StorageEvent("storage", { key: MANUAL_STORAGE_KEY, storageArea: window.localStorage }));
  expect(feed.snapshot!.ram.checks["potos-chest"]).toBeNull();
});
it("uses canonical inventory ordering without changing native RAM bindings", () => {
  render(<App />);
  const names = (region: string) => [...screen.getByRole("region", { name: region }).querySelectorAll('.item-card')].map(e => e.getAttribute('aria-label')?.split(':')[0]);
  expect(names("Elements")).toEqual(["Undine","Gnome","Sylphid","Salamando","Shade","Lumina","Luna","Dryad"]);
  expect(names("Weapons")).toEqual(["Sword","Spear","Gloves","Boomerang","Bow","Axe","Whip","Javelin"]);
});
it("restores the Pandora Girl row from RAM after reload without completing its seven siblings", () => {
  feed.snapshot!.ram.checks["pandora-castle-girl"] = true;
  for (let reload = 0; reload < 2; reload++) {
    const app = render(<App />); fireEvent.click(screen.getByRole("button", { name: /^Pandora:/ }));
    expect(screen.getByRole("button", { name: "Pandora Castle Girl" }).classList.contains("complete")).toBe(true);
    expect(screen.getByRole("button", { name: /^Pandora:/ }).getAttribute("aria-label")).toContain("1 of 8 complete"); app.unmount();
  }
});
it("keeps the MTR range dropdown, acquired seed count and three scoped resets", () => {
  render(<App />); const select = screen.getByRole("combobox", { name: "Required Mana Seeds" }) as HTMLSelectElement;
  expect([...select.options].map(o => o.value)).toEqual(["", "5", "6", "7"]);
  for (const name of ["Water Seed", "Earth Seed", "Wind Seed"]) fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}: not acquired`) }));
  expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 5–7" })).toBeDefined();
  fireEvent.change(select, { target: { value: "6" } }); expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 6" })).toBeDefined();
  fireEvent.change(select, { target: { value: "" } }); expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 5–7" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  for (const name of ["Reset Crystal Orbs","Reset Manual Tracking","New Seed Reset"]) expect(within(screen.getByRole("region", { name: "Reset tracking" })).getByRole("button", { name })).toBeDefined();
});
