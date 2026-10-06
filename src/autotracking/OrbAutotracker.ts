import { ORB_COMPLETION_SIGNALS, ORB_FLAG_RAM_BASE } from "../data/orbCompletion";
import type { OrbId } from "../domain/orbs";
import { usb2snesAddressForSnesBus } from "./addressing";
import type { SniClient } from "./SniClient";

export interface OrbDiagnostic { address: number; threshold: number; value: number | null; error: string | null }
export type OrbRamState = Record<OrbId, boolean | null>;
export function emptyOrbRamState(): OrbRamState {
  return Object.fromEntries(ORB_COMPLETION_SIGNALS.map(({ id }) => [id, null])) as OrbRamState;
}
export class OrbAutotracker {
  constructor(private readonly client: Pick<SniClient, "readMemory">) {}
  async poll(): Promise<{ values: OrbRamState; diagnostics: Partial<Record<OrbId, OrbDiagnostic>> }> {
    const values = emptyOrbRamState();
    const diagnostics: Partial<Record<OrbId, OrbDiagnostic>> = {};
    const first = Math.min(...ORB_COMPLETION_SIGNALS.map((s) => s.flag));
    const last = Math.max(...ORB_COMPLETION_SIGNALS.map((s) => s.flag));
    try {
      const bytes = await this.client.readMemory(usb2snesAddressForSnesBus(ORB_FLAG_RAM_BASE + first), last - first + 1);
      if (bytes.length !== last - first + 1) throw new Error("Incomplete Orb flag read");
      for (const signal of ORB_COMPLETION_SIGNALS) {
        const value = bytes[signal.flag - first];
        values[signal.id] = value >= signal.threshold;
        diagnostics[signal.id] = { address: ORB_FLAG_RAM_BASE + signal.flag, threshold: signal.threshold, value, error: null };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const signal of ORB_COMPLETION_SIGNALS) diagnostics[signal.id] = {
        address: ORB_FLAG_RAM_BASE + signal.flag, threshold: signal.threshold, value: null, error: message,
      };
    }
    return { values, diagnostics };
  }
}
