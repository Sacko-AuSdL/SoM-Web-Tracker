import type { SniStatus } from "../autotracking/SniClient";
import type { CrystalOrbMode } from "../domain/orbs";
import type { Character, WorldSettings, WorldState } from "../state/worldState";
import type { DungeonMode } from "../state/uiPreferences";
import { useState } from "react";
import { parseRandomizerSettings, type ParsedRandomizerSettings, type SettingsDiagnostic } from "../adapters/randomizerSettings";
import { CHARACTERS, isRoleRandomized } from "../state/worldState";
import { effectiveStartingLocation } from "../logic/travel";
import { PARTY_MODES, needsAdditionalIdentity, resolvedStart, type PartyMode } from "../domain/characters";

interface SettingsPanelProps {
  sni: SniStatus;
  onSelectDevice: (device: string) => void;
  world: WorldState;
  onUpdateSetting: <K extends keyof WorldSettings>(key: K, value: WorldSettings[K]) => void;
  onSetOrbMode: (mode: CrystalOrbMode) => void;
  onToggleDisabledCharacter: (character: Character) => void;
  dungeonMode: DungeonMode;
  onSetDungeonMode: (mode: DungeonMode) => void;
  onClose: () => void;
  onImportSettings: (parsed: ParsedRandomizerSettings) => void;
}

