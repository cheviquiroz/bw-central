// Reads elevator-typed IfcTransportElement into first-class output.
//
// NO DEDICATED "IfcElevator" ENTITY: confirmed against web-ifc's own
// type registry (WebIFC.IFCELEVATOR is undefined for IFC2X3/IFC4/IFC4X3,
// the three schemas this reader's fixtures use - IfcElevator only exists
// from IFC4.3 onward). Elevators are IfcTransportElement with a
// discriminator marking it ELEVATOR (vs ESCALATOR/MOVINGWALKWAY/etc) -
// confirmed against web-ifc's generated schema, this discriminator is a
// DIFFERENT attribute depending on schema version:
//   - IFC2X3: OperationType (an IfcTransportElementTypeEnum), plus
//     CapacityByWeight/CapacityByNumber as direct entity attributes.
//   - IFC4/IFC4X3: PredefinedType (same enum values), and NO capacity
//     attributes at all - dropped from the entity schema.
//
// UNTESTED AGAINST REAL DATA: none of this reader's five real fixtures
// contain any IfcTransportElement at all (confirmed via
// GetLineIDsWithType, not assumed), elevator-typed or otherwise. Every
// behavior below follows directly from the schema facts above, but none
// of it has been exercised against a real elevator.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrap, unwrapString, type IfcApi } from "./webifc.js";
import { worldAabb } from "./geometry.js";
import { indexStoreyContainment } from "./spatialIndex.js";
import { readIsAccessible } from "./accessibility.js";
import type { IfcElevator } from "../types.js";

function readOperationTypeOrPredefinedType(line: Record<string, unknown>): string | null {
  // IFC2X3 usa OperationType, IFC4/IFC4X3 usan PredefinedType - mismo
  // propósito (discriminar ELEVATOR/ESCALATOR/MOVINGWALKWAY/...),
  // atributo distinto según versión de schema.
  const raw = unwrap(line.OperationType) ?? unwrap(line.PredefinedType);
  return typeof raw === "string" ? raw : null;
}

function readCapacityByNumber(line: Record<string, unknown>): number | null {
  // Solo existe como atributo directo en IFC2X3 - en IFC4/IFC4X3 fue
  // removido del schema del entity; ver el comentario del archivo. No se
  // busca en property sets como fallback: no hay un fixture real de
  // ascensor IFC4 para confirmar qué nombre de propiedad usaría un
  // proyecto real, y adivinar uno sería exactamente el tipo de "respuesta
  // confiada pero no verificada" que este paquete evita.
  const v = unwrap(line.CapacityByNumber);
  return typeof v === "number" ? v : null;
}

export function resolveElevators(api: IfcApi, modelID: number): IfcElevator[] {
  const transportElementIds = getLineIds(api, modelID, WebIFC.IFCTRANSPORTELEMENT);
  if (transportElementIds.length === 0) return [];

  const storeyByElement = indexStoreyContainment(api, modelID);
  const relDefinesByPropertiesIds = getLineIds(api, modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);

  const elevatorIds = transportElementIds.filter((id) => readOperationTypeOrPredefinedType(getLine(api, modelID, id)) === "ELEVATOR");

  return elevatorIds.map((elevatorId) => {
    const line = getLine(api, modelID, elevatorId);
    const name = unwrapString(line.Name);
    const objectType = unwrapString(line.ObjectType);
    const homeStorey = storeyByElement.get(elevatorId) ?? null;

    return {
      expressId: elevatorId,
      globalId: unwrapString(line.GlobalId),
      name,
      objectType,
      isAccessible: readIsAccessible(api, modelID, elevatorId, name, objectType, relDefinesByPropertiesIds),
      boundingBox: worldAabb(api, modelID, elevatorId),
      servedStoreyExpressIds: homeStorey === null ? null : [homeStorey],
      carryingCapacity: readCapacityByNumber(line),
    };
  });
}
