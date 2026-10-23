import { useEffect, useState } from "react";
import { Autotracker, type AutotrackerSnapshot } from "./autotracking/Autotracker";
import type { LocationId } from "./data/locationDefinitions";
import type { CrystalOrbMode, OrbId, OrbRequirement } from "./domain/orbs";
import { activeDungeon } from "./data/dungeons";
import { countTrackerProgress } from "./logic/progress";
import { createLogicContext } from "./logic/reachability";
import {
  isManuallyCompleted, loadManualState, saveManualState, setManualCompletion,
  type PersistentManualState, MANUAL_STORAGE_KEY,
} from "./state/trackerState";
import { DebugPanel } from "./ui/DebugPanel";
import { DungeonMapPanel } from "./ui/DungeonMapPanel";
import { ItemPanel } from "./ui/ItemPanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { WorldMap } from "./ui/WorldMap";
import { emptyWorldState, loadWorldState, saveWorldState, setOrbMode, setOrbRequirement, setRoleIdentity, setOrbCleared, setHintRead,
  addCannonConnection, removeCannonConnection, replaceCannonConnection, clearCannonConnections, setCannonOfficeClosed,
  cycleGpHint, setReviveSeedResolution, WORLD_STORAGE_KEY, type Character, type Role, type WorldSettings, type WorldState } from "./state/worldState";
import { resetTracking, type ResetScope } from "./state/resetTracking";
import { isInventoryMode, loadUiPreferences, saveUiPreferences, loadPopoutInventoryMode, savePopoutInventoryMode, type DungeonMode, type InventoryMode, type PresentationMode } from "./state/uiPreferences";
import { useManualInventorySession } from "./state/useManualInventorySession";
import { applyRandomizerSettings } from "./adapters/randomizerSettings";
import type { CannonAction } from "./ui/CannonLayer";

const endpoint = import.meta.env.VITE_SNI_ENDPOINT || "ws://localhost:23074";
const autotracker = new Autotracker(endpoint);

