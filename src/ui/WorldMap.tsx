import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type WheelEvent } from "react";
import { MAP_IMAGE_SIZE } from "../data/mapGroups";
import { activeMapAreas } from "../data/mapAreas";
import { ORB_DISPLAY_OFFSET, UPPER_LAND_ORB_POSITION } from "../data/orbLayout";
import { ORB_SOURCE_DEFINITIONS } from "../data/sourceWorldData";
import { activeHintMarkers } from "../data/hintMarkers";
import { SANDSHIP } from "../data/sandship";
import { LOCATION_BY_ID, type LocationId } from "../data/locationDefinitions";
import type { InventoryId } from "../data/inventoryDefinitions";
import { ELEMENTS, WEAPON_FAMILIES, requirementLabel, type OrbId, type OrbRequirement } from "../domain/orbs";
import { createLogicContext, evaluateArea, evaluateCheck, evaluateOrbGate, orbCompletion } from "../logic/reachability";
import { deriveEffectiveCheckState, isManuallyCompleted, type RamState, type PersistentManualState } from "../state/trackerState";
import type { WorldState } from "../state/worldState";
import { orbImage, orbRequirementImage, overworldImage } from "./assets";
import { CannonLayer, type CannonAction } from "./CannonLayer";
import { worldToScreen, type MapView } from "./mapTransform";

interface Size { width: number; height: number }
type Layer = "checks" | "orbs" | "hints";
type OpenMarker = { kind: Layer; id: string } | null;
function fitScale(size: Size): number { return Math.min(size.width / MAP_IMAGE_SIZE.width, size.height / MAP_IMAGE_SIZE.height); }
function clampView(view: MapView, size: Size): MapView {
  const width = MAP_IMAGE_SIZE.width * view.scale, height = MAP_IMAGE_SIZE.height * view.scale;
  return { ...view,
    x: width <= size.width ? (size.width - width) / 2 : Math.min(0, Math.max(size.width - width, view.x)),
    y: height <= size.height ? (size.height - height) / 2 : Math.min(0, Math.max(size.height - height, view.y)) };
}

