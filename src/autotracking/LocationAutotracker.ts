import type {
  EventResolution,
  LocationDefinition,
  LocationDiagnostic,
  LocationEventDiagnostic,
} from "../domain/tracker";
import { readU24LittleEndian, usb2snesAddressForSnesBus } from "./addressing";
import { EventResolver, type EventBinding } from "./EventResolver";
import type { SniClient } from "./SniClient";

const EVENT_FLAGS_ADDRESS = 0x7ecf00;
const EVENT_FLAGS_SIZE = 0xff;
const CURRENT_EVENT_POINTER_ADDRESS = 0x7e00d1;

interface BindingOwner {
  location: LocationDefinition;
  binding: EventBinding;
}

export interface LocationPollResult {
  checks: Record<string, boolean | null>;
  diagnostics: Record<string, LocationDiagnostic>;
}

export class LocationAutotracker {
  private readonly resolver: EventResolver;
  private readonly owners = new Map<string, BindingOwner>();
  private readonly resolutions = new Map<string, EventResolution>();
  private readonly executionCompleted = new Set<string>();
  private readonly eventDiagnostics = new Map<string, LocationEventDiagnostic>();
  private checks: Record<string, boolean | null> = {};
  private diagnostics: Record<string, LocationDiagnostic> = {};

  constructor(
    private readonly client: SniClient,
    private readonly definitions: readonly LocationDefinition[],
    resolver = new EventResolver(client),
  ) {
    this.resolver = resolver;
    const bindings = EventResolver.bindingsFor(definitions);
    for (const location of definitions) {
      for (const event of location.events) {
        const key = `${location.id}:${event.eventNumber.toString(16)}`;
        const binding = bindings.find((candidate) => candidate.key === key)!;
        this.owners.set(key, { location, binding });
      }
      this.checks[location.id] = null;
      this.diagnostics[location.id] = { id: location.id, events: [], error: null };
    }
  }

  async poll(supportsSandship = false): Promise<LocationPollResult> {
    const active = [...this.owners.values()].filter((owner) => !owner.location.feature || supportsSandship);
    for (const [key, owner] of this.owners) {
      if (owner.location.feature && !supportsSandship) {
        this.resolutions.delete(key);
        this.eventDiagnostics.delete(key);
        this.executionCompleted.delete(key);
      }
    }
    const outcomes = await this.resolver.resolve(
      active.map((owner) => owner.binding),
    );
    const flagOutcomes = outcomes.filter(
      (outcome) => outcome.resolution?.strategy.kind === "flag",
    );
    const pendingExecutionOutcomes = outcomes.filter(
      (outcome) =>
        outcome.resolution?.strategy.kind === "execution-pointer" &&
        !this.executionCompleted.has(outcome.binding.key),
    );

    const [flagRead, pointerRead] = await Promise.allSettled([
      flagOutcomes.length > 0
        ? this.client.readMemory(
            usb2snesAddressForSnesBus(EVENT_FLAGS_ADDRESS),
            EVENT_FLAGS_SIZE,
          )
        : Promise.resolve(new Uint8Array(EVENT_FLAGS_SIZE)),
      pendingExecutionOutcomes.length > 0
        ? this.readCurrentEventPointer()
        : Promise.resolve(0),
    ]);

    for (const outcome of outcomes) {
      const previous = this.resolutions.get(outcome.binding.key);
      if (!outcome.resolution) {
        this.resolutions.delete(outcome.binding.key);
        this.executionCompleted.delete(outcome.binding.key);
        this.eventDiagnostics.set(outcome.binding.key, {
          eventNumber: outcome.binding.eventNumber,
          eventPointerTable: null,
          eventPointer: null,
          strategy: null,
          complete: null,
          flagValue: null,
          currentEventPointer: null,
          error: outcome.error,
        });
        continue;
      }

      if (!sameResolution(previous, outcome.resolution)) {
        this.executionCompleted.delete(outcome.binding.key);
      }
      this.resolutions.set(outcome.binding.key, outcome.resolution);

      if (outcome.resolution.strategy.kind === "flag") {
        if (flagRead.status === "rejected") {
          this.eventDiagnostics.set(
            outcome.binding.key,
            diagnosticForError(outcome.resolution, errorMessage(flagRead.reason)),
          );
          continue;
        }
        const flagOffset = outcome.resolution.strategy.flagOffset;
        const flagValue = flagRead.value[flagOffset];
        this.eventDiagnostics.set(outcome.binding.key, {
          ...outcome.resolution,
          complete: flagValue >= outcome.resolution.strategy.completedValue,
          flagValue,
          currentEventPointer: null,
          error: null,
        });
        continue;
      }

      if (this.executionCompleted.has(outcome.binding.key)) {
        this.eventDiagnostics.set(outcome.binding.key, {
          ...outcome.resolution,
          complete: true,
          flagValue: null,
          currentEventPointer: null,
          error: null,
        });
        continue;
      }
      if (pointerRead.status === "rejected") {
        this.eventDiagnostics.set(
          outcome.binding.key,
          diagnosticForError(outcome.resolution, errorMessage(pointerRead.reason)),
        );
        continue;
      }
      const complete = pointerIsInRange(pointerRead.value, outcome.resolution);
      if (complete) {
        this.executionCompleted.add(outcome.binding.key);
      }
      this.eventDiagnostics.set(outcome.binding.key, {
        ...outcome.resolution,
        complete,
        flagValue: null,
        currentEventPointer: pointerRead.value,
        error: null,
      });
    }

    this.rebuildLocations();
    return this.getSnapshot();
  }

