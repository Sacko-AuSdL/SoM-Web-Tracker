import { useEffect, useId, useState } from "react";
import { cannonNetwork, CANNON_OFFICES, CANNON_OFFICE_BY_ID, CANNON_TARGETS, CANNON_TARGET_BY_ID, connectionId,
  type CannonConnection, type CannonNodeId } from "../domain/cannons";
import type { WorldState } from "../state/worldState";
import type { MapView } from "./mapTransform";
import { worldToScreen } from "./mapTransform";

export type CannonAction = { kind: "add"; edge: CannonConnection } | { kind: "remove"; id: string } |
  { kind: "replace"; id: string; edge: CannonConnection } | { kind: "clear" };
interface Props { world: WorldState; view: MapView; editing: boolean; onAction: (action: CannonAction) => void }
export function CannonLayer({ world, view, editing, onAction }: Props) {
  const [source, setSource] = useState<CannonNodeId | null>(null);
  const [inspected, setInspected] = useState<CannonNodeId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  useEffect(() => { if (!editing) { setSource(null); setReplacing(null); } }, [editing]);
  const arrowId = `cannon-arrow-${useId().replace(/:/g, "")}`;
  const network = cannonNetwork(world.settings.cannonMode, world.cannonConnections);
  const edge = network.find((entry) => connectionId(entry) === selected);
  // Display outgoing routes for one office; Open's 56-edge graph still drives
  // logic, without drawing an unreadable full-map mesh over gameplay markers.
  const lines = network.filter((entry) => entry.from === inspected);
  const coords = (point: { x: number; y: number }) => worldToScreen(view, point.x, point.y, 18, 16);
  const choose = (id: typeof CANNON_TARGETS[number]["id"]) => {
    if (editing && source) {
      if (source !== id) {
        const next = { from: source, to: id };
        onAction(replacing ? { kind: "replace", id: replacing, edge: next } : { kind: "add", edge: next });
        setSelected(connectionId(next));
      }
      setSource(null); setReplacing(null);
    } else if (CANNON_OFFICE_BY_ID.has(id as CannonNodeId)) {
      setInspected(id as CannonNodeId); setSelected(null);
      if (editing) setSource(id as CannonNodeId);
    }
  };
  return <>
    <div className="cannon-guide" role="status">
      <span>{editing ? source ? `From ${CANNON_OFFICE_BY_ID.get(source)!.name}: click a destination` : "Click source office, then destination" :
        inspected ? `${CANNON_OFFICE_BY_ID.get(inspected)!.name}: ${lines.length} outgoing routes` : "Click an office to inspect its directed routes"}</span>
      {source && <button type="button" onClick={() => { setSource(null); setReplacing(null); }}>Cancel source</button>}
      {editing && edge && <>
        <button type="button" onClick={() => { onAction({ kind: "remove", id: selected! }); setSelected(null); }}>Remove route</button>
        <button type="button" onClick={() => { setSource(edge.from); setReplacing(selected); }}>Replace destination</button>
      </>}
      {editing && <button type="button" disabled={!world.cannonConnections.length} onClick={() => {
        onAction({ kind: "clear" }); setSelected(null); setSource(null); setReplacing(null);
      }}>Clear seed network</button>}
    </div>
    <svg className="cannon-lines" aria-label="Directed Cannon routes">
      <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="#80d9fa" /></marker></defs>
      {lines.map((entry) => {
        const from = coords(CANNON_OFFICE_BY_ID.get(entry.from)!), to = coords(CANNON_TARGET_BY_ID.get(entry.to)!);
        const dx = to.left - from.left, dy = to.top - from.top, length = Math.hypot(dx, dy);
        const shrink = Math.min(13, length / 3);
        const start = { x: from.left + dx / length * shrink, y: from.top + dy / length * shrink };
        const end = { x: to.left - dx / length * shrink, y: to.top - dy / length * shrink };
        const id = connectionId(entry);
        return <g key={id}>
          <line className={`cannon-line${selected === id ? " selected" : ""}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd={`url(#${arrowId})`} />
          <line className="cannon-line-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} role="button" tabIndex={0}
            aria-label={`Cannon route ${CANNON_OFFICE_BY_ID.get(entry.from)!.name} to ${CANNON_TARGET_BY_ID.get(entry.to)!.name}`}
            onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelected(id)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(id); } }} />
        </g>;
      })}
    </svg>
    {CANNON_TARGETS.map((point) => {
      const office = CANNON_OFFICES.some((entry) => entry.id === point.id);
      return <div key={point.id} className="map-anchor cannon-anchor" style={coords(point)}>
        <button type="button" className={`cannon-pin${source === point.id ? " source" : ""}${!office ? " landing" : ""}`}
          aria-label={`${point.name} Cannon ${office ? "Office" : "Landing"}`}
          title={`${point.name} · ${office ? "Cannon office / home landing region" : "Landing destination (no office)"}`}
          disabled={!office && (!editing || !source)} onClick={() => choose(point.id)}>{office ? "➤" : "◆"}</button>
      </div>;
    })}
  </>;
}