export interface WorldMapProps {
  ram: RamState; manual: PersistentManualState; manualItems: ReadonlySet<InventoryId>; world: WorldState;
  onToggleManualCheck: (id: LocationId) => void;
  onSelectOrb: (id: OrbId, requirement: OrbRequirement) => void;
  onSetOrbCleared?: (id: OrbId, cleared: boolean) => void;
  onSetHintRead?: (id: string, read: boolean) => void;
  onCannonAction?: (action: CannonAction) => void;
}
export function WorldMap({ ram, manual, manualItems, world, onToggleManualCheck, onSelectOrb, onSetOrbCleared, onSetHintRead, onCannonAction }: WorldMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const initializedRef = useRef(false);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<MapView>({ scale: 1, x: 0, y: 0 });
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ checks: true, orbs: true, hints: false });
  const [hovered, setHovered] = useState<OpenMarker>(null);
  const [pinned, setPinned] = useState<OpenMarker>(null);
  const [cannonsVisible, setCannonsVisible] = useState(false);
  const [cannonEditActive, setCannonEditActive] = useState(false);
  const [cannonFooter, setCannonFooter] = useState<HTMLDivElement | null>(null);
  const editingChanged = useCallback((active: boolean) => {
    setCannonEditActive(active);
    if (active) {
      setPinned(null); setHovered(null);
      setView(clampView({ scale: fitScale(size), x: 0, y: 0 }, size));
    }
  }, [size]);
  const open = pinned ?? hovered;
  const officeOpened = useCallback(() => { setPinned(null); setHovered(null); }, []);
  const context = createLogicContext(ram, manualItems, world);
  const areas = activeMapAreas(ram.sandship.supported);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize(next);
      if (!initializedRef.current) {
        initializedRef.current = true;
        setView(clampView({ scale: fitScale(next), x: 0, y: 0 }, next));
      } else setView((current) => clampView(current, next));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const zoomAt = (factor: number, point: { x: number; y: number }) => {
    if (!size.width) return;
    setView((current) => {
      const scale = Math.min(1.6, Math.max(fitScale(size), current.scale * factor));
      const worldX = (point.x - current.x) / current.scale, worldY = (point.y - current.y) / current.scale;
      return clampView({ scale, x: point.x - worldX * scale, y: point.y - worldY * scale }, size);
    });
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".map-popover")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAt(event.deltaY < 0 ? 1.18 : 1 / 1.18, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, .map-popover")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setView((current) => clampView({ ...current, x: current.x + dx, y: current.y + dy }, size));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const markerHandlers = (kind: Layer, id: string) => ({
    onMouseEnter: () => setHovered({ kind, id }),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setHovered({ kind, id }),
    onBlur: (event: FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(null); },
  });
  const togglePin = (kind: Layer, id: string) => setPinned((current) =>
    current?.kind === kind && current.id === id ? null : { kind, id });
  const popupStyle = (x: number, y: number) => {
    // Clamp inside the visible map, including narrow OBS/browser captures.
    const left = Math.min(Math.max(4, x + 12), Math.max(4, size.width - 272));
    const top = Math.min(Math.max(4, y - 10), Math.max(4, size.height - 280));
    return { left: left - x + 11, top: top - y + 11, maxHeight: Math.max(80, size.height - top - 4) };
  };
  const position = (x: number, y: number, dx = 0, dy = 0) => worldToScreen(view, x, y, dx, dy);
  const isOpen = (kind: Layer, id: string) => open?.kind === kind && open.id === id;
  return <section className="map-panel" aria-label="World map">
    <div className="panel-heading map-heading">
      <div><span className="eyebrow">OVERWORLD</span><h2>World map</h2></div>
      <div className="layer-controls" aria-label="Map layers">
        {(["checks", "orbs", "hints"] as const).map((layer) => <button type="button" key={layer}
          className={layers[layer] ? "active" : ""} aria-pressed={layers[layer]}
          onClick={() => { setLayers((current) => ({ ...current, [layer]: !current[layer] })); setPinned(null); }}>
          {layer[0].toUpperCase() + layer.slice(1)} {layers[layer] ? "✓" : "○"}</button>)}
        <button type="button" className={cannonsVisible ? "active" : ""} aria-pressed={cannonsVisible}
          onClick={() => setCannonsVisible((value) => !value)}>Cannons {cannonsVisible ? "✓" : "○"}</button>
      </div>
      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={() => zoomAt(1.25, { x: size.width / 2, y: size.height / 2 })} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.25, { x: size.width / 2, y: size.height / 2 })} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setView(clampView({ scale: fitScale(size), x: 0, y: 0 }, size))}>Fit</button>
      </div>
    </div>
    <div className="map-viewport" ref={viewportRef} onWheel={onWheel}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <img className="map-image" src={overworldImage} alt="Secret of Mana overworld" draggable={false}
        style={{ width: MAP_IMAGE_SIZE.width * view.scale, height: MAP_IMAGE_SIZE.height * view.scale,
          left: view.x, top: view.y, imageRendering: view.scale >= 1 ? "pixelated" : "auto" }} />
      {cannonsVisible && size.width > 0 && <CannonLayer world={world} view={view} footerElement={cannonFooter} onEditingChange={editingChanged}
        viewportSize={size} onOfficeOpen={officeOpened}
        onAction={(action) => onCannonAction?.(action)} />}
      {/* Area, Orb, hint and directed Cannon overlays share one transform. */}
      {layers.checks && size.width > 0 && areas.map((area) => {
        const progress = evaluateArea(area, context, manual);
        const captain = area.id === SANDSHIP.areaId ? evaluateCheck(SANDSHIP.captainId, context, manual) : null;
        const markerName = captain ? SANDSHIP.captainName : area.name;
        const markerStatus = captain ? captain.complete ? "completed" : captain.access === "checkable" ? "partial" : captain.access : progress.status;
        const coords = position(area.x, area.y, area.screenOffset?.x, area.screenOffset?.y);
        return <div key={area.id} inert={cannonEditActive} className={`map-anchor${isOpen("checks", area.id) ? " open" : ""}`}
          style={coords} {...markerHandlers("checks", area.id)}>
          <button type="button" className={`map-pin pin-${markerStatus}`} onClick={() => togglePin("checks", area.id)}
            aria-label={`${markerName}: ${markerStatus}, ${progress.completed} of ${progress.total} complete`}
            aria-expanded={isOpen("checks", area.id)} title={markerName}>
          </button>
          {isOpen("checks", area.id) && <div className="map-popover" style={popupStyle(coords.left, coords.top)}>
            <button type="button" className="popover-close" aria-label="Close popup" onClick={() => { setPinned(null); setHovered(null); }}>×</button>
            <h3>{area.name}</h3>
            <div className="popover-summary">{progress.completed}/{progress.total} complete · {progress.reachable} reachable
              {progress.unknown > 0 && ` · ${progress.unknown} unknown`}</div>
            {area.sourceNote && <p className="source-note">{area.sourceNote}</p>}
            {area.id === SANDSHIP.areaId && <p className="source-note">Boss: {ram.sandship.bossDefeated === null ? "unknown" : ram.sandship.bossDefeated ? "defeated" : "not defeated"}.
              Fixed boss Weapon Orb and Captain randomized prize are separate.</p>}
            <div className="popover-checks">{area.checkIds.map((id) => {
              const check = LOCATION_BY_ID.get(id)!;
              const state = deriveEffectiveCheckState(id, ram, manual);
              const access = evaluateCheck(id, context, manual);
              if (!access.visible) return null;
              return <button key={id} type="button" className={`popover-check ${state.complete ? "complete" : access.access}`}
                onClick={() => onToggleManualCheck(id)} aria-pressed={isManuallyCompleted(manual, id)}
                title={state.completionSource === "ram" ? "Auto-complete; click to add a persistent manual mark" :
                  isManuallyCompleted(manual, id) ? "Click to undo manual completion" : "Click to mark permanently complete"}>
                <span className="check-status-swatch" aria-hidden="true" />
                <span>{check.name}</span>{state.completionSource === "manual" && <small title="Manually completed">M</small>}
              </button>;
            })}</div>
          </div>}
        </div>;
      })}
      {layers.orbs && size.width > 0 && ORB_SOURCE_DEFINITIONS.map((orb) => {
        const offset = ORB_DISPLAY_OFFSET.get(orb.id) ?? { x: 0, y: -22 };
        const coords = position(orb.id === "uf_orb" ? UPPER_LAND_ORB_POSITION.x : orb.x,
          orb.id === "uf_orb" ? UPPER_LAND_ORB_POSITION.y : orb.y, offset.x, offset.y);
        const requirement = world.orbs[orb.id];
        const gate = evaluateOrbGate(context, orb.id);
        const completion = orbCompletion(context, orb.id);
        const completionLabel = completion !== "none" ? `Cleared/open (${completion})` : ram.orbs[orb.id] === null ? "Completion unavailable" : "Not cleared";
        return <div key={orb.id} inert={cannonEditActive} className={`map-anchor orb-anchor${isOpen("orbs", orb.id) ? " open" : ""}`}
          style={coords} {...markerHandlers("orbs", orb.id)}>
          <button type="button" className={`orb-pin orb-${gate}${completion !== "none" ? " orb-cleared" : ""}`} onClick={() => togglePin("orbs", orb.id)}
            aria-label={`${orb.name}: ${requirementLabel(requirement)}, ${gate}${completion !== "none" ? `, cleared (${completion})` : ""}`} aria-expanded={isOpen("orbs", orb.id)}
            title={`${orb.name}: ${requirementLabel(requirement)} · requirement ${gate} · ${completionLabel}`}>
            <span className="orb-sprite"><img src={orbImage} alt="" />
              {requirement.kind === "unknown" && <span className="orb-uncertainty" aria-hidden="true">?</span>}</span>
            {requirement.kind !== "unknown" && <img className="orb-requirement" src={orbRequirementImage(requirement)!} alt={requirementLabel(requirement)} />}
            <small aria-hidden="true">{completion !== "none" ? "✓" : gate === "passable" ? "+" : gate === "blocked" ? "×" : ""}</small>
          </button>
          {isOpen("orbs", orb.id) && <div className="map-popover" style={popupStyle(coords.left, coords.top)}>
            <button type="button" className="popover-close" aria-label="Close popup" onClick={() => { setPinned(null); setHovered(null); }}>×</button>
            <h3>{orb.name}</h3><p className="popover-summary">Requirement: {gate} · {completionLabel}</p>
            <p className="source-note">RAM open flags include seed-preopened Orbs. Ownership alone is not completion.</p>
            <button type="button" className="orb-manual-clear" aria-pressed={world.manualClearedOrbs.includes(orb.id)}
              onClick={() => onSetOrbCleared?.(orb.id, !world.manualClearedOrbs.includes(orb.id))}>
              {world.manualClearedOrbs.includes(orb.id) ? "Undo manual cleared mark" : "Mark Orb cleared manually"}</button>
            <p className="source-note">Manual cleared marks persist; RAM completion follows save-state rollback.</p>
            <div className="orb-options">
              {world.settings.orbMode !== "weapon-only" && <><h4>Magic</h4><div>{ELEMENTS.map((element) =>
                <button key={element} type="button" onClick={() => { onSelectOrb(orb.id, { kind: "element", element }); setPinned(null); setHovered(null); }}>{requirementLabel({ kind: "element", element })}</button>)}</div></>}
              {world.settings.orbMode !== "magic-only" && <><h4>Weapons</h4><div>{WEAPON_FAMILIES.map((weapon) =>
                <button key={weapon} type="button" onClick={() => { onSelectOrb(orb.id, { kind: "weapon-family", weapon }); setPinned(null); setHovered(null); }}>{requirementLabel({ kind: "weapon-family", weapon })}</button>)}</div></>}
              <button type="button" className="unknown-option" onClick={() => { onSelectOrb(orb.id, { kind: "unknown" }); setPinned(null); setHovered(null); }}>Unknown</button>
            </div>
          </div>}
        </div>;
      })}
      {layers.hints && size.width > 0 && activeHintMarkers(ram.sandship).map((hint) => {
        // A small display offset keeps the regional fallback off gameplay pins;
        // the source coordinate remains untouched and is not claimed as exact.
        const coords = position(hint.x, hint.y, hint.screenOffset.x, hint.screenOffset.y);
        // Visibility follows compatibility, while availability follows the existing boss RAM gate.
        const isMorie = hint.id === SANDSHIP.hintId;
        const availability = !isMorie || ram.sandship.bossDefeated === true ? "available" :
          ram.sandship.bossDefeated === false ? "blocked" : "unknown";
        const availabilityLabel = availability === "available" ? "Hint available here" : availability === "blocked" ?
          "Hint unavailable: defeat the Sandship boss first" : "Hint availability unknown: boss state unavailable";
        return <div key={hint.id} inert={cannonEditActive} className={`map-anchor hint-anchor${isOpen("hints", hint.id) ? " open" : ""}`}
          style={coords} {...markerHandlers("hints", hint.id)}>
          <button type="button" className={`hint-pin${isMorie ? ` hint-${availability}` : ""}`} onClick={() => togglePin("hints", hint.id)}
            aria-label={`${hint.name}: ${hint.sources.length} hint sources (regional position)${isMorie ? `, ${availability}` : ""}`}
            aria-expanded={isOpen("hints", hint.id)}><span className="hint-scroll" aria-hidden="true">≡</span></button>
          {isOpen("hints", hint.id) && <div className="map-popover" style={popupStyle(coords.left, coords.top)}>
            <button type="button" className="popover-close" aria-label="Close popup" onClick={() => { setPinned(null); setHovered(null); }}>×</button>
            <h3>{hint.name}</h3><p className="popover-summary">{availabilityLabel}</p>
            {isMorie && <>
              <button type="button" aria-pressed={world.manualReadHints.includes(hint.id)}
                disabled={availability !== "available" && !world.manualReadHints.includes(hint.id)}
                onClick={() => onSetHintRead?.(hint.id, !world.manualReadHints.includes(hint.id))}>
                {world.manualReadHints.includes(hint.id) ? "Mark hint unread" : "Mark hint read"}</button>
              <p className="source-note">Repeatable hint; manual read mark persists independently of RAM.</p>
            </>}
            <p className="source-note">Regional position; individual coordinates unavailable.</p>
            {hint.sources.length > 1 && <ul className="hint-sources">{hint.sources.map((source) =>
              <li key={source.id} data-source-id={source.id}>{source.name}</li>)}</ul>}
          </div>}
        </div>;
      })}
    </div>
    <div className="map-footnote"><div ref={setCannonFooter} /><span>Drag · scroll to zoom · hover or click a marker</span><span>{areas.length} areas · {ORB_SOURCE_DEFINITIONS.length} orbs</span></div>
  </section>;
}
