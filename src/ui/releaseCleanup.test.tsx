// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CannonLayer } from "./CannonLayer";
import { SettingsPanel } from "./SettingsPanel";
import { ItemPanel } from "./ItemPanel";
import { applyRandomizerSettings, parseRandomizerSettings } from "../adapters/randomizerSettings";
import { emptyRamState } from "../state/trackerState";
import { addCannonConnection, emptyWorldState, setCannonOfficeClosed } from "../state/worldState";

afterEach(cleanup);
const view = { scale: .2, x: 0, y: 0 };
describe("focused release Cannon UX", () => {
  it.each(["shuffle", "chaos"] as const)("%s displays all directed routes and dims rather than hides unrelated edges", (mode) => {
    let world = emptyWorldState(); world.settings.cannonMode = mode;
    for (const edge of [{ from: "kakkara", to: "iceCountry" }, { from: "kakkara", to: "matango" },
      { from: "potos", to: "southtown" }, { from: "matango", to: "kakkara" }] as const) world = addCannonConnection(world, edge);
    render(<CannonLayer world={world} view={view} onAction={vi.fn()} />);
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Cannon route Ice Country to Kakkara" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Cannons" })).toBeNull();
    const office = screen.getByRole("button", { name: "Kakkara Cannon Office" });
    fireEvent.mouseEnter(office);
    expect(document.querySelectorAll('[data-emphasis="highlight"]')).toHaveLength(2);
    expect(document.querySelector('[data-route="matango:kakkara"]')?.getAttribute("data-emphasis")).toBe("incoming");
    expect(document.querySelector('[data-route="potos:southtown"]')?.getAttribute("data-emphasis")).toBe("dim");
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(4);
    fireEvent.mouseLeave(office);
    expect(document.querySelectorAll('[data-emphasis="normal"]')).toHaveLength(4);
    const route = screen.getByRole("button", { name: "Cannon route Potos to Southtown" });
    fireEvent.mouseEnter(route);
    expect(document.querySelectorAll('[data-emphasis="highlight"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-emphasis="dim"]')).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Potos Cannon Office" }).className).toContain("highlighted");
    expect(screen.getByRole("button", { name: "Southtown Cannon Office" }).className).toContain("highlighted");
    fireEvent.mouseLeave(route);
    expect(document.querySelectorAll('[data-emphasis="normal"]')).toHaveLength(4);
    expect(route.previousElementSibling?.getAttribute("marker-end")).toContain("cannon-arrow-");
  });
  it("distinguishes Chaos Unknown/Open/Closed and allows marking/unmarking without discarding routes", () => {
    function Harness() {
      const [world, setWorld] = useState(() => { const s = addCannonConnection(emptyWorldState(), { from: "potos", to: "southtown" }); s.settings.cannonMode = "chaos"; return s; });
      return <CannonLayer world={world} view={view} onAction={(a) => { if (a.kind === "closed") setWorld((s) => setCannonOfficeClosed(s, a.office, a.closed)); }} />;
    }
    render(<Harness />);
    const potos = screen.getByRole("button", { name: "Potos Cannon Office" });
    expect(potos.getAttribute("data-office-state")).toBe("open");
    expect(screen.getByRole("button", { name: "Kakkara Cannon Office" }).getAttribute("data-office-state")).toBe("unknown");
    fireEvent.click(potos);
    fireEvent.click(screen.getByRole("button", { name: "Mark Closed" }));
    expect(potos.getAttribute("data-office-state")).toBe("closed");
    expect(potos.textContent).toContain("×");
    expect(document.querySelectorAll(".cannon-line.closed")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Unmark Closed" }));
    expect(potos.getAttribute("data-office-state")).toBe("open");
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Kakkara Cannon Office" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(potos);
    fireEvent.click(screen.getByRole("button", { name: "Mark Closed" }));
    expect(potos.getAttribute("data-office-state")).toBe("closed");
    expect(screen.getByRole("button", { name: "Kakkara Cannon Office" }).getAttribute("data-office-state")).toBe("unknown");
  });
  it("Vanilla exposes no manual route controls", () => {
    render(<CannonLayer world={emptyWorldState()} view={view} onAction={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelectorAll(".cannon-line")).toHaveLength(0);
    expect((screen.getByRole("button", { name: "Potos Cannon Office" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
describe("concise imports and compact availability UI", () => {
  it("shows a short success message, optional diagnostics, imported character controls, and visible relevant errors", () => {
    function Harness() {
      const [world, setWorld] = useState(emptyWorldState());
      return <SettingsPanel world={world} sni={{ endpoint: "ws://mock", phase: "disconnected", devices: [], attachedDevice: null, serverInfo: [], error: null }}
        onSelectDevice={vi.fn()} onClose={vi.fn()} dungeonMode="auto" onSetDungeonMode={vi.fn()} onToggleDisabledCharacter={vi.fn()} onSetOrbMode={vi.fn()}
        onUpdateSetting={(key, value) => setWorld((s) => ({ ...s, settings: { ...s.settings, [key]: value } }))}
        onImportSettings={(parsed) => setWorld((s) => applyRandomizerSettings(s, parsed))} />;
    }
    render(<Harness />);
    const input = screen.getByLabelText("Randomizer Settings String");
    fireEvent.change(input, { target: { value: "version=1.49 mode=open spoilerLog=yes opStartGold=500 opStartChar=girl opCharacters=find1CL irrelevant=yes" } });
    fireEvent.click(screen.getByRole("button", { name: "Import / Apply" }));
    expect(screen.getByRole("status").textContent).toBe("Settings imported successfully.");
    expect(screen.queryByText(/spoilerLog is not imported|opStartGold is not imported/)).toBeNull();
    expect((document.querySelector("details") as HTMLDetailsElement).open).toBe(false);
    expect((screen.getByLabelText("Starting Character") as HTMLSelectElement).value).toBe("girl");
    expect((screen.getByLabelText("Additional Characters") as HTMLSelectElement).value).toBe("find-one-current");
    const identity = screen.getByLabelText("Identify findable slot");
    expect((identity as HTMLSelectElement).value).toBe("");
    fireEvent.change(identity, { target: { value: "sprite" } });
    expect((identity as HTMLSelectElement).value).toBe("sprite");
    fireEvent.change(input, { target: { value: "opCharacters=bogus" } });
    fireEvent.click(screen.getByRole("button", { name: "Import / Apply" }));
    expect(screen.getByRole("alert").textContent).toContain("Unrecognized opCharacters=bogus");
    expect(screen.queryByText("Settings imported successfully.")).toBeNull();
  });
  it("uses S/F/×/… for availability, separate from randomized-role ? overlays and live ownership", () => {
    const world = applyRandomizerSettings(emptyWorldState(), parseRandomizerSettings("opCharacters=start1only opBoyRole=random"));
    const ram = emptyRamState();
    const props = { world, ram, manualItems: new Set<string>() as Set<never>, mode: "compact" as const, onSetMode: vi.fn(), onToggleManualItem: vi.fn(), onSetRole: vi.fn() };
    const { rerender } = render(<ItemPanel {...props} />);
    const boy = screen.getByRole("button", { name: /Boy slot: present/ });
    expect(boy.querySelector(".availability-badge")?.textContent).toBe("S");
    expect(boy.querySelector(".role-overlay")?.getAttribute("data-role")).toBe("unknown");
    expect(screen.getByRole("button", { name: /Girl slot: not present/ }).querySelector(".availability-badge")?.textContent).toBe("…");
    world.settings.additionalCharacter = "girl"; rerender(<ItemPanel {...props} />);
    expect(screen.getByRole("button", { name: /Girl slot: present/ }).querySelector(".availability-badge")?.textContent).toBe("S");
    expect(screen.getByRole("button", { name: /Sprite slot: not present/ }).querySelector(".availability-badge")?.textContent).toBe("×");
    ram.inventory.boy = false; rerender(<ItemPanel {...props} />);
    expect(screen.getByRole("button", { name: /Boy slot: not present; Missing \(RAM\)/ })).toBeDefined();
  });
});
