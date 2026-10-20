// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AutotrackerSnapshot } from "./autotracking/Autotracker";
import { emptyManualState, emptyRamState, loadManualState, saveManualState, setManualCompletion } from "./state/trackerState";
import { addCannonConnection, emptyWorldState, loadWorldState, saveWorldState } from "./state/worldState";
import { loadUiPreferences, saveUiPreferences } from "./state/uiPreferences";
import App from "./App";

const feed = vi.hoisted(() => ({ snapshot: null as AutotrackerSnapshot | null, listener: null as ((state: AutotrackerSnapshot) => void) | null }));
vi.mock("./autotracking/Autotracker", () => ({ Autotracker: class {
  getSnapshot() { return feed.snapshot!; }
  subscribe(listener: (state: AutotrackerSnapshot) => void) { feed.listener = listener; return () => { feed.listener = null; }; }
  start() {} stop() {} selectDevice = vi.fn();
} }));
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 800, height: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  const ram = emptyRamState(); ram.inventory["weapon-spear"] = true; ram.checks["mantis-ant"] = true; ram.orbs.et_orb = true;
  feed.snapshot = { sni: { phase: "attached", endpoint: "ws://localhost:23074", devices: ["mock-device"], attachedDevice: "mock-device", serverInfo: [], error: null },
    ram, gameDetected: false, game: null, locations: {}, inventory: {}, orbs: {}, subsystemErrors: { locations: null, inventory: null, orbs: null }, lastPollAt: null, error: null };
  let world = addCannonConnection(emptyWorldState(), { from: "kakkara", to: "potos" });
  world.settings.orbMode = "mixed"; world.settings.goal = "revive"; world.settings.reviveSeedCount = 5;
  world.orbs.uf_orb = { kind: "weapon-family", weapon: "spear" }; world.manualClearedOrbs = ["uf_orb"];
  world.manualReadHints = ["sandship-morie-hint"]; world.gpHints = { "element-gnome": "not-required" }; world.roles.boy = "sprite";
  saveWorldState(window.localStorage, world);
  saveManualState(window.localStorage, setManualCompletion(emptyManualState(), "potos-chest", true));
  window.localStorage.setItem("som-web-tracker-mini:manual-state:v2", JSON.stringify({ completedChecks: { potosChest: true } }));
  window.localStorage.setItem("connection-preferences", "preserve-connection");
  saveUiPreferences(window.localStorage, { version: 1, inventoryMode: "square", dungeonMode: "hidden" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function openReset(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.getByRole("alertdialog");
}
function confirm(dialog: HTMLElement) { fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reset" })); }
function closeSettings() { fireEvent.click(within(screen.getByRole("dialog", { name: "Settings" })).getByRole("button", { name: "Close settings" })); }

it.each(["Reset Crystal Orbs", "Reset Manual Tracking", "New Seed Reset"])("%s requires confirmation, and Cancel changes nothing", (name) => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^Axe: not acquired/ }));
  const before = Object.entries(window.localStorage);
  const dialog = openReset(name);
  expect(within(dialog).getByText("Emulator memory is never changed. Cancel changes nothing.")).toBeDefined();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(Object.entries(window.localStorage)).toEqual(before);
  closeSettings();
  expect(screen.getByRole("button", { name: /^Axe: acquired; Manual/ })).toBeDefined();
});

it.each(["attached", "disconnected"] as const)("manual reset works %s, survives reload/reconnect, and never deletes RAM progress", (phase) => {
  feed.snapshot!.sni.phase = phase;
  const before = loadWorldState(window.localStorage), ramBefore = structuredClone(feed.snapshot!.ram);
  const mounted = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^Axe: not acquired/ }));
  confirm(openReset("Reset Manual Tracking")); closeSettings();
  expect(loadManualState(window.localStorage)).toEqual(emptyManualState());
  expect(loadWorldState(window.localStorage)).toEqual({ ...before, manualClearedOrbs: [], manualReadHints: [] });
  expect(screen.getByRole("button", { name: /^Axe: not acquired/ })).toBeDefined();
  expect(screen.getByRole("button", { name: /^Spear: acquired; Auto/ })).toBeDefined();
  expect(screen.getByLabelText("Checks: 1 of 76 completed")).toBeDefined();
  expect(feed.snapshot!.ram).toEqual(ramBefore);
  mounted.unmount(); render(<App />);
  expect(screen.getByRole("complementary", { name: "Inventory" }).getAttribute("data-layout")).toBe("square");
  act(() => { feed.snapshot = { ...feed.snapshot!, ram: emptyRamState(), sni: { ...feed.snapshot!.sni, phase: "disconnected" } }; feed.listener?.(feed.snapshot); });
  expect(screen.getByLabelText("Checks: 0 of 76 completed")).toBeDefined();
  act(() => { feed.snapshot = { ...feed.snapshot!, ram: structuredClone(ramBefore), sni: { ...feed.snapshot!.sni, phase: "attached" } }; feed.listener?.(feed.snapshot); });
  expect(screen.getByLabelText("Checks: 1 of 76 completed")).toBeDefined();
  expect(screen.getByRole("button", { name: /^Earth Temple Orb:.*cleared \(ram\)/ })).toBeDefined();
  act(() => { feed.snapshot = { ...feed.snapshot!, ram: { ...feed.snapshot!.ram, checks: { ...feed.snapshot!.ram.checks, "mantis-ant": false } } }; feed.listener?.(feed.snapshot); });
  expect(screen.getByLabelText("Checks: 0 of 76 completed")).toBeDefined();
  expect(loadManualState(window.localStorage).manualCompletedChecks).toEqual([]);
  expect(window.localStorage.getItem("connection-preferences")).toBe("preserve-connection");
});

