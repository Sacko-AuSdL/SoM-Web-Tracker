// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEMENTS, WEAPON_FAMILIES } from "../domain/orbs";
import { CANNON_OFFICE_BY_ID } from "../domain/cannons";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { emptyManualState, emptyRamState } from "../state/trackerState";
import { addCannonConnection, clearCannonConnections, emptyWorldState, removeCannonConnection, replaceCannonConnection, setOrbCleared, setOrbRequirement } from "../state/worldState";
import { inventoryImage, orbRequirementImage } from "./assets";
import { CannonLayer, type CannonAction } from "./CannonLayer";
import { SettingsPanel } from "./SettingsPanel";
import { WorldMap } from "./WorldMap";
import { ItemPanel } from "./ItemPanel";
import { worldToScreen } from "./mapTransform";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Orb inventory icon adapter", () => {
  it.each(ELEMENTS)("reuses %s element icon", (element) => {
    expect(orbRequirementImage({ kind: "element", element })).toBe(inventoryImage(`element-${element}`));
    expect(orbRequirementImage({ kind: "element", element })).toBeTruthy();
  });
  it.each(WEAPON_FAMILIES)("reuses %s weapon icon", (weapon) => {
    expect(orbRequirementImage({ kind: "weapon-family", weapon })).toBe(inventoryImage(`weapon-${weapon}`));
    expect(orbRequirementImage({ kind: "weapon-family", weapon })).toBeTruthy();
  });
  it("has no guessed icon for Unknown", () => expect(orbRequirementImage({ kind: "unknown" })).toBeNull());
  it("shows icon-only blocked/passable/cleared states and offers explicit manual clearing", () => {
    vi.stubGlobal("ResizeObserver", class { constructor(private callback: ResizeObserverCallback) {} observe() { this.callback([{ contentRect: { width: 900, height: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver); } disconnect() {} });
    const ram = emptyRamState();
    const initial = emptyWorldState(); initial.settings.orbMode = "mixed";
    function Harness() {
      const [world, setWorld] = useState(setOrbRequirement(initial, "uf_orb", { kind: "weapon-family", weapon: "axe" }));
      return <WorldMap ram={ram} manual={emptyManualState()} manualItems={new Set()} world={world} onSelectOrb={vi.fn()} onToggleManualCheck={vi.fn()}
        onSetOrbCleared={(id, cleared) => setWorld((s) => setOrbCleared(s, id, cleared))} />;
    }
    const { rerender } = render(<Harness />);
    let orb = screen.getByRole("button", { name: /Upper Land Forest Orb: Axe, blocked/ });
    expect(orb.querySelector("img.orb-requirement")?.getAttribute("alt")).toBe("Axe");
    expect(orb.textContent).toBe("×");
    ram.inventory["weapon-axe"] = true; rerender(<Harness />);
    orb = screen.getByRole("button", { name: /Upper Land Forest Orb: Axe, passable/ });
    expect(orb.className).not.toContain("orb-cleared");
    expect(orb.textContent).toBe("+");
    fireEvent.click(orb);
    fireEvent.click(screen.getByRole("button", { name: "Mark Orb cleared manually" }));
    expect(orb.className).toContain("orb-cleared");
    expect(orb.textContent).toBe("✓");
    ram.inventory["weapon-axe"] = false; rerender(<Harness />);
    expect(orb.getAttribute("aria-label")).toContain("blocked, cleared (manual)");
    fireEvent.click(screen.getByRole("button", { name: "Undo manual cleared mark" }));
    expect(orb.className).not.toContain("orb-cleared");
    ram.orbs.uf_orb = true; rerender(<Harness />);
    expect(orb.getAttribute("aria-label")).toContain("cleared (ram)");
    ram.orbs.uf_orb = false; rerender(<Harness />);
    expect(orb.className).not.toContain("orb-cleared");
  });
});
describe("Settings import controls", () => {
  it("visibly applies imported globals and allows subsequent manual overrides", () => {
    function Harness() {
      const [world, setWorld] = useState(emptyWorldState());
      return <SettingsPanel world={world} sni={{ endpoint: "ws://mock", phase: "disconnected", devices: [], attachedDevice: null, serverInfo: [], error: null }}
        onSelectDevice={vi.fn()} onClose={vi.fn()} dungeonMode="auto" onSetDungeonMode={vi.fn()} onToggleDisabledCharacter={vi.fn()}
        onSetOrbMode={(mode) => setWorld((s) => ({ ...s, settings: { ...s.settings, orbMode: mode } }))}
        onUpdateSetting={(key, value) => setWorld((s) => ({ ...s, settings: { ...s.settings, [key]: value } }))}
        onImportSettings={(parsed) => setWorld((s) => applyRandomizerSettings(s, parsed))} />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Randomizer Settings String"), { target: { value: "version=1.49 mode=open crystalOrbWeaponBreaking=weaponOnly cannonTravelRandomization=open opFlammieDrumInLogic=yes opStartingLocation=kakkara opBoyRole=randomunique" } });
    fireEvent.click(screen.getByRole("button", { name: "Import / Apply" }));
    expect((screen.getByLabelText("Crystal Orbs") as HTMLSelectElement).value).toBe("weapon-only");
    expect((screen.getByLabelText("Cannon Travel") as HTMLSelectElement).value).toBe("open");
    expect((screen.getByLabelText("Starting Location") as HTMLSelectElement).value).toBe("kakkara");
    expect((screen.getByLabelText("boy role") as HTMLSelectElement).value).toBe("random");
    fireEvent.change(screen.getByLabelText("Cannon Travel"), { target: { value: "chaos" } });
    expect((screen.getByLabelText("Cannon Travel") as HTMLSelectElement).value).toBe("chaos");
    fireEvent.change(screen.getByLabelText("Randomizer Settings String"), { target: { value: "cannonTravelRandomization=invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Import / Apply" }));
    expect(screen.getByText(/Unrecognized cannonTravelRandomization/)).toBeDefined();
    expect((screen.getByLabelText("Cannon Travel") as HTMLSelectElement).value).toBe("chaos");
  });
  it("shows random ? and fixed cross-slot overlays without changing character ownership", () => {
    const world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings("version=1.49 mode=open opBoyRole=random opGirlRole=OGsprite"));
    render(<ItemPanel world={world} ram={emptyRamState()} manualItems={new Set()} mode="compact" onSetMode={vi.fn()} onToggleManualItem={vi.fn()} onSetRole={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Boy slot: present/ }).querySelector(".role-overlay")?.getAttribute("data-role")).toBe("unknown");
    expect(screen.getByRole("button", { name: /Girl slot: not present/ }).querySelector(".role-overlay")?.getAttribute("data-role")).toBe("sprite");
    expect(screen.getByRole("button", { name: /Sprite slot: not present/ }).querySelector(".role-overlay")).toBeNull();
  });
});
describe("directed Cannon map editing", () => {
  it("route inspection dismisses gameplay hover and pinned popups before a route click", () => {
    vi.stubGlobal("ResizeObserver", class { constructor(private callback: ResizeObserverCallback) {} observe() { this.callback([{ contentRect: { width: 800, height: 370 } } as ResizeObserverEntry], this as unknown as ResizeObserver); } disconnect() {} });
    const world = addCannonConnection(emptyWorldState(), { from: "kakkara", to: "waterPalace" }); world.settings.cannonMode = "shuffle";
    const action = vi.fn();
    render(<WorldMap world={world} ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()} onSelectOrb={vi.fn()} onToggleManualCheck={vi.fn()} onCannonAction={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Cannons ○" }));
    const orb = screen.getByRole("button", { name: /Upper Land Forest Orb:/ });
    fireEvent.mouseEnter(orb); fireEvent.click(orb);
    expect(screen.getByRole("heading", { name: "Upper Land Forest Orb" })).toBeDefined();
    const route = screen.getByRole("button", { name: "Cannon route Kakkara to Water Palace" });
    fireEvent.focus(route);
    expect(screen.queryByRole("heading", { name: "Upper Land Forest Orb" })).toBeNull();
    fireEvent.click(route);
    expect(action).toHaveBeenCalledWith({ kind: "remove", id: "kakkara:waterPalace" });
  });
  it("makes gameplay markers passive only during Cannon editing so they cannot intercept route clicks", () => {
    vi.stubGlobal("ResizeObserver", class { constructor(private callback: ResizeObserverCallback) {} observe() { this.callback([{ contentRect: { width: 800, height: 370 } } as ResizeObserverEntry], this as unknown as ResizeObserver); } disconnect() {} });
    const world = emptyWorldState(); world.settings.cannonMode = "shuffle";
    render(<WorldMap world={world} ram={emptyRamState()} manual={emptyManualState()} manualItems={new Set()} onSelectOrb={vi.fn()} onToggleManualCheck={vi.fn()} onCannonAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Potos: reachable/ }));
    expect(screen.getByRole("heading", { name: "Potos" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cannons ○" }));
    expect(screen.queryByRole("button", { name: "Edit Cannons" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Potos Cannon Office" }));
    expect(screen.queryByRole("heading", { name: "Potos" })).toBeNull();
    expect(document.querySelector(".orb-anchor")?.hasAttribute("inert")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Add route" }));
    expect(document.querySelector(".orb-anchor")?.hasAttribute("inert")).toBe(true);
    expect(document.querySelector(".cannon-anchor")?.hasAttribute("inert")).toBe(false);
    expect(document.querySelector(".map-viewport .cannon-status")).toBeNull();
    expect(document.querySelector(".map-footnote .cannon-status")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".orb-anchor")?.hasAttribute("inert")).toBe(false);
  });
  it("adds and replaces locally, then directly removes routes without adding reverse edges or footer controls", () => {
    const initial = emptyWorldState(); initial.settings.cannonMode = "shuffle";
    const actions: CannonAction[] = [];
    function Harness() {
      const [world, setWorld] = useState(initial);
      return <CannonLayer world={world} view={{ scale: 0.2, x: 0, y: 0 }} onAction={(action) => {
        actions.push(action);
        setWorld((s) => action.kind === "add" ? addCannonConnection(s, action.edge) : action.kind === "remove" ? removeCannonConnection(s, action.id) : action.kind === "replace" ? replaceCannonConnection(s, action.id, action.edge) : clearCannonConnections(s));
      }} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    fireEvent.click(screen.getByRole("button", { name: "Add route" }));
    fireEvent.click(screen.getByRole("button", { name: "Ice Country Cannon Office" }));
    expect(screen.getByRole("button", { name: "Cannon route Kakkara to Ice Country" })).toBeDefined();
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(1);
    expect(actions[0]).toEqual({ kind: "add", edge: { from: "kakkara", to: "iceCountry" } });
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace route to Ice Country" }));
    expect(screen.queryByRole("region", { name: "Kakkara Cannon controls" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Water Palace Cannon Landing" }));
    expect(screen.queryByRole("button", { name: "Cannon route Kakkara to Ice Country" })).toBeNull();
    const route = screen.getByRole("button", { name: "Cannon route Kakkara to Water Palace" });
    fireEvent.keyDown(route, { key: "Enter" });
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Potos Cannon Office" }));
    fireEvent.click(screen.getByRole("button", { name: "Add route" }));
    fireEvent.click(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    fireEvent.click(screen.getByRole("button", { name: "Cannon route Potos to Kakkara" }));
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(0);
    expect(document.querySelector(".cannon-status button")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear seed network" })).toBeNull();
    expect(actions.map((a) => a.kind)).toEqual(["add", "replace", "remove", "add", "remove"]);
  });
  it("uses the shared map transform for pins and arrow endpoints on pan and zoom", () => {
    const world = addCannonConnection(emptyWorldState(), { from: "kakkara", to: "iceCountry" }); world.settings.cannonMode = "chaos";
    let view = { scale: 0.2, x: 0, y: 0 };
    const { rerender } = render(<CannonLayer world={world} view={view} onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    const line = document.querySelector(".cannon-line")!;
    const x = Number(line.getAttribute("x1")), y = Number(line.getAttribute("y1"));
    view = { ...view, x: 55, y: -21 };
    rerender(<CannonLayer world={world} view={view} onAction={vi.fn()} />);
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(x + 55);
    expect(Number(line.getAttribute("y1"))).toBeCloseTo(y - 21);
    view = { scale: 0.5, x: 55, y: -21 };
    rerender(<CannonLayer world={world} view={view} onAction={vi.fn()} />);
    const point = CANNON_OFFICE_BY_ID.get("kakkara")!, transformed = worldToScreen(view, point.x, point.y, 18, 16);
    const pin = screen.getByRole("button", { name: "Kakkara Cannon Office" }).parentElement!;
    expect(Number.parseFloat(pin.style.left)).toBeCloseTo(transformed.left);
    expect(Number.parseFloat(pin.style.top)).toBeCloseTo(transformed.top);
    expect(Math.hypot(Number(line.getAttribute("x1")) - transformed.left, Number(line.getAttribute("y1")) - transformed.top)).toBeCloseTo(13);
    expect(line.getAttribute("marker-end")).toMatch(/url\(#cannon-arrow-/);
  });
  it("keeps Open's network in logic without route visualization or selection UI", () => {
    const world = emptyWorldState(); world.settings.cannonMode = "open";
    render(<CannonLayer world={world} view={{ scale: 0.2, x: 0, y: 0 }} onAction={vi.fn()} />);
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Potos Cannon Office" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear seed network" })).toBeNull();
  });
});
