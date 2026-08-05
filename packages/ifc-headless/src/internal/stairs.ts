// Reads IfcStair + IfcStairFlight into first-class output, parallel to
// spaces - never folded into a space's boundingElements list, since
// stairs are structural vertical circulation, not surface boundaries.
//
// KNOWN REAL-WORLD GAP (found while building this against
// OLAS-ARQ-05.ifc, a real ArchiCAD export with 24 IfcStair entities):
// not every real file decomposes IfcStair into IfcStairFlight per the
// buildingSMART convention. OLAS-ARQ-05 has ZERO IfcStairFlight anywhere
// in the file - each of its 24 stairs decomposes via IfcRelAggregates
// into generic IfcBuildingElementProxy children instead (individual step
// meshes, e.g. "SE - 008"). This reader does not reinterpret those
// proxies as flights or derive riser/tread from them - undeclared means
// an empty flights array, not a guess, exactly per this task's own
// instruction not to derive stair dimensions from geometry.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrap, unwrapId, unwrapIdList, unwrapString, type IfcApi, type RawLine } from "./webifc.js";
import { worldAabb, unionAabb } from "./geometry.js";
import { indexAggregatesByParent, indexStoreyContainment } from "./spatialIndex.js";
import type { BoundingBox, DeclaredUnit, FileUnits, IfcStair, IfcStairFlight } from "../types.js";

function readNumberAttr(line: RawLine, key: string): number | null {
  const v = unwrap(line[key]);
  return typeof v === "number" ? v : null;
}

// "Zona vertical de seguridad" is an OGUC term (Art. 4.2.10/4.2.11), not
// a standard IFC one - no schema attribute carries it. Only recognized
// if a project's own property set literally names it this way.
const SECURITY_ZONE_PROPERTY_NAMES = new Set(["issecurityzone", "zonaverticalseguridad", "zonaverticaldeseguridad"]);

function readIsSecurityZone(api: IfcApi, modelID: number, stairId: number, relDefinesByPropertiesIds: number[]): boolean | "unknown" {
  for (const relId of relDefinesByPropertiesIds) {
    const rel = getLine(api, modelID, relId);
    if (!unwrapIdList(rel.RelatedObjects).includes(stairId)) continue;
    const pdId = unwrapId(rel.RelatingPropertyDefinition);
    if (pdId === null) continue;
    const pd = getLine(api, modelID, pdId);
    if (pd.type !== WebIFC.IFCPROPERTYSET) continue;
    for (const propId of unwrapIdList(pd.HasProperties)) {
      const prop = getLine(api, modelID, propId);
      const rawName = unwrapString(prop.Name);
      const normalizedName = rawName?.toLowerCase().replace(/[^a-z]/g, "");
      if (!normalizedName || !SECURITY_ZONE_PROPERTY_NAMES.has(normalizedName)) continue;
      const value = unwrap(prop.NominalValue);
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return /^(true|yes|si|s[ií])$/i.test(value.trim());
    }
  }
  return "unknown";
}

function readFlight(api: IfcApi, modelID: number, flightId: number, lengthUnit: DeclaredUnit | null): IfcStairFlight {
  const line = getLine(api, modelID, flightId);
  return {
    globalId: unwrapString(line.GlobalId),
    name: unwrapString(line.Name),
    riserCount: readNumberAttr(line, "NumberOfRiser"),
    treadDepth: readNumberAttr(line, "TreadLength"),
    riserHeight: readNumberAttr(line, "RiserHeight"),
    direction: "unknown",
    boundingBox: worldAabb(api, modelID, flightId),
    lengthUnit,
  };
}

function readStairBoundingBox(api: IfcApi, modelID: number, stairId: number, childIds: number[]): BoundingBox | null {
  const own = worldAabb(api, modelID, stairId);
  if (own) return own;
  // Muchos exports reales (ver OLAS-ARQ-05.ifc) no ponen geometría en el
  // propio IfcStair - vive en sus hijos de descomposición reales. Se usa
  // la unión de esa geometría real, nunca una caja estimada.
  const childBoxes = childIds.map((id) => worldAabb(api, modelID, id)).filter((b): b is NonNullable<typeof b> => b !== null);
  return unionAabb(childBoxes);
}

export function resolveStairs(api: IfcApi, modelID: number, units: FileUnits): IfcStair[] {
  const stairIds = getLineIds(api, modelID, WebIFC.IFCSTAIR);
  if (stairIds.length === 0) return [];

  const aggregatesByParent = indexAggregatesByParent(api, modelID);
  const storeyByElement = indexStoreyContainment(api, modelID);
  const relDefinesByPropertiesIds = getLineIds(api, modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);

  return stairIds.map((stairId) => {
    const line = getLine(api, modelID, stairId);
    const childIds = aggregatesByParent.get(stairId) ?? [];

    const flights: IfcStairFlight[] = [];
    for (const childId of childIds) {
      const childLine = getLine(api, modelID, childId);
      if (childLine.type === WebIFC.IFCSTAIRFLIGHT) {
        flights.push(readFlight(api, modelID, childId, units.length));
      }
    }

    return {
      expressId: stairId,
      globalId: unwrapString(line.GlobalId),
      name: unwrapString(line.Name),
      objectType: unwrapString(line.ObjectType),
      flights,
      storeyExpressId: storeyByElement.get(stairId) ?? null,
      isSecurityZone: readIsSecurityZone(api, modelID, stairId, relDefinesByPropertiesIds),
      boundingBox: readStairBoundingBox(api, modelID, stairId, childIds),
    };
  });
}
