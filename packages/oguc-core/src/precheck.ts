// Pre-Check gate: "is this model fit for OGUC compliance review at all",
// evaluated BEFORE any article-specific rule runs. Not a new calculation
// engine - every check here either calls an existing engine function
// directly (calculateOccupancyLoad, evaluateHeightRule) or reads a field
// ifc-headless's IfcHeadlessDocument already exposes
// (hasDeclaredSpaceBoundaries, boundingElements). The few genuinely new
// helpers (storey-count approximation, fragmented-stair detection,
// unenclosed-space detection, "any geometry at all") are additive, not a
// refactor of anything above - none of the existing engine files change.
//
// Two real ifc-headless gaps surfaced while writing this and are NOT
// silently worked around:
//  - IfcHeadlessDocument has no top-level storey list, only
//    storeyExpressId references on spaces/stairs (see the same
//    "lower bound, not ground truth" caveat already documented in
//    evaluateEvacuationRoutes.ts). approximateStoreyCount() below
//    reuses that exact caveat, not a new assumption.
//  - IfcApplication (the exporting tool - Revit/ArchiCAD/etc.) is never
//    read by ifc-headless's reader. "Revit vs ArchiCAD convention
//    detected" from the original Pre-Check design cannot be computed
//    from IfcHeadlessDocument as it exists today - runPreCheck reports
//    it as unavailable (info.exportTool === null) rather than guessing
//    from filename/fixture conventions.

import type { IfcHeadlessDocument, IfcSpaceRecord } from "@bw-central/ifc-headless";
import { calculateOccupancyLoad } from "./engine/calculateOccupancyLoad.js";
import { evaluateHeightRule } from "./engine/evaluateEvacuationRoutes.js";

export type PreCheckSeverity = "blocking" | "warning" | "info";

export interface PreCheckIssue {
  id: string;
  severity: PreCheckSeverity;
  message: string;
  detail?: string;
}

export interface PreCheckResult {
  blocking: PreCheckIssue[];
  warnings: PreCheckIssue[];
  info: PreCheckIssue[];
}

/**
 * Distinct storeyExpressId values across spaces AND stairs. A LOWER
 * BOUND, not ground truth (same caveat as evaluateEvacuationRoutes.ts's
 * approxStoreyCount): a storey with no space and no stair on it (e.g. an
 * empty plant room, a roof level) is invisible to this count, since
 * ifc-headless does not expose the building's full IfcBuildingStorey
 * list, only these back-references.
 */
export function approximateStoreyCount(doc: IfcHeadlessDocument): number {
  const ids = new Set<number>();
  for (const space of doc.spaces) {
    if (space.storeyExpressId !== null) ids.add(space.storeyExpressId);
  }
  for (const stair of doc.stairs) {
    if (stair.storeyExpressId !== null) ids.add(stair.storeyExpressId);
  }
  return ids.size;
}

/** True if the file has ANY spatial/vertical-circulation entity with real geometry - spaces, or a stair/ramp/elevator with a resolved boundingBox. Used to distinguish "file has geometry but zero IfcSpace" (blocking) from "file genuinely has nothing" (also blocking, but a different message). */
function hasAnyGeometry(doc: IfcHeadlessDocument): boolean {
  if (doc.spaces.length > 0) return true;
  return (
    doc.stairs.some((s) => s.boundingBox !== null) ||
    doc.ramps.some((r) => r.boundingBox !== null) ||
    doc.elevators.some((e) => e.boundingBox !== null)
  );
}

/**
 * Stairs with zero IfcStairFlight children ("flightless"), grouped by
 * storey, flagged when a storey has more than one. A stair's internal
 * step structure is normally captured as real IfcStairFlight children
 * (see IfcStair.flights's own doc comment) - a flightless stair isn't
 * inherently wrong (a file may just not model that detail), but MULTIPLE
 * flightless IfcStair entities sharing a storey is the real, observed
 * pattern this checks for: OLAS-ARQ-05.ifc (see stairValidation.spec.ts)
 * has 24 raw IfcStair entities from an ArchiCAD export, none with
 * flights, 2 per storey across 12 storeys - plausibly fragments of fewer
 * real staircases, or two legitimately separate ones; this package
 * cannot tell which from data alone (never fabricates a definitive
 * answer), so it flags the storey as worth a human look before Art.
 * 4.2.10 counts its stairs, rather than silently accepting the raw count.
 */
function findFragmentedStoreys(doc: IfcHeadlessDocument): { storeyExpressId: number; stairCount: number }[] {
  const countByStorey = new Map<number, number>();
  for (const stair of doc.stairs) {
    if (stair.storeyExpressId === null || stair.flights.length > 0) continue;
    countByStorey.set(stair.storeyExpressId, (countByStorey.get(stair.storeyExpressId) ?? 0) + 1);
  }
  return [...countByStorey.entries()]
    .filter(([, count]) => count > 1)
    .map(([storeyExpressId, stairCount]) => ({ storeyExpressId, stairCount }));
}