it.each(["attached", "disconnected"] as const)("Crystal Orb reset %s retains RAM, checks, hints, session items and seed settings", (phase) => {
  feed.snapshot!.sni.phase = phase;
  const before = loadWorldState(window.localStorage); render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^Axe: not acquired/ }));
  confirm(openReset("Reset Crystal Orbs")); closeSettings();
  const after = loadWorldState(window.localStorage);
  expect(Object.values(after.orbs)).toHaveLength(14); expect(Object.values(after.orbs).every((value) => value.kind === "unknown")).toBe(true);
  expect(after.gpHints).toEqual({}); expect(after.manualClearedOrbs).toEqual([]);
  expect(after.settings).toEqual(before.settings); expect(after.cannonConnections).toEqual(before.cannonConnections);
  expect(after.roles).toEqual(before.roles); expect(after.manualReadHints).toEqual(before.manualReadHints);
  expect(loadManualState(window.localStorage).manualCompletedChecks).toEqual(["potos-chest"]);
  expect(screen.getByRole("button", { name: /^Axe: acquired; Manual/ })).toBeDefined();
  expect(screen.getByRole("button", { name: /^Earth Temple Orb:.*cleared \(ram\)/ })).toBeDefined();
});

it.each(["attached", "disconnected"] as const)("New Seed Reset %s clears options/configuration, preserving UI and connection preferences", (phase) => {
  feed.snapshot!.sni.phase = phase;
  const beforeRam = structuredClone(feed.snapshot!.ram), ui = loadUiPreferences(window.localStorage);
  render(<App />); const dialog = openReset("New Seed Reset");
  expect(within(dialog).getByText(/Imported Options String settings are RESET/)).toBeDefined();
  confirm(dialog); closeSettings();
  expect(loadWorldState(window.localStorage)).toEqual(emptyWorldState());
  expect(loadManualState(window.localStorage)).toEqual(emptyManualState());
  expect(loadUiPreferences(window.localStorage)).toEqual(ui); expect(feed.snapshot!.ram).toEqual(beforeRam);
  expect(window.localStorage.getItem("connection-preferences")).toBe("preserve-connection");
  expect(screen.queryByText(/^Mana Seeds:/)).toBeNull();
});

it("persists inline MTR resolution and all GP knowledge states through actual App reload and the three reset scopes", () => {
  const mounted = render(<App />);
  fireEvent.change(screen.getByRole("combobox", { name: "Required Mana Seeds" }), { target: { value: "6" } });
  expect(loadWorldState(window.localStorage).manualReviveSeedCount).toBe(6);
  expect(loadWorldState(window.localStorage).settings.reviveSeedCount).toBe(5);
  fireEvent.click(screen.getByRole("button", { name: "Gnome: not required for Grand Palace" }));
  const unknown = screen.getByRole("button", { name: "Undine: Grand Palace hint unknown" });
  expect(unknown.tagName).toBe("BUTTON"); expect(unknown.tabIndex).toBe(0);
  fireEvent.focus(unknown); fireEvent.click(unknown);
  expect(loadWorldState(window.localStorage).gpHints).toEqual({ "element-undine": "required" });
  mounted.unmount(); render(<App />);
  expect((screen.getByRole("combobox", { name: "Required Mana Seeds" }) as HTMLSelectElement).value).toBe("6");
  expect(screen.getByRole("button", { name: "Undine: required for Grand Palace" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Gnome: Grand Palace hint unknown" })).toBeDefined();
  confirm(openReset("Reset Manual Tracking")); closeSettings();
  expect(loadWorldState(window.localStorage).manualReviveSeedCount).toBe(6);
  expect(loadWorldState(window.localStorage).gpHints).toEqual({ "element-undine": "required" });
  confirm(openReset("Reset Crystal Orbs")); closeSettings();
  expect(loadWorldState(window.localStorage).gpHints).toEqual({});
  expect(loadWorldState(window.localStorage).manualReviveSeedCount).toBe(6);
  confirm(openReset("New Seed Reset")); closeSettings();
  expect(loadWorldState(window.localStorage).manualReviveSeedCount).toBeNull();
  expect(loadWorldState(window.localStorage).gpHints).toEqual({});
  expect(screen.queryByRole("combobox", { name: "Required Mana Seeds" })).toBeNull();
});
