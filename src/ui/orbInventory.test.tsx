// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrbRequirementPicker } from "./OrbRequirementPicker";
import { ItemPanel } from "./ItemPanel";
import { emptyRamState } from "../state/trackerState";
import { cycleGpHint, emptyWorldState, setReviveSeedResolution } from "../state/worldState";
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
      onToggleManualItem={toggleOwnership} onToggleGp={(id) => setWorld((old) => cycleGpHint(old, id))}
      onResolveRevival={(count) => setWorld((old) => setReviveSeedResolution(old, count))} />;
  }
  render(<Harness />);
  expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 5" })).toBeDefined();
  const badge = screen.getByRole("button", { name: "Gnome: Grand Palace hint unknown" });
  expect(badge.textContent).not.toContain("GP"); expect(badge.getAttribute("data-gp-state")).toBe("unknown");
  expect(document.querySelectorAll(".gp-badge:not(.unknown)")).toHaveLength(0);
  fireEvent.click(badge);
  expect(screen.getByRole("button", { name: "Gnome: required for Grand Palace" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Gnome: required for Grand Palace" }));
  expect(screen.getByRole("button", { name: "Gnome: not required for Grand Palace" }).classList.contains("not-required")).toBe(true);
  expect(toggleOwnership).not.toHaveBeenCalled();
  expect(ram.inventory["element-gnome"]).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Gnome: not required for Grand Palace" }));
  expect(screen.getByRole("button", { name: "Gnome: Grand Palace hint unknown" }).getAttribute("aria-pressed")).toBe("mixed");
  expect(toggleOwnership).not.toHaveBeenCalled();
  const countPicker = screen.getByRole("combobox", { name: "Required Mana Seeds" });
  fireEvent.mouseEnter(countPicker);
  expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.change(countPicker, { target: { value: "6" } });
  expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 6" })).toBeDefined();
  fireEvent.change(countPicker, { target: { value: "" } });
  expect(screen.getByRole("status", { name: "Mana Seeds: 3 / 5" })).toBeDefined();
  expect(document.querySelectorAll(".gp-badge")).toHaveLength(16);
});
it("shows Unknown for a random Revival requirement, manual fallback after identification, and no counter for other goals", () => {
  let world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings("opGoal=mtr opNumSeeds=random"));
  const props = { world, ram: emptyRamState(), manualItems: new Set<never>(), mode: "normal" as const, onSetMode: vi.fn(), onSetRole: vi.fn(), onToggleManualItem: vi.fn() };
  const { rerender } = render(<ItemPanel {...props} />);
  expect(screen.getByRole("status", { name: "Mana Seeds: 0 / Unknown" })).toBeDefined();
  world = setReviveSeedResolution(world, 4); rerender(<ItemPanel {...props} world={world} />);
  expect(screen.getByRole("status", { name: "Mana Seeds: 0 / 4" })).toBeDefined();
  world.settings.goal = "short"; rerender(<ItemPanel {...props} world={world} />);
  expect(screen.queryByRole("status", { name: /^Mana Seeds:/ })).toBeNull();
});
it.each([["magic-only", 8], ["weapon-only", 8]] as const)("only shows applicable GP badges in %s", (mode, count) => {
  const world = emptyWorldState(); world.settings.orbMode = mode;
  render(<ItemPanel mode="compact" world={world} ram={emptyRamState()} manualItems={new Set()} onSetMode={vi.fn()} onSetRole={vi.fn()} onToggleManualItem={vi.fn()} />);
  expect(document.querySelectorAll(".gp-badge")).toHaveLength(count);
});
it.each(["normal", "compact", "square"] as const)("MTR dropdown in %s contains only imported 5..8 and resets manual resolution without Settings", (mode) => {
  const initial = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings("opGoal=mtr opNumSeeds=random opMinSeeds=5 opMaxSeeds=8"));
  function Harness() {
    const [world, setWorld] = useState(initial);
    return <ItemPanel mode={mode} world={world} ram={emptyRamState()} manualItems={new Set()} onSetMode={vi.fn()} onSetRole={vi.fn()}
      onToggleManualItem={vi.fn()} onResolveRevival={(count) => setWorld((old) => setReviveSeedResolution(old, count))} />;
  }
  render(<Harness />);
  const select = screen.getByRole("combobox", { name: "Required Mana Seeds" }) as HTMLSelectElement;
  expect([...select.options].map((option) => option.value)).toEqual(["", "5", "6", "7", "8"]);
  expect(select.size).toBe(0); expect(select.multiple).toBe(false);
  fireEvent.change(select, { target: { value: "7" } });
  expect(screen.getByRole("status", { name: "Mana Seeds: 0 / 7" })).toBeDefined();
  fireEvent.change(select, { target: { value: "" } });
  expect(screen.getByRole("status", { name: "Mana Seeds: 0 / Unknown" })).toBeDefined();
  expect(screen.queryByRole("dialog")).toBeNull();
});
