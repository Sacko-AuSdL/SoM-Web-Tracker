import { useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { INVENTORY_DEFINITIONS, type InventoryId } from "../data/inventoryDefinitions";
import type { RamState } from "../state/trackerState";
import { CHARACTERS, ROLE_LABELS, effectiveRole, gpHintState, isRoleRandomized, type Character, type Role, type WorldState } from "../state/worldState";
import type { InventoryMode } from "../state/uiPreferences";
import { characterRoleOverlay, inventoryImage } from "./assets";
import { availabilityLabel, characterAvailability, characterPresent } from "../domain/characters";
import { ELEMENTS, WEAPON_FAMILIES, type GpRequirementId } from "../domain/orbs";
import { countManaSeeds } from "../logic/inventory";
import { allowedRevivalCounts, revivalRequiredCount, revivalRequirementLabel } from "../domain/revival";

const categories = [
  { id: "character", title: "Characters" }, { id: "element", title: "Elements" },
  { id: "weapon", title: "Weapons" }, { id: "key-item", title: "Key items" },
  { id: "seed", title: "Mana seeds" },
] as const;
const orbStageId: Partial<Record<InventoryId, InventoryId>> = {
  "weapon-gloves": "weapon-orbs-gloves", "weapon-sword": "weapon-orbs-sword",
  "weapon-axe": "weapon-orbs-axe", "weapon-spear": "weapon-orbs-spear",
  "weapon-whip": "weapon-orbs-whip", "weapon-bow": "weapon-orbs-bow",
  "weapon-boomerang": "weapon-orbs-boomerang", "weapon-javelin": "weapon-orbs-javelin",
};
const presentationIds: readonly string[] = [...ELEMENTS.map((id) => `element-${id}`), ...WEAPON_FAMILIES.map((id) => `weapon-${id}`)];
const displayDefinitions = [...INVENTORY_DEFINITIONS].sort((a, b) => presentationIds.indexOf(a.id) - presentationIds.indexOf(b.id));
interface ItemPanelProps {
  ram: RamState; manualItems: ReadonlySet<InventoryId>; world: WorldState;
  mode: InventoryMode;
  onSetMode: (mode: InventoryMode) => void;
  onToggleManualItem: (id: InventoryId) => void;
  onSetRole: (character: Character, role: Role) => void;
  onToggleGp?: (id: GpRequirementId) => void;
  onResolveRevival?: (count: number | null) => void;
  onOpenInventoryWindow?: () => void;
  onCloseInventoryWindow?: () => void;
}
export function ItemPanel({ ram, manualItems, world, mode, onSetMode, onToggleManualItem, onSetRole, onToggleGp, onResolveRevival, onOpenInventoryWindow, onCloseInventoryWindow }: ItemPanelProps) {
  const neededSeeds = revivalRequiredCount(world);
  const neededLabel = revivalRequirementLabel(world);
  const seedCount = countManaSeeds(ram, manualItems);
  const [rolePicker, setRolePicker] = useState<{ slot: Character; left: number; top: number } | null>(null);
  const openRolePicker = (event: MouseEvent<HTMLButtonElement>, slot: Character) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setRolePicker((current) => current?.slot === slot ? null : {
      slot, left: Math.max(8, Math.min(rect.right + 8, window.innerWidth - 196)),
      top: Math.max(8, Math.min(rect.top, window.innerHeight - 240)),
    });
  };
  return <aside className="item-panel" data-layout={mode} aria-label="Inventory">
    <div className="panel-heading"><div><span className="eyebrow">YOUR PARTY</span><h2>Inventory</h2></div>
      <div className="inventory-mode-toggle" aria-label="Inventory layout">
        <button type="button" aria-label="Normal inventory" title="Normal" aria-pressed={mode === "normal"}
          onClick={() => onSetMode("normal")}>N</button>
        <button type="button" aria-label="Compact inventory" title="Compact" aria-pressed={mode === "compact"}
          onClick={() => onSetMode("compact")}>C</button>
        <button type="button" aria-label="Square inventory" title="Square" aria-pressed={mode === "square"}
          onClick={() => onSetMode("square")}>S</button>
        {onOpenInventoryWindow && <button type="button" aria-label="Open Inventory Window" title="Open Inventory Window" onClick={onOpenInventoryWindow}>↗</button>}
        {onCloseInventoryWindow && <button type="button" aria-label="Close inventory window" title="Close inventory window" onClick={onCloseInventoryWindow}>x</button>}
      </div>
    </div>
    <div className="item-scroll">
      {categories.map((category) => <section className="item-category" data-category={category.id} key={category.id} aria-label={category.title}>
        <h3>{category.title}</h3>
        {category.id === "seed" && world.settings.goal === "revive" &&
          <p className="revival-count" role="status" aria-label={`Mana Seeds: ${seedCount} / ${neededLabel}`}>
            Mana Seeds: {seedCount} / <span className="revival-required" title={`Mana Tree Revival (MTR). Required: ${neededLabel}${world.manualReviveSeedCount !== null ? " (manual resolution)" : " (imported/configured)"}. Click to choose. Unknown / Reset removes only the manual resolution.`}>
              <span aria-hidden="true">{neededLabel}</span>
              <select aria-label="Required Mana Seeds" value={neededSeeds ?? ""}
                onChange={(event) => onResolveRevival?.(event.target.value === "" ? null : Number(event.target.value))}>
                <option value="">Unknown / Reset</option>
                {allowedRevivalCounts(world.settings).map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </span>
          </p>}
        <div className="item-grid">{displayDefinitions.filter((item) => item.category === category.id).map((definition) => {
          const id = definition.id;
          const ramValue = ram.inventory[id];
          const manual = manualItems.has(id);
          const character = category.id === "character" ? id as Character : null;
          const availability = character ? characterAvailability(world, character) : null;
          const acquired = character ? characterPresent(world, ram, manualItems, character) : ramValue === true || manual;
          const src = inventoryImage(id);
          const stageId = orbStageId[id];
          const stage = stageId ? ram.inventory[stageId] : null;
          const gpId = ((category.id === "element" && world.settings.orbMode !== "weapon-only") ||
            (category.id === "weapon" && world.settings.orbMode !== "magic-only")) ? id as GpRequirementId : null;
          const gpHint = gpId ? gpHintState(world, gpId) : "unknown";
          const gpLabel = gpHint === "unknown" ? "Grand Palace hint unknown" : `${gpHint === "required" ? "required" : "not required"} for Grand Palace`;
          const nextGpLabel = gpHint === "unknown" ? "required" : gpHint === "required" ? "not required" : "unknown";
          const randomized = character !== null && isRoleRandomized(world, character);
          const assignedRole = character ? effectiveRole(world, character) : "unknown";
          const showRole = randomized || (character !== null && assignedRole !== character);
          const status = ramValue === true ? "Auto" : ramValue === false && character ? "Missing (RAM)" : manual ? "Manual" :
            acquired && character ? "Configured" : ramValue === null ? "Unknown" : "Missing";
          return <div key={id} className={`inventory-slot ${acquired ? "acquired" : "unowned"}`}>
            <button type="button" className="item-card" onClick={(event) => randomized && character ? openRolePicker(event, character) : onToggleManualItem(id)}
              aria-label={character ? `${definition.name} slot: ${acquired ? "present" : "not present"}; ${status}. ${randomized ?
                `Randomized role: ${ROLE_LABELS[assignedRole]}. Choose role` : `${showRole ? `Fixed role: ${ROLE_LABELS[assignedRole]}. ` : ""}${manual ? "Clear" : "Add"} manual mark`}` :
                `${definition.name}: ${acquired ? "acquired" : "not acquired"}; ${status}. ${manual ? "Clear" : "Add"} manual mark`}
              aria-pressed={randomized ? rolePicker?.slot === character : manual}
              title={`${definition.name}${character ? " slot" : ""} · ${status}${availability ? ` · ${availabilityLabel(availability)}` : ""}${randomized ? ` · randomized role: ${ROLE_LABELS[assignedRole]}. Click to choose.` :
                `. Click to ${manual ? "clear" : "add"} session mark.`}`}>
              {src && <img src={src} alt="" className="item-icon" />}
              {availability && <span className={`availability-badge ${availability.disposition}`} data-availability={availability.disposition}
                aria-label={availabilityLabel(availability)} title={availabilityLabel(availability)}>
                {availability.disposition === "starting" ? "S" : availability.disposition === "findable" ? "F" : availability.disposition === "absent" ? "×" : "…"}
              </span>}
              {showRole && <img src={characterRoleOverlay(assignedRole)} alt="" className="role-overlay"
                data-role={assignedRole} aria-hidden="true" />}
              {stageId && <span className="weapon-stage" title={`${definition.name} orb stage: ${stage ?? "unknown"}`}>{stage ?? "–"}</span>}
              {manual && <span className="manual-indicator" aria-hidden="true">M</span>}
            </button>
            {gpId && <button type="button" className={`gp-badge ${gpHint}`} data-gp-state={gpHint}
              aria-label={`${definition.name}: ${gpLabel}`} aria-pressed={gpHint === "unknown" ? "mixed" : gpHint === "required"}
              title={`${definition.name}: ${gpLabel}. Click to mark ${nextGpLabel}; ownership is unchanged.`}
              onClick={(event) => { event.stopPropagation(); onToggleGp?.(gpId); }}>{gpHint === "unknown" ? "·" : "GP"}</button>}
            {mode === "square" && character && <span className="square-character-label">{definition.name}</span>}
          </div>;
        })}</div>
      </section>)}
    </div>
    {!onCloseInventoryWindow && <p className="panel-note">Click items for session marks; randomized characters open a role picker. Weapon numbers show orb stages.</p>}
    {rolePicker && isRoleRandomized(world, rolePicker.slot) && createPortal(<div className="role-picker"
      role="dialog" aria-label={`${rolePicker.slot} randomized role`} style={{ left: rolePicker.left, top: rolePicker.top }}>
      <div className="role-picker-heading"><strong>{rolePicker.slot} slot · role</strong>
        <button type="button" aria-label="Close role picker" onClick={() => setRolePicker(null)}>×</button></div>
      <div className="role-picker-options">{(["unknown", ...CHARACTERS] as Role[]).map((role) =>
        <button type="button" key={role} aria-pressed={world.roles[rolePicker.slot] === role}
          onClick={() => { onSetRole(rolePicker.slot, role); setRolePicker(null); }}>
          <img src={characterRoleOverlay(role)} alt="" />{role === "unknown" ? "Unknown (?)" : ROLE_LABELS[role]}
        </button>)}</div>
      <button type="button" className="role-manual" onClick={() => onToggleManualItem(rolePicker.slot)}>
        {manualItems.has(rolePicker.slot) ? "Clear session presence mark" : "Mark slot present for session"}
      </button>
    </div>, document.body)}
  </aside>;
}
