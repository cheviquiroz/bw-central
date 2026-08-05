// Applies what is mechanically computable, from ifc-headless's current
// output, from Art. 4.2.5, 4.2.6, and 4.2.15. Every rule that needs data
// ifc-headless does not expose (real evacuation-path distances, sprinkler
// presence, per-door heights, stair-specific geometry) is returned as
// "not-evaluable" with the specific missing input named - never faked,
// never silently skipped.

import type { IfcHeadlessDocument, IfcSpaceRecord, QuantityEntry } from "@bw-central/ifc-headless";
import * as R from "../dictionary/evacuationRoutes.js";

export type RuleEvaluationStatus = "evaluated" | "not-evaluable" | "flagged";

export interface RuleEvaluationResult {
  articulo: string;
  rule: string;
  status: RuleEvaluationStatus;
  detail: string;
  value?: number | string | boolean;
}

/** Finds a length quantity by name, honoring whatever unit this file declared for LENGTHUNIT (metre or milli+metre only - anything else is refused, not guessed). */
function findLengthM(space: IfcSpaceRecord, names: string[]): number | null {
  for (const wanted of names) {
    for (const qto of Object.values(space.quantitySets)) {
      const key = Object.keys(qto).find((k) => k.toLowerCase() === wanted.toLowerCase());
      if (!key) continue;
      const entry: QuantityEntry = qto[key];
      if (entry.value === null || !entry.unit || entry.unit.name !== "METRE") continue;
      const factor = entry.unit.prefix === null ? 1 : entry.unit.prefix === "MILLI" ? 0.001 : null;
      if (factor === null) continue;
      const num = Number(entry.value);
      if (!Number.isFinite(num)) continue;
      return num * factor;
    }
  }
  return null;
}

export function evaluateHeightRule(space: IfcSpaceRecord): RuleEvaluationResult {
  const heightM = findLengthM(space, ["Height"]);
  if (heightM === null) {
    return {
      articulo: "4.2.6",
      rule: "altura_libre_minima_via_evacuacion",
      status: "not-evaluable",
      detail: "No \"Height\" quantity found for this space, or its declared unit could not be resolved to metres.",
    };
  }
  const ok = heightM >= R.MIN_HEIGHT_EVACUATION_ROUTE_M;
  return {
    articulo: "4.2.6",
    rule: "altura_libre_minima_via_evacuacion",
    status: "evaluated",
    detail: ok
      ? `Height ${heightM}m meets the ${R.MIN_HEIGHT_EVACUATION_ROUTE_M}m minimum.`
      : `Height ${heightM}m is BELOW the ${R.MIN_HEIGHT_EVACUATION_ROUTE_M}m minimum required by Art. 4.2.6.`,
    value: heightM,
  };
}

export function evaluateWidthRule(space: IfcSpaceRecord): RuleEvaluationResult {
  const widthM = findLengthM(space, ["Width"]);
  if (widthM === null) {
    return {
      articulo: "4.2.5",
      rule: "ancho_minimo_via_evacuacion",
      status: "not-evaluable",
      detail: "No \"Width\" quantity found for this space, or its declared unit could not be resolved to metres.",
    };
  }
  return {
    articulo: "4.2.5",
    rule: "ancho_minimo_via_evacuacion",
    status: "flagged",
    detail: `Width quantity found (${widthM}m), but Art. 4.2.5's actual minimum is derived from the occupancy load of the specific surface that route section serves (with rules for adjacent-floor convergence and multi-exit division) - this package does not yet compute that per-section served load, so no pass/fail judgement is made here.`,
    value: widthM,
  };
}

