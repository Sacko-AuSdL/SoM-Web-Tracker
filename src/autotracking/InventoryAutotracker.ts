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
    private readonly client: Pick<SniClient, "readMemory">,
    private readonly definitions: readonly InventoryDefinition[],
  ) {}

  async poll(): Promise<InventoryPollResult> {
    const values: Record<string, InventoryValue | null> = {};
    const diagnostics: Record<string, InventoryDiagnostic> = {};
    if (this.definitions.length === 0) {
      return { values, diagnostics };
    }

    // Separate distant memory windows. A single native party byte must not
    // turn the compact event-flag read into a ~53 KiB WRAM transfer.
    const sorted = [...this.definitions].sort((a, b) => a.address - b.address);
    const groups: InventoryDefinition[][] = [];
    for (const definition of sorted) {
      const last = groups.at(-1);
      if (!last || definition.address - last[0].address > 0x100) groups.push([definition]);
      else last.push(definition);
    }
    for (const definitions of groups) {
      const minimumAddress = definitions[0].address;
      const maximumAddress = definitions.at(-1)!.address;
      let bytes: Uint8Array;
      try {
        bytes = await this.client.readMemory(
          usb2snesAddressForSnesBus(minimumAddress),
          maximumAddress - minimumAddress + 1,
        );
        if (bytes.length !== maximumAddress - minimumAddress + 1) throw new Error("Incomplete inventory read");
      } catch (error) {
        const message = errorMessage(error);
        for (const definition of definitions) {
          values[definition.id] = null;
          diagnostics[definition.id] = {
            id: definition.id,
            address: definition.address,
            rawValue: null,
            decodedValue: null,
            error: message,
          };
        }
        continue;
      }

      for (const definition of definitions) {
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
    }
    return { values, diagnostics };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
