import { ELEMENTS, WEAPON_FAMILIES, requirementAllowed, requirementId, requirementLabel,
  type CrystalOrbMode, type OrbRequirement } from "../domain/orbs";
import { orbRequirementImage } from "./assets";

export function OrbRequirementPicker({ mode, selected, onSelect }: {
  mode: CrystalOrbMode; selected: OrbRequirement; onSelect: (requirement: OrbRequirement) => void;
}) {
  const choices: Exclude<OrbRequirement, { kind: "unknown" }>[] = [
    ...ELEMENTS.map((element) => ({ kind: "element" as const, element })),
    ...WEAPON_FAMILIES.map((weapon) => ({ kind: "weapon-family" as const, weapon })),
  ];
  return <div className="orb-picker" role="group" aria-label="Orb requirement">
    <div className="orb-icon-grid">{choices.filter((choice) => requirementAllowed(mode, choice)).map((choice) =>
      <button type="button" className="orb-choice" key={requirementId(choice)}
        title={`${requirementLabel(choice)} (${choice.kind === "element" ? "element" : "weapon"} requirement)`}
        aria-label={requirementLabel(choice)} aria-pressed={selected.kind !== "unknown" && requirementId(selected) === requirementId(choice)}
        onClick={() => onSelect(choice)}><img src={orbRequirementImage(choice)!} alt="" /></button>)}</div>
    <button type="button" className="orb-unknown-choice" title="Reset requirement to Unknown"
      aria-pressed={selected.kind === "unknown"} onClick={() => onSelect({ kind: "unknown" })}>Unknown</button>
  </div>;
}
