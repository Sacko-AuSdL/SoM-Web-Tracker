// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryId } from "../data/inventoryDefinitions";
import { emptyManualState, emptyRamState, setManualCompletion } from "../state/trackerState";
import { emptyWorldState, setOrbRequirement, setRoleIdentity } from "../state/worldState";
import { ItemPanel } from "./ItemPanel";
import { WorldMap } from "./WorldMap";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setupResizeObserver() {
  class ResizeObserverMock {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() { this.callback([{ contentRect: { width: 900, height: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}

describe("map-first interaction", () => {
  it("shows area checks on hover and toggles permanent completion in the popup", () => {
    setupResizeObserver();
    const ram = emptyRamState();
    ram.checks["potos-chest"] = false;
    function Harness() {
      const [manual, setManual] = useState(emptyManualState());
      return <WorldMap ram={ram} manual={manual} manualItems={new Set()} world={emptyWorldState()}
        onSelectOrb={vi.fn()} onToggleManualCheck={(id) =>
          setManual((current) => setManualCompletion(current, id, !current.manualCompletedChecks.includes(id)))} />;
    }
    render(<Harness />);
    const pin = screen.getByRole("button", { name: /Potos: .*0 of 2 complete/ });
    fireEvent.mouseEnter(pin.parentElement!);
    expect(screen.getByRole("heading", { name: "Potos" })).toBeDefined();
    const chest = screen.getByRole("button", { name: "Potos Chest" });
    fireEvent.click(chest);
    expect(screen.getByRole("button", { name: /Potos: .*1 of 2 complete/ })).toBeDefined();
    expect(chest.getAttribute("aria-pressed")).toBe("true");
    expect(ram.checks["potos-chest"]).toBe(false);
    fireEvent.click(chest);
    expect(screen.getByRole("button", { name: /Potos: .*0 of 2 complete/ })).toBeDefined();
  });

  it("zooms and exposes mode-specific orb choices with a two-click picker", () => {
    setupResizeObserver();
    const world = emptyWorldState();
    world.settings.orbMode = "mixed";
    function Harness() {
      const [state, setState] = useState(world);
      return <WorldMap ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()}
        world={state} onToggleManualCheck={vi.fn()}
        onSelectOrb={(id, requirement) => setState((current) => setOrbRequirement(current, id, requirement))} />;
    }
    render(<Harness />);
    const image = screen.getByRole("img", { name: "Secret of Mana overworld" });
    const fitWidth = Number.parseFloat(image.style.width);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(Number.parseFloat(image.style.width)).toBeGreaterThan(fitWidth);
    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    expect(Number.parseFloat(image.style.width)).toBe(fitWidth);
    fireEvent.click(screen.getByRole("button", { name: /Upper Land.*Orb: \?/i }));
    fireEvent.click(screen.getByRole("button", { name: "Axe" }));
    expect(screen.getByRole("button", { name: /Upper Land.*Orb: Axe, blocked/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
    expect(screen.getByRole("button", { name: /Potos.*hint sources/i })).toBeDefined();
    expect(screen.queryByText(/Flammie is in Pandora/i)).toBeNull();
  });
  it("keeps compact pins semantic and distinct in reachable, unreachable, unknown and complete states", () => {
    setupResizeObserver();
    const world = emptyWorldState();
    const ram = emptyRamState();
    const { rerender } = render(<WorldMap ram={ram} manual={emptyManualState()} manualItems={new Set()}
      world={world} onToggleManualCheck={vi.fn()} onSelectOrb={vi.fn()} />);
    const potos = screen.getByRole("button", { name: /Potos: reachable/ });
    expect(potos.className).toContain("pin-reachable");
    expect(screen.getByRole("button", { name: /Elinee's Castle: unreachable/ }).className).toContain("pin-unreachable");
    expect(screen.getByRole("button", { name: /Fire Palace: unknown/ }).className).toContain("pin-unknown");
    expect(potos.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    const completed = setManualCompletion(setManualCompletion(emptyManualState(), "potos-chest", true), "mantis-ant", true);
    rerender(<WorldMap ram={ram} manual={completed} manualItems={new Set()}
      world={world} onToggleManualCheck={vi.fn()} onSelectOrb={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Potos: completed/ }).className).toContain("pin-completed");
    expect(screen.getByRole("button", { name: /Potos: completed/ }).textContent).toBe("✓");
  });
  it("embeds unknown uncertainty inside the Orb sprite rather than a dangling requirement label", () => {
    setupResizeObserver();
    const { rerender } = render(<WorldMap ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()}
      world={emptyWorldState()} onToggleManualCheck={vi.fn()} onSelectOrb={vi.fn()} />);
    const orb = screen.getByRole("button", { name: /Upper Land Forest Orb: \?, unknown/ });
    expect(orb.querySelector(".orb-sprite .orb-uncertainty")?.textContent).toBe("?");
    expect(orb.querySelector(".orb-requirement")).toBeNull();
    const known = setOrbRequirement(emptyWorldState(), "uf_orb", { kind: "element", element: "gnome" });
    rerender(<WorldMap ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()}
      world={known} onToggleManualCheck={vi.fn()} onSelectOrb={vi.fn()} />);
    const selected = screen.getByRole("button", { name: /Upper Land Forest Orb: Gnome/ });
    expect(selected.querySelector(".orb-uncertainty")).toBeNull();
    expect(selected.querySelector(".orb-requirement")).not.toBeNull();
  });
  it("caps lower-map popup height at the remaining viewport space so long check lists scroll inside it", () => {
    setupResizeObserver();
    render(<WorldMap ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()}
      world={emptyWorldState()} onToggleManualCheck={vi.fn()} onSelectOrb={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Gaia's Navel: partial/ }));
    expect((document.querySelector(".map-popover") as HTMLElement).style.maxHeight).toBe("276px");
    expect(screen.getByRole("button", { name: "Dwarf Elder" })).toBeDefined();
  });
  it("shows source identities through regional scroll hints without changing reachability or completion", () => {
    setupResizeObserver();
    const toggleCheck = vi.fn(), selectOrb = vi.fn();
    render(<WorldMap ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()}
      world={emptyWorldState()} onToggleManualCheck={toggleCheck} onSelectOrb={selectOrb} />);
    const areaStates = () => [...document.querySelectorAll(".map-pin")].map((pin) => pin.getAttribute("aria-label"));
    const before = areaStates();
    expect(document.querySelectorAll(".hint-pin")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Hints ○" }));
    expect(document.querySelectorAll(".hint-pin .hint-scroll")).toHaveLength(7);
    fireEvent.focus(screen.getByRole("button", { name: /Potos Area Hints: 6 hint sources/ }));
    expect(screen.getByText("Potos Elder Hint").getAttribute("data-source-id")).toBe("potos-area-hints:0");
    expect(screen.getByText("Hint available here")).toBeDefined();
    expect(screen.getByText(/Regional position;/)).toBeDefined();
    expect(areaStates()).toEqual(before);
    expect(toggleCheck).not.toHaveBeenCalled();
    expect(selectOrb).not.toHaveBeenCalled();
  });
});

describe("randomized character role overlay", () => {
  it("uses only Unknown, Boy, Girl and Sprite role labels without changing RAM presence", () => {
    const ram = emptyRamState();
    ram.inventory.boy = true;
    const initial = emptyWorldState();
    initial.settings.roleModeBySlot = { boy: "random" };
    const togglePresence = vi.fn();
    function Harness() {
      const [world, setWorld] = useState(initial);
      return <ItemPanel ram={ram} manualItems={new Set()} world={world} mode="compact" onSetMode={vi.fn()}
        onToggleManualItem={togglePresence}
        onSetRole={(slot, role) => setWorld((current) => setRoleIdentity(current, slot, role))} />;
    }
    render(<Harness />);
    const boy = screen.getByRole("button", { name: /Boy slot: present; Auto.*Unknown/ });
    const baseImage = boy.querySelector(".item-icon")?.getAttribute("src");
    expect(boy.querySelector(".role-overlay")?.getAttribute("data-role")).toBe("unknown");
    expect(screen.getByRole("button", { name: /Girl slot: not present/ }).querySelector(".role-overlay")).toBeNull();
    fireEvent.click(boy);
    expect(togglePresence).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/Warrior|Light Mage|Dark Mage/);
    fireEvent.click(screen.getByRole("button", { name: "Sprite" }));
    expect(boy.querySelector(".role-overlay")?.getAttribute("data-role")).toBe("sprite");
    expect(boy.querySelector(".item-icon")?.getAttribute("src")).toBe(baseImage);
    expect(ram.inventory.boy).toBe(true);
    expect(screen.getByRole("button", { name: /Girl slot: not present/ }).querySelector(".role-overlay")).toBeNull();
    fireEvent.click(boy);
    fireEvent.click(screen.getByRole("button", { name: "Unknown (?)" }));
    expect(boy.querySelector(".role-overlay")?.getAttribute("data-role")).toBe("unknown");
  });
  it("does not turn a not-present randomized slot into an owned character when a role is selected", () => {
    const ram = emptyRamState();
    ram.inventory.sprite = false;
    const initial = emptyWorldState();
    initial.settings.roleMode = "random";
    function Harness() {
      const [world, setWorld] = useState(initial);
      return <ItemPanel ram={ram} manualItems={new Set()} world={world} mode="normal" onSetMode={vi.fn()}
        onToggleManualItem={vi.fn()}
        onSetRole={(slot, role) => setWorld((current) => setRoleIdentity(current, slot, role))} />;
    }
    render(<Harness />);
    const sprite = screen.getByRole("button", { name: /Sprite slot: not present; Missing/ });
    fireEvent.click(sprite);
    fireEvent.click(screen.getByRole("button", { name: "Boy" }));
    expect(sprite.getAttribute("aria-label")).toContain("not present");
    expect(sprite.querySelector(".role-overlay")?.getAttribute("data-role")).toBe("boy");
    expect(ram.inventory.sprite).toBe(false);
  });
});

describe("compact inventory", () => {
  it("switches Normal/Compact without changing inventory or world state", () => {
    const ram = emptyRamState();
    const world = emptyWorldState();
    function Harness() {
      const [mode, setMode] = useState<"normal" | "compact" | "square">("normal");
      return <ItemPanel ram={ram} manualItems={new Set()} world={world} mode={mode}
        onSetMode={setMode} onSetRole={vi.fn()} onToggleManualItem={vi.fn()} />;
    }
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Normal inventory" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Compact inventory" }));
    expect(screen.getByRole("button", { name: "Compact inventory" }).getAttribute("aria-pressed")).toBe("true");
    expect(ram.inventory["weapon-spear"]).toBeNull();
    expect(world.orbs.uf_orb).toEqual({ kind: "unknown" });
  });
  it("shows weapon orb stage on the weapon icon and keeps manual marks session-only", () => {
    const ram = emptyRamState();
    ram.inventory["weapon-spear"] = true;
    ram.inventory["weapon-orbs-spear"] = 3;
    ram.inventory["midge-mallet"] = false;
    function Harness() {
      const [manual, setManual] = useState<ReadonlySet<InventoryId>>(() => new Set());
      return <ItemPanel ram={ram} manualItems={manual} world={emptyWorldState()} mode="normal" onSetMode={vi.fn()} onSetRole={vi.fn()}
        onToggleManualItem={(id) => setManual((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        })} />;
    }
    render(<Harness />);
    const spear = screen.getByRole("button", { name: /Spear: acquired; Auto/ });
    expect(spear.textContent).toContain("3");
    fireEvent.click(screen.getByRole("button", { name: /Midge Mallet: not acquired; Missing/ }));
    expect(screen.getByRole("button", { name: /Midge Mallet: acquired; Manual/ })).toBeDefined();
    expect(ram.inventory["midge-mallet"]).toBe(false);
  });
});
