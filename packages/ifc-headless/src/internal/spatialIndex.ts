// Shared spatial-relationship indexing, factored out of stairs.ts (Fase
// 1.1 Part B) so ramps/elevators (Part C) reuse the exact same, already
// fixture-verified logic instead of a second copy that could drift.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrapId, unwrapIdList, type IfcApi } from "./webifc.js";

/** parent expressId -> direct children expressIds, via IfcRelAggregates (IsDecomposedBy). */
export function indexAggregatesByParent(api: IfcApi, modelID: number): Map<number, number[]> {
  const relIds = getLineIds(api, modelID, WebIFC.IFCRELAGGREGATES);
  const byParent = new Map<number, number[]>();
  for (const relId of relIds) {
    const rel = getLine(api, modelID, relId);
    const parentId = unwrapId(rel.RelatingObject);
    if (parentId === null) continue;
    byParent.set(parentId, unwrapIdList(rel.RelatedObjects));
  }
  return byParent;
}

/**
 * element expressId -> containing IfcBuildingStorey expressId, via
 * IfcRelContainedInSpatialStructure. Deliberately only accepts a
 * RelatingStructure whose entity type is IfcBuildingStorey - a real
 * fixture (CASA-ARQ) has a stair contained directly at IfcSite level,
 * which is not a storey and must not be reported as one.
 */
export function indexStoreyContainment(api: IfcApi, modelID: number): Map<number, number> {
  const relIds = getLineIds(api, modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
  const byElement = new Map<number, number>();
  for (const relId of relIds) {
    const rel = getLine(api, modelID, relId);
    const structureId = unwrapId(rel.RelatingStructure);
    if (structureId === null) continue;
    const structureLine = getLine(api, modelID, structureId);
    if (structureLine.type !== WebIFC.IFCBUILDINGSTOREY) continue;
    for (const elementId of unwrapIdList(rel.RelatedElements)) {
      byElement.set(elementId, structureId);
    }
  }
  return byElement;
}
