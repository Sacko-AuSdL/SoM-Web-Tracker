// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CANNON_OFFICE_BY_ID, type CannonPoint } from "../domain/cannons";
import { MAP_AREAS } from "../data/mapAreas";
import { addCannonConnection, clearCannonConnections, emptyWorldState, removeCannonConnection, setCannonOfficeClosed } from "../state/worldState";
import { CannonLayer } from "./CannonLayer";
import { SettingsPanel } from "./SettingsPanel";
import { cannonToScreen, worldToScreen } from "./mapTransform";

afterEach(cleanup);
describe("office-local Cannon release polish", () => {
  it("cancels replacing on Escape or source re-click without changing the original edge", () => {
    const world = addCannonConnection(emptyWorldState(), { from: "kakkara", to: "iceCountry" });
    world.settings.cannonMode = "shuffle"; const onAction = vi.fn();
    render(<CannonLayer world={world} view={{ scale: .1, x: 0, y: 0 }} onAction={onAction} />);
    const office = screen.getByRole("button", { name: "Kakkara Cannon Office" });
    fireEvent.mouseEnter(office);
    fireEvent.click(screen.getByRole("button", { name: "Replace route to Ice Country" }));
    expect(office.className).toContain("source");
    expect(screen.queryByRole("region")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Cannon route Kakkara to Ice Country" })).toBeDefined();
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(office); fireEvent.click(office);
    expect(document.querySelector(".cannon-pin.source")).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });
  it("exposes the three inventory layouts and a collapsed marker legend in Settings, not the map", () => {
    const onSetInventoryMode = vi.fn();
    render(<SettingsPanel world={emptyWorldState()} sni={{ endpoint: "ws://mock", phase: "disconnected", devices: [], attachedDevice: null, serverInfo: [], error: null }}
      onSelectDevice={vi.fn()} onClose={vi.fn()} dungeonMode="auto" onSetDungeonMode={vi.fn()} onToggleDisabledCharacter={vi.fn()}
      onSetOrbMode={vi.fn()} onUpdateSetting={vi.fn()} onImportSettings={vi.fn()} inventoryMode="compact" onSetInventoryMode={onSetInventoryMode} />);
    const select = screen.getByRole("combobox", { name: "Inventory Layout" });
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Normal", "Compact", "Square"]);
    fireEvent.change(select, { target: { value: "square" } });
    expect(onSetInventoryMode).toHaveBeenCalledWith("square");
    const legend = screen.getByText("Map marker legend").closest("details")!;
    expect(legend.hasAttribute("open")).toBe(false);
    for (const color of ["Green square", "Dark red square", "Grey square", "Amber square"]) expect(legend.textContent).toContain(color);
    expect(legend.textContent).not.toMatch(/[+×✓?◐]/);
    expect(legend.closest(".settings-dialog")).not.toBeNull();
  });
  it("direct click removes exactly that directed route, preserving its reverse and unrelated routes", () => {
    function Harness() {
      const [world, setWorld] = useState(() => {
        let s = emptyWorldState(); s.settings.cannonMode = "shuffle";
        for (const edge of [{ from: "potos", to: "kakkara" }, { from: "kakkara", to: "potos" }, { from: "matango", to: "iceCountry" }] as const)
          s = addCannonConnection(s, edge);
        return s;
      });
      return <CannonLayer world={world} view={{ scale: .1, x: 0, y: 0 }} onAction={(a) => {
        if (a.kind === "remove") setWorld((s) => removeCannonConnection(s, a.id));
      }} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cannon route Potos to Kakkara" }));
    expect(screen.queryByRole("button", { name: "Cannon route Potos to Kakkara" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cannon route Kakkara to Potos" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cannon route Matango to Ice Country" })).toBeDefined();
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(2);
  });
  it("opens a compact hover popup, retains it across its controls and supports local cancel and removal", () => {
    const world = addCannonConnection(emptyWorldState(), { from: "kakkara", to: "iceCountry" });
    world.settings.cannonMode = "chaos";
    const onAction = vi.fn();
    render(<CannonLayer world={world} view={{ scale: .08, x: 0, y: 0 }} viewportSize={{ width: 420, height: 330 }} onAction={onAction} />);
    const office = screen.getByRole("button", { name: "Kakkara Cannon Office" });
    fireEvent.mouseEnter(office);
    let popup = screen.getByRole("region", { name: "Kakkara Cannon controls" });
    expect(screen.queryByRole("button", { name: "Add route" })).toBeNull();
    expect(office.querySelector("svg.cannon-symbol")).not.toBeNull();
    fireEvent.mouseEnter(popup);
    fireEvent.click(office);
    expect(screen.queryByRole("region", { name: "Kakkara Cannon controls" })).toBeNull();
    expect(document.querySelectorAll(".cannon-pin.target")).toHaveLength(8);
    expect((office as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Cannon route" }));
    fireEvent.mouseEnter(office);
    popup = screen.getByRole("region", { name: "Kakkara Cannon controls" });
    expect(within(popup).queryByRole("combobox")).toBeNull();
    fireEvent.click(within(popup).getByRole("button", { name: "Remove route to Ice Country" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "remove", id: "kakkara:iceCountry" });
    expect(document.querySelector(".cannon-status button")).toBeNull();
    const position = office.parentElement!.style;
    const left = Number.parseFloat(position.left) - 11 + Number.parseFloat(popup.style.left);
    const top = Number.parseFloat(position.top) - 11 + Number.parseFloat(popup.style.top);
    expect(left).toBeGreaterThanOrEqual(4);
    expect(left + Number.parseFloat(popup.style.width)).toBeLessThanOrEqual(416);
    expect(top).toBeGreaterThanOrEqual(4);
    expect(top + Number.parseFloat(popup.style.maxHeight)).toBeLessThanOrEqual(326);
  });
  it("keeps clear-network in a collapsed Settings fallback and preserves Closed marks", () => {
    function Harness() {
      const [world, setWorld] = useState(() => {
        const s = setCannonOfficeClosed(addCannonConnection(emptyWorldState(), { from: "potos", to: "kakkara" }), "potos", true);
        s.settings.cannonMode = "chaos"; return s;
      });
      return <>
        <SettingsPanel world={world} sni={{ endpoint: "ws://mock", phase: "disconnected", devices: [], attachedDevice: null, serverInfo: [], error: null }}
          onSelectDevice={vi.fn()} onClose={vi.fn()} dungeonMode="auto" onSetDungeonMode={vi.fn()} onToggleDisabledCharacter={vi.fn()}
          onSetOrbMode={vi.fn()} onUpdateSetting={vi.fn()} onImportSettings={vi.fn()} onClearCannonNetwork={() => setWorld((s) => clearCannonConnections(s))} />
        <CannonLayer world={world} view={{ scale: .1, x: 0, y: 0 }} onAction={vi.fn()} />
      </>;
    }
    render(<Harness />);
    expect(document.querySelector(".cannon-network-settings")?.hasAttribute("open")).toBe(false);
    const clear = screen.getByText("Clear seed network", { selector: "button" });
    expect(clear.closest(".settings-dialog")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/Warrior|Light Mage|Dark Mage/);
    fireEvent.click(clear);
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Potos Cannon Office" }).getAttribute("data-office-state")).toBe("closed");
    expect((clear as HTMLButtonElement).disabled).toBe(true);
  });
  it("bottom-aligns a short Gaia popup to its office instead of leaving a hover gap", () => {
    const world = emptyWorldState(); world.settings.cannonMode = "chaos";
    render(<CannonLayer world={world} view={{ scale: .08, x: 100, y: 0 }} viewportSize={{ width: 700, height: 330 }} onAction={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Gaia's Navel Cannon Office" }));
    const popup = screen.getByRole("region", { name: "Gaia's Navel Cannon controls" });
    expect(popup.style.top).toBe("auto");
    expect(popup.style.bottom).toBe("0px");
    expect(popup.style.maxHeight).toBe("230px");
  });
  it("moves Gaia left and separates Doppelganger from Dark Palace at zoomed-out desktop and compact scales", () => {
    for (const scale of [.08, .12]) {
      const view = { scale, x: 140, y: 0 };
      const office: CannonPoint = CANNON_OFFICE_BY_ID.get("gaiasNavel")!;
      const pin = cannonToScreen(view, office);
      const old = worldToScreen(view, 0x7f * 16, office.y, 18, 16);
      expect(pin.left).toBeLessThan(old.left - 8);
      expect(pin.left - 10).toBeGreaterThan(0);
      expect(pin.top - 10).toBeGreaterThan(0);
      const gaia = MAP_AREAS.find((area) => area.id === "gaia-s-navel")!;
      const gaiaPin = worldToScreen(view, gaia.x, gaia.y);
      expect(Math.hypot(pin.left - gaiaPin.left, pin.top - gaiaPin.top)).toBeGreaterThan(22);
      const joch = MAP_AREAS.find((area) => area.id === "lofty-mountains-joch-s-cave")!;
      const dark = MAP_AREAS.find((area) => area.id === "lofty-mountains-palace-of-darkness")!;
      const jochPin = worldToScreen(view, joch.x, joch.y, joch.screenOffset?.x, joch.screenOffset?.y);
      const darkPin = worldToScreen(view, dark.x, dark.y);
      expect(jochPin.left - darkPin.left).toBeGreaterThanOrEqual(24);
    }
  });
});
