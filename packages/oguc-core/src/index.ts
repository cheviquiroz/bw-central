export * from "./types.js";
export { OCCUPANCY_LOAD_TABLE, FIXED_SEATS_RULE, CONTINUOUS_BENCH_ROW_RULE, ESTUDIO_EVACUACION_THRESHOLD_PERSONS } from "./dictionary/occupancyLoad.js";
export { STAIRS_TABLE, STAIRS_STUDY_REQUIRED_ABOVE_PERSONS, lookupStairsRequirement } from "./dictionary/stairs.js";
export * as evacuationRouteConstants from "./dictionary/evacuationRoutes.js";
export { STARTER_SYNONYMS } from "./dictionary/synonyms.js";
export { matchDestino } from "./engine/matchDestino.js";
export { calculateOccupancyLoad } from "./engine/calculateOccupancyLoad.js";
export { evaluateStairs } from "./engine/evaluateStairs.js";
export { evaluateEvacuationRoutes, evaluateHeightRule, evaluateWidthRule, evaluateTerraceRule } from "./engine/evaluateEvacuationRoutes.js";
