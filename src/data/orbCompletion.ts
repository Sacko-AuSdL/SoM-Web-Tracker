import type { OrbId } from "../domain/orbs";

// Randomizer EventFlags.cs, InitialEventFlagStates.cs, ElementSwaps.cs and
// OpenWorldSupportingEvents.cs. These are persistent open/cleared states,
// NOT the temporary 0x98–0x9F element checker results. Weapon routes preserve
// the original success mutations (CrystalOrbWeaponBreaking.cs).
export const ORB_COMPLETION_SIGNALS = [
  { id: "et_orb", flag: 0x18, threshold: 2 },
  { id: "uf_orb", flag: 0x20, threshold: 4 },
  { id: "mc_orb", flag: 0x24, threshold: 4 },
  { id: "fp_orb1", flag: 0x2C, threshold: 1 },
  { id: "fp_orb2", flag: 0x2B, threshold: 1 },
  { id: "fp_orb3", flag: 0x2B, threshold: 4 },
  { id: "mp_orb", flag: 0x3B, threshold: 2 },
  ...([1, 2, 3, 4, 5, 6, 7] as const).map((n) => ({ id: `gp_orb${n}` as OrbId, flag: 0xE7 + n, threshold: 1 })),
] as const satisfies readonly { id: OrbId; flag: number; threshold: number }[];
export const ORB_FLAG_RAM_BASE = 0x7ECF00;
