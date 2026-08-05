// Whether a ramp/elevator counts as a verified accessible alternative,
// per Art. 4.1.7 (ramps) and a plain accessibility marking (elevators).
//
// "unknown" is never treated as accessible - an unmarked ramp/elevator
// is not assumed to comply just because no one said it doesn't (see
// ifc-headless's own IfcRamp.isAccessible/IfcElevator.isAccessible doc
// comments: "unknown" means "not marked either way", not "compliant").
//
// A ramp marked isAccessible=true by keyword but with NO declared slope
// (slopePercentage === null) is NOT counted as verified accessible
// either - a marking without a measurable slope to check against Art.
// 4.1.7's 8,33% cap is an unverifiable claim, not a compliance fact this
// package can assert.

import type { IfcRamp, IfcElevator } from "@bw-central/ifc-headless";
import { ACCESSIBLE_RAMP_SLOPE_RULE } from "../dictionary/accessibility.js";

export function isAccessibleRamp(ramp: IfcRamp): boolean {
  return ramp.isAccessible === true && ramp.slopePercentage !== null && ramp.slopePercentage <= ACCESSIBLE_RAMP_SLOPE_RULE.maxSlopePercent;
}

export function isAccessibleElevator(elevator: IfcElevator): boolean {
  return elevator.isAccessible === true;
}
