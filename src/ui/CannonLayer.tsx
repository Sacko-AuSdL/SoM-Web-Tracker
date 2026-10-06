import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { CANNON_OFFICES, CANNON_OFFICE_BY_ID, CANNON_TARGETS, CANNON_TARGET_BY_ID, connectionId,
  type CannonConnection, type CannonNodeId, type CannonDestinationId } from "../domain/cannons";
import { chaosOfficeState, type WorldState } from "../state/worldState";
import type { MapView } from "./mapTransform";
import { worldToScreen } from "./mapTransform";

export type CannonAction = { kind: "add"; edge: CannonConnection } | { kind: "remove"; id: string } |
  { kind: "replace"; id: string; edge: CannonConnection } | { kind: "clear" } |
  { kind: "closed"; office: CannonNodeId; closed: boolean };
interface Props {
  world: WorldState; view: MapView; onAction: (action: CannonAction) => void;
  footerElement?: HTMLElement | null; onEditingChange?: (active: boolean) => void;
}
export function CannonLayer({ world, view, onAction, footerElement, onEditingChange }: Props) {
  const [source, setSource] = useState<CannonNodeId | null>(null);
  const [office, setOffice] = useState<CannonNodeId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [hoverOffice, setHoverOffice] = useState<CannonDestinationId | null>(null);
  const [hoverRoute, setHoverRoute] = useState<string | null>(null);
  const mode = world.settings.cannonMode;
  const manual = mode === "shuffle" || mode === "chaos";
  const cancel = () => { setSource(null); setReplacing(null); };
  useEffect(() => { setSource(null); setReplacing(null); setSelected(null); setOffice(null); setHoverOffice(null); setHoverRoute(null); }, [mode]);
  useEffect(() => {
    onEditingChange?.(source !== null);
    return () => onEditingChange?.(false);
  }, [source, onEditingChange]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setSource(null); setReplacing(null); setSelected(null); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const arrowId = `cannon-arrow-${useId().replace(/:/g, "")}`;
  if (mode === "open") return null;
  const lines = manual ? world.cannonConnections : [];
  const edge = lines.find((entry) => connectionId(entry) === selected);
  const hoveredEdge = lines.find((entry) => connectionId(entry) === hoverRoute);
  const coords = (point: { x: number; y: number }) => worldToScreen(view, point.x, point.y, 18, 16);
  const choose = (id: CannonDestinationId) => {
    if (!manual) return;
    if (source) {
      if (source !== id) {
        const next = { from: source, to: id };
        onAction(replacing ? { kind: "replace", id: replacing, edge: next } : { kind: "add", edge: next });
        setSelected(connectionId(next));
      }
      cancel();
    } else if (CANNON_OFFICE_BY_ID.has(id as CannonNodeId)) {
      setOffice(id as CannonNodeId); setSelected(null); setSource(id as CannonNodeId);
    }
  };
  const selectRoute = (entry: CannonConnection) => {
    if (!source) { setSelected(connectionId(entry)); setOffice(entry.from); }
  };
  const footer = manual && <div className="cannon-status" role="status">
    <span>{source ? `Select destination for ${CANNON_OFFICE_BY_ID.get(source)!.name} · Esc to cancel` :
      edge ? `${CANNON_OFFICE_BY_ID.get(edge.from)!.name} → ${CANNON_TARGET_BY_ID.get(edge.to)!.name}` :
        `${office ? `${CANNON_OFFICE_BY_ID.get(office)!.name} · ${mode === "chaos" ? chaosOfficeState(world, office) : "office"} · ` : ""}Click Cannon Office → destination`}</span>
    {source && <button type="button" onClick={cancel}>Cancel source</button>}
    {edge && !source && <>
      <button type="button" onClick={() => { onAction({ kind: "remove", id: selected! }); setSelected(null); }}>Remove route</button>
      <button type="button" onClick={() => { setSource(edge.from); setReplacing(selected); }}>Replace destination</button>
    </>}
    {mode === "chaos" && office && <button type="button" title={`${CANNON_OFFICE_BY_ID.get(office)!.name} office`} onClick={() => {
      onAction({ kind: "closed", office, closed: chaosOfficeState(world, office) !== "closed" }); cancel();
    }}>{chaosOfficeState(world, office) === "closed" ? "Unmark Closed" : "Mark Closed"}</button>}
    {!source && <button type="button" disabled={!lines.length} onClick={() => { onAction({ kind: "clear" }); setSelected(null); cancel(); }}>Clear seed network</button>}
  </div>;
  return <>
    {footer && (footerElement ? createPortal(footer, footerElement) : footer)}
    <svg className="cannon-lines" aria-label="Directed Cannon routes">
      <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
        <path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke" /></marker></defs>
      {lines.map((entry) => {
        const from = coords(CANNON_OFFICE_BY_ID.get(entry.from)!), to = coords(CANNON_TARGET_BY_ID.get(entry.to)!);
        const dx = to.left - from.left, dy = to.top - from.top, length = Math.hypot(dx, dy);
        const shrink = Math.min(13, length / 3);
        const start = { x: from.left + dx / length * shrink, y: from.top + dy / length * shrink };
        const end = { x: to.left - dx / length * shrink, y: to.top - dy / length * shrink };
        const id = connectionId(entry);
        const emphasis = hoverRoute ? (hoverRoute === id ? "highlight" : "dim") : hoverOffice ?
          entry.from === hoverOffice ? "highlight" : entry.to === hoverOffice ? "incoming" : "dim" : "normal";
        const closed = mode === "chaos" && chaosOfficeState(world, entry.from) === "closed";
        return <g key={id} data-route={id} data-emphasis={emphasis} data-closed={closed}>
          <line className={`cannon-line ${emphasis}${selected === id ? " selected" : ""}${closed ? " closed" : ""}`}
            x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd={`url(#${arrowId})`} />
          <line className="cannon-line-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} role="button" tabIndex={0}
            aria-label={`Cannon route ${CANNON_OFFICE_BY_ID.get(entry.from)!.name} to ${CANNON_TARGET_BY_ID.get(entry.to)!.name}`}
            onPointerDown={(event) => event.stopPropagation()} onClick={() => selectRoute(entry)}
            onMouseEnter={() => setHoverRoute(id)} onMouseLeave={() => setHoverRoute(null)}
            onFocus={() => setHoverRoute(id)} onBlur={() => setHoverRoute(null)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectRoute(entry); } }} />
        </g>;
      })}
    </svg>
    {CANNON_TARGETS.map((point) => {
      const isOffice = CANNON_OFFICES.some((entry) => entry.id === point.id);
      const state = mode === "chaos" && isOffice ? chaosOfficeState(world, point.id as CannonNodeId) : null;
      const highlighted = hoveredEdge?.from === point.id || hoveredEdge?.to === point.id;
      return <div key={point.id} className="map-anchor cannon-anchor" style={coords(point)}>
        <button type="button" className={`cannon-pin${source === point.id ? " source" : ""}${!isOffice ? " landing" : ""}${highlighted ? " highlighted" : ""}${state === "closed" ? " closed" : ""}`}
          data-office-state={state ?? undefined} aria-label={`${point.name} Cannon ${isOffice ? "Office" : "Landing"}`}
          title={`${point.name} · ${state ?? (isOffice ? "Cannon Office" : "Landing destination")}`}
          onMouseEnter={() => setHoverOffice(point.id)} onMouseLeave={() => setHoverOffice(null)}
          disabled={!manual || (!isOffice && !source)} onClick={() => choose(point.id)}>
          {isOffice ? "➤" : "◆"}{state === "closed" && <span className="cannon-closed" aria-hidden="true">×</span>}
        </button>
      </div>;
    })}
  </>;
}