export function evaluateTerraceRule(doc: IfcHeadlessDocument, totalOcupantes: number): RuleEvaluationResult {
  const storeyIds = new Set(doc.spaces.map((s) => s.storeyExpressId).filter((id): id is number => id !== null));
  const approxStoreyCount = storeyIds.size;

  if (approxStoreyCount === 0) {
    return {
      articulo: "4.2.15",
      rule: "terraza_evacuacion",
      status: "not-evaluable",
      detail: "No storey information resolved for any space - cannot evaluate the 10+-storey terrace rule.",
    };
  }

  const lowerBoundNote = `Approximate storey count from distinct space->storey references: ${approxStoreyCount}. This is a LOWER BOUND, not a ground truth: storeys with no IfcSpace at all (plant rooms, roof levels, etc.) are invisible to this count, since ifc-headless exposes each space's storeyExpressId but not the building's full storey list.`;

  if (approxStoreyCount < R.TERRACE_MIN_STOREYS) {
    return {
      articulo: "4.2.15",
      rule: "terraza_evacuacion",
      status: "flagged",
      detail: `${lowerBoundNote} Below the ${R.TERRACE_MIN_STOREYS}-storey threshold on this approximate count, so the terrace rule likely does not apply - but confirm the real storey count (including storeys with no modeled space) is not actually >=${R.TERRACE_MIN_STOREYS}.`,
      value: approxStoreyCount,
    };
  }

  const minAreaM2 = totalOcupantes * R.TERRACE_MIN_AREA_M2_PER_PERSON;
  return {
    articulo: "4.2.15",
    rule: "terraza_evacuacion",
    status: "flagged",
    detail: `${lowerBoundNote} At or above the ${R.TERRACE_MIN_STOREYS}-storey threshold: IF this building has a single evacuation stair, it must terminate in a terraza de evacuación >= ${R.TERRACE_MIN_WIDTH_M}m wide and >= ${minAreaM2}m2 (${R.TERRACE_MIN_AREA_M2_PER_PERSON} m2/persona over the occupancy load of the building sector above the midpoint of the stair's evacuation route). This package uses total building occupancy as an approximation - it cannot isolate the specific above-midpoint sector from current data.`,
    value: approxStoreyCount,
  };
}

export interface SpaceEvacuationRuleSet {
  spaceExpressId: number;
  spaceGlobalId: string | null;
  rules: RuleEvaluationResult[];
}

export interface EvacuationRoutesEvaluation {
  terrace: RuleEvaluationResult;
  perSpace: SpaceEvacuationRuleSet[];
  /** Rules from the article set that this package cannot evaluate at all with ifc-headless's current output, named individually rather than silently omitted. */
  notEvaluable: RuleEvaluationResult[];
}

export function evaluateEvacuationRoutes(doc: IfcHeadlessDocument, totalOcupantes: number): EvacuationRoutesEvaluation {
  const perSpace: SpaceEvacuationRuleSet[] = doc.spaces.map((space) => ({
    spaceExpressId: space.expressId,
    spaceGlobalId: space.globalId,
    rules: [evaluateHeightRule(space), evaluateWidthRule(space)],
  }));

  const notEvaluable: RuleEvaluationResult[] = [
    {
      articulo: "4.2.6",
      rule: "altura_minima_vano_puerta",
      status: "not-evaluable",
      detail: "Door minimum height (2m) cannot be evaluated: ifc-headless identifies doors only by expressId/ifcType in a space's boundingElements, without a per-door Height quantity exposed.",
    },
    {
      articulo: "4.2.11",
      rule: "requisitos_constructivos_escalera",
      status: "not-evaluable",
      detail: "Handrail heights and tread/riser dimensions require stair-specific geometry (IfcStair/IfcStairFlight quantities) that ifc-headless does not currently expose.",
    },
    {
      articulo: "4.2.12",
      rule: "terminacion_escalera",
      status: "not-evaluable",
      detail: "Distance from a stair's first step to the exterior, and exit-vestibule width, require a real evacuation-path measurement along modeled geometry, which this package does not compute.",
    },
    {
      articulo: "4.2.13",
      rule: "distancia_maxima_a_escalera",
      status: "not-evaluable",
      detail: "Requires path distance from each unit's door to the nearest evacuation stair, plus sprinkler-system presence (an input this package has no source for) - neither is computed.",
    },
    {
      articulo: "4.2.14",
      rule: "distancia_maxima_estacionamientos_bodegas",
      status: "not-evaluable",
      detail: "Same path-distance limitation as 4.2.13, plus \"planta abierta en 50%+ de su perímetro\" requires perimeter/enclosure analysis this package does not perform.",
    },
  ];

  return { terrace: evaluateTerraceRule(doc, totalOcupantes), perSpace, notEvaluable };
}
