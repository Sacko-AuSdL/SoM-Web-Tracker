const USB2SNES_WRAM_BASE = 0xf50000;
const SNES_WRAM_BASE = 0x7e0000;
const SNES_WRAM_END = 0x7fffff;

export function usb2snesAddressForSnesBus(address: number): number {
  if (address >= SNES_WRAM_BASE && address <= SNES_WRAM_END) {
    return USB2SNES_WRAM_BASE + (address - SNES_WRAM_BASE);
  }

  // Secret of Mana is HiROM. Full-bank $C0-$FF ROM addresses map linearly.
  if (address >= 0xc00000 && address <= 0xffffff) {
    return address - 0xc00000;
  }

  return address;
}

export function readU16LittleEndian(bytes: Uint8Array, offset = 0): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function readU24LittleEndian(bytes: Uint8Array, offset = 0): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16)
  );
}
