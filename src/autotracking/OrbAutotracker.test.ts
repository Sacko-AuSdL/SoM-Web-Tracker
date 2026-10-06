import { describe, expect, it, vi } from "vitest";
import { ORB_COMPLETION_SIGNALS } from "../data/orbCompletion";
import { OrbAutotracker } from "./OrbAutotracker";

describe("persistent Orb open-state flags", () => {
  it("uses the exact source event flags and thresholds, not temporary checker flags", () => {
    expect(ORB_COMPLETION_SIGNALS.map((s) => [s.id, s.flag, s.threshold])).toEqual([
      ["et_orb", 0x18, 2], ["uf_orb", 0x20, 4], ["mc_orb", 0x24, 4],
      ["fp_orb1", 0x2c, 1], ["fp_orb2", 0x2b, 1], ["fp_orb3", 0x2b, 4], ["mp_orb", 0x3b, 2],
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`gp_orb${n}`, 0xe7 + n, 1]),
    ]);
  });
  it.each(ORB_COMPLETION_SIGNALS)("tracks $id at its threshold and reverts on RAM rollback", async (signal) => {
    const bytes = new Uint8Array(0xee - 0x18 + 1);
    const readMemory = vi.fn(async () => bytes);
    const tracker = new OrbAutotracker({ readMemory });
    bytes[signal.flag - 0x18] = signal.threshold - 1;
    expect((await tracker.poll()).values[signal.id]).toBe(false);
    bytes[signal.flag - 0x18] = signal.threshold;
    const open = await tracker.poll();
    expect(open.values[signal.id]).toBe(true);
    expect(open.diagnostics[signal.id]).toEqual({ address: 0x7ecf00 + signal.flag, threshold: signal.threshold, value: signal.threshold, error: null });
    bytes[signal.flag - 0x18] = 0;
    expect((await tracker.poll()).values[signal.id]).toBe(false);
    expect(readMemory).toHaveBeenCalledWith(0xf5cf18, 0xd7);
  });
  it("distinguishes Fire Palace 2 and 3 sharing one progress byte", async () => {
    const bytes = new Uint8Array(0xd7);
    bytes[0x2b - 0x18] = 1;
    bytes.fill(3, 0x98 - 0x18, 0xa0 - 0x18);
    const result = await new OrbAutotracker({ readMemory: async () => bytes }).poll();
    expect(result.values.fp_orb2).toBe(true);
    expect(result.values.fp_orb3).toBe(false);
    expect(result.values.uf_orb).toBe(false);
  });
  it.each(["failure", "short read"])("isolates %s with explicit diagnostics and unknown state", async (kind) => {
    const result = await new OrbAutotracker({ readMemory: async () => {
      if (kind === "failure") throw new Error("Orb read unavailable");
      return new Uint8Array(1);
    } }).poll();
    expect(Object.values(result.values)).toEqual(Array(14).fill(null));
    expect(result.diagnostics.uf_orb?.error).toContain(kind === "failure" ? "unavailable" : "Incomplete");
  });
});
