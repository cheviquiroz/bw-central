// Question 1 of Art. 4.2.10 validation: does this building require
// evacuation stairs at all, before asking whether its stairs comply?
//
// RESOLVED (previously flagged): an earlier version of this function
// exempted a building from needing stairs if it had a verified
// accessible ramp/elevator. The domain expert confirmed that was wrong -
// per Art. 4.2.8 (already transcribed verbatim in
// dictionary/evacuationRoutes.ts's ELEMENTS_NOT_CONSIDERED_EVACUATION_ROUTES:
// "Ascensores, escaleras mecánicas, rampas mecánicas y pasillos móviles
// NO se consideran vías de evacuación"), elevators and ramps are never a
// substitute for evacuation stairs - accessibility and evacuation
// capacity are separate concerns. Stair requirement depends only on
// storey count.
//
// isAccessibleRamp/isAccessibleElevator (engine/accessibleAlternatives.ts)
// and the Art. 4.1.7 slope rule (dictionary/accessibility.ts) are kept -
// they're correct on their own terms for a future accessible-circulation
// rule - but neither feeds into this function anymore.

export interface StairRequirementInput {
  storeyCount: number;
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

  return {
    stairsRequired: true,
    reason: `Building has ${input.storeyCount} storeys - Art. 4.2.10 evacuation stairs are required regardless of any accessible ramp or elevator (Art. 4.2.8: neither counts as an evacuation route).`,
  };
}
