import { describe, expect, it } from "vitest";
import {
  decodeInventoryFlag,
  MIDGE_MALLET_ADDRESS,
  SPEAR_OWNERSHIP_ADDRESS,
  SPEAR_WEAPON_INDEX,
  WEAPON_OWNERSHIP_BASE_ADDRESS,
} from "./inventory";

describe("Midge Mallet RAM decoding", () => {
  it("uses the PopTracker WRAM address", () => {
    expect(MIDGE_MALLET_ADDRESS).toBe(0x7ecf5c);
  });

  it("treats zero as not acquired", () => {
    expect(decodeInventoryFlag(0)).toBe(false);
  });

  it("treats a positive flag as acquired", () => {
    expect(decodeInventoryFlag(1)).toBe(true);
    expect(decodeInventoryFlag(0xff)).toBe(true);
  });
});

describe("Spear RAM decoding", () => {
  it("uses PopTracker's weapon ownership base and Spear index", () => {
    expect(WEAPON_OWNERSHIP_BASE_ADDRESS).toBe(0x7ecfc8);
    expect(SPEAR_WEAPON_INDEX).toBe(0x03);
    expect(SPEAR_OWNERSHIP_ADDRESS).toBe(0x7ecfcb);
  });

  it("treats a zero ownership byte as absent", () => {
    expect(decodeInventoryFlag(0)).toBe(false);
  });

  it("treats a positive ownership byte as acquired", () => {
    expect(decodeInventoryFlag(1)).toBe(true);
    expect(decodeInventoryFlag(0xff)).toBe(true);
  });
});