  async pollExecutionPointer(): Promise<LocationPollResult | null> {
    const pending = [...this.resolutions.entries()].filter(
      ([key, resolution]) =>
        resolution.strategy.kind === "execution-pointer" &&
        !this.executionCompleted.has(key),
    );
    if (pending.length === 0) {
      return null;
    }

    const currentEventPointer = await this.readCurrentEventPointer();
    let changed = false;
    for (const [key, resolution] of pending) {
      if (!pointerIsInRange(currentEventPointer, resolution)) {
        continue;
      }
      this.executionCompleted.add(key);
      const previous = this.eventDiagnostics.get(key);
      this.eventDiagnostics.set(key, {
        ...resolution,
        complete: true,
        flagValue: null,
        currentEventPointer,
        error: null,
      });
      changed ||= previous?.complete !== true;
    }

    if (!changed) {
      return null;
    }
    this.rebuildLocations();
    return this.getSnapshot();
  }

  resetSession(): void {
    this.resolver.clear();
    this.resolutions.clear();
    this.executionCompleted.clear();
    this.eventDiagnostics.clear();
    this.checks = Object.fromEntries(
      this.definitions.map((definition) => [definition.id, null]),
    );
    this.diagnostics = Object.fromEntries(
      this.definitions.map((definition) => [
        definition.id,
        { id: definition.id, events: [], error: null },
      ]),
    );
  }

  getSnapshot(): LocationPollResult {
    return {
      checks: { ...this.checks },
      diagnostics: Object.fromEntries(
        Object.entries(this.diagnostics).map(([id, diagnostic]) => [
          id,
          { ...diagnostic, events: diagnostic.events.map((event) => ({ ...event })) },
        ]),
      ),
    };
  }

  private rebuildLocations(): void {
    for (const location of this.definitions) {
      const events = location.events.map((event) =>
        this.eventDiagnostics.get(`${location.id}:${event.eventNumber.toString(16)}`),
      ).filter((event): event is LocationEventDiagnostic => event !== undefined);
      const values = events.map((event) => event.complete);
      let complete: boolean | null;
      if (events.length !== location.events.length || values.some((value) => value === null)) {
        complete = location.completionMode === "any" && values.includes(true) ? true : null;
      } else {
        complete = location.completionMode === "all"
          ? values.every((value) => value === true)
          : values.some((value) => value === true);
      }
      this.checks[location.id] = complete;
      const errors = events.flatMap((event) => event.error ? [event.error] : []);
      this.diagnostics[location.id] = {
        id: location.id,
        events,
        error: errors.length > 0 ? errors.join(" | ") : null,
      };
    }
  }

  private async readCurrentEventPointer(): Promise<number> {
    return readU24LittleEndian(
      await this.client.readMemory(
        usb2snesAddressForSnesBus(CURRENT_EVENT_POINTER_ADDRESS),
        3,
      ),
    );
  }
}

function sameResolution(
  left: EventResolution | undefined,
  right: EventResolution,
): boolean {
  return (
    left?.eventPointerTable === right.eventPointerTable &&
    left.eventPointer === right.eventPointer &&
    left.strategy.kind === right.strategy.kind
  );
}

function pointerIsInRange(pointer: number, resolution: EventResolution): boolean {
  return (
    resolution.strategy.kind === "execution-pointer" &&
    pointer >= resolution.strategy.eventStart &&
    pointer <= resolution.strategy.eventEnd
  );
}

function diagnosticForError(
  resolution: EventResolution,
  error: string,
): LocationEventDiagnostic {
  return {
    ...resolution,
    complete: null,
    flagValue: null,
    currentEventPointer: null,
    error,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
