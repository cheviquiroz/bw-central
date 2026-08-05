// Reads IfcRamp into first-class output, parallel to stairs.
//
// UNTESTED AGAINST REAL DATA: none of this reader's five real fixtures
// contain a single IfcRamp (confirmed via GetLineIDsWithType against all
// five, not assumed). Every behavior below is implemented per the IFC
// schema (verified against web-ifc's own generated schema: neither
// IfcRamp nor IfcRampFlight has a Slope ATTRIBUTE in any version - it is
// only ever a property, if declared at all) and this package's "never
// fabricate" discipline, but none of it has been exercised against real
// declared-slope or accessibility-marker data. Flagged, not hidden - see
// the commit that adds this for the fixture search that established it.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrapId, unwrapIdList, unwrapString, type IfcApi, type RawLine } from "./webifc.js";
import { worldAabb, unionAabb } from "./geometry.js";
import { indexAggregatesByParent, indexStoreyContainment } from "./spatialIndex.js";
import { readIsAccessible } from "./accessibility.js";
import type { BoundingBox, DeclaredSlope, IfcRamp } from "../types.js";

// Measure types that represent a rise/run ratio (slope% = ratio x 100).
// A plane angle measure is a real, different possibility real exports
// use for "Slope" and is deliberately NOT converted here (would need
// trigonometry this reader has no real declared-angle fixture to
// validate against - see DeclaredSlope's doc comment in types.ts).
const RATIO_MEASURE_TYPE_NAMES = new Set(["IFCPOSITIVERATIOMEASURE", "IFCRATIOMEASURE", "IFCNORMALISEDRATIOMEASURE"]);

const SLOPE_PROPERTY_NAMES = new Set(["slope", "pendiente"]);

function readDeclaredSlope(api: IfcApi, modelID: number, elementId: number, relDefinesByPropertiesIds: number[]): DeclaredSlope | null {
  for (const relId of relDefinesByPropertiesIds) {
    const rel = getLine(api, modelID, relId);
    if (!unwrapIdList(rel.RelatedObjects).includes(elementId)) continue;
    const pdId = unwrapId(rel.RelatingPropertyDefinition);
    if (pdId === null) continue;
    const pd = getLine(api, modelID, pdId);
    if (pd.type !== WebIFC.IFCPROPERTYSET) continue;
    for (const propId of unwrapIdList(pd.HasProperties)) {
      const prop = getLine(api, modelID, propId);
      const name = unwrapString(prop.Name)?.toLowerCase();
      if (!name || !SLOPE_PROPERTY_NAMES.has(name)) continue;
      const nominalValue = (prop as RawLine).NominalValue as { value?: unknown; name?: string } | null | undefined;
      if (!nominalValue || typeof nominalValue.value !== "number") continue;
      return { value: nominalValue.value, measureType: nominalValue.name ?? "UNKNOWN" };
    }
  }
  return null;
}

export function computeSlopePercentage(slope: DeclaredSlope | null): number | null {
  if (slope === null) return null;
  if (!RATIO_MEASURE_TYPE_NAMES.has(slope.measureType)) return null;
  return slope.value * 100;
}

function readRampBoundingBox(api: IfcApi, modelID: number, rampId: number, childIds: number[]): BoundingBox | null {
  const own = worldAabb(api, modelID, rampId);
  if (own) return own;
  const childBoxes = childIds.map((id) => worldAabb(api, modelID, id)).filter((b): b is NonNullable<typeof b> => b !== null);
  return unionAabb(childBoxes);
}

export function resolveRamps(api: IfcApi, modelID: number): IfcRamp[] {
  const rampIds = getLineIds(api, modelID, WebIFC.IFCRAMP);
  if (rampIds.length === 0) return [];

  const aggregatesByParent = indexAggregatesByParent(api, modelID);
  const storeyByElement = indexStoreyContainment(api, modelID);
  const relDefinesByPropertiesIds = getLineIds(api, modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);

  return rampIds.map((rampId) => {
    const line = getLine(api, modelID, rampId);
    const childIds = aggregatesByParent.get(rampId) ?? [];
    const name = unwrapString(line.Name);
    const objectType = unwrapString(line.ObjectType);

    // El propio IfcRamp o sus IfcRampFlight hijos pueden llevar la
    // propiedad "Slope" - se busca en ambos, propio ramp primero.
    const slope = readDeclaredSlope(api, modelID, rampId, relDefinesByPropertiesIds) ?? childIds.map((id) => readDeclaredSlope(api, modelID, id, relDefinesByPropertiesIds)).find((s) => s !== null) ?? null;

    return {
      expressId: rampId,
      globalId: unwrapString(line.GlobalId),
      name,
      objectType,
      slope,
      slopePercentage: computeSlopePercentage(slope),
      storeyExpressId: storeyByElement.get(rampId) ?? null,
      isAccessible: readIsAccessible(api, modelID, rampId, name, objectType, relDefinesByPropertiesIds),
      boundingBox: readRampBoundingBox(api, modelID, rampId, childIds),
    };
  });
}
