import type {
  EventCompletionStrategy,
  EventResolution,
  LocationDefinition,
} from "../domain/tracker";
import { parseEventCompletionStrategy } from "./potosEvent";
import { readU24LittleEndian, usb2snesAddressForSnesBus } from "./addressing";
import type { SniClient } from "./SniClient";

const EVENT_POINTER_TABLE_ADDRESS_POINTER = 0x01e7a3;
const EVENT_SCAN_SIZE = 0xff;

export interface EventBinding {
  key: string;
  eventNumber: number;
  completedValue: number;
  requirePersistentFlag?: boolean;
}

export interface EventResolutionOutcome {
  binding: EventBinding;
  resolution: EventResolution | null;
  error: string | null;
}

interface CachedResolution extends EventResolution {
  completedValue: number;
}

export class EventResolver {
  private readonly cache = new Map<number, CachedResolution>();

  constructor(private readonly client: SniClient) {}

  static bindingsFor(definitions: readonly LocationDefinition[]): EventBinding[] {
    return definitions.flatMap((location) =>
      location.events.map((event) => ({
        key: `${location.id}:${event.eventNumber.toString(16)}`,
        eventNumber: event.eventNumber,
        completedValue: event.completedValue ?? 1,
        requirePersistentFlag: event.requirePersistentFlag,
      })),
    );
  }

  async resolve(bindings: readonly EventBinding[]): Promise<EventResolutionOutcome[]> {
    if (bindings.length === 0) {
      return [];
    }

    let eventPointerTable: number;
    let pointerBytes: Uint8Array;
    const minimumEvent = Math.min(...bindings.map((binding) => binding.eventNumber));
    const maximumEvent = Math.max(...bindings.map((binding) => binding.eventNumber));

    try {
      eventPointerTable = readU24LittleEndian(
        await this.client.readMemory(EVENT_POINTER_TABLE_ADDRESS_POINTER, 3),
      );
      if (eventPointerTable === 0) {
        throw new Error("The Secret of Mana event pointer table is not initialized");
      }
      pointerBytes = await this.client.readMemory(
        usb2snesAddressForSnesBus(eventPointerTable) + minimumEvent * 3,
        (maximumEvent - minimumEvent + 1) * 3,
      );
    } catch (error) {
      const message = errorMessage(error);
      return bindings.map((binding) => ({ binding, resolution: null, error: message }));
    }

    return Promise.all(
      bindings.map(async (binding): Promise<EventResolutionOutcome> => {
        const pointerOffset = (binding.eventNumber - minimumEvent) * 3;
        const eventPointer = readU24LittleEndian(pointerBytes, pointerOffset);
        if (eventPointer === 0) {
          return {
            binding,
            resolution: null,
            error: `Event 0x${binding.eventNumber.toString(16)} has no event pointer`,
          };
        }

        const cached = this.cache.get(binding.eventNumber);
        if (
          cached?.eventPointerTable === eventPointerTable &&
          cached.eventPointer === eventPointer &&
          cached.completedValue === binding.completedValue &&
          (!binding.requirePersistentFlag || cached.strategy.kind === "flag")
        ) {
          return { binding, resolution: cached, error: null };
        }

        try {
          const eventData = await this.client.readMemory(
            usb2snesAddressForSnesBus(eventPointer),
            EVENT_SCAN_SIZE,
          );
          const parsed = parseEventCompletionStrategy(eventData, eventPointer);
          if (binding.requirePersistentFlag && parsed.kind !== "flag") {
            throw new Error(`Event 0x${binding.eventNumber.toString(16)} has no recognized persistent prize-claim flag`);
          }
          const strategy: EventCompletionStrategy =
            parsed.kind === "flag"
              ? { ...parsed, completedValue: binding.completedValue }
              : parsed;
          const resolution: CachedResolution = {
            eventNumber: binding.eventNumber,
            eventPointerTable,
            eventPointer,
            strategy,
            completedValue: binding.completedValue,
          };
          this.cache.set(binding.eventNumber, resolution);
          return { binding, resolution, error: null };
        } catch (error) {
          this.cache.delete(binding.eventNumber);
          return { binding, resolution: null, error: errorMessage(error) };
        }
      }),
    );
  }

  clear(): void {
    this.cache.clear();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
