// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { emptyWorldState, setOrbCleared } from "../state/worldState";
import { LIVE_SETTINGS } from "../testFixtures/liveSettings";
import { WorldMap } from "./WorldMap";

beforeEach(() => vi.stubGlobal("ResizeObserver", class {
  constructor(private callback: ResizeObserverCallback) {}
  observe() { this.callback([{ contentRect: { width: 900, height: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
  disconnect() {}
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() {
  const world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings(LIVE_SETTINGS));
  world.orbs.mp_orb = { kind: "element", element: "undine" };
  const ram = emptyRamState();
  ram.inventory["flammie-drum"] = true; ram.inventory["seed-moon"] = true;
  return { world, ram };
}
const manual = emptyManualState();
function props({ world, ram }: ReturnType<typeof setup>) {
  return { world, ram, manual, manualItems: new Set<never>(), onToggleManualCheck: vi.fn(), onSelectOrb: vi.fn() };
}
it("renders the live cleared Moon combination as an open Orb and reachable unfinished check, then follows rollback", () => {
  const state = setup(), p = props(state);
  const { rerender } = render(<WorldMap {...p} />);
  const orb = () => screen.getByRole("button", { name: /^Moon Palace Orb:/ });
  const area = () => screen.getByRole("button", { name: /^Moon Palace:/ });
  expect(orb().classList.contains("orb-blocked")).toBe(true);
  expect(area().classList.contains("pin-unreachable")).toBe(true);
  state.ram.orbs.mp_orb = true; rerender(<WorldMap {...p} />);
  expect(orb().classList.contains("orb-blocked")).toBe(false);
  expect(orb().classList.contains("orb-cleared")).toBe(true);
  expect(orb().getAttribute("aria-label")).toContain("passable, cleared (ram)");
  expect(area().classList.contains("pin-reachable")).toBe(true);
  expect(area().getAttribute("aria-label")).toContain("0 of 1 complete");
  fireEvent.click(orb());
  expect(screen.getByText(/Traversal: passable · Requirement: blocked · Cleared\/open \(ram\)/)).toBeDefined();
  state.ram.checks["moon-palace-seed"] = true; rerender(<WorldMap {...p} />);
  expect(area().classList.contains("pin-completed")).toBe(true);
  state.ram.checks["moon-palace-seed"] = false; state.ram.orbs.mp_orb = false;
  rerender(<WorldMap {...p} />);
  expect(area().classList.contains("pin-unreachable")).toBe(true);
  expect(orb().classList.contains("orb-cleared")).toBe(false);
  expect(orb().classList.contains("orb-blocked")).toBe(true);
});
it.each(["flammie-drum", "seed-moon"] as const)("keeps the Moon check blocked without %s even when the Orb is open", (missing) => {
  const state = setup(); state.ram.orbs.mp_orb = true; state.ram.inventory[missing] = false;
  render(<WorldMap {...props(state)} />);
  expect(screen.getByRole("button", { name: /^Moon Palace:/ }).classList.contains("pin-unreachable")).toBe(true);
  expect(screen.getByRole("button", { name: /^Moon Palace Orb:/ }).getAttribute("aria-label")).toContain("passable, cleared (ram)");
});
it("uses the same open-state display for manual clearing without collecting the Moon reward", () => {
  const state = setup(); state.world = setOrbCleared(state.world, "mp_orb", true);
  render(<WorldMap {...props(state)} />);
  expect(screen.getByRole("button", { name: /^Moon Palace Orb:/ }).getAttribute("aria-label")).toContain("passable, cleared (manual)");
  expect(screen.getByRole("button", { name: /^Moon Palace:/ }).classList.contains("pin-reachable")).toBe(true);
});
it("has collapsed header help instead of a permanent map-bottom bar, retaining contextual Cannon guidance", () => {
  const state = setup(); state.world.settings.cannonMode = "shuffle";
  render(<WorldMap {...props(state)} />);
  const help = screen.getByText("?", { selector: ".map-help summary" }).parentElement!;
  expect(help.hasAttribute("open")).toBe(false);
  expect(help.closest(".map-heading")).not.toBeNull();
  expect(document.querySelector(".map-footnote")).toBeNull();
  expect(document.querySelector(".map-context")?.textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Cannons ○" }));
  expect(document.querySelector(".map-heading .cannon-status")?.textContent).toContain("Click office");
  fireEvent.click(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
  expect(document.querySelector(".map-heading .cannon-status")?.textContent).toContain("Choose destination for Kakkara");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector(".map-heading .cannon-status")?.textContent).toContain("Click office");
  fireEvent.click(screen.getByRole("button", { name: "Cannons ✓" }));
  expect(document.querySelector(".map-context")?.textContent).toBe("");
});
