// Art. 4.2.10 stairs evaluation. Given a building's total occupancy
// load, looks up the required stair count/width. Cannot compare that
// requirement against modeled stair geometry: ifc-headless's
// IfcHeadlessDocument does not currently surface IfcStair elements as a
// first-class output (a space's boundingElements only ever carry
// Ifc(Wall|Window|Door) references - see ifc-headless's
// geometricBoundaries.ts/authoritativeBoundaries.ts). This is a real,
// named gap, not an oversight papered over here.

import { lookupStairsRequirement, type StairsLookupResult } from "../dictionary/stairs.js";

export interface StairsEvaluation {
  totalOcupantes: number;
  requirement: StairsLookupResult;
  modeledStairsAvailable: false;
  note: string;
}

export function evaluateStairs(totalOcupantes: number): StairsEvaluation {
  return {
    totalOcupantes,
    requirement: lookupStairsRequirement(totalOcupantes),
    modeledStairsAvailable: false,
    note: "The required stair count/width above was computed from Art. 4.2.10's table, but ifc-headless does not currently expose IfcStair elements, so there is nothing here to compare it against yet. That comparison needs ifc-headless to surface stairs as a first-class part of its output.",
  };
}
