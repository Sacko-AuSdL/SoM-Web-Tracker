import { describe, expect, it } from "vitest";
import {
  findCompletionFlagInEvent,
  parseEventCompletionStrategy,
  readU24LittleEndian,
  usb2snesAddressForSnesBus,
} from "./potosEvent";

describe("Potos event parsing", () => {
  it("finds a recognized event flag using PopTracker's command stepping", () => {
    const event = new Uint8Array([
      0x40, 0xaa, 0xbb, 0xcc, 0xdd,
      0x29, 0xa3,
      0x00,
    ]);
    expect(findCompletionFlagInEvent(event)).toBe(0xa3);
  });

  it("does not treat an unrecognized flag write as completion", () => {
    expect(findCompletionFlagInEvent(new Uint8Array([0x29, 0x42, 0x00]))).toBeNull();
  });

  it("resolves the Mantis Ant event fixture with the unchanged parser", () => {
    const mantisEvent = new Uint8Array([
      0x25, 0x01,
      0x30, 0x10, 0x0c,
      0x50,
      0x42, 0x76, 0x1f, 0x13, 0x96,
      0x30, 0x76, 0x01,
      0x00,
    ]);
    expect(findCompletionFlagInEvent(mantisEvent)).toBe(0x76);
  });

  it("resolves a valid flagless Mantis Ant reward to its execution range", () => {
    const flaglessMantisEvent = new Uint8Array([
      0x25, 0x01,
      0x30, 0x10, 0x0c,
      0x50,
      0xa9, 0x8f, 0x90, 0x93, 0x80, 0x8e, 0x8f, 0x80, 0x89,
      0x94, 0x85, 0x8d, 0x28, 0x00,
      0x51,
      0x40, 0x01, 0x14, 0x00, 0xff,
      0x18, 0x8e,
      0x00,
    ]);
    expect(parseEventCompletionStrategy(flaglessMantisEvent, 0xe145d4)).toEqual({
      kind: "execution-pointer",
      eventStart: 0xe145d4,
      eventEnd: 0xe145f0,
    });
  });

  it("rejects event data that has no terminator in the scan window", () => {
    expect(() =>
      parseEventCompletionStrategy(new Uint8Array(0xff).fill(0x60), 0xe145d4),
    ).toThrow("did not terminate within 255 bytes");
  });

  it("maps SNES WRAM and HiROM addresses into usb2snes space", () => {
    expect(usb2snesAddressForSnesBus(0x7ecf00)).toBe(0xf5cf00);
    expect(usb2snesAddressForSnesBus(0xe1711a)).toBe(0x21711a);
  });

  it("decodes 24-bit little-endian pointers", () => {
    expect(readU24LittleEndian(new Uint8Array([0x1a, 0x71, 0xe1]))).toBe(0xe1711a);
  });
});