/** Spaces with zero bounding elements at all - not partially bounded, not even one wall/window/door associated (authoritative or inferred). */
function findUnenclosedSpaces(doc: IfcHeadlessDocument): IfcSpaceRecord[] {
  return doc.spaces.filter((space) => space.boundingElements.length === 0);
}

export function runPreCheck(doc: IfcHeadlessDocument): PreCheckResult {
  const blocking: PreCheckIssue[] = [];
  const warnings: PreCheckIssue[] = [];
  const info: PreCheckIssue[] = [];

  // --- BLOCKING ---

  if (!hasAnyGeometry(doc)) {
    blocking.push({
      id: "no-geometry",
      severity: "blocking",
      message: "El modelo no tiene geometría alguna (sin IfcSpace, IfcStair, IfcRamp ni IfcElevator con geometría real).",
    });
  } else if (doc.spaces.length === 0) {
    blocking.push({
      id: "zero-spaces",
      severity: "blocking",
      message: "El modelo tiene geometría pero cero IfcSpace - no hay definiciones espaciales para revisar.",
    });
  }

  const storeyCount = approximateStoreyCount(doc);
  if (doc.spaces.length > 0 || doc.stairs.length > 0) {
    if (storeyCount === 0) {
      blocking.push({
        id: "zero-storeys",
        severity: "blocking",
        message: "No se pudo determinar ningún IfcBuildingStorey - no es posible evaluar los requisitos de Art. 4.2.10 sin cantidad de pisos.",
      });
    }
  }

  if (doc.spaces.length > 0) {
    const occupancy = calculateOccupancyLoad(doc);
    const zeroAreaSpaces = occupancy.spaces.filter((s) => s.areaM2 === 0);
    for (const s of zeroAreaSpaces) {
      blocking.push({
        id: `zero-area-${s.spaceExpressId}`,
        severity: "blocking",
        message: `Recinto "${s.spaceName ?? s.spaceGlobalId ?? s.spaceExpressId}" tiene área declarada en 0 m².`,
      });
    }

    const zeroHeightSpaces = doc.spaces
      .map((space) => ({ space, height: evaluateHeightRule(space) }))
      .filter(({ height }) => height.status === "evaluated" && height.value === 0);
    for (const { space } of zeroHeightSpaces) {
      blocking.push({
        id: `zero-height-${space.expressId}`,
        severity: "blocking",
        message: `Recinto "${space.name ?? space.globalId ?? space.expressId}" tiene altura declarada en 0 m.`,
      });
    }
  }

  // --- WARNING ---

  if (doc.spaces.length > 0) {
    const occupancy = calculateOccupancyLoad(doc);
    const totalAreaM2 = occupancy.classifiedAreaM2 + occupancy.unclassifiedAreaM2;
    if (totalAreaM2 > 0 && occupancy.unclassifiedAreaM2 > 0) {
      const pct = Math.round((occupancy.unclassifiedAreaM2 / totalAreaM2) * 100);
      warnings.push({
        id: "unclassified-destino",
        severity: "warning",
        message: `${pct}% del área total (${occupancy.unclassifiedAreaM2.toFixed(1)} m² de ${totalAreaM2.toFixed(1)} m²) corresponde a recintos sin destino OGUC identificado.`,
        detail: `${occupancy.unclassified.length} recinto(s) sin clasificar.`,
      });
    }
  }

  const fragmentedStoreys = findFragmentedStoreys(doc);
  for (const { storeyExpressId, stairCount } of fragmentedStoreys) {
    warnings.push({
      id: `fragmented-stairs-${storeyExpressId}`,
      severity: "warning",
      message: `Piso (express ID ${storeyExpressId}) tiene ${stairCount} entidades IfcStair - posibles fragmentos de una misma escalera que conviene agrupar antes de evaluar Art. 4.2.10.`,
    });
  }

  if (doc.spaces.length > 0 && !doc.hasDeclaredSpaceBoundaries) {
    warnings.push({
      id: "inferred-boundaries",
      severity: "warning",
      message: "El archivo no declara IfcRelSpaceBoundary - los límites espaciales de los recintos son inferidos geométricamente (AABB), no de datos autoritativos del archivo.",
    });
  }

  const unenclosedSpaces = findUnenclosedSpaces(doc);
  if (unenclosedSpaces.length > 0) {
    warnings.push({
      id: "unenclosed-spaces",
      severity: "warning",
      message: `${unenclosedSpaces.length} recinto(s) sin ningún elemento delimitante asociado (paredes/ventanas/puertas).`,
    });
  }

  // --- INFO ---

  info.push({
    id: "file-units",
    severity: "info",
    message: `Unidades del archivo: longitud=${doc.units.length?.name ?? "no declarada"}, área=${doc.units.area?.name ?? "no declarada"}.`,
  });

  info.push({
    id: "export-tool",
    severity: "info",
    message: "Herramienta de exportación (Revit/ArchiCAD/etc.): no disponible - ifc-headless no lee IfcApplication en esta versión.",
  });

  info.push({
    id: "model-summary",
    severity: "info",
    message: `${doc.spaces.length} recinto(s), ${storeyCount} piso(s) (aproximado), esquema ${doc.schema}.`,
  });

  return { blocking, warnings, info };
}
