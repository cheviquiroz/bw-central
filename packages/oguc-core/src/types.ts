// Re-exports the public types defined across dictionary/ and engine/ in
// one place, following the pattern of the other packages in this
// monorepo. No new types are defined here.
//
// LANGUAGE CONVENTION (see also packages/ifc-headless/src/types.ts, where
// this was first established): identifiers, types, and comments are
// English. Domain terms with no accurate English equivalent keep their
// Spanish spelling as identifiers (destino, cargaOcupacion,
// viaEvacuacion) - no accents in identifiers, accents preserved in any
// string data or comments quoting the regulation text. This package
// reads the OGUC's tables and evaluates data against them - it does not
// decide what a "recinto habitable" is or judge compliance beyond what
// the transcribed tables and rules literally say.

export type { ArticuloRef, OccupancyFactorEntry, FixedSeatsRule, LengthPerPersonRule } from "./dictionary/occupancyLoad.js";
export type { StairsTableRow, StairsLookupResult } from "./dictionary/stairs.js";
export type { DestinoMatch, DestinoMatchConfidence } from "./engine/matchDestino.js";
export type { ManualOccupancyOverride, SpaceOccupancyStatus, SpaceOccupancyResult, BuildingOccupancyResult } from "./engine/calculateOccupancyLoad.js";
export type { StairsEvaluation } from "./engine/evaluateStairs.js";
export type { RuleEvaluationStatus, RuleEvaluationResult, SpaceEvacuationRuleSet, EvacuationRoutesEvaluation } from "./engine/evaluateEvacuationRoutes.js";
export type {
  StairDetectionConfidence,
  StairValidationRequirement,
  StairValidationDetected,
  StairValidationVerdict,
  StairValidationDetails,
  StairValidationResult,
  StairValidationInput,
} from "./engine/stairValidation.js";
