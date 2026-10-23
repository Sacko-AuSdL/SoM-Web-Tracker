import { describe, expect, it, vi } from "vitest";
import { ManualInventorySession, type SessionChannel } from "./manualInventorySession";

class Bus {
  ports: Port[] = [];
  pending: (() => void)[] = [];
  port() { const port = new Port(this); this.ports.push(port); return port; }
  flush() { while (this.pending.length) this.pending.shift()!(); }
}
class Port implements SessionChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(private bus: Bus) {}
  postMessage(data: unknown) {
    for (const peer of this.bus.ports) if (peer !== this) this.bus.pending.push(() => peer.onmessage?.({ data } as MessageEvent));
  }
  close() { this.bus.ports = this.bus.ports.filter(port => port !== this); this.onmessage = null; }
}
describe("same-origin manual inventory session (never RAM/persistent storage)", () => {
  it("retains local manual tracking when an older browser lacks crypto.randomUUID", () => {
    vi.stubGlobal("crypto", undefined);
    try {
      const local = new ManualInventorySession(null); local.toggle("weapon-spear");
      expect(local.snapshot().has("weapon-spear")).toBe(true); local.close();
    } finally { vi.unstubAllGlobals(); }
  });
  it("joins an existing session and propagates bidirectional toggles without echo loops", () => {
    const bus = new Bus(), main = new ManualInventorySession(bus.port(), "main");
    main.toggle("weapon-spear");
    const pop = new ManualInventorySession(bus.port(), "pop"); pop.start(); bus.flush();
    expect(pop.snapshot()).toEqual(new Set(["weapon-spear"]));
    pop.toggle("weapon-spear"); bus.flush(); expect(main.snapshot().size).toBe(0);
    main.toggle("seed-moon"); bus.flush(); expect(pop.snapshot()).toEqual(main.snapshot());
    expect(bus.pending).toHaveLength(0);
  });
  it("preserves simultaneous edits to different items and converges on concurrent same-item edits", () => {
    const bus = new Bus(), main = new ManualInventorySession(bus.port(), "a"), pop = new ManualInventorySession(bus.port(), "b");
    main.toggle("weapon-spear"); pop.toggle("seed-moon"); bus.flush();
    expect(main.snapshot()).toEqual(new Set(["weapon-spear", "seed-moon"]));
    expect(pop.snapshot()).toEqual(main.snapshot());
    main.toggle("weapon-spear"); pop.toggle("weapon-spear"); bus.flush();
    expect(pop.snapshot()).toEqual(main.snapshot()); expect(main.snapshot().has("weapon-spear")).toBe(false);
  });
  it("reloads from a surviving peer and propagates reset without resurrecting stale marks", () => {
    const bus = new Bus(), main = new ManualInventorySession(bus.port(), "a");
    main.toggle("weapon-spear");
    const oldPort = bus.port(), old = new ManualInventorySession(oldPort, "b"); old.start(); bus.flush();
    old.close();
    const pop = new ManualInventorySession(bus.port(), "c"); pop.start(); bus.flush();
    expect(pop.snapshot().has("weapon-spear")).toBe(true);
    main.clear(); bus.flush(); expect(pop.snapshot().size).toBe(0);
    bus.port().postMessage({ kind: "marks", records: [{ id: "weapon-spear", marked: true, clock: 1, writer: "a" }] }); bus.flush();
    expect(pop.snapshot().size).toBe(0); expect(main.snapshot().size).toBe(0);
  });
  it("starts empty after the last view closes; marks never become permanent inventory", () => {
    const bus = new Bus(), main = new ManualInventorySession(bus.port(), "a");
    main.toggle("weapon-spear"); main.close();
    const direct = new ManualInventorySession(bus.port(), "b"); direct.start(); bus.flush();
    expect(direct.snapshot().size).toBe(0);
  });
  it("keeps isolated profiles and unavailable channels independent", () => {
    const main = new ManualInventorySession(null, "a"), isolated = new ManualInventorySession(null, "b");
    main.toggle("weapon-spear"); expect(main.snapshot().has("weapon-spear")).toBe(true);
    expect(isolated.snapshot().size).toBe(0); main.clear(); expect(main.snapshot().size).toBe(0);
  });
  it("ignores invalid inventory IDs, RAM-shaped payloads and malformed versions", () => {
    const port = new Bus().port(), main = new ManualInventorySession(port, "a");
    for (const data of [null, { ram: { inventory: { "weapon-spear": true } } }, { kind: "marks", records: [null,
      { id: "unknown", marked: true, clock: 2, writer: "x" }, { id: "weapon-spear", marked: true, clock: NaN, writer: "x" },
      { id: "weapon-orbs-spear", marked: true, clock: 2, writer: "x" }] }]) port.onmessage?.({ data } as MessageEvent);
    expect(main.snapshot().size).toBe(0);
  });
});
