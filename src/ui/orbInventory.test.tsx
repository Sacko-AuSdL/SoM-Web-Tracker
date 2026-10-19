// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrbRequirementPicker } from "./OrbRequirementPicker";
import { ItemPanel } from "./ItemPanel";
import { emptyRamState } from "../state/trackerState";
import { emptyWorldState, toggleGpRequirement } from "../state/worldState";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";

afterEach(cleanup);
it.each([["magic-only", 8], ["weapon-only", 8], ["mixed", 16]] as const)("renders %s as %s icon-only choices with full tooltips and an Unknown reset", (mode, count) => {
  const onSelect = vi.fn();
  const { rerender } = render(<OrbRequirementPicker mode={mode} selected={{ kind: "unknown" }} onSelect={onSelect} />);
  const group = screen.getByRole("group", { name: "Orb requirement" });
  const icons = group.querySelectorAll(".orb-choice"); expect(icons).toHaveLength(count);
  for (const icon of icons) { expect(icon.textContent).toBe(""); expect(icon.querySelector("img")).not.toBeNull(); expect(icon.getAttribute("title")).toContain("requirement"); }
  expect(screen.getByRole("button", { name: "Unknown" }).getAttribute("aria-pressed")).toBe("true");
  const name = mode === "magic-only" ? "Gnome" : "Axe";
  fireEvent.click(within(group).getByRole("button", { name }));
  const selected = onSelect.mock.calls[0][0];
  rerender(<OrbRequirementPicker mode={mode} selected={selected} onSelect={onSelect} />);
  expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Unknown" }));
  expect(onSelect).toHaveBeenLastCalledWith({ kind: "unknown" });
});
it.each(["normal", "compact", "square"] as const)("GP badge is an independent click target and Revival is readable in %s", (mode) => {
  const ram = emptyRamState(); ram.inventory["seed-water"] = true; ram.inventory["seed-fire"] = true;
  const toggleOwnership = vi.fn();
  const initial = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings("version=1.49 mode=open opGoal=mtr opNumSeeds=5 crystalOrbWeaponBreaking=on"));
  function Harness() {
    const [world, setWorld] = useState(initial);
    return <ItemPanel mode={mode} world={world} ram={ram} manualItems={new Set(["seed-earth"])} onSetMode={vi.fn()} onSetRole={vi.fn()}
      onToggleManualItem={toggleOwnership} onToggleGp={(id) => setWorld((old) => toggleGpRequirement(old, id))} />;
  }
  render(<Harness />);
  expect(screen.getByText("Mana Seeds: 3 / 5")).toBeDefined();
  const badge = screen.getByRole("button", { name: "Gnome: required for Grand Palace" }); fireEvent.click(badge);
  expect(screen.getByRole("button", { name: "Gnome: not required for Grand Palace" }).classList.contains("not-required")).toBe(true);
  expect(toggleOwnership).not.toHaveBeenCalled();
  expect(ram.inventory["element-gnome"]).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Gnome: not required for Grand Palace" }));
  expect(screen.getByRole("button", { name: "Gnome: required for Grand Palace" }).getAttribute("aria-pressed")).toBe("true");
  expect(document.querySelectorAll(".gp-badge")).toHaveLength(16);
});
it("shows Unknown for a random Revival requirement, manual fallback after identification, and no counter for other goals", () => {
  let world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings("opGoal=mtr opNumSeeds=random"));
  const props = { world, ram: emptyRamState(), manualItems: new Set<never>(), mode: "normal" as const, onSetMode: vi.fn(), onSetRole: vi.fn(), onToggleManualItem: vi.fn() };
  const { rerender } = render(<ItemPanel {...props} />);
  expect(screen.getByText("Mana Seeds: 0 / Unknown")).toBeDefined();
  world = { ...world, settings: { ...world.settings, reviveSeedCount: 4 } }; rerender(<ItemPanel {...props} world={world} />);
  expect(screen.getByText("Mana Seeds: 0 / 4")).toBeDefined();
  world.settings.goal = "short"; rerender(<ItemPanel {...props} world={world} />);
  expect(screen.queryByText(/^Mana Seeds:/)).toBeNull();
});
it.each([["magic-only", 8], ["weapon-only", 8]] as const)("only shows applicable GP badges in %s", (mode, count) => {
  const world = emptyWorldState(); world.settings.orbMode = mode;
  render(<ItemPanel mode="compact" world={world} ram={emptyRamState()} manualItems={new Set()} onSetMode={vi.fn()} onSetRole={vi.fn()} onToggleManualItem={vi.fn()} />);
  expect(document.querySelectorAll(".gp-badge")).toHaveLength(count);
});
