import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { CANNON_OFFICES, CANNON_OFFICE_BY_ID, CANNON_TARGETS, CANNON_TARGET_BY_ID, connectionId,
  type CannonConnection, type CannonNodeId, type CannonDestinationId, type CannonPoint } from "../domain/cannons";
import { chaosOfficeState, type WorldState } from "../state/worldState";
import type { MapView } from "./mapTransform";
import { worldToScreen } from "./mapTransform";

export type CannonAction = { kind: "add"; edge: CannonConnection } | { kind: "remove"; id: string } |
  { kind: "replace"; id: string; edge: CannonConnection } | { kind: "clear" } |
  { kind: "closed"; office: CannonNodeId; closed: boolean };
interface Props {
  world: WorldState; view: MapView; onAction: (action: CannonAction) => void;
  footerElement?: HTMLElement | null; onEditingChange?: (active: boolean) => void;
  onOfficeOpen?: () => void; viewportSize?: { width: number; height: number };
}
export function CannonLayer({ world, view, onAction, footerElement, onEditingChange, onOfficeOpen,
  viewportSize = { width: 800, height: 600 } }: Props) {
  const [source, setSource] = useState<CannonNodeId | null>(null);
  const [pinnedOffice, setPinnedOffice] = useState<CannonNodeId | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [hoverOffice, setHoverOffice] = useState<CannonDestinationId | null>(null);
  const [hoverRoute, setHoverRoute] = useState<string | null>(null);
  const mode = world.settings.cannonMode;
  const manual = mode === "shuffle" || mode === "chaos";
  const cancel = () => { setSource(null); setReplacing(null); };
  const close = () => { cancel(); setPinnedOffice(null); setHoverOffice(null); };
  useEffect(() => { setSource(null); setReplacing(null); setPinnedOffice(null); setHoverOffice(null); setHoverRoute(null); }, [mode]);
  useEffect(() => {
    onEditingChange?.(source !== null);
    return () => onEditingChange?.(false);
  }, [source, onEditingChange]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSource(null); setReplacing(null); setPinnedOffice(null); setHoverOffice(null); setHoverRoute(null); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const arrowId = `cannon-arrow-${useId().replace(/:/g, "")}`;
  if (mode === "open") return null;
  const lines = manual ? world.cannonConnections : [];
  const hoveredEdge = lines.find((entry) => connectionId(entry) === hoverRoute);
  const activeOffice = source ?? pinnedOffice ?? (!hoverRoute && CANNON_OFFICE_BY_ID.has(hoverOffice as CannonNodeId) ? hoverOffice as CannonNodeId : null);
  const coords = (point: CannonPoint) => worldToScreen(view, point.x, point.y, point.screenOffset?.x ?? 18, point.screenOffset?.y ?? 16);
  const popupStyle = (x: number, y: number) => {
    const width = Math.min(228, Math.max(120, viewportSize.width - 8));
    const left = Math.min(Math.max(4, x + 12), Math.max(4, viewportSize.width - width - 4));
    // Align to the office, not to an estimated popup height: a short popup near
    // the bottom must not float far above its hover target with an unusable gap.
    const horizontal = { left: left - x + 11, width };
    if (y > viewportSize.height / 2) {
      const bottom = Math.min(viewportSize.height - 4, y + 11);
      return { ...horizontal, top: "auto", bottom: y + 11 - bottom, maxHeight: Math.min(230, Math.max(80, bottom - 4)) };
    }
    const top = Math.max(4, y - 10);
    return { ...horizontal, top: top - y + 11, maxHeight: Math.min(230, Math.max(80, viewportSize.height - top - 4)) };
  };
  const choose = (id: CannonDestinationId) => {
    if (!manual) return;
    if (source) {
      if (source === id) return;
      const next = { from: source, to: id };
      onAction(replacing ? { kind: "replace", id: replacing, edge: next } : { kind: "add", edge: next });
      setPinnedOffice(source);
      cancel();
    } else if (CANNON_OFFICE_BY_ID.has(id as CannonNodeId)) {
      onOfficeOpen?.();
      setPinnedOffice(pinnedOffice === id ? null : id as CannonNodeId);
    }
  };
  const removeRoute = (id: string) => {
    onAction({ kind: "remove", id });
    setHoverRoute(null);
    if (replacing === id) cancel();
  };
  const footer = manual && <div className="cannon-status" role="status">
    {source ? `Choose destination for ${CANNON_OFFICE_BY_ID.get(source)!.name} · Esc cancels` :
      "Office: manage routes · Route: click to remove · Hover: highlight"}
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
          <line className={`cannon-line ${emphasis}${closed ? " closed" : ""}`}
            x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd={`url(#${arrowId})`} />
          <line className="cannon-line-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} role="button" tabIndex={0}
            aria-label={`Cannon route ${CANNON_OFFICE_BY_ID.get(entry.from)!.name} to ${CANNON_TARGET_BY_ID.get(entry.to)!.name}`}
            onPointerDown={(event) => event.stopPropagation()} onClick={() => removeRoute(id)}
            onMouseEnter={() => setHoverRoute(id)} onMouseLeave={() => setHoverRoute(null)}
            onFocus={() => setHoverRoute(id)} onBlur={() => setHoverRoute(null)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); removeRoute(id); } }}>
            <title>Click to remove this directed route</title>
          </line>
        </g>;
      })}
    </svg>
    {CANNON_TARGETS.map((point) => {
      const isOffice = CANNON_OFFICES.some((entry) => entry.id === point.id);
      const officeId = point.id as CannonNodeId;
      const state = isOffice ? chaosOfficeState(world, officeId) : null;
      const highlighted = hoveredEdge?.from === point.id || hoveredEdge?.to === point.id;
      const open = manual && isOffice && activeOffice === point.id;
      const position = coords(point);
      const outgoing = lines.filter((entry) => entry.from === point.id);
      return <div key={point.id} className={`map-anchor cannon-anchor${open ? " open" : ""}`} style={position}
        onMouseEnter={() => { setHoverOffice(point.id); if (manual && isOffice && !source) onOfficeOpen?.(); }}
        onMouseLeave={() => setHoverOffice(null)}
        onFocus={() => { setHoverOffice(point.id); if (manual && isOffice && !source) onOfficeOpen?.(); }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHoverOffice(null); }}>
        <button type="button" className={`cannon-pin${source === point.id ? " source" : ""}${!isOffice ? " landing" : ""}${highlighted ? " highlighted" : ""}${mode === "chaos" && state === "closed" ? " closed" : ""}`}
          data-office-state={mode === "chaos" ? state ?? undefined : undefined}
          aria-label={`${point.name} Cannon ${isOffice ? "Office" : "Landing"}`} aria-expanded={isOffice && manual ? open : undefined}
          title={`${point.name} · ${mode === "chaos" ? state : isOffice ? "Cannon Office" : "Landing destination"}`}
          disabled={!manual || (!isOffice && !source)} onClick={() => choose(point.id)}>
          {isOffice ? "➤" : "◆"}{mode === "chaos" && state === "closed" && <span className="cannon-closed" aria-hidden="true">×</span>}
        </button>
        {open && <div className="map-popover cannon-popover" role="region" aria-label={`${point.name} Cannon controls`} style={popupStyle(position.left, position.top)}>
          <div className="cannon-popup-heading"><h3>{point.name} Cannon Office</h3>
            <button type="button" aria-label="Close Cannon popup" onClick={close}>×</button></div>
          <p className="cannon-office-state">{mode === "chaos" ? state : outgoing.length ? "Open" : "Unknown"} · {outgoing.length} outgoing</p>
          {outgoing.length ? <ul className="cannon-outgoing">{outgoing.map((entry) => {
            const id = connectionId(entry), destination = CANNON_TARGET_BY_ID.get(entry.to)!.name;
            return <li key={id}><span>→ {destination}</span><button type="button" aria-label={`Replace route to ${destination}`}
              onClick={() => { setPinnedOffice(officeId); setSource(officeId); setReplacing(id); }}>Replace</button>
              <button type="button" aria-label={`Remove route to ${destination}`} onClick={() => removeRoute(id)}>×</button></li>;
          })}</ul> : <p>No known routes.</p>}
          {source === officeId ? <>
            <label>{replacing ? "Replace destination" : "Destination"}<select aria-label={`Destination from ${point.name}`} value=""
              onChange={(event) => choose(event.target.value as CannonDestinationId)}>
              <option value="" disabled>Choose here or on map…</option>
              {CANNON_TARGETS.filter((target) => target.id !== point.id).map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
            </select></label><button type="button" onClick={cancel}>Cancel</button>
          </> : <button type="button" onClick={() => { setPinnedOffice(officeId); setSource(officeId); setReplacing(null); }}>Add route</button>}
          {mode === "chaos" && <button type="button" onClick={() => {
            onAction({ kind: "closed", office: officeId, closed: state !== "closed" }); cancel();
          }}>{state === "closed" ? "Unmark Closed" : "Mark Closed"}</button>}
        </div>}
      </div>;
    })}
  </>;
}
