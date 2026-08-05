// Resolves IfcRelSpaceBoundary into per-space bounding elements. This is
// the "authoritative" path: the file itself declares which elements
// bound a space. Only present in one of the four Part 1 fixtures
// (EOFF-SPC, 73 boundaries across 9 spaces) - CASA-ARQ, CASA-MEP and
// EOFF-ARQ declare none, and fall back to geometric derivation instead
// (see geometricBoundaries.ts).

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrapId, unwrapString, typeName, type IfcApi } from "./webifc.js";
import type { BoundingElementRef } from "../types.js";

export function hasAnySpaceBoundaries(api: IfcApi, modelID: number): boolean {
  return getLineIds(api, modelID, WebIFC.IFCRELSPACEBOUNDARY).length > 0;
}

/** space express-ID -> its authoritative bounding elements, per IfcRelSpaceBoundary. Physical boundaries only - virtual boundaries (space-to-space separations with no real element) have no RelatedBuildingElement and are skipped, since this reader reports elements, not abstract separations. */
export function resolveAuthoritativeBoundaries(api: IfcApi, modelID: number, spaceIds: Set<number>): Map<number, BoundingElementRef[]> {
  const result = new Map<number, BoundingElementRef[]>();
  const boundaryIds = getLineIds(api, modelID, WebIFC.IFCRELSPACEBOUNDARY);

  for (const boundaryId of boundaryIds) {
    const boundary = getLine(api, modelID, boundaryId);
    const spaceId = unwrapId(boundary.RelatingSpace);
    if (spaceId === null || !spaceIds.has(spaceId)) continue;

    const elementId = unwrapId(boundary.RelatedBuildingElement);
    if (elementId === null) continue; // boundary virtual, sin elemento real

    const element = getLine(api, modelID, elementId);
    const ref: BoundingElementRef = {
      expressId: elementId,
      ifcType: typeName(api, element.type as number),
      globalId: unwrapString(element.GlobalId),
      method: "authoritative",
    };

    const existing = result.get(spaceId) ?? [];
    existing.push(ref);
    result.set(spaceId, existing);
  }

  return result;
}
