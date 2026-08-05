// Full Art. 4.2.10 evaluation, in the correct order: first "does this
// building need stairs at all" (stairRequirement.ts), then - only if the
// answer is yes - "do its stairs comply" (reusing the same table lookup
// stairValidation.ts already uses). Returns early with NOT_REQUIRED
// without ever looking at occupancy/stair-count data when stairs are not
// needed, per this task's explicit two-question sequencing.

import { determineStairRequirement } from "./stairRequirement.js";
import { lookupStairsRequirement, STAIRS_STUDY_REQUIRED_ABOVE_PERSONS } from "../dictionary/stairs.js";

export type StairComplianceVerdict = "PASS" | "FAIL" | "NOT_REQUIRED" | "EXCEEDS_TABLE" | "INCOMPLETE_DATA";

export interface StairComplianceResult {
  stairsRequired: boolean;
  verdict: StairComplianceVerdict;
  occupancyLoad: number | null;
  occupancyRange?: string;
  required?: {
    stairCount: number;
    stairWidth: number;
  };
  detected?: {
    stairCount: number;
  };
  reasonNotRequired?: string;
  message: string;
}

export interface StairComplianceInput {
  storeyCount: number;
  occupancyLoad: number;
  confirmedStairCount: number;
}

function formatOccupancyRange(occupancyLoad: number): string {
  const lookup = lookupStairsRequirement(occupancyLoad);
  if (lookup.status === "table") return `${lookup.row.minPersons}-${lookup.row.maxPersons}`;
  if (lookup.status === "requires-study") return `>${STAIRS_STUDY_REQUIRED_ABOVE_PERSONS}`;
  return "0";
}

export function evaluateStairCompliance(input: StairComplianceInput): StairComplianceResult {
  const requirement = determineStairRequirement({ storeyCount: input.storeyCount });

  if (!requirement.stairsRequired) {
    return {
      stairsRequired: false,
      verdict: "NOT_REQUIRED",
      occupancyLoad: null,
      reasonNotRequired: requirement.reason,
      message: `Art. 4.2.10 does not apply: ${requirement.reason}`,
    };
  }

  // Escaleras requeridas - recién acá importa la carga de ocupación.
  if (!Number.isFinite(input.occupancyLoad) || input.occupancyLoad <= 0) {
    return {
      stairsRequired: true,
      verdict: "INCOMPLETE_DATA",
      occupancyLoad: input.occupancyLoad,
      message: "Stairs are required (2+ storeys), but occupancy load is zero or not a valid positive number - Art. 4.2.10 cannot be validated without a real occupancy load.",
    };
  }

  const occupancyRange = formatOccupancyRange(input.occupancyLoad);
  const lookup = lookupStairsRequirement(input.occupancyLoad);

  if (lookup.status === "requires-study") {
    return {
      stairsRequired: true,
      verdict: "EXCEEDS_TABLE",
      occupancyLoad: input.occupancyLoad,
      occupancyRange,
      message: lookup.detail,
    };
  }

  if (lookup.status !== "table") {
    throw new Error(`Unexpected "${lookup.status}" stairs lookup for a positive occupancy load of ${input.occupancyLoad} - this indicates a bug in lookupStairsRequirement's boundary handling.`);
  }

  const required = { stairCount: lookup.row.minCount, stairWidth: lookup.row.minWidthM };
  const detected = { stairCount: input.confirmedStairCount };
  const countCheck = detected.stairCount >= required.stairCount;

  return {
    stairsRequired: true,
    verdict: countCheck ? "PASS" : "FAIL",
    occupancyLoad: input.occupancyLoad,
    occupancyRange,
    required,
    detected,
    message: countCheck
      ? `${detected.stairCount} stair(s) detected, meeting the Art. 4.2.10 minimum of ${required.stairCount} for ${input.occupancyLoad} persons (range ${occupancyRange}). Minimum width per stair is ${required.stairWidth}m - not verifiable from current ifc-headless data (see engine/stairValidation.ts).`
      : `Only ${detected.stairCount} stair(s) detected, but Art. 4.2.10 requires at least ${required.stairCount} for an occupancy load of ${input.occupancyLoad} persons (range ${occupancyRange}).`,
  };
}