export function SettingsPanel({ sni, onSelectDevice, world, onUpdateSetting, onSetOrbMode, onToggleDisabledCharacter,
  dungeonMode, onSetDungeonMode, onClose, onImportSettings }: SettingsPanelProps) {
  const [raw, setRaw] = useState("");
  const [diagnostics, setDiagnostics] = useState<SettingsDiagnostic[]>([]);
  const [imported, setImported] = useState(false);
  const start = resolvedStart(world);
  return (
    <div className="modal-layer">
      <button type="button" className="modal-scrim" aria-label="Close settings" onClick={onClose} />
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="drawer-heading"><div><span className="eyebrow">TRACKER</span><h2 id="settings-title">Settings</h2></div>
          <button type="button" onClick={onClose} aria-label="Close settings">✕</button></div>
        <div className="settings-body">
          <section className="settings-import" aria-label="Settings String import">
            <label htmlFor="randomizer-settings">Randomizer Settings String</label>
            <textarea id="randomizer-settings" value={raw} onChange={(event) => setRaw(event.target.value)}
              placeholder="Paste the Randomizer's version=… mode=open … options string" />
            <button type="button" onClick={() => {
              const parsed = parseRandomizerSettings(raw);
              setDiagnostics(parsed.diagnostics);
              setImported(parsed.settings !== null);
              if (parsed.settings) onImportSettings(parsed);
            }}>Import / Apply</button>
            {imported && <p className="import-success" role="status">Settings imported successfully.</p>}
            {diagnostics.some((d) => d.level === "error") && <ul role="alert">{diagnostics.filter((d) => d.level === "error").map((d, index) => <li className="import-error" key={index}>{d.message}</li>)}</ul>}
            {diagnostics.some((d) => d.level === "warning") && <details><summary>Parser diagnostics</summary>
              <ul>{diagnostics.filter((d) => d.level === "warning").map((d, index) => <li key={index}>{d.message}</li>)}</ul></details>}
          </section>
          <div className="settings-grid">
            <label>Logic<select value={world.settings.logic} onChange={(event) => onUpdateSetting("logic", event.target.value as WorldSettings["logic"])}>
              <option value="basic">Basic</option><option value="restrictive">Restrictive</option>
            </select></label>
            <label>Flammie Drum<select value={world.settings.drumLogic} onChange={(event) => onUpdateSetting("drumLogic", event.target.value as WorldSettings["drumLogic"])}>
              <option value="normal">Out of logic (default)</option><option value="random">In logic (find Drum)</option>
            </select></label>
            <label>Roles<select value={world.settings.roleMode} onChange={(event) => onUpdateSetting("roleMode", event.target.value as WorldSettings["roleMode"])}>
              <option value="normal">Normal</option><option value="random">Random</option>
            </select></label>
            <label>Crystal Orbs<select value={world.settings.orbMode} onChange={(event) => onSetOrbMode(event.target.value as CrystalOrbMode)}>
              <option value="magic-only">Magic Only</option><option value="mixed">Mixed</option><option value="weapon-only">Weapon Only</option>
            </select></label>
            <label>Cannon Travel<select value={world.settings.cannonMode} onChange={(event) => onUpdateSetting("cannonMode", event.target.value as WorldSettings["cannonMode"])}>
              <option value="vanilla">Vanilla</option><option value="open">Open</option><option value="shuffle">Shuffle</option><option value="chaos">Chaos</option>
            </select></label>
            <label>Starting Location<select value={world.settings.startingLocation} onChange={(event) => onUpdateSetting("startingLocation", event.target.value as WorldSettings["startingLocation"])}>
              <option value="default">Default</option><option value="kakkara">Kakkara</option>
            </select></label>
            <label>Starting Character<select value={world.settings.startingCharacter} onChange={(event) => onUpdateSetting("startingCharacter", event.target.value as WorldSettings["startingCharacter"])}>
              {CHARACTERS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}<option value="unresolved">Random · seed identity unresolved</option>
            </select></label>
            <label>Additional Characters<select value={world.settings.partyMode} onChange={(event) => onUpdateSetting("partyMode", event.target.value as PartyMode)}>
              {Object.entries(PARTY_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            {world.settings.startingCharacter === "unresolved" && <label>Identify starting slot<select value={world.settings.resolvedStartingCharacter ?? ""}
              onChange={(event) => onUpdateSetting("resolvedStartingCharacter", event.target.value as Character || null)}>
              <option value="">Unresolved</option>{CHARACTERS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select></label>}
            {needsAdditionalIdentity(world.settings.partyMode) && <label>Identify {world.settings.partyMode.startsWith("start-") ? "additional starting" : "findable"} slot<select
              disabled={!start} value={world.settings.additionalCharacter ?? ""} onChange={(event) => onUpdateSetting("additionalCharacter", event.target.value as Character || null)}>
              <option value="">Seed identity unresolved</option>{CHARACTERS.filter((slot) => slot !== start).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select></label>}
            <label>Dungeon Map<select value={dungeonMode} onChange={(event) => onSetDungeonMode(event.target.value as DungeonMode)}>
              <option value="auto">Auto (verified maps only)</option><option value="hidden">Hidden</option>
            </select></label>
            <label>Goal<select value={world.settings.goal} onChange={(event) => onUpdateSetting("goal", event.target.value as WorldSettings["goal"])}>
              <option value="short">Short</option><option value="long">Long</option><option value="revive">Revive the Tree</option>
            </select></label>
            {world.settings.goal === "revive" && <label>Seeds needed<select value={world.settings.reviveSeedCount}
              onChange={(event) => onUpdateSetting("reviveSeedCount", Number(event.target.value))}>
              {[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count}</option>)}
            </select></label>}
          </div>
          <p className="settings-hint">Effective start: {effectiveStartingLocation(world.settings) === "kakkara" ? "Kakkara" : "Default"}.
            Kakkara requires Flammie Drum in logic. Open: deterministic routes; Shuffle/Chaos: enter known routes on the map.</p>
          <div className="slot-role-settings">{CHARACTERS.map((slot) => <label key={slot}>{slot} role
            <select value={isRoleRandomized(world, slot) ? "random" : `OG${world.settings.fixedRoles[slot] ?? slot}`}
              onChange={(event) => {
                const random = event.target.value === "random";
                onUpdateSetting("roleModeBySlot", { ...world.settings.roleModeBySlot, [slot]: random ? "random" : "normal" });
                if (!random) onUpdateSetting("fixedRoles", { ...world.settings.fixedRoles, [slot]: event.target.value.slice(2) as Character });
              }}><option value="random">Randomized (?)</option><option value="OGboy">Boy / Warrior</option>
              <option value="OGgirl">Girl / Light Mage</option><option value="OGsprite">Sprite / Dark Mage</option></select>
          </label>)}</div>
          <fieldset className="character-settings"><legend>Disabled characters (if configured by seed)</legend>
            {(["boy", "girl", "sprite"] as const).map((character) => <label key={character}><input type="checkbox"
              checked={world.disabledCharacters.includes(character)} onChange={() => onToggleDisabledCharacter(character)} />{character}</label>)}
          </fieldset>
          <p className="settings-hint">Changing Crystal Orb mode clears requirements that are invalid in the new mode. Check/orb settings persist locally; inventory manual marks remain session-only.</p>
          <label className="field-label" htmlFor="sni-device">SNI device</label>
          <select id="sni-device" value={sni.attachedDevice ?? ""} disabled={sni.devices.length === 0}
            onChange={(event) => onSelectDevice(event.target.value)}>
            {sni.devices.length === 0 && <option value="">No device found</option>}
            {sni.devices.map((device) => <option key={device} value={device}>{device}</option>)}
          </select>
          <p className="settings-hint">Endpoint: <code>{sni.endpoint}</code></p>
          <p className="settings-hint">To change the endpoint, set <code>VITE_SNI_ENDPOINT</code> before starting the tracker.</p>
        </div>
      </section>
    </div>
  );
}
