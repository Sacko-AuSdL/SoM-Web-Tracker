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
it("shows Morie blocked before victory, enables manual read afterwards, and preserves its mark through rollback", () => {
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
  fireEvent.click(screen.getByRole("button", { name: /^Sandship - Captain: reachable/ }));
  const captain = screen.getByRole("button", { name: "Sandship - Captain" });
  expect(captain.classList.contains("reachable")).toBe(true);
  expect(captain.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByText(/Boss: not defeated/)).toBeDefined();
  expect(screen.getByRole("button", { name: /Sandship - Morie Hint:.*blocked/ }).classList.contains("hint-blocked")).toBe(true);
  ram.sandship.bossDefeated = true;
  rerender(<WorldMap {...props()} />);
  expect(screen.getByRole("button", { name: "Sandship - Captain" }).classList.contains("reachable")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Sandship - Morie Hint:/ }));
  fireEvent.click(screen.getByRole("button", { name: "Mark hint read" }));
  expect(onSetHintRead).toHaveBeenCalledWith(SANDSHIP.hintId, true);
  world = setHintRead(world, SANDSHIP.hintId, true);
  rerender(<WorldMap {...props()} />);
  expect(screen.getByRole("button", { name: "Mark hint unread" }).getAttribute("aria-pressed")).toBe("true");
  expect(countTrackerProgress(createLogicContext(ram, new Set(), world), emptyManualState())).toMatchObject({ total: 77, completed: 0 });
  ram.sandship.bossDefeated = false;
  rerender(<WorldMap {...props()} />);
  expect(screen.getByRole("button", { name: /Sandship - Morie Hint:.*blocked/ }).classList.contains("hint-blocked")).toBe(true);
  expect(screen.getByText("Hint unavailable: defeat the Sandship boss first")).toBeDefined();
  const unread = screen.getByRole("button", { name: "Mark hint unread" }) as HTMLButtonElement;
  expect(unread.disabled).toBe(false);
  fireEvent.click(unread);
  expect(onSetHintRead).toHaveBeenLastCalledWith(SANDSHIP.hintId, false);
  expect(world.manualReadHints).toEqual([SANDSHIP.hintId]);
  expect([...document.querySelectorAll(".map-pin")].every((pin) => pin.textContent === "" && pin.children.length === 0)).toBe(true);
});

