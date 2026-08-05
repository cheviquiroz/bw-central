// Question 1 of Art. 4.2.10 validation: does this building require
// evacuation stairs at all, before asking whether its stairs comply?
//
// ============================================================================
// FLAGGED, NOT SILENTLY IMPLEMENTED: a real conflict with Art. 4.2.8,
// already transcribed verbatim by the domain expert in an earlier task
// (see dictionary/evacuationRoutes.ts's ELEMENTS_NOT_CONSIDERED_EVACUATION_ROUTES):
//
//   "Ascensores, escaleras mecánicas, rampas mecánicas y pasillos
//    móviles NO se consideran vías de evacuación."
//
// This task's brief asks: if an accessible elevator (or ramp) exists,
// evacuation stairs are NOT required at all. But Art. 4.2.8, already on
// record in this same package, says elevators are explicitly NOT
// evacuation routes - which is the opposite conclusion for fire/life-
// safety egress purposes. It is plausible these are two different,
// non-contradictory questions (Art. 4.1.7 "accessible circulation for
// people with reduced mobility" vs Art. 4.2.10 "evacuation capacity for
// everyone"), and that this task is deliberately scoped to the narrower
// accessible-circulation question, not overriding Art. 4.2.10's general
// evacuation requirement. But that reconciliation is a domain-expert
// judgment call, not something this code can verify on its own. This
// function is implemented exactly as this task specified - DO NOT trust
// a NOT_REQUIRED verdict produced by this function for real evacuation
// planning without the domain expert confirming this reconciliation
// first. See this task's summary for the same flag.
// ============================================================================

import type { IfcRamp, IfcElevator } from "@bw-central/ifc-headless";
import { isAccessibleRamp, isAccessibleElevator } from "./accessibleAlternatives.js";

export interface StairRequirementInput {
  storeyCount: number;
  ramps: IfcRamp[];
  elevators: IfcElevator[];
}

export interface StairRequirementResult {
  stairsRequired: boolean;
  reason: string;
}

export function determineStairRequirement(input: StairRequirementInput): StairRequirementResult {
  if (input.storeyCount < 2) {
    return {
      stairsRequired: false,
      reason: `Building has ${input.storeyCount} storey(s) - Art. 4.2.10's evacuation-stair requirement is about vertical circulation between storeys, which does not apply to a single-storey building.`,
    };
  }

  const accessibleRamp = input.ramps.find(isAccessibleRamp);
  const accessibleElevator = input.elevators.find(isAccessibleElevator);

  if (accessibleRamp || accessibleElevator) {
    const alternatives: string[] = [];
    if (accessibleRamp) alternatives.push(`an accessible ramp (${accessibleRamp.globalId ?? `expressId ${accessibleRamp.expressId}`}, ${accessibleRamp.slopePercentage}% slope, within Art. 4.1.7's 8,33% cap)`);
    if (accessibleElevator) alternatives.push(`an accessible elevator (${accessibleElevator.globalId ?? `expressId ${accessibleElevator.expressId}`})`);
    return {
      stairsRequired: false,
      reason: `Building has ${input.storeyCount} storeys, but ${alternatives.join(" and ")} provide accessible vertical circulation, per this task's Art. 4.1.7-based rule. See this file's header comment: this conclusion has not been reconciled against Art. 4.2.8's own statement that elevators are not evacuation routes - do not trust this verdict for real evacuation planning without domain-expert confirmation.`,
    };
  }

  return {
    stairsRequired: true,
    reason: `Building has ${input.storeyCount} storeys, with no accessible ramp (Art. 4.1.7, slope <= 8,33%) or accessible elevator detected - Art. 4.2.10 evacuation stairs are required.`,
  };
}
