// Resolves which storey each IfcSpace belongs to, and which building
// elements each storey directly contains.
//
// Per the Part 1 inventory: every fixture that has spaces links them to
// their storey via IfcRelAggregates (RelatedObjects), never via
// IfcRelContainedInSpatialStructure - confirmed across both IFC2X3
// (CASA-ARQ) and IFC4 (EOFF-SPC) fixtures. This reader does not assume
// the reverse. Physical elements (walls, windows, doors) use the other
// relation, IfcRelContainedInSpatialStructure, which this module also
// resolves - needed to scope the geometric boundary derivation (see
// geometricBoundaries.ts) to elements on the same storey as a space,
// rather than testing every wall in the whole file against every space.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrapId, unwrapIdList, type IfcApi } from "./webifc.js";

/** storey expressId -> space expressIds it aggregates. */
export type StoreySpaces = Map<number, number[]>;
/** space expressId -> its storey expressId. */
export type SpaceStorey = Map<number, number>;
/** storey expressId -> element expressIds it directly contains (IfcRelContainedInSpatialStructure). */
export type StoreyElements = Map<number, number[]>;

export interface SpatialHierarchy {
  storeySpaces: StoreySpaces;
  spaceStorey: SpaceStorey;
  storeyElements: StoreyElements;
}

export function resolveSpatialHierarchy(api: IfcApi, modelID: number, spaceIds: Set<number>): SpatialHierarchy {
  const storeyIds = new Set(getLineIds(api, modelID, WebIFC.IFCBUILDINGSTOREY));

  const storeySpaces: StoreySpaces = new Map();
  const spaceStorey: SpaceStorey = new Map();

  const relAggregatesIds = getLineIds(api, modelID, WebIFC.IFCRELAGGREGATES);
  for (const relId of relAggregatesIds) {
    const rel = getLine(api, modelID, relId);
    const relatingId = unwrapId(rel.RelatingObject);
    if (relatingId === null || !storeyIds.has(relatingId)) continue;

    const relatedIds = unwrapIdList(rel.RelatedObjects);
    const relatedSpaceIds = relatedIds.filter((id) => spaceIds.has(id));
    if (relatedSpaceIds.length === 0) continue;

    const existing = storeySpaces.get(relatingId) ?? [];
    storeySpaces.set(relatingId, existing.concat(relatedSpaceIds));
    for (const spaceId of relatedSpaceIds) spaceStorey.set(spaceId, relatingId);
  }

  const storeyElements: StoreyElements = new Map();
  const relContainedIds = getLineIds(api, modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
  for (const relId of relContainedIds) {
    const rel = getLine(api, modelID, relId);
    const structureId = unwrapId(rel.RelatingStructure);
    if (structureId === null || !storeyIds.has(structureId)) continue;

    const relatedElementIds = unwrapIdList(rel.RelatedElements);
    const existing = storeyElements.get(structureId) ?? [];
    storeyElements.set(structureId, existing.concat(relatedElementIds));
  }

  return { storeySpaces, spaceStorey, storeyElements };
}
