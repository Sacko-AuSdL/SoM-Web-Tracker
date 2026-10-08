// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorldMap } from "./WorldMap";
import { SANDSHIP } from "../data/sandship";
import { emptyManualState, emptyRamState, setManualCompletion } from "../state/trackerState";
import { emptyWorldState, setHintRead } from "../state/worldState";
import { countTrackerProgress } from "../logic/progress";
import { createLogicContext } from "../logic/reachability";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 800, height: 370 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
});
function setup() {
  const ram = emptyRamState(); const world = emptyWorldState();
  world.settings.startingLocation = "kakkara"; world.settings.drumLogic = "random";
  return { ram, world, manual: emptyManualState(), manualItems: new Set<never>(),
    onToggleManualCheck: vi.fn(), onSelectOrb: vi.fn(), onSetHintRead: vi.fn() };
}
it("hides unsupported Sandship, exposes its pre-boss popup, and gives Morie separate read controls after victory", () => {
  const ram = emptyRamState(); let world = emptyWorldState(); world.settings.startingLocation = "kakkara";
  world.settings.drumLogic = "random";
  const onSetHintRead = vi.fn();
  const props = () => ({ world, ram, manual: emptyManualState(), manualItems: new Set<never>(),
    onToggleManualCheck: vi.fn(), onSelectOrb: vi.fn(), onSetHintRead });
  const { rerender } = render(<WorldMap {...props()} />);
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  expect(screen.queryByRole("button", { name: /^Sandship - Captain:/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Sandship - Morie Hint:/ })).toBeNull();
  ram.sandship.supported = true; ram.sandship.bossDefeated = false;
  rerender(<WorldMap {...props()} />);
  fireEvent.click(screen.getByRole("button", { name: /^Sandship - Captain: unreachable/ }));
  const captain = screen.getByRole("button", { name: "Sandship - Captain" });
  expect(captain.className).toContain("unreachable");
  expect(captain.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByText(/Boss: not defeated/)).toBeDefined();
  expect(screen.queryByRole("button", { name: /Sandship - Morie Hint:/ })).toBeNull();
  ram.sandship.bossDefeated = true;
  rerender(<WorldMap {...props()} />);
  expect(screen.getByRole("button", { name: "Sandship - Captain" }).classList.contains("reachable")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Sandship - Morie Hint:/ }));
  fireEvent.click(screen.getByRole("button", { name: "Mark hint read" }));
  expect(onSetHintRead).toHaveBeenCalledWith(SANDSHIP.hintId, true);
  world = setHintRead(world, SANDSHIP.hintId, true);
  rerender(<WorldMap {...props()} />);
  expect(screen.getByRole("button", { name: "Mark hint unread" }).getAttribute("aria-pressed")).toBe("true");
  ram.sandship.bossDefeated = false;
  rerender(<WorldMap {...props()} />);
  expect(screen.queryByRole("button", { name: /Sandship - Morie Hint:/ })).toBeNull();
  expect(world.manualReadHints).toEqual([SANDSHIP.hintId]);
  expect([...document.querySelectorAll(".map-pin")].every((pin) => pin.textContent === "" && pin.children.length === 0)).toBe(true);
});

it.each([null, false, true] as const)("renders supported boss state %s without completing Captain or adding a prize", (bossDefeated) => {
  const props = setup(); props.ram.sandship.supported = true;
  props.ram.sandship.bossDefeated = bossDefeated; props.ram.checks[SANDSHIP.captainId] = false;
  render(<WorldMap {...props} />);
  const label = bossDefeated === null ? "unknown" : bossDefeated ? "defeated" : "not defeated";
  const boss = screen.getByRole("button", { name: `Sandship Boss: ${label}` });
  expect(boss.classList.contains(`pin-${bossDefeated === null ? "unknown" : bossDefeated ? "completed" : "unreachable"}`)).toBe(true);
  const captain = screen.getByRole("button", { name: /^Sandship - Captain:/ });
  expect(captain.classList.contains("pin-completed")).toBe(false);
  expect(countTrackerProgress(createLogicContext(props.ram, props.manualItems, props.world), props.manual)).toMatchObject({ total: 77, completed: 0 });
  fireEvent.click(boss);
  expect(screen.getByText(/Read-only boss status: WRAM 0x7ECF28 == 0x0F/)).toBeDefined();
  expect(props.onToggleManualCheck).not.toHaveBeenCalled();
});

