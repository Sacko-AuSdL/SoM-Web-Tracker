import { INVENTORY_DEFINITIONS, type InventoryId } from "../data/inventoryDefinitions";

export const INVENTORY_SESSION_CHANNEL = "som-web-tracker:manual-inventory:v1";
const ids = new Set<InventoryId>(INVENTORY_DEFINITIONS.filter(item => item.valueKind === "boolean").map(item => item.id));
interface Mark { id: InventoryId; marked: boolean; clock: number; writer: string }
function writerId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
export interface SessionChannel {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
  close(): void;
}
// Only manual session marks cross this same-origin channel. RAM never does.
// Per-item logical timestamps merge independent edits and resolve simultaneous
// edits deterministically. False records prevent stale peers resurrecting reset
// marks. Nothing is written to persistent storage.
export class ManualInventorySession {
  private readonly marks = new Map<InventoryId, Mark>();
  private clock = 0;
  private readonly listeners = new Set<(items: ReadonlySet<InventoryId>) => void>();
  constructor(private readonly channel: SessionChannel | null, private readonly writer: string = writerId()) {
    if (channel) channel.onmessage = event => this.receive(event.data);
  }
  start(): void { this.channel?.postMessage({ kind: "request" }); }
  subscribe(listener: (items: ReadonlySet<InventoryId>) => void): () => void {
    this.listeners.add(listener); listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }
  snapshot(): ReadonlySet<InventoryId> { return new Set([...this.marks.values()].filter(mark => mark.marked).map(mark => mark.id)); }
  toggle(id: InventoryId): void { if (ids.has(id)) this.write([id], !this.marks.get(id)?.marked); }
  clear(): void { this.write([...ids], false); }
  close(): void { if (this.channel) this.channel.onmessage = null; this.channel?.close(); this.listeners.clear(); }
  private write(itemIds: InventoryId[], marked: boolean): void {
    const clock = ++this.clock;
    const records = itemIds.map(id => ({ id, marked, clock, writer: this.writer }));
    this.merge(records);
    this.channel?.postMessage({ kind: "marks", records });
  }
  private receive(message: unknown): void {
    if (!message || typeof message !== "object") return;
    const data = message as { kind?: unknown; records?: unknown };
    if (data.kind === "request") this.channel?.postMessage({ kind: "marks", records: [...this.marks.values()] });
    else if (data.kind === "marks" && Array.isArray(data.records)) this.merge(data.records);
  }
  private merge(records: unknown[]): void {
    let changed = false;
    for (const raw of records) {
      if (!raw || typeof raw !== "object") continue;
      const mark = raw as Mark;
      if (!ids.has(mark.id) || typeof mark.marked !== "boolean" || !Number.isSafeInteger(mark.clock) || mark.clock < 0 ||
        typeof mark.writer !== "string" || mark.writer.length > 100) continue;
      this.clock = Math.max(this.clock, mark.clock);
      const prior = this.marks.get(mark.id);
      if (prior && (prior.clock > mark.clock || prior.clock === mark.clock && prior.writer >= mark.writer)) continue;
      this.marks.set(mark.id, { ...mark }); changed = true;
    }
    if (changed) for (const listener of this.listeners) listener(this.snapshot());
  }
}