it.each([null, false, true] as const)("boss state %s gates Morie's availability, not Captain reachability or prize completion", (bossDefeated) => {
  const props = setup(); props.ram.sandship.supported = true;
  props.ram.sandship.bossDefeated = bossDefeated; props.ram.checks[SANDSHIP.captainId] = false;
  render(<WorldMap {...props} />);
  expect(screen.queryByRole("button", { name: /^Sandship Boss:/ })).toBeNull();
  const captain = screen.getByRole("button", { name: /^Sandship - Captain:/ });
  expect(captain.classList.contains("pin-reachable")).toBe(true);
  expect(captain.classList.contains("pin-completed")).toBe(false);
  expect(document.querySelectorAll('.map-pin[title^="Sandship"]')).toHaveLength(1);
  expect(countTrackerProgress(createLogicContext(props.ram, props.manualItems, props.world), props.manual)).toMatchObject({ total: 77, completed: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  const availability = bossDefeated === null ? "unknown" : bossDefeated ? "available" : "blocked";
  const morie = screen.getByRole("button", { name: new RegExp(`^Sandship - Morie Hint:.*${availability}$`) });
  expect(morie.classList.contains(`hint-${availability}`)).toBe(true);
  fireEvent.click(morie);
  const read = screen.getByRole("button", { name: "Mark hint read" }) as HTMLButtonElement;
  expect(read.disabled).toBe(bossDefeated !== true);
  if (bossDefeated === true) expect(screen.getByText("Hint available here")).toBeDefined();
  else {
    expect(screen.queryByText("Hint available here")).toBeNull();
    expect(screen.getByText(bossDefeated === false ? "Hint unavailable: defeat the Sandship boss first" : "Hint availability unknown: boss state unavailable")).toBeDefined();
    fireEvent.click(read);
    expect(props.onSetHintRead).not.toHaveBeenCalled();
  }
  expect(props.onToggleManualCheck).not.toHaveBeenCalled();
});

it("keeps Captain green through the boss fight, greys only on prize collection, and follows rollback and travel", () => {
  const props = setup(); props.ram.sandship.supported = true;
  props.ram.sandship.bossDefeated = false; props.ram.sandship.bossFlagValue = 0x0e;
  props.ram.checks[SANDSHIP.captainId] = false;
  const { rerender } = render(<WorldMap {...props} />);
  const pin = () => screen.getByRole("button", { name: /^Sandship - Captain:/ });
  expect(pin().classList.contains("pin-reachable")).toBe(true);
  props.ram.sandship.bossDefeated = true; props.ram.sandship.bossFlagValue = 0x0f;
  rerender(<WorldMap {...props} />);
  expect(pin().classList.contains("pin-reachable")).toBe(true);
  expect(pin().getAttribute("aria-label")).toContain("0 of 1 complete");
  props.ram.checks[SANDSHIP.captainId] = true;
  rerender(<WorldMap {...props} />);
  expect(pin().classList.contains("pin-completed")).toBe(true);
  props.ram.checks[SANDSHIP.captainId] = false;
  rerender(<WorldMap {...props} />);
  expect(pin().classList.contains("pin-reachable")).toBe(true);
  props.ram.sandship.bossDefeated = false; props.ram.sandship.bossFlagValue = 0x0e;
  rerender(<WorldMap {...props} />);
  expect(pin().classList.contains("pin-reachable")).toBe(true);
  props.world.settings.startingLocation = "default"; props.world.settings.cannonMode = "shuffle";
  rerender(<WorldMap {...props} />);
  expect(pin().classList.contains("pin-unreachable")).toBe(true);
});

it("keeps boss RAM rollback independent from Captain RAM and persistent manual completion", () => {
  const props = setup(); props.ram.sandship.supported = true; props.ram.sandship.bossDefeated = false;
  props.ram.checks[SANDSHIP.captainId] = true;
  const { rerender } = render(<WorldMap {...props} />);
  expect(screen.getByRole("button", { name: /^Sandship - Captain: completed/ })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  expect(screen.getByRole("button", { name: /^Sandship - Morie Hint:.*blocked/ })).toBeDefined();
  props.ram.checks[SANDSHIP.captainId] = false;
  props.manual = setManualCompletion(props.manual, SANDSHIP.captainId, true);
  props.ram.sandship.bossDefeated = true;
  rerender(<WorldMap {...props} />);
  expect(screen.getByRole("button", { name: /^Sandship - Morie Hint:.*available/ })).toBeDefined();
  props.ram.sandship.bossDefeated = false;
  rerender(<WorldMap {...props} />);
  expect(screen.getByRole("button", { name: /^Sandship - Morie Hint:.*blocked/ })).toBeDefined();
  expect(screen.queryByRole("button", { name: /^Sandship Boss:/ })).toBeNull();
  expect(screen.getByRole("button", { name: /^Sandship - Captain: completed/ })).toBeDefined();
  expect(countTrackerProgress(createLogicContext(props.ram, props.manualItems, props.world), props.manual)).toMatchObject({ total: 77, completed: 1 });
});

it("gates Morie visibility only on the Hints layer and compatibility, and hides unsupported or undetected Sandship", () => {
  const props = setup(); props.ram.sandship.supported = true; props.ram.sandship.bossDefeated = false;
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

it("separates only Captain and Morie through small display offsets at fit and zoom", () => {
  const props = setup(); props.ram.sandship.supported = true; props.ram.sandship.bossDefeated = false;
  render(<WorldMap {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  const coordinates = (name: RegExp) => {
    const anchor = screen.getByRole("button", { name }).closest<HTMLElement>(".map-anchor")!;
    return { x: parseFloat(anchor.style.left), y: parseFloat(anchor.style.top) };
  };
  for (const zoom of [false, true]) {
    if (zoom) fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const captain = coordinates(/^Sandship - Captain:/), hint = coordinates(/^Sandship - Morie Hint:/);
    expect(hint.x - captain.x).toBeCloseTo(56); expect(hint.y - captain.y).toBeCloseTo(0);
    expect(Math.abs(hint.x - captain.x)).toBeGreaterThanOrEqual(22);
    expect(screen.queryByRole("button", { name: /^Sandship Boss:/ })).toBeNull();
  }
});
