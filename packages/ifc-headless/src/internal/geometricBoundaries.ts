// Geometric derivation of space-bounding elements, for files with no
// IfcRelSpaceBoundary (CASA-ARQ; also CASA-MEP/EOFF-ARQ, though those
// have zero spaces so this never runs anything on them in practice).
//
// SCOPED FIRST VERSION - documented limitations, not a hidden
// approximation:
//
//   - Test is axis-aligned bounding-box (AABB) overlap, not true solid
//     coincidence. A wall's AABB is expanded-tolerance-tested against
//     the space's AABB; there is no boolean/CSG intersection against
//     actual geometry. This means:
//       * A diagonal or curved wall's AABB is looser than its real
//         footprint, so it may be included even where the true geometry
//         only grazes the space (false positive risk).
//       * An L-shaped or non-convex space's AABB covers its full
//         bounding rectangle, including area the space doesn't actually
//         occupy - a wall sitting in that "extra" rectangle but outside
//         the real space footprint can be wrongly included (false
//         positive risk, worse for non-rectangular rooms).
//       * A wall whose real geometry touches the space but whose AABB
//         happens to fall outside the tolerance band (e.g. a very thin
//         sliver of contact) is missed (false negative risk).
//   - The candidate wall set is scoped to the same storey as the space
//     (via IfcRelContainedInSpatialStructure) - a space whose bounding
//     wall is (unusually) modeled on a different storey than the space
//     itself will not find that wall.
//   - Confidence is a coarse binary signal, not a real geometric score:
//     "high" means the wall's un-expanded AABB actually intersects the
//     space's AABB (real overlap); "low" means it was only found within
//     the tolerance band (near, not overlapping). This is meant to flag
//     "look at this one before trusting it", not to rank precision.
//   - Windows/doors are attributed to a space only through their host
//     wall (via IfcRelFillsElement -> IfcRelVoidsElement), inheriting
//     that wall's confidence - they are never tested against the space's
//     AABB directly.
//
// Hardening this properly would mean: real solid-solid intersection
// (a geometry kernel, not AABB), handling non-convex space footprints
// with actual polygon/solid boundaries instead of a bounding box, and
// probably ray-casting or half-space tests against each wall's actual
// planar faces rather than its box. That is a materially larger task -
// this version is honest about being a starting point, not that result.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrapId, unwrapString, typeName, type IfcApi } from "./webifc.js";
import { worldAabb, intersects, intersectsExpanded, type Aabb } from "./geometry.js";
import type { StoreyElements, SpaceStorey } from "./spatialHierarchy.js";
import type { BoundingElementRef } from "../types.js";

/** Meters. Real walls in these fixtures are tens of cm thick; this covers a modeled space boundary sitting at the wall's inner face, centerline, or outer face without over-including neighbours' walls. Not derived from measurement - a starting value to revisit once checked against more fixtures. */
const AABB_TOLERANCE_M = 0.35;

interface HostWallLookup {
  get(fillingElementId: number): number | null;
}

/** door/window express-ID -> its host wall express-ID, via IfcRelFillsElement (element -> opening) then IfcRelVoidsElement (opening -> wall). */
function buildHostWallLookup(api: IfcApi, modelID: number): HostWallLookup {
  const openingToWall = new Map<number, number>();
  for (const relId of getLineIds(api, modelID, WebIFC.IFCRELVOIDSELEMENT)) {
    const rel = getLine(api, modelID, relId);
    const wallId = unwrapId(rel.RelatingBuildingElement);
    const openingId = unwrapId(rel.RelatedOpeningElement);
    if (wallId !== null && openingId !== null) openingToWall.set(openingId, wallId);
  }

  const fillingToWall = new Map<number, number>();
  for (const relId of getLineIds(api, modelID, WebIFC.IFCRELFILLSELEMENT)) {
    const rel = getLine(api, modelID, relId);
    const fillingId = unwrapId(rel.RelatedBuildingElement);
    const openingId = unwrapId(rel.RelatingOpeningElement);
    if (fillingId === null || openingId === null) continue;
    const wallId = openingToWall.get(openingId);
    if (wallId !== undefined) fillingToWall.set(fillingId, wallId);
  }

  return { get: (id) => fillingToWall.get(id) ?? null };
}

export function resolveGeometricBoundaries(
  api: IfcApi,
  modelID: number,
  spaceIds: number[],
  spaceStorey: SpaceStorey,
  storeyElements: StoreyElements
): Map<number, BoundingElementRef[]> {
  const result = new Map<number, BoundingElementRef[]>();
  const hostWalls = buildHostWallLookup(api, modelID);

  const windowIds = new Set(getLineIds(api, modelID, WebIFC.IFCWINDOW));
  const doorIds = new Set(getLineIds(api, modelID, WebIFC.IFCDOOR));
  const wallIds = new Set(getLineIds(api, modelID, WebIFC.IFCWALL));

  const aabbCache = new Map<number, Aabb | null>();
  const getAabb = (id: number): Aabb | null => {
    if (!aabbCache.has(id)) aabbCache.set(id, worldAabb(api, modelID, id));
    return aabbCache.get(id) ?? null;
  };

  for (const spaceId of spaceIds) {
    const spaceBox = getAabb(spaceId);
    if (!spaceBox) {
      result.set(spaceId, []); // sin representación geométrica: no se puede inferir nada, no se inventa un resultado
      continue;
    }

    const storeyId = spaceStorey.get(spaceId);
    const candidateElementIds = storeyId !== undefined ? (storeyElements.get(storeyId) ?? []) : [];
    const candidateWallIds = candidateElementIds.filter((id) => wallIds.has(id));

    const refs: BoundingElementRef[] = [];
    const boundingWallIds = new Set<number>();

    for (const wallId of candidateWallIds) {
      const wallBox = getAabb(wallId);
      if (!wallBox) continue;
      if (!intersectsExpanded(spaceBox, wallBox, AABB_TOLERANCE_M)) continue;

      const confidence = intersects(spaceBox, wallBox) ? "high" : "low";
      const wallLine = getLine(api, modelID, wallId);
      refs.push({
        expressId: wallId,
        ifcType: typeName(api, wallLine.type as number),
        globalId: unwrapString(wallLine.GlobalId),
        method: "inferred",
        confidence,
      });
      boundingWallIds.add(wallId);
    }

    // Ventanas/puertas: solo por su muro anfitrión, nunca contra la AABB del
    // espacio directamente - heredan la confianza del muro que las aloja.
    for (const elementId of candidateElementIds) {
      if (!windowIds.has(elementId) && !doorIds.has(elementId)) continue;
      const hostWallId = hostWalls.get(elementId);
      if (hostWallId === null || !boundingWallIds.has(hostWallId)) continue;

      const hostRef = refs.find((r) => r.expressId === hostWallId);
      const elementLine = getLine(api, modelID, elementId);
      refs.push({
        expressId: elementId,
        ifcType: typeName(api, elementLine.type as number),
        globalId: unwrapString(elementLine.GlobalId),
        method: "inferred",
        confidence: hostRef?.confidence ?? "low",
      });
    }

    result.set(spaceId, refs);
  }

  return result;
}
