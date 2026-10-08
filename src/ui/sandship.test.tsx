// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorldMap } from "./WorldMap";
import { SANDSHIP } from "../data/sandship";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { emptyWorldState, setHintRead } from "../state/worldState";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("hides unsupported Sandship, exposes its pre-boss popup, and gives Morie separate read controls after victory", () => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 800, height: 370 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  const ram = emptyRamState(); let world = emptyWorldState(); world.settings.startingLocation = "kakkara";
  world.settings.drumLogic = "random";
  const onSetHintRead = vi.fn();
  const props = () => ({ world, ram, manual: emptyManualState(), manualItems: new Set<never>(),
    onToggleManualCheck: vi.fn(), onSelectOrb: vi.fn(), onSetHintRead });
  const { rerender } = render(<WorldMap {...props()} />);
  fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
  expect(screen.queryByRole("button", { name: /^Sandship:/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Sandship - Morie Hint:/ })).toBeNull();
  ram.sandship.supported = true; ram.sandship.bossDefeated = false;
  rerender(<WorldMap {...props()} />);
  fireEvent.click(screen.getByRole("button", { name: /^Sandship: reachable/ }));
  const captain = screen.getByRole("button", { name: "Sandship - Captain" });
  expect(captain.className).toContain("unreachable");
  expect(captain.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByText(/Boss: not defeated/)).toBeDefined();
  expect(screen.queryByRole("button", { name: /Sandship - Morie Hint:/ })).toBeNull();
  ram.sandship.bossDefeated = true;
  rerender(<WorldMap {...props()} />);
  expect(screen.getByRole("button", { name: "Sandship - Captain" }).className).toContain("reachable");
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
