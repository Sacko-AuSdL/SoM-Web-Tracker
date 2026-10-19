import { useEffect, useState } from "react";
import { Autotracker, type AutotrackerSnapshot } from "./autotracking/Autotracker";
import type { InventoryId } from "./data/inventoryDefinitions";
import type { LocationId } from "./data/locationDefinitions";
import type { CrystalOrbMode, OrbId, OrbRequirement } from "./domain/orbs";
import { activeDungeon } from "./data/dungeons";
import { countTrackerProgress } from "./logic/progress";
import { createLogicContext } from "./logic/reachability";
import {
  isManuallyCompleted, loadManualState, saveManualState, setManualCompletion,
  type PersistentManualState,
} from "./state/trackerState";
import { DebugPanel } from "./ui/DebugPanel";
import { DungeonMapPanel } from "./ui/DungeonMapPanel";
import { ItemPanel } from "./ui/ItemPanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { WorldMap } from "./ui/WorldMap";
import { emptyWorldState, loadWorldState, saveWorldState, setOrbMode, setOrbRequirement, setRoleIdentity, setOrbCleared, setHintRead,
  addCannonConnection, removeCannonConnection, replaceCannonConnection, clearCannonConnections, setCannonOfficeClosed,
  toggleGpRequirement, type Character, type Role, type WorldSettings, type WorldState } from "./state/worldState";
import { resetTracking, type ResetScope } from "./state/resetTracking";
import { loadUiPreferences, saveUiPreferences, type DungeonMode, type InventoryMode } from "./state/uiPreferences";
import { applyRandomizerSettings } from "./adapters/randomizerSettings";
import type { CannonAction } from "./ui/CannonLayer";

const endpoint = import.meta.env.VITE_SNI_ENDPOINT || "ws://localhost:23074";
const autotracker = new Autotracker(endpoint);

export default function App() {
  const [snapshot, setSnapshot] = useState<AutotrackerSnapshot>(() => autotracker.getSnapshot());
  const [manual, setManual] = useState<PersistentManualState>(() => loadManualState(window.localStorage));
  const [manualItems, setManualItems] = useState<ReadonlySet<InventoryId>>(() => new Set());
  const [world, setWorld] = useState<WorldState>(() => typeof window === "undefined" ? emptyWorldState() : loadWorldState(window.localStorage));
  const [ui, setUi] = useState(() => loadUiPreferences(window.localStorage));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = autotracker.subscribe(setSnapshot);
    autotracker.start();
    return () => { unsubscribe(); autotracker.stop(); };
  }, []);
  useEffect(() => saveManualState(window.localStorage, manual), [manual]);
  useEffect(() => saveWorldState(window.localStorage, world), [world]);
  useEffect(() => saveUiPreferences(window.localStorage, ui), [ui]);
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
  const toggleManualItem = (id: InventoryId) => {
    setManualItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectDevice = (device: string) => { void autotracker.selectDevice(device); };
  const reset = (scope: ResetScope) => {
    const next = resetTracking(scope, { world, manual, manualItems });
    setWorld(next.world); setManual(next.manual); setManualItems(next.manualItems);
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
  const progress = countTrackerProgress(createLogicContext(snapshot.ram, manualItems, world), manual);
  const dungeon = activeDungeon(ui.dungeonMode, snapshot.gameDetected ? snapshot.game?.currentMap : null);

  return (
    <div className={`tracker-shell inventory-${ui.inventoryMode}`}>
      <header className="topbar">
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
      </header>

      <div className="workspace">
        <ItemPanel ram={snapshot.ram} manualItems={manualItems} world={world} mode={ui.inventoryMode}
          onSetMode={(mode: InventoryMode) => setUi((current) => ({ ...current, inventoryMode: mode }))}
          onToggleManualItem={toggleManualItem} onSetRole={setRole}
          onToggleGp={(id) => setWorld((current) => toggleGpRequirement(current, id))} />
        <div className={`map-surfaces${dungeon ? " with-dungeon" : ""}`}>
          <WorldMap ram={snapshot.ram} manual={manual} manualItems={manualItems} world={world}
            onToggleManualCheck={toggleManualCheck} onSelectOrb={selectOrb}
            onSetOrbCleared={(id, cleared) => setWorld((current) => setOrbCleared(current, id, cleared))}
            onSetHintRead={(id, read) => setWorld((current) => setHintRead(current, id, read))}
            onCannonAction={cannonAction} />
          {dungeon && <DungeonMapPanel dungeon={dungeon} />}
        </div>
      </div>

      <footer className="footerbar">
        <div><button type="button" onClick={() => setSettingsOpen(true)}>Settings</button>
          <button type="button" onClick={() => setDebugOpen((open) => !open)} aria-expanded={debugOpen}>Debug</button></div>
        <div className="footer-meta"><a href="/POPTRACKER_LICENSE.txt" target="_blank" rel="noreferrer">PopTracker source notice</a>
          <a href="/fonts/license.txt" target="_blank" rel="noreferrer">Manaspace · zone38</a></div>
      </footer>

      {settingsOpen && <SettingsPanel sni={snapshot.sni} onSelectDevice={selectDevice} world={world}
        onReset={reset}
        onClearCannonNetwork={() => setWorld((current) => clearCannonConnections(current))}
        onUpdateSetting={updateSetting} onSetOrbMode={changeOrbMode} onToggleDisabledCharacter={toggleDisabledCharacter}
        onImportSettings={(parsed) => setWorld((current) => applyRandomizerSettings(current, parsed))}
        dungeonMode={ui.dungeonMode}
        inventoryMode={ui.inventoryMode}
        onSetInventoryMode={(mode) => setUi((current) => ({ ...current, inventoryMode: mode }))}
        onSetDungeonMode={(mode: DungeonMode) => setUi((current) => ({ ...current, dungeonMode: mode }))}
        onClose={() => setSettingsOpen(false)} />}
      {debugOpen && <DebugPanel snapshot={snapshot} onClose={() => setDebugOpen(false)} />}
    </div>
  );
}
