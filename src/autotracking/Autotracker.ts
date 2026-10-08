import { INVENTORY_DEFINITIONS } from "../data/inventoryDefinitions";
import { LOCATION_DEFINITIONS } from "../data/locationDefinitions";
import type { InventoryDiagnostic, LocationDiagnostic } from "../domain/tracker";
import { emptyRamState, type RamState } from "../state/trackerState";
import { InventoryAutotracker } from "./InventoryAutotracker";
import { OrbAutotracker, type OrbDiagnostic } from "./OrbAutotracker";
import type { OrbId } from "../domain/orbs";
import { LocationAutotracker } from "./LocationAutotracker";
import { SandshipAutotracker } from "./SandshipAutotracker";
import { detectSecretOfMana, type GameDetectionResult } from "./potosEvent";
import { SniClient, type SniStatus } from "./SniClient";

export interface AutotrackerSnapshot {
  sni: SniStatus;
  gameDetected: boolean;
  game: GameDetectionResult | null;
  ram: RamState;
  locations: Record<string, LocationDiagnostic>;
  inventory: Record<string, InventoryDiagnostic>;
  orbs: Partial<Record<OrbId, OrbDiagnostic>>;
  subsystemErrors: { locations: string | null; inventory: string | null; orbs: string | null };
  lastPollAt: string | null;
  error: string | null;
}

type Listener = (snapshot: AutotrackerSnapshot) => void;
const POLL_INTERVAL_MS = 750;
const EXECUTION_POINTER_POLL_INTERVAL_MS = 100;

export class Autotracker {
  private readonly client: SniClient;
  private readonly locationTracker: LocationAutotracker;
  private readonly inventoryTracker: InventoryAutotracker;
  private readonly orbTracker: OrbAutotracker;
  private readonly sandshipTracker: SandshipAutotracker;
  private readonly listeners = new Set<Listener>();
  private snapshot: AutotrackerSnapshot;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private executionPointerPollTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private pollInProgress = false;
  private executionPointerPollInProgress = false;
  private unsubscribeSni: (() => void) | null = null;

  constructor(endpoint?: string) {
    this.client = new SniClient(endpoint);
    this.locationTracker = new LocationAutotracker(this.client, LOCATION_DEFINITIONS);
    this.inventoryTracker = new InventoryAutotracker(this.client, INVENTORY_DEFINITIONS);
    this.orbTracker = new OrbAutotracker(this.client);
    this.sandshipTracker = new SandshipAutotracker(this.client);
    this.snapshot = {
      sni: this.client.getStatus(), gameDetected: false, game: null,
      ram: emptyRamState(), locations: this.locationTracker.getSnapshot().diagnostics,
      inventory: {}, orbs: {}, subsystemErrors: { locations: null, inventory: null, orbs: null },
      lastPollAt: null, error: null,
    };
  }

  getSnapshot(): AutotrackerSnapshot {
    return {
      ...this.snapshot,
      sni: this.client.getStatus(),
      game: this.snapshot.game ? { ...this.snapshot.game, characterFlags: [...this.snapshot.game.characterFlags] as [number, number, number] } : null,
      ram: { checks: { ...this.snapshot.ram.checks }, inventory: { ...this.snapshot.ram.inventory }, orbs: { ...this.snapshot.ram.orbs }, sandship: { ...this.snapshot.ram.sandship } },
      locations: { ...this.snapshot.locations }, inventory: { ...this.snapshot.inventory },
      orbs: { ...this.snapshot.orbs },
      subsystemErrors: { ...this.snapshot.subsystemErrors },
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubscribeSni = this.client.subscribe((sni) => {
      this.update({ sni, error: sni.error });
      if (sni.phase === "attached") void this.poll();
      else this.resetRuntimeState();
    });
    this.client.start();
    this.schedulePoll();
    this.scheduleExecutionPointerPoll();
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer !== null) clearTimeout(this.pollTimer);
    if (this.executionPointerPollTimer !== null) clearTimeout(this.executionPointerPollTimer);
    this.pollTimer = null;
    this.executionPointerPollTimer = null;
    this.unsubscribeSni?.();
    this.unsubscribeSni = null;
    this.client.stop();
  }

