// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemPanel } from "./ItemPanel";
import { CannonLayer } from "./CannonLayer";
import { cannonToScreen, worldToScreen } from "./mapTransform";
import { emptyWorldState } from "../state/worldState";
import { emptyRamState } from "../state/trackerState";
import { CANNON_OFFICE_BY_ID } from "../domain/cannons";
import { ORB_DISPLAY_OFFSET } from "../data/orbLayout";
import { ORB_SOURCE_DEFINITIONS } from "../data/sourceWorldData";
import { MAP_AREAS } from "../data/mapAreas";
import { LOCATION_BY_ID } from "../data/locationDefinitions";
import type { InventoryMode } from "../state/uiPreferences";
import { HINT_MAP_MARKERS } from "../data/hintMarkers";

afterEach(cleanup);
describe("pre-release inventory layouts", () => {
  it.each(["normal", "compact", "square"] as const)("renders all five sections in %s without Crystal Orbs", (mode) => {
    render(<ItemPanel mode={mode} onSetMode={vi.fn()} world={emptyWorldState()} ram={emptyRamState()}
      manualItems={new Set()} onToggleManualItem={vi.fn()} onSetRole={vi.fn()} />);
    for (const name of ["Characters", "Elements", "Weapons", "Key items", "Mana seeds"])
      expect(screen.getByRole("region", { name })).toBeDefined();
    expect(document.querySelectorAll(".item-card")).toHaveLength(32);
    expect(document.querySelector('[data-category="weapon-orb"]')).toBeNull();
    expect(document.querySelector('[data-category="orb"]')).toBeNull();
    expect(screen.getByRole("complementary", { name: "Inventory" }).getAttribute("data-layout")).toBe(mode);
  });
  it("selects Square and keeps availability, presence and randomized roles independent", () => {
    const world = emptyWorldState(); world.settings.roleMode = "random";
    function Harness() {
      const [mode, setMode] = useState<InventoryMode>("normal");
      return <ItemPanel mode={mode} onSetMode={setMode} world={world} ram={emptyRamState()}
        manualItems={new Set()} onToggleManualItem={vi.fn()} onSetRole={vi.fn()} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Square inventory" }));
    expect(screen.getByRole("button", { name: "Square inventory" }).getAttribute("aria-pressed")).toBe("true");
    expect([...document.querySelectorAll(".square-character-label")].map((n) => n.textContent)).toEqual(["Boy", "Girl", "Sprite"]);
    const boy = screen.getByRole("button", { name: /Boy slot: present/ });
    expect(boy.querySelector(".availability-badge")?.getAttribute("data-availability")).toBe("starting");
    expect(boy.querySelector(".role-overlay")?.getAttribute("data-role")).toBe("unknown");
    expect(boy.title).toContain("randomized role");
    fireEvent.click(boy);
    expect(screen.getByRole("dialog", { name: "boy randomized role" })).toBeDefined();
  });
});
describe("pre-release map presentation", () => {
  it("keeps Morie's new hint clear of the nearby Kakkara Cannon at fit scales", () => {
    const hint = HINT_MAP_MARKERS.find((entry) => entry.id === "sandship-morie-hint")!;
    for (const scale of [.08, .12]) {
      const view = { scale, x: 0, y: 0 };
      const pin = worldToScreen(view, hint.x, hint.y, hint.screenOffset.x, hint.screenOffset.y);
      const cannon = cannonToScreen(view, CANNON_OFFICE_BY_ID.get("kakkara")!);
      expect(Math.hypot(pin.left - cannon.left, pin.top - cannon.top)).toBeGreaterThan(22);
    }
  });
  it("moves Undersea Palace slightly left/down without changing its source coordinate or checks", () => {
    const area = MAP_AREAS.find((entry) => entry.id === "lost-continent-undersea-palace")!;
    expect([area.x, area.y]).toEqual([3400, 3575]);
    expect(area.screenOffset).toEqual({ x: -8, y: 8 });
    expect(area.checkIds).toEqual(["undersea-palace-chest", "undersea-palace-boss-hydra", "undergound-city-boss-kettle-kin"]);
  });
  it("keeps the original Gaia coordinate and smoothly removes declutter when zoomed in", () => {
    const point = CANNON_OFFICE_BY_ID.get("gaiasNavel")!;
    expect([point.x, point.y, point.region]).toEqual([0x7f * 16, 0xc2 * 16, "potos"]);
    const offset = (scale: number) => cannonToScreen({ scale, x: 0, y: 0 }, point).left - point.x * scale;
    expect(offset(.08)).toBeCloseTo(-18);
    expect(offset(.12)).toBeCloseTo(-18);
    expect(offset(.35)).toBeCloseTo(18);
    expect(offset(1)).toBeCloseTo(18);
    for (let scale = .12; scale < .35; scale += .001) {
      expect(offset(scale + .001)).toBeGreaterThanOrEqual(offset(scale) - .000001);
      expect(Math.abs(offset(scale + .001) - offset(scale))).toBeLessThan(.24);
    }
  });
  it("places Earth Palace Orb below Gaia through a display-only offset", () => {
    const orb = ORB_SOURCE_DEFINITIONS.find((o) => o.id === "et_orb")!;
    const gaia = MAP_AREAS.find((a) => a.id === "gaia-s-navel")!;
    expect([orb.x, orb.y]).toEqual([gaia.x, gaia.y]);
    const offset = ORB_DISPLAY_OFFSET.get("et_orb")!;
    for (const scale of [.08, .12, .5]) {
      const view = { scale, x: 0, y: 0 };
      expect(worldToScreen(view, orb.x, orb.y, offset.x, offset.y).top - worldToScreen(view, gaia.x, gaia.y).top).toBe(28);
    }
  });
  it("labels the Lumina source without changing its event, ID or legacy migration path", () => {
    const check = LOCATION_BY_ID.get("gold-tower-reward-gorgon-bull")!;
    expect(check.name).toBe("Gold Tower After Boss - Lumina");
    expect(check.events).toEqual([{ eventNumber: 0x587 }]);
    expect(check.legacyPath).toContain("Gold Tower Reward - Gorgon Bull");
  });
  it("hover targets a new office; source click hides every popup until destination or cancellation", () => {
    const world = emptyWorldState(); world.settings.cannonMode = "shuffle";
    const onAction = vi.fn();
    render(<CannonLayer world={world} view={{ scale: .1, x: 0, y: 0 }} onAction={onAction} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Potos Cannon Office" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    expect(screen.getByRole("region", { name: "Kakkara Cannon controls" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Add route" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Potos Cannon Office" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.querySelectorAll(".cannon-pin.target:not(:disabled)")).toHaveLength(8);
    expect(document.querySelector(".cannon-status button")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".cannon-pin.target")).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });
});
