// Art. 4.1.7 OGUC - accesibilidad universal, la parte relevante para
// determinar si una rampa cuenta como alternativa accesible de
// circulación vertical: pendiente máxima 1:12 (8,33%).
//
// This is its own small, named, traceable rule - not a bare number
// inlined into stairRequirement.ts - for the same reason every other
// OGUC number in this package lives in dictionary/: so it can be found,
// cited, and never accidentally re-transcribed with a different value
// somewhere else.

export interface AccessibleRampSlopeRule {
  articulo: "4.1.7";
  maxSlopePercent: number;
  detail: string;
}

export const ACCESSIBLE_RAMP_SLOPE_RULE: AccessibleRampSlopeRule = {
  articulo: "4.1.7",
  maxSlopePercent: 8.33,
  detail: "Rampa accesible: pendiente máxima 1:12 (8,33%).",
};
