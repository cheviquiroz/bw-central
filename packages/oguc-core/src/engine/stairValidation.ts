// Art. 4.2.10 stair validation: given an already-computed occupancy load
// (Fase 1.2 Part A) and a confirmed stair count (from the stair-grouping
// Pre-Check flow this task consumes but does not build - see the note
// below), looks up the required count/width and compares.
//
// GROUPING, NOT BUILT HERE: this task's brief describes a heuristic that
// groups fragmented IfcStair/IfcBuildingElementProxy entities (common in
// ArchiCAD exports like OLAS-ARQ-05.ifc, which has 24 raw IfcStair
// entities that may or may not correspond to 24 real evacuation routes)
// into "logical stairs," plus a Pre-Check UI that asks a human to
// confirm the grouped count. Neither exists in this codebase - this
// task's own constraints say not to reimplement grouping here, and no
// Pre-Check UI exists elsewhere in the monorepo either. This function
// therefore takes confirmedStairCount as a plain input, exactly the
// shape a future Pre-Check would eventually supply, and does not itself
// attempt any clustering of raw stair fragments.
//
// WIDTH IS NOT MEASURABLE FROM CURRENT DATA, AT ANY CONFIDENCE LEVEL:
// Art. 4.2.10's "ancho mínimo" is a stair's clear horizontal width
// (room to walk side by side), a dimension unrelated to
// IfcStairFlight's NumberOfRiser/TreadLength/RiserHeight (which
// describe individual step geometry along the direction of travel, not
// the flight's width). Neither IFC2X3 nor IFC4's IfcStairFlight schema
// carries a width attribute at all, and ifc-headless does not derive one
// from geometry. This is a real gap, not a low-confidence-only
// limitation - so widthCheckable is false unconditionally in this
// version, regardless of how the stair count was derived. Measuring a
// real "ancho" would need ifc-headless to expose flight geometry
// suitable for a perpendicular-to-travel width measurement, which does
// not exist yet.

import type { IfcStair } from "@bw-central/ifc-headless";
import { lookupStairsRequirement, STAIRS_STUDY_REQUIRED_ABOVE_PERSONS, type StairsLookupResult } from "../rules/art4210StairsTable.js";

export type StairDetectionConfidence = "high" | "low" | "manual";

export interface StairValidationRequirement {
  /** Null only when occupancyLoad exceeds the table (>1.000 personas - Art. 4.2.10 requires an Estudio de Evacuación instead of a table lookup). */
  stairCount: number | null;
  stairWidthM: number | null;
}

export interface StairValidationDetected {
  stairCount: number;
  stairs: IfcStair[];
  confidence: StairDetectionConfidence;
}

export type StairValidationVerdict = "PASS" | "FAIL" | "EXCEEDS_TABLE" | "INCOMPLETE_DATA";

export interface StairValidationDetails {
  stairCountMatch: boolean;
  widthCheckable: boolean;
  requiresStudy: boolean;
}

export interface StairValidationResult {
  occupancyLoad: number;
  /** e.g. "51-100", ">1.000", or "0" for the incomplete-data case. */
  occupancyRange: string;
  required: StairValidationRequirement;
  detected: StairValidationDetected;
  verdict: StairValidationVerdict;
  message: string;
  details?: StairValidationDetails;
}

export interface StairValidationInput {
  occupancyLoad: number;
  confirmedStairCount: number;
  detectedStairs: IfcStair[];
  confidence: StairDetectionConfidence;
}

/**
 * Always null in this version - see the file header. Kept as an
 * explicit, named function (rather than an inline `null`) so the
 * reasoning is visible at the call site and easy to replace once
 * ifc-headless can supply a real clear-width measurement.
 */
export function measureStairWidthM(_stair: IfcStair): number | null {
  return null;
}

function formatOccupancyRange(lookup: StairsLookupResult): string {
  if (lookup.status === "table") return `${lookup.row.minPersons}-${lookup.row.maxPersons}`;
  if (lookup.status === "requires-study") return `>${STAIRS_STUDY_REQUIRED_ABOVE_PERSONS}`;
  return "0";
}

export function validateStairs(input: StairValidationInput): StairValidationResult {
  const { occupancyLoad, confirmedStairCount, detectedStairs, confidence } = input;
  const detected: StairValidationDetected = { stairCount: confirmedStairCount, stairs: detectedStairs, confidence };

  if (!Number.isFinite(occupancyLoad) || occupancyLoad <= 0) {
    return {
      occupancyLoad,
      occupancyRange: "0",
      required: { stairCount: null, stairWidthM: null },
      detected,
      verdict: "INCOMPLETE_DATA",
      message:
        "Occupancy load is zero (or not a valid positive number) - Art. 4.2.10 cannot be evaluated without a real occupancy load. A model with zero IfcSpace (e.g. OLAS-ARQ-05.ifc, which has no IfcSpace at all) has no occupancy load this package can derive on its own; a real number must come from calculateOccupancyLoad against a file that has spaces, or from a manual override, before this validation is meaningful.",
    };
  }

  const lookup = lookupStairsRequirement(occupancyLoad);
  const occupancyRange = formatOccupancyRange(lookup);

  if (lookup.status === "requires-study") {
    return {
      occupancyLoad,
      occupancyRange,
      required: { stairCount: null, stairWidthM: null },
      detected,
      verdict: "EXCEEDS_TABLE",
      message: lookup.detail,
      details: { stairCountMatch: false, widthCheckable: false, requiresStudy: true },
    };
  }

  if (lookup.status !== "table") {
    // occupancyLoad > 0 fue verificado arriba, así que un "no-requirement"
    // acá sería un bug del lookup, no un estado real de edificio - no se
    // absorbe en silencio como un verdicto inventado.
    throw new Error(`Unexpected "${lookup.status}" stairs lookup for a positive occupancy load of ${occupancyLoad} - this indicates a bug in lookupStairsRequirement's boundary handling.`);
  }

  const required: StairValidationRequirement = { stairCount: lookup.row.minCount, stairWidthM: lookup.row.minWidthM };
  const stairCountMatch = confirmedStairCount >= lookup.row.minCount;
  const widthCheckable = false;

  const confidenceCaveat =
    confidence === "low"
      ? " NOTE: this count comes from unclustered/fragmented stair entities (low confidence) - a human should confirm these fragments really correspond to distinct evacuation routes before trusting this result."
      : "";

  const verdict: StairValidationVerdict = stairCountMatch ? "PASS" : "FAIL";
  const message = stairCountMatch
    ? `${confirmedStairCount} stair(s) detected, meeting the Art. 4.2.10 minimum of ${required.stairCount} for ${occupancyLoad} persons (range ${occupancyRange}). Minimum width per stair is ${required.stairWidthM}m, but this package cannot verify stair width from ifc-headless's current output - visual/manual inspection recommended.${confidenceCaveat}`
    : `Detected only ${confirmedStairCount} stair(s), but Art. 4.2.10 requires at least ${required.stairCount} for an occupancy load of ${occupancyLoad} persons (range ${occupancyRange}).${confidenceCaveat}`;

  return {
    occupancyLoad,
    occupancyRange,
    required,
    detected,
    verdict,
    message,
    details: { stairCountMatch, widthCheckable, requiresStudy: false },
  };
}
