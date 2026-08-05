// Art. 4.2.10 OGUC - Tabla de Escaleras.
//
// This is a re-export, not a re-transcription. The table itself already
// lives in dictionary/stairs.ts (built for Fase 1.2 Part A's
// evaluateStairs), and this package's own self-check rule is "no bare
// magic numbers outside dictionary/, and the table lives in exactly one
// place." Transcribing it a second time here would violate that and
// risk the two copies drifting apart. rules/ is kept as a thin, named
// entry point matching this task's requested structure, sourcing from
// the one real copy.
export { STAIRS_TABLE, STAIRS_STUDY_REQUIRED_ABOVE_PERSONS, lookupStairsRequirement, type StairsTableRow, type StairsLookupResult } from "../dictionary/stairs.js";