  selectDevice(device: string): Promise<void> { return this.client.selectDevice(device); }

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => void this.poll().finally(() => this.schedulePoll()), POLL_INTERVAL_MS);
  }

  private scheduleExecutionPointerPoll(): void {
    if (!this.running) return;
    this.executionPointerPollTimer = setTimeout(
      () => void this.pollExecutionPointer().finally(() => this.scheduleExecutionPointerPoll()),
      EXECUTION_POINTER_POLL_INTERVAL_MS,
    );
  }

  private async poll(): Promise<void> {
    if (this.pollInProgress || this.client.getStatus().phase !== "attached") return;
    this.pollInProgress = true;
    try {
      const game = await detectSecretOfMana(this.client);
      if (!game.detected) {
        this.locationTracker.resetSession();
        this.update({ gameDetected: false, game, ram: emptyRamState(),
          locations: this.locationTracker.getSnapshot().diagnostics, inventory: {},
          orbs: {}, subsystemErrors: { locations: null, inventory: null, orbs: null },
          lastPollAt: new Date().toISOString(), error: null });
        return;
      }

      const sandshipPromise = this.sandshipTracker.poll();
      const [locations, inventory, orbs, sandship] = await Promise.allSettled([
        sandshipPromise.then((feature) => this.locationTracker.poll(feature.supported === true)),
        this.inventoryTracker.poll(), this.orbTracker.poll(), sandshipPromise,
      ]);
      this.update({
        gameDetected: true, game,
        ram: {
          checks: locations.status === "fulfilled" ? locations.value.checks as RamState["checks"] : this.snapshot.ram.checks,
          inventory: inventory.status === "fulfilled" ? inventory.value.values as RamState["inventory"] : this.snapshot.ram.inventory,
          orbs: orbs.status === "fulfilled" ? orbs.value.values : emptyRamState().orbs,
          sandship: sandship.status === "fulfilled" ? sandship.value : { ...emptyRamState().sandship, error: rejectionMessage(sandship) },
        },
        locations: locations.status === "fulfilled" ? locations.value.diagnostics : this.snapshot.locations,
        inventory: inventory.status === "fulfilled" ? inventory.value.diagnostics : this.snapshot.inventory,
        orbs: orbs.status === "fulfilled" ? orbs.value.diagnostics : {},
        subsystemErrors: { locations: rejectionMessage(locations), inventory: rejectionMessage(inventory),
          orbs: orbs.status === "fulfilled" ? Object.values(orbs.value.diagnostics).find((entry) => entry.error)?.error ?? null : rejectionMessage(orbs) },
        lastPollAt: new Date().toISOString(), error: null,
      });
    } catch (error) {
      this.locationTracker.resetSession();
      this.update({ gameDetected: false, game: null, ram: emptyRamState(),
        orbs: {},
        locations: this.locationTracker.getSnapshot().diagnostics, inventory: {},
        lastPollAt: new Date().toISOString(), error: errorMessage(error) });
    } finally { this.pollInProgress = false; }
  }

  private async pollExecutionPointer(): Promise<void> {
    if (this.executionPointerPollInProgress || this.client.getStatus().phase !== "attached" || !this.snapshot.gameDetected) return;
    this.executionPointerPollInProgress = true;
    try {
      const locations = await this.locationTracker.pollExecutionPointer();
      if (locations) this.update({ ram: { ...this.snapshot.ram, checks: locations.checks as RamState["checks"] }, locations: locations.diagnostics });
    } catch (error) {
      this.update({ subsystemErrors: { ...this.snapshot.subsystemErrors, locations: errorMessage(error) } });
    } finally { this.executionPointerPollInProgress = false; }
  }

  private resetRuntimeState(): void {
    this.locationTracker.resetSession();
    this.update({ gameDetected: false, game: null, ram: emptyRamState(),
      locations: this.locationTracker.getSnapshot().diagnostics, inventory: {},
      orbs: {}, subsystemErrors: { locations: null, inventory: null, orbs: null } });
  }

  private update(patch: Partial<AutotrackerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function rejectionMessage(result: PromiseSettledResult<unknown>): string | null {
  return result.status === "rejected" ? errorMessage(result.reason) : null;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