export default function App() {
  const [popout] = useState(() => new URLSearchParams(window.location.search).get("view") === "inventory-popout");
  const [snapshot, setSnapshot] = useState<AutotrackerSnapshot>(() => autotracker.getSnapshot());
  const [manual, setManual] = useState<PersistentManualState>(() => loadManualState(window.localStorage));
  const [manualItems, toggleManualItem, clearManualItems] = useManualInventorySession();
  const [world, setWorld] = useState<WorldState>(() => typeof window === "undefined" ? emptyWorldState() : loadWorldState(window.localStorage));
  const [ui, setUi] = useState(() => {
    const preferences = loadUiPreferences(window.localStorage);
    const params = new URLSearchParams(window.location.search);
    const layout = params.get("layout");
    if (popout) return { ...preferences, inventoryMode: isInventoryMode(layout) ? layout : loadPopoutInventoryMode(window.localStorage) };
    return params.get("view") === "broadcast" ? { ...preferences, presentation: "broadcast" as const } : preferences;
  });
  const broadcast = !popout && ui.presentation === "broadcast";
  const [windowNotice, setWindowNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  useEffect(() => { if (popout) document.title = "Secret of Mana Inventory"; }, [popout]);
  const setInventoryMode = (mode: InventoryMode) => {
    if (popout) {
      const url = new URL(window.location.href); url.searchParams.set("layout", mode);
      window.history.replaceState(null, "", url);
    }
    setUi((current) => ({ ...current, inventoryMode: mode }));
  };
  const setPresentation = (presentation: PresentationMode) => {
    const url = new URL(window.location.href);
    if (presentation === "broadcast") url.searchParams.set("view", "broadcast");
    else if (url.searchParams.get("view") === "broadcast") url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
    setUi(current => ({ ...current, presentation }));
  };
  const inventoryWindowUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "inventory-popout"); url.searchParams.set("layout", ui.inventoryMode);
    return url.href;
  };
  const openInventoryWindow = () => {
    const width = ui.inventoryMode === "square" ? 350 : ui.inventoryMode === "compact" ? 190 : 260;
    if (!window.open(inventoryWindowUrl(), "som-inventory-popout", `popup,width=${width},height=780`)) {
      setWindowNotice("Pop-up blocked. Allow this site's pop-ups or use the inventory link below.");
    }
  };
  useEffect(() => {
    if (!broadcast && !popout) return;
    const exitBroadcast = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || (event.target instanceof HTMLElement && event.target.matches("input,select,textarea,[contenteditable]"))) return;
      if (settingsOpen || debugOpen) return;
      if (event.key === "Escape" && broadcast) { event.preventDefault(); setPresentation("normal"); return; }
      const modes: Record<string, InventoryMode> = { n: "normal", c: "compact", s: "square" };
      const mode = modes[event.key.toLowerCase()];
      if (mode) { event.preventDefault(); setInventoryMode(mode); }
    };
    window.addEventListener("keydown", exitBroadcast);
    return () => window.removeEventListener("keydown", exitBroadcast);
  }, [broadcast, popout, settingsOpen, debugOpen]);

  useEffect(() => {
    const unsubscribe = autotracker.subscribe(setSnapshot);
    autotracker.start();
    return () => { unsubscribe(); autotracker.stop(); };
  }, []);
  useEffect(() => saveManualState(window.localStorage, manual), [manual]);
  useEffect(() => saveWorldState(window.localStorage, world), [world]);
  useEffect(() => {
    if (popout) savePopoutInventoryMode(window.localStorage, ui.inventoryMode);
    else saveUiPreferences(window.localStorage, ui);
  }, [ui, popout]);
  useEffect(() => {
    const receiveStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.key === null || event.key === WORLD_STORAGE_KEY) setWorld(loadWorldState(window.localStorage));
      if (event.key === null || event.key === MANUAL_STORAGE_KEY) setManual(loadManualState(window.localStorage));
    };
    window.addEventListener("storage", receiveStorage);
    return () => window.removeEventListener("storage", receiveStorage);
  }, []);
  useEffect(() => {
    if (!settingsOpen && !debugOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSettingsOpen(false); setDebugOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, debugOpen]);

  const toggleManualCheck = (id: LocationId) => {
    setManual((current) => setManualCompletion(current, id, !isManuallyCompleted(current, id)));
  };
  const selectDevice = (device: string) => { void autotracker.selectDevice(device); };
  const reset = (scope: ResetScope) => {
    const next = resetTracking(scope, { world, manual, manualItems });
    setWorld(next.world); setManual(next.manual);
    if (scope !== "orbs") clearManualItems();
  };
  const updateSetting = <K extends keyof WorldSettings>(key: K, value: WorldSettings[K]) =>
    setWorld((current) => ({ ...current, settings: { ...current.settings, [key]: value,
      ...(key === "startingCharacter" || key === "partyMode" || key === "resolvedStartingCharacter" ? { additionalCharacter: null } : {}),
      ...(key === "startingCharacter" ? { resolvedStartingCharacter: null } : {}),
      ...(key === "roleMode" ? { roleModeBySlot: {}, fixedRoles: {} } : {}) } }));
  const toggleDisabledCharacter = (character: Character) => setWorld((current) => ({
    ...current, disabledCharacters: current.disabledCharacters.includes(character) ?
      current.disabledCharacters.filter((value) => value !== character) : [...current.disabledCharacters, character],
  }));
  const selectOrb = (id: OrbId, requirement: OrbRequirement) =>
    setWorld((current) => setOrbRequirement(current, id, requirement));
  const changeOrbMode = (mode: CrystalOrbMode) => setWorld((current) => setOrbMode(current, mode));
  const setRole = (character: Character, role: Role) =>
    setWorld((current) => setRoleIdentity(current, character, role));
  const cannonAction = (action: CannonAction) => setWorld((current) => {
    if (action.kind === "add") return addCannonConnection(current, action.edge);
    if (action.kind === "remove") return removeCannonConnection(current, action.id);
    if (action.kind === "replace") return replaceCannonConnection(current, action.id, action.edge);
    if (action.kind === "closed") return setCannonOfficeClosed(current, action.office, action.closed);
    return clearCannonConnections(current);
  });
  const sniConnected = snapshot.sni.phase === "attached";
  const logicContext = createLogicContext(snapshot.ram, manualItems, world);
  const progress = countTrackerProgress(logicContext, manual);
  const dungeon = activeDungeon(ui.dungeonMode, snapshot.gameDetected ? snapshot.game?.currentMap : null);

  return (
    <div className={`tracker-shell inventory-${ui.inventoryMode}${broadcast ? " presentation-broadcast" : ""}${popout ? " inventory-popout" : ""}`}>
      {!popout && <header className="topbar">
        <div className="brand">
          <div><strong>Secret of Mana</strong><span>Open Mode Tracker</span></div></div>
        <div className="top-status">
          <span className="progress-pill" aria-label={`Checks: ${progress.completed} of ${progress.total} completed`}>
            <span>CHECKS</span><strong>{progress.completed} / {progress.total}</strong>
          </span>
          <span className="progress-pill available" title={`${progress.available} reachable unfinished checks in ${progress.availableAreas} areas`}
            aria-label={`Available: ${progress.available} reachable unfinished checks`}>
            <span>AVAILABLE</span><strong>{progress.available}</strong>
          </span>
          <span className={`status-pill ${sniConnected ? "online" : "offline"}`} title={snapshot.sni.error ?? snapshot.sni.phase}>
            <i aria-hidden="true" /> SNI <strong>{sniConnected ? "Connected" : "Disconnected"}</strong>
          </span>
          <span className={`status-pill ${snapshot.gameDetected ? "online" : "offline"}`} title={snapshot.error ?? undefined}>
            <i aria-hidden="true" /> Game <strong>{snapshot.gameDetected ? "Detected" : "Not detected"}</strong>
          </span>
        </div>
      </header>}

      <div className="workspace">
        <ItemPanel ram={snapshot.ram} manualItems={manualItems} world={world} mode={ui.inventoryMode}
          onSetMode={setInventoryMode}
          onOpenInventoryWindow={popout ? undefined : openInventoryWindow}
          onCloseInventoryWindow={popout ? () => { window.close(); setWindowNotice("If this tab was opened directly, close it using your browser's tab controls."); } : undefined}
          onToggleManualItem={toggleManualItem} onSetRole={setRole}
          onToggleGp={(id) => setWorld((current) => cycleGpHint(current, id))}
          onResolveRevival={(count) => setWorld((current) => setReviveSeedResolution(current, count))} />
        {!popout && <div className={`map-surfaces${dungeon ? " with-dungeon" : ""}`}>
          <WorldMap ram={snapshot.ram} manual={manual} manualItems={manualItems} world={world}
            onToggleManualCheck={toggleManualCheck} onSelectOrb={selectOrb}
            onSetOrbCleared={(id, cleared) => setWorld((current) => setOrbCleared(current, id, cleared))}
            onSetHintRead={(id, read) => setWorld((current) => setHintRead(current, id, read))}
            onCannonAction={cannonAction} />
          {dungeon && <DungeonMapPanel dungeon={dungeon} />}
        </div>}
      </div>

      {windowNotice && <p className="window-notice" role="status">{windowNotice}
        {!popout && <> <a href={inventoryWindowUrl()} target="_blank" rel="noreferrer">Open Inventory Window</a></>}</p>}
      {popout && <div className="popout-connection" role="status" title={`${snapshot.sni.error ?? snapshot.sni.phase}${snapshot.error ? ` · ${snapshot.error}` : ""}. Each window connects to its own local SNI device.`}>
        SNI {sniConnected ? "Connected" : "Disconnected"} · Game {snapshot.gameDetected ? "Detected" : "Not detected"}
        {snapshot.sni.devices.length > 1 && <select aria-label="Inventory SNI device" value={snapshot.sni.attachedDevice ?? ""}
          onChange={event => selectDevice(event.target.value)}>{snapshot.sni.devices.map(device => <option key={device} value={device}>{device}</option>)}</select>}
      </div>}

      {!popout && <footer className="footerbar">
        <div><button type="button" onClick={() => setSettingsOpen(true)}>Settings</button>
          <button type="button" onClick={() => setDebugOpen((open) => !open)} aria-expanded={debugOpen}>Debug</button>
          <button type="button" aria-label="Broadcast presentation" aria-pressed={broadcast} title="Full-page black presentation · Escape to exit"
            onClick={() => setPresentation(broadcast ? "normal" : "broadcast")}>{broadcast ? "Exit Broadcast (Esc)" : "Broadcast"}</button></div>
        <div className="footer-meta"><a href={`${import.meta.env.BASE_URL}POPTRACKER_LICENSE.txt`} target="_blank" rel="noreferrer">PopTracker source notice</a>
          <a href={`${import.meta.env.BASE_URL}fonts/license.txt`} target="_blank" rel="noreferrer">Manaspace · zone38</a></div>
      </footer>}

      {settingsOpen && <SettingsPanel sni={snapshot.sni} onSelectDevice={selectDevice} world={world}
        onReset={reset}
        onClearCannonNetwork={() => setWorld((current) => clearCannonConnections(current))}
        onUpdateSetting={updateSetting} onSetOrbMode={changeOrbMode} onToggleDisabledCharacter={toggleDisabledCharacter}
        onImportSettings={(parsed) => setWorld((current) => applyRandomizerSettings(current, parsed))}
        dungeonMode={ui.dungeonMode}
        inventoryMode={ui.inventoryMode}
        onSetInventoryMode={setInventoryMode}
        onSetDungeonMode={(mode: DungeonMode) => setUi((current) => ({ ...current, dungeonMode: mode }))}
        onClose={() => setSettingsOpen(false)} />}
      {debugOpen && <DebugPanel snapshot={snapshot} context={logicContext} onClose={() => setDebugOpen(false)} />}
    </div>
  );
}
