import type { AutotrackerSnapshot } from "../autotracking/Autotracker";
import { INVENTORY_DEFINITIONS } from "../data/inventoryDefinitions";
import { LOCATION_DEFINITIONS } from "../data/locationDefinitions";
import type { EventCompletionStrategy } from "../domain/tracker";
import { ORB_SOURCE_DEFINITIONS } from "../data/sourceWorldData";

function hex(value: number | null | undefined, width = 2): string {
  return value == null ? "—" : `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
}

function strategyText(strategy: EventCompletionStrategy | null): string {
  if (!strategy) return "—";
  return strategy.kind === "flag"
    ? `Flag ${hex(strategy.flagAddress, 6)} ≥ ${strategy.completedValue}`
    : `Execution pointer ${hex(strategy.eventStart, 6)}–${hex(strategy.eventEnd, 6)}`;
}

function diagnosticValue(value: boolean | number | null | undefined): string {
  return value == null ? "—" : String(value);
}

interface DebugPanelProps { snapshot: AutotrackerSnapshot; onClose: () => void }

export function DebugPanel({ snapshot, onClose }: DebugPanelProps) {
  const table = Object.values(snapshot.locations).flatMap((location) => location.events)
    .find((event) => event.eventPointerTable != null)?.eventPointerTable;
  return (
    <aside className="debug-drawer" aria-label="Debug diagnostics">
      <div className="drawer-heading"><div><span className="eyebrow">DIAGNOSTICS</span><h2>Debug</h2></div>
        <button type="button" onClick={onClose} aria-label="Close debug panel">✕</button></div>
      <div className="drawer-scroll">
        <dl className="debug-grid">
          <dt>SNI endpoint</dt><dd>{snapshot.sni.endpoint}</dd>
          <dt>Device</dt><dd>{snapshot.sni.attachedDevice ?? "—"}</dd>
          <dt>Info</dt><dd>{snapshot.sni.serverInfo.join(" | ") || "—"}</dd>
          <dt>Game detected</dt><dd>{String(snapshot.gameDetected)}</dd>
          <dt>Current map</dt><dd>{hex(snapshot.game?.currentMap, 4)}</dd>
          <dt>NMI byte</dt><dd>{hex(snapshot.game?.nmiFirstByte)}</dd>
          <dt>Character flags</dt><dd>{snapshot.game?.characterFlags.join(", ") ?? "—"}</dd>
          <dt>Event pointer table</dt><dd>{hex(table, 6)}</dd>
          <dt>Last poll</dt><dd>{snapshot.lastPollAt ?? "—"}</dd>
          <dt>SNI/game error</dt><dd>{snapshot.error ?? "—"}</dd>
          <dt>Location error</dt><dd>{snapshot.subsystemErrors.locations ?? "—"}</dd>
          <dt>Inventory error</dt><dd>{snapshot.subsystemErrors.inventory ?? "—"}</dd>
          <dt>Orb subsystem error</dt><dd>{snapshot.subsystemErrors.orbs ?? "—"}</dd>
        </dl>
        <h3>Locations</h3>
        {LOCATION_DEFINITIONS.map((location) => {
          const diagnostic = snapshot.locations[location.id];
          return (
            <details className="debug-entity" key={location.id}>
              <summary>{location.name} <code>{location.id}</code>{diagnostic?.error && <span className="error-marker">Error</span>}</summary>
              <dl className="debug-grid">
                <dt>Stable ID</dt><dd>{location.id}</dd>
                <dt>PopTracker path</dt><dd>{location.legacyPath}</dd>
                <dt>Completion</dt><dd>{diagnosticValue(snapshot.ram.checks[location.id])}</dd>
                <dt>Error</dt><dd>{diagnostic?.error ?? "—"}</dd>
                {(diagnostic?.events ?? []).map((event) => (
                  <div className="debug-event" key={event.eventNumber}>
                    <strong>Event {hex(event.eventNumber, 3)}</strong>
                    <dl className="debug-grid">
                      <dt>Pointer table</dt><dd>{hex(event.eventPointerTable, 6)}</dd>
                      <dt>Event pointer</dt><dd>{hex(event.eventPointer, 6)}</dd>
                      <dt>Strategy</dt><dd>{strategyText(event.strategy)}</dd>
                      <dt>Flag value</dt><dd>{hex(event.flagValue)}</dd>
                      <dt>Current pointer</dt><dd>{hex(event.currentEventPointer, 6)}</dd>
                      <dt>Error</dt><dd>{event.error ?? "—"}</dd>
                    </dl>
                  </div>
                ))}
              </dl>
            </details>
          );
        })}
        <h3>Crystal Orbs (RAM cleared/open)</h3>
        <p className="source-note">Open flags may be initialized by seed settings. They do not identify who activated the Orb.</p>
        {ORB_SOURCE_DEFINITIONS.map((orb) => {
          const diagnostic = snapshot.orbs[orb.id];
          return <details className="debug-entity" key={orb.id}><summary>{orb.name}</summary>
            <dl className="debug-grid"><dt>RAM cleared/open</dt><dd>{diagnosticValue(snapshot.ram.orbs[orb.id])}</dd>
              <dt>Flag address</dt><dd>{hex(diagnostic?.address, 6)}</dd><dt>Threshold</dt><dd>{diagnostic?.threshold ?? "—"}</dd>
              <dt>Raw value</dt><dd>{hex(diagnostic?.value)}</dd><dt>Error</dt><dd>{diagnostic?.error ?? "—"}</dd></dl>
          </details>;
        })}
        <h3>Inventory</h3>
        {INVENTORY_DEFINITIONS.map((item) => {
          const diagnostic = snapshot.inventory[item.id];
          return (
            <details className="debug-entity" key={item.id}>
              <summary>{item.name} <code>{item.id}</code>{diagnostic?.error && <span className="error-marker">Error</span>}</summary>
              <dl className="debug-grid">
                <dt>Stable ID</dt><dd>{item.id}</dd>
                <dt>WRAM address</dt><dd>{hex(item.address, 6)}</dd>
                <dt>Raw value</dt><dd>{hex(diagnostic?.rawValue)}</dd>
                <dt>Decoded value</dt><dd>{diagnosticValue(diagnostic?.decodedValue)}</dd>
                <dt>Error</dt><dd>{diagnostic?.error ?? "—"}</dd>
              </dl>
            </details>
          );
        })}
      </div>
    </aside>
  );
}
