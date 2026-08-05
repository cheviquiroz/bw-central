// Art. 4.2.4 occupancy load calculation: per-space destino matching +
// area lookup, then building-level aggregation. Never converts units -
// an area quantity is only used if its declared unit resolves to a bare
// square metre; otherwise the space is reported, not silently miscounted.

import type { IfcHeadlessDocument, IfcSpaceRecord, QuantityEntry } from "@bw-central/ifc-headless";
import { matchDestino, type DestinoMatch } from "./matchDestino.js";

/**
 * Manual, human-supplied occupancy input for a space this engine cannot
 * (and should not) compute on its own:
 *  - Art. 4.2.4 "locales con asientos fijos" (seat count, not area/factor)
 *  - Art. 4.2.4 "aposentadurías corridas" (0,45 m/persona)
 *  - Art. 4.2.9 external areas (patios/plazoletas/atrios) whose occupancy
 *    load "lo determina el arquitecto del proyecto" - a declared input by
 *    regulation, not something derivable from geometry.
 * Keyed by the space's GlobalId.
 */
export interface ManualOccupancyOverride {
  ocupantes: number;
  reason: string;
  articulo?: string;
}

export type SpaceOccupancyStatus = "calculated" | "unmatched" | "requires-manual-tier" | "no-area" | "unit-not-resolvable" | "manual-override";

export interface SpaceOccupancyResult {
  spaceExpressId: number;
  spaceGlobalId: string | null;
  spaceName: string | null;
  spaceLongName: string | null;
  destinoMatch: DestinoMatch;
  areaM2: number | null;
  areaSourceQuantity: string | null;
  ocupantes: number | null;
  status: SpaceOccupancyStatus;
  notes: string[];
}

export interface BuildingOccupancyResult {
  totalOcupantes: number;
  classifiedAreaM2: number;
  unclassifiedAreaM2: number;
  spaces: SpaceOccupancyResult[];
  /** Every space that did NOT contribute to totalOcupantes, with why - so an incomplete total is visible, never silently absorbed. */
  unclassified: SpaceOccupancyResult[];
}

const AREA_QUANTITY_NAME_PRIORITY = ["NetFloorArea", "GrossFloorArea"];

function findAreaM2(space: IfcSpaceRecord): { areaM2: number | null; source: string | null; note?: string } {
  for (const wanted of AREA_QUANTITY_NAME_PRIORITY) {
    for (const [qtoName, qto] of Object.entries(space.quantitySets)) {
      const key = Object.keys(qto).find((k) => k.toLowerCase() === wanted.toLowerCase());
      if (!key) continue;
      const entry: QuantityEntry = qto[key];
      const source = `${qtoName}.${key}`;
      if (entry.value === null) continue;
      if (!entry.unit || entry.unit.name !== "SQUARE_METRE" || entry.unit.prefix !== null) {
        return {
          areaM2: null,
          source,
          note: `Found "${source}" but its declared unit is not a bare SQUARE_METRE (unit=${JSON.stringify(entry.unit)}) - this package never converts units, so this area cannot be used.`,
        };
      }
      const num = Number(entry.value);
      if (!Number.isFinite(num)) continue;
      return { areaM2: num, source };
    }
  }
  return { areaM2: null, source: null };
}

function emptyDestinoMatch(reasoning: string): DestinoMatch {
  return {
    destino: null,
    categoria: null,
    label: null,
    articulo: null,
    m2PorPersona: null,
    requiresManualTier: false,
    confidence: "unmatched",
    matchedField: null,
    matchedText: null,
    reasoning,
  };
}

export function calculateOccupancyLoad(
  doc: IfcHeadlessDocument,
  options?: { manualOverrides?: Record<string, ManualOccupancyOverride> }
): BuildingOccupancyResult {
  const overrides = options?.manualOverrides ?? {};
  const spaces: SpaceOccupancyResult[] = [];

  for (const space of doc.spaces) {
    const base = {
      spaceExpressId: space.expressId,
      spaceGlobalId: space.globalId,
      spaceName: space.name,
      spaceLongName: space.longName,
    };

    const override = space.globalId ? overrides[space.globalId] : undefined;
    if (override) {
      spaces.push({
        ...base,
        destinoMatch: emptyDestinoMatch("Manual override supplied - destino matching was skipped for this space."),
        areaM2: null,
        areaSourceQuantity: null,
        ocupantes: override.ocupantes,
        status: "manual-override",
        notes: [`Manual override: ${override.reason}${override.articulo ? ` (Art. ${override.articulo})` : ""}`],
      });
      continue;
    }

    const destinoMatch = matchDestino(space);
    const { areaM2, source, note } = findAreaM2(space);
    const notes: string[] = note ? [note] : [];

    if (destinoMatch.confidence === "unmatched") {
      spaces.push({
        ...base,
        destinoMatch,
        areaM2,
        areaSourceQuantity: source,
        ocupantes: null,
        status: "unmatched",
        notes: [...notes, "Excluded from the building total (unmatched destino) - see destinoMatch.reasoning for why, and Art. 4.2.4's own text on assimilating unlisted destinos manually."],
      });
      continue;
    }

    if (destinoMatch.requiresManualTier) {
      spaces.push({
        ...base,
        destinoMatch,
        areaM2,
        areaSourceQuantity: source,
        ocupantes: null,
        status: "requires-manual-tier",
        notes: [
          ...notes,
          "Matched the \"Vivienda\" category, but its m2/persona tier depends on the TOTAL área útil of the dwelling unit (Art. 4.2.4), not this individual space - ifc-headless does not group spaces into dwelling units, so this cannot be resolved automatically. Excluded from the building total.",
        ],
      });
      continue;
    }

    if (areaM2 === null) {
      const status: SpaceOccupancyStatus = source ? "unit-not-resolvable" : "no-area";
      spaces.push({
        ...base,
        destinoMatch,
        areaM2: null,
        areaSourceQuantity: source,
        ocupantes: null,
        status,
        notes: [...notes, source ? "Area quantity found but its unit could not be honored as m2." : `No ${AREA_QUANTITY_NAME_PRIORITY.join("/")} quantity found for this space.`],
      });
      continue;
    }

    // destinoMatch.m2PorPersona is non-null here: requiresManualTier
    // (the only case producing a matched-but-null factor) was already
    // handled above.
    const ocupantes = areaM2 / destinoMatch.m2PorPersona!;
    spaces.push({ ...base, destinoMatch, areaM2, areaSourceQuantity: source, ocupantes, status: "calculated", notes });
  }

  const totalOcupantes = spaces.reduce((sum, s) => sum + (s.ocupantes ?? 0), 0);
  const classifiedAreaM2 = spaces.filter((s) => s.status === "calculated").reduce((sum, s) => sum + (s.areaM2 ?? 0), 0);
  const unclassified = spaces.filter((s) => s.status !== "calculated" && s.status !== "manual-override");
  const unclassifiedAreaM2 = unclassified.reduce((sum, s) => sum + (s.areaM2 ?? 0), 0);

  return { totalOcupantes, classifiedAreaM2, unclassifiedAreaM2, spaces, unclassified };
}
