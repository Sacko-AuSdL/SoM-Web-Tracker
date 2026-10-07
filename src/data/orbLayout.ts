import type { OrbId } from "../domain/orbs";

// Two aligned rows anchored to the shared Grand Palace source coordinate.
export const GRAND_PALACE_ORB_LAYOUT = [
  { id: "gp_orb1", x: -66, y: -56 },
  { id: "gp_orb2", x: -22, y: -56 },
  { id: "gp_orb3", x: 22, y: -56 },
  { id: "gp_orb4", x: 66, y: -56 },
  { id: "gp_orb5", x: -44, y: -29 },
  { id: "gp_orb6", x: 0, y: -29 },
  { id: "gp_orb7", x: 44, y: -29 },
] as const satisfies readonly { id: OrbId; x: number; y: number }[];

export const GRAND_PALACE_ORB_OFFSET = new Map<OrbId, { x: number; y: number }>(
  GRAND_PALACE_ORB_LAYOUT.map(({ id, x, y }) => [id, { x, y }]),
);

// The PopTracker source gives only regional coordinates. These small display
// offsets separate the three Fire Palace choices from each other and its check.
export const FIRE_PALACE_ORB_LAYOUT = [
  { id: "fp_orb1", x: -48, y: 30 },
  { id: "fp_orb2", x: 0, y: 30 },
  { id: "fp_orb3", x: 48, y: 30 },
] as const satisfies readonly { id: OrbId; x: number; y: number }[];

// Display-only, approximate gate: the forest/meadow transition on Matango's
// southern approach, not the isolated ring clearing east of the castle.
// The overworld illustration does not depict the literal in-room Orb.
export const UPPER_LAND_ORB_POSITION = { x: 1770, y: 2505, dx: 0, dy: 0 } as const;

export const ORB_DISPLAY_OFFSET = new Map<OrbId, { x: number; y: number }>([
  ...GRAND_PALACE_ORB_OFFSET,
  ...FIRE_PALACE_ORB_LAYOUT.map(({ id, x, y }) => [id, { x, y }] as const),
  ["uf_orb", { x: UPPER_LAND_ORB_POSITION.dx, y: UPPER_LAND_ORB_POSITION.dy }],
]);