it("keeps boss RAM rollback independent from Captain RAM and persistent manual completion", () => {
  const props = setup(); props.ram.sandship.supported = true; props.ram.sandship.bossDefeated = false;
  props.ram.checks[SANDSHIP.captainId] = true;
  const { rerender } = render(<WorldMap {...props} />);
  expect(screen.getByRole("button", { name: /^Sandship - Captain: completed/ })).toBeDefined();
  expect(screen.getByRole("button", { name: "Sandship Boss: not defeated" })).toBeDefined();
  props.ram.checks[SANDSHIP.captainId] = false;
  props.manual = setManualCompletion(props.manual, SANDSHIP.captainId, true);
  props.ram.sandship.bossDefeated = true;
  rerender(<WorldMap {...props} />);
  expect(screen.getByRole("button", { name: "Sandship Boss: defeated" })).toBeDefined();
  props.ram.sandship.bossDefeated = false;
  rerender(<WorldMap {...props} />);
  expect(screen.getByRole("button", { name: "Sandship Boss: not defeated" }).classList.contains("pin-completed")).toBe(false);
  expect(screen.getByRole("button", { name: /^Sandship - Captain: completed/ })).toBeDefined();
  expect(countTrackerProgress(createLogicContext(props.ram, props.manualItems, props.world), props.manual)).toMatchObject({ total: 77, completed: 1 });
});

it("gates Morie on the Hints layer and hides all three markers for unsupported or undetected builds", () => {
  const props = setup(); props.ram.sandship.supported = true; props.ram.sandship.bossDefeated = true;
  const { rerender } = render(<WorldMap {...props} />);
  expect(screen.queryByRole("button", { name: /^Sandship - Morie Hint:/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  expect(screen.getByRole("button", { name: /^Sandship - Morie Hint: 1 hint sources/ })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Hints ✓" }));
  expect(screen.queryByRole("button", { name: /^Sandship - Morie Hint:/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  fireEvent.click(screen.getByRole("button", { name: "Checks ✓" }));
  expect(screen.queryByRole("button", { name: /^Sandship Boss:/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Sandship - Captain:/ })).toBeNull();
  expect(screen.getByRole("button", { name: /^Sandship - Morie Hint:/ })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Checks ○" }));
  for (const supported of [false, null]) {
    props.ram.sandship.supported = supported;
    props.manual = setManualCompletion(props.manual, SANDSHIP.captainId, true);
    props.world = setHintRead(props.world, SANDSHIP.hintId, true);
    rerender(<WorldMap {...props} />);
    expect(screen.queryByRole("button", { name: /^Sandship Boss:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Sandship - Captain:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Sandship - Morie Hint:/ })).toBeNull();
    expect(countTrackerProgress(createLogicContext(props.ram, props.manualItems, props.world), props.manual)).toMatchObject({ total: 76, completed: 0 });
  }
});

it("separates the three Sandship display markers through fixed small screen offsets at fit and zoom", () => {
  const props = setup(); props.ram.sandship.supported = true; props.ram.sandship.bossDefeated = true;
  render(<WorldMap {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  const coordinates = (name: RegExp) => {
    const anchor = screen.getByRole("button", { name }).closest<HTMLElement>(".map-anchor")!;
    return { x: parseFloat(anchor.style.left), y: parseFloat(anchor.style.top) };
  };
  for (const zoom of [false, true]) {
    if (zoom) fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const captain = coordinates(/^Sandship - Captain:/), boss = coordinates(/^Sandship Boss:/), hint = coordinates(/^Sandship - Morie Hint:/);
    expect(boss.x - captain.x).toBeCloseTo(48); expect(boss.y - captain.y).toBeCloseTo(-24);
    expect(hint.x - captain.x).toBeCloseTo(56); expect(hint.y - captain.y).toBeCloseTo(0);
    for (const [a, b] of [[captain, boss], [captain, hint], [boss, hint]])
      expect(Math.abs(a.x - b.x) >= 22 || Math.abs(a.y - b.y) >= 22).toBe(true);
  }
});
