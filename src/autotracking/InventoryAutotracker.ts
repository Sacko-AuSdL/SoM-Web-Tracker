import type {
  InventoryDefinition,
  InventoryDiagnostic,
  InventoryValue,
} from "../domain/tracker";
import { usb2snesAddressForSnesBus } from "./addressing";
import type { SniClient } from "./SniClient";

export interface InventoryPollResult {
  values: Record<string, InventoryValue | null>;
  diagnostics: Record<string, InventoryDiagnostic>;
}

export class InventoryAutotracker {
  constructor(
    private readonly client: SniClient,
    private readonly definitions: readonly InventoryDefinition[],
  ) {}

  async poll(): Promise<InventoryPollResult> {
    const values: Record<string, InventoryValue | null> = {};
    const diagnostics: Record<string, InventoryDiagnostic> = {};
    if (this.definitions.length === 0) {
      return { values, diagnostics };
    }

    const minimumAddress = Math.min(...this.definitions.map((definition) => definition.address));
    const maximumAddress = Math.max(...this.definitions.map((definition) => definition.address));
    let bytes: Uint8Array;
    try {
      bytes = await this.client.readMemory(
        usb2snesAddressForSnesBus(minimumAddress),
        maximumAddress - minimumAddress + 1,
      );
    } catch (error) {
      const message = errorMessage(error);
      for (const definition of this.definitions) {
        values[definition.id] = null;
        diagnostics[definition.id] = {
          id: definition.id,
          address: definition.address,
          rawValue: null,
          decodedValue: null,
          error: message,
        };
      }
      return { values, diagnostics };
    }

    for (const definition of this.definitions) {
      const rawValue = bytes[definition.address - minimumAddress];
      try {
        const decodedValue = definition.decode(rawValue);
        values[definition.id] = decodedValue;
        diagnostics[definition.id] = {
          id: definition.id,
          address: definition.address,
          rawValue,
          decodedValue,
          error: null,
        };
      } catch (error) {
        values[definition.id] = null;
        diagnostics[definition.id] = {
          id: definition.id,
          address: definition.address,
          rawValue,
          decodedValue: null,
          error: errorMessage(error),
        };
      }
    }
    return { values, diagnostics };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
