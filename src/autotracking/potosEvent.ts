import type { SniClient } from "./SniClient";
import type { EventCompletionStrategy } from "../domain/tracker";
import { PARTY_MEMBERS_ADDRESS } from "../data/inventoryDefinitions";
import {
  readU16LittleEndian,
  readU24LittleEndian,
  usb2snesAddressForSnesBus,
} from "./addressing";
export {
  readU16LittleEndian,
  readU24LittleEndian,
  usb2snesAddressForSnesBus,
} from "./addressing";

export const POTOS_LOCATION_PATH = "@Potos/Potos Chest";
export const POTOS_EVENT_NUMBER = 0x680;
export const MANTIS_ANT_LOCATION_PATH = "@Potos/Potos Boss - Mantis Ant";
export const MANTIS_ANT_EVENT_NUMBER = 0x112;

const CURRENT_MAP_ADDRESS = 0x7e00dc;
const NMI_VECTOR_ADDRESS = 0x7e0100;
const CHARACTER_FLAGS_ADDRESS = 0x7ecf0c;
const EVENT_FLAGS_ADDRESS = 0x7ecf00;
const CURRENT_EVENT_POINTER_ADDRESS = 0x7e00d1;
const EVENT_POINTER_TABLE_ADDRESS_POINTER = 0x01e7a3;
const EVENT_SCAN_SIZE = 0xff;

// Ported from scripts/autotracking/locations.lua. Values are parameter counts.
const EVENT_COMMAND_PARAMETER_COUNTS: Readonly<Record<number, number>> = {
  0x00: 0, 0x02: 0, 0x03: 0, 0x04: 0, 0x05: 0, 0x08: 0, 0x0a: 0,
  0x0e: 0, 0x0f: 0, 0x10: 1, 0x11: 1, 0x12: 1, 0x13: 1, 0x14: 1,
  0x15: 1, 0x16: 1, 0x17: 1, 0x18: 1, 0x19: 1, 0x1a: 1, 0x1b: 1,
  0x1c: 0, 0x1d: 1, 0x1e: 1, 0x1f: 1, 0x20: 1, 0x21: 1, 0x22: 1,
  0x23: 1, 0x24: 1, 0x25: 1, 0x26: 1, 0x27: 1, 0x28: 1, 0x29: 1,
  0x2a: 1, 0x2b: 1, 0x2c: 1, 0x2d: 3, 0x2e: 1, 0x2f: 1, 0x30: 2,
  0x31: 2, 0x32: 2, 0x33: 0, 0x34: 2, 0x36: 2, 0x37: 2, 0x38: 1,
  0x39: 3, 0x40: 4, 0x42: 4, 0x49: 5, 0x4a: 5, 0x4b: 5, 0x4e: 5,
  0x50: 0, 0x51: 0, 0x52: 0, 0x57: 1, 0x58: 0, 0x59: 0, 0x5a: 1,
  0x5b: 0, 0x5d: 0, 0x5e: 0, 0x5f: 0,
};

// The same recognized event flags used by the PopTracker event scanner.
const RECOGNIZED_EVENT_FLAGS = new Set([
  0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
  0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
  0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf,
  0x37, 0x29, 0x74, 0x5c, 0x0c, 0x0d, 0x0e,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e,
  0x04, 0x05, 0x06, 0x07, 0x08, 0x1f, 0x23, 0x3d, 0x3e,
  0x51, 0x52, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x69, 0x6a,
  0x6b, 0x6c, 0x6d, 0x6e, 0xa1, 0xa2, 0xa3, 0xd3, 0xd4, 0xd5,
  0xd6, 0xd0, 0xd7, 0xda, 0xdb, 0xdd, 0xde, 0xdc, 0xdf, 0xe0,
  0xe1, 0xe2,
]);

export interface GameDetectionResult {
  detected: boolean;
  currentMap: number;
  nmiFirstByte: number;
  characterFlags: [number, number, number];
  partyMask?: number;
}

export interface EventCheckRamResult {
  complete: boolean;
  eventNumber: number;
  eventFlagOffset: number | null;
  eventFlagValue: number | null;
  eventPointerTable: number;
  eventPointer: number;
  currentEventPointer: number | null;
  strategy: EventCompletionStrategy;
}

export interface EventCheckResolution {
  eventNumber: number;
  eventPointerTable: number;
  eventPointer: number;
  strategy: EventCompletionStrategy;
}

export function findCompletionFlagInEvent(eventData: Uint8Array): number | null {
  try {
    const strategy = parseEventCompletionStrategy(eventData, 0);
    return strategy.kind === "flag" ? strategy.flagOffset : null;
  } catch {
    return null;
  }
}

export function parseEventCompletionStrategy(
  eventData: Uint8Array,
  eventPointer: number,
): EventCompletionStrategy {
  let offset = 0;
  while (offset < eventData.length) {
    const command = eventData[offset];
    if (command === 0x00) {
      return {
        kind: "execution-pointer",
        eventStart: eventPointer,
        eventEnd: eventPointer + offset,
      };
    }

    if (
      (command === 0x29 || command === 0x2a || command === 0x30) &&
      offset + 1 < eventData.length
    ) {
      const candidate = eventData[offset + 1];
      if (RECOGNIZED_EVENT_FLAGS.has(candidate)) {
        return {
          kind: "flag",
          flagAddress: EVENT_FLAGS_ADDRESS + candidate,
          flagOffset: candidate,
          completedValue: 1,
        };
      }
    }

    offset += (EVENT_COMMAND_PARAMETER_COUNTS[command] ?? 0) + 1;
  }
  throw new Error(
    `Event at 0x${eventPointer.toString(16)} did not terminate within ${eventData.length} bytes`,
  );
}

