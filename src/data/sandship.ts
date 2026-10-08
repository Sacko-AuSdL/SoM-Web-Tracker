// Source-backed identities from the local Open World Sandship extension.
// No reward identity is fixed: the Captain uses normal randomized prize data.
export const SANDSHIP = {
  areaId: "sandship", x: 660, y: 1690,
  captainId: "sandship-captain", captainName: "Sandship - Captain",
  plandoKey: "p_Sandship-Captain", captainEvent: 0x2a3, captainObject: 1,
  hintId: "sandship-morie-hint", hintName: "Sandship - Morie Hint",
  hintEvent: 0x2a2, hintObject: 0, crewMap: 91,
  entranceEvent: 0x28a, deathEvent: 0x2a1,
  bossFlagAddress: 0x7ecf28, bossClearedValue: 0x0f,
} as const;

export interface SandshipRamState {
  supported: boolean | null;
  bossDefeated: boolean | null;
  bossFlagValue: number | null;
  error: string | null;
}
export function emptySandshipState(): SandshipRamState {
  return { supported: null, bossDefeated: null, bossFlagValue: null, error: null };
}
