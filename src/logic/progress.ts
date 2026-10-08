import { activeLocationDefinitions } from "../data/locationDefinitions";
import { MAP_AREAS } from "../data/mapAreas";
import { deriveEffectiveCheckState, type PersistentManualState } from "../state/trackerState";
import { evaluateCheck, type LogicContext } from "./reachability";

export interface TrackerProgress {
  completed: number;
  total: number;
  available: number;
  availableAreas: number;
}

export function countTrackerProgress(context: LogicContext, manual: PersistentManualState): TrackerProgress {
  const definitions = activeLocationDefinitions(context.ram.sandship.supported);
  const availableIds = new Set(definitions.filter((definition) => {
    const state = deriveEffectiveCheckState(definition.id, context.ram, manual);
    if (state.complete) return false;
    const reachability = evaluateCheck(definition.id, context, manual);
    return reachability.visible && reachability.access === "reachable";
  }).map((definition) => definition.id));
  return {
    total: definitions.length,
    completed: definitions.filter((definition) => deriveEffectiveCheckState(definition.id, context.ram, manual).complete).length,
    available: availableIds.size,
    availableAreas: MAP_AREAS.filter((area) => area.checkIds.some((id) => availableIds.has(id))).length,
  };
}