export async function detectSecretOfMana(client: SniClient): Promise<GameDetectionResult> {
  const [mapBytes, nmiBytes, characterBytes, partyBytes] = await Promise.all([
    client.readMemory(usb2snesAddressForSnesBus(CURRENT_MAP_ADDRESS), 2),
    client.readMemory(usb2snesAddressForSnesBus(NMI_VECTOR_ADDRESS), 1),
    client.readMemory(usb2snesAddressForSnesBus(CHARACTER_FLAGS_ADDRESS), 3),
    // Supplemental detection evidence must not invalidate the original shared
    // reads if this isolated party byte is temporarily unavailable.
    client.readMemory(usb2snesAddressForSnesBus(PARTY_MEMBERS_ADDRESS), 1).catch(() => new Uint8Array()),
  ]);

  const currentMap = readU16LittleEndian(mapBytes);
  const nmiFirstByte = nmiBytes[0];
  const characterFlags: [number, number, number] = [
    characterBytes[0],
    characterBytes[1],
    characterBytes[2],
  ];
  const partyMask = partyBytes[0];
  const nativePartyReady = partyMask > 0 && partyMask <= 7;
  const hasCharacterSetup = nativePartyReady || (
    characterFlags.every((flag) => flag === 0 || flag === 1) &&
    characterFlags.reduce((sum, flag) => sum + flag, 0) > 0);
  const inTitle = nmiFirstByte === 0x40;

  return {
    detected:
      !inTitle && currentMap !== 0x5555 && currentMap !== 0x0000 && hasCharacterSetup,
    currentMap,
    nmiFirstByte,
    characterFlags,
    partyMask,
  };
}

export async function readEventCheckState(
  client: SniClient,
  eventNumber: number,
  cachedResolution: EventCheckResolution | null = null,
): Promise<EventCheckRamResult> {
  const tablePointerBytes = await client.readMemory(EVENT_POINTER_TABLE_ADDRESS_POINTER, 3);
  const eventPointerTable = readU24LittleEndian(tablePointerBytes);
  if (eventPointerTable === 0) {
    throw new Error("The Secret of Mana event pointer table is not initialized");
  }

  const eventPointerAddress =
    usb2snesAddressForSnesBus(eventPointerTable) + eventNumber * 3;
  const eventPointerBytes = await client.readMemory(eventPointerAddress, 3);
  const eventPointer = readU24LittleEndian(eventPointerBytes);
  if (eventPointer === 0) {
    throw new Error(`Event 0x${eventNumber.toString(16)} has no event pointer`);
  }

  let strategy: EventCompletionStrategy;
  if (
    cachedResolution?.eventNumber === eventNumber &&
    cachedResolution.eventPointerTable === eventPointerTable &&
    cachedResolution.eventPointer === eventPointer
  ) {
    strategy = cachedResolution.strategy;
  } else {
    const eventData = await client.readMemory(
      usb2snesAddressForSnesBus(eventPointer),
      EVENT_SCAN_SIZE,
    );
    try {
      strategy = parseEventCompletionStrategy(eventData, eventPointer);
    } catch (error) {
      const preview = Array.from(eventData.subarray(0, 32), (byte) =>
        byte.toString(16).toUpperCase().padStart(2, "0"),
      ).join(" ");
      throw new Error(
        `Event 0x${eventNumber.toString(16)} at 0x${eventPointer.toString(16)} is malformed; ` +
          `first 32 bytes: ${preview}; ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (strategy.kind === "execution-pointer") {
    const currentEventPointer = await readCurrentEventPointer(client);
    return {
      complete: isPointerInEventRange(currentEventPointer, strategy),
      eventNumber,
      eventFlagOffset: null,
      eventFlagValue: null,
      eventPointerTable,
      eventPointer,
      currentEventPointer,
      strategy,
    };
  }

  const flagBytes = await client.readMemory(
    usb2snesAddressForSnesBus(strategy.flagAddress),
    1,
  );
  const eventFlagValue = flagBytes[0];
  return {
    complete: eventFlagValue >= strategy.completedValue,
    eventNumber,
    eventFlagOffset: strategy.flagOffset,
    eventFlagValue,
    eventPointerTable,
    eventPointer,
    currentEventPointer: null,
    strategy,
  };
}

export async function readCurrentEventPointer(client: SniClient): Promise<number> {
  return readU24LittleEndian(
    await client.readMemory(
      usb2snesAddressForSnesBus(CURRENT_EVENT_POINTER_ADDRESS),
      3,
    ),
  );
}

export function isPointerInEventRange(
  currentEventPointer: number,
  strategy: Extract<EventCompletionStrategy, { kind: "execution-pointer" }>,
): boolean {
  return (
    currentEventPointer >= strategy.eventStart &&
    currentEventPointer <= strategy.eventEnd
  );
}

export function resolutionFromResult(result: EventCheckRamResult): EventCheckResolution {
  return {
    eventNumber: result.eventNumber,
    eventPointerTable: result.eventPointerTable,
    eventPointer: result.eventPointer,
    strategy: result.strategy,
  };
}

export function readPotosChestState(
  client: SniClient,
  cachedResolution: EventCheckResolution | null = null,
): Promise<EventCheckRamResult> {
  return readEventCheckState(client, POTOS_EVENT_NUMBER, cachedResolution);
}

export function readMantisAntState(
  client: SniClient,
  cachedResolution: EventCheckResolution | null = null,
): Promise<EventCheckRamResult> {
  return readEventCheckState(client, MANTIS_ANT_EVENT_NUMBER, cachedResolution);
}
