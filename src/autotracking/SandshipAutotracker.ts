import { emptySandshipState, SANDSHIP, type SandshipRamState } from "../data/sandship";
import { readU24LittleEndian, usb2snesAddressForSnesBus } from "./addressing";
import type { SniClient } from "./SniClient";

// EventScript encodings of SandshipEvents.cs: entrance, death, post-boss NPCs.
// Inspect all four signatures, not a version string or a vanilla event number.
export const SANDSHIP_EVENT_SIGNATURES = [
  { event: 0x28a, bytes: [0x42, 0x28, 0xff, 0x12, 0xa8, 0x19, 0x93, 0x27, 0x04, 0x00] },
  { event: 0x2a1, bytes: [0x42, 0x28, 0xff, 0x10, 0x00, 0x25, 0x04, 0x30, 0x28, 0x0f, 0x19, 0xff, 0x27, 0xc2, 0x00] },
  { event: 0x2a3, bytes: [0x42, 0x28, 0x0e, 0x10, 0x00, 0x50] },
  { event: 0x2a2, bytes: [0x42, 0x28, 0x0e, 0x10, 0x00, 0x50] },
] as const;

export class SandshipAutotracker {
  constructor(private readonly client: SniClient) {}

  async poll(): Promise<SandshipRamState> {
    let supported: boolean | null = null;
    try {
      const table = readU24LittleEndian(await this.client.readMemory(0x01e7a3, 3));
      if (!table) throw new Error("Sandship compatibility: event table unavailable");
      const signatures = await Promise.all(SANDSHIP_EVENT_SIGNATURES.map(async ({ event, bytes }) => {
        const pointer = readU24LittleEndian(await this.client.readMemory(usb2snesAddressForSnesBus(table) + event * 3, 3));
        if (!pointer) return false;
        const data = await this.client.readMemory(usb2snesAddressForSnesBus(pointer), bytes.length);
        return bytes.every((value, index) => data[index] === value);
      }));
      supported = signatures.every(Boolean);
      if (!supported) return { ...emptySandshipState(), supported: false };
      const bytes = await this.client.readMemory(usb2snesAddressForSnesBus(SANDSHIP.bossFlagAddress), 1);
      const value = bytes[0];
      // Event flags occupy individual bytes with a 4-bit event-script value.
      // The NPC visibility guard is exactly F..F, not a >= F threshold.
      if (value === undefined || value > 0x0f) throw new Error(`Invalid Sandship boss flag value: ${value}`);
      return { supported, bossDefeated: value === SANDSHIP.bossClearedValue, bossFlagValue: value, error: null };
    } catch (error) {
      return { ...emptySandshipState(), supported, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
