export type InventoryValue = boolean | number;

export interface InventoryDefinition {
  id: string;
  name: string;
  category: "character" | "key-item" | "seed" | "element" | "weapon" | "weapon-orbs";
  address: number;
  valueKind: "boolean" | "stage";
  decode: (value: number) => InventoryValue;
}

export interface LocationEventDefinition {
  eventNumber: number;
  completedValue?: number;
  requirePersistentFlag?: boolean;
}

export interface LocationDefinition {
  id: string;
  feature?: "sandship";
  name: string;
  legacyPath: string;
  completionMode: "any" | "all";
  events: readonly LocationEventDefinition[];
}

export type EventCompletionStrategy =
  | {
      kind: "flag";
      flagAddress: number;
      flagOffset: number;
      completedValue: number;
    }
  | {
      kind: "execution-pointer";
      eventStart: number;
      eventEnd: number;
    };

export interface EventResolution {
  eventNumber: number;
  eventPointerTable: number;
  eventPointer: number;
  strategy: EventCompletionStrategy;
}

export interface LocationEventDiagnostic {
  eventNumber: number;
  eventPointerTable: number | null;
  eventPointer: number | null;
  strategy: EventCompletionStrategy | null;
  complete: boolean | null;
  flagValue: number | null;
  currentEventPointer: number | null;
  error: string | null;
}

export interface LocationDiagnostic {
  id: string;
  events: readonly LocationEventDiagnostic[];
  error: string | null;
}

export interface InventoryDiagnostic {
  id: string;
  address: number;
  rawValue: number | null;
  decodedValue: InventoryValue | null;
  error: string | null;
}
