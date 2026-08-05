// Reads IfcProject -> UnitsInContext -> IfcUnitAssignment.Units, exactly
// as declared - no conversion, no assumed default. See types.ts's
// DeclaredUnit for why this matters: CASA-ARQ declares LENGTHUNIT=METRE,
// EOFF-SPC declares LENGTHUNIT=MILLI+METRE, and both declare
// AREAUNIT/VOLUMEUNIT as bare SQUARE_METRE/CUBIC_METRE regardless of the
// length prefix (confirmed against all four real fixtures in the Part 1
// inventory).
//
// KNOWN LIMITATION: only IfcSIUnit is resolved. A file that declares an
// IfcConversionBasedUnit (e.g. imperial units, or a custom named unit
// derived from an SI unit via a conversion factor) is not resolved by
// this reader - that category comes back as null, same as if no unit
// were declared at all. None of the four fixtures this reader was built
// and tested against exercise this path (all declare IfcSIUnit
// directly), so this is a real, untested gap, not a verified-safe
// simplification.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrap, unwrapId, unwrapString, type IfcApi, type RawLine } from "./webifc.js";
import type { DeclaredUnit, FileUnits } from "../types.js";

function readDeclaredUnit(api: IfcApi, modelID: number, unitLine: RawLine): DeclaredUnit | null {
  if (unitLine.type !== WebIFC.IFCSIUNIT) return null; // ver limitación de IfcConversionBasedUnit arriba
  return {
    name: unwrapString(unitLine.Name),
    prefix: unwrapString(unitLine.Prefix),
  };
}

export function readFileUnits(api: IfcApi, modelID: number): FileUnits {
  const empty: FileUnits = { length: null, area: null, volume: null };

  const projectIds = getLineIds(api, modelID, WebIFC.IFCPROJECT);
  if (projectIds.length === 0) return empty;

  const project = getLine(api, modelID, projectIds[0]);
  const unitsAssignmentId = unwrapId(project.UnitsInContext);
  if (unitsAssignmentId === null) return empty;

  const unitAssignment = getLine(api, modelID, unitsAssignmentId);
  const unitHandles = Array.isArray(unitAssignment.Units) ? unitAssignment.Units : [];

  const result: FileUnits = { ...empty };
  for (const handle of unitHandles) {
    const unitId = unwrapId(handle);
    if (unitId === null) continue;
    const unitLine = getLine(api, modelID, unitId);
    const unitType = unwrap(unitLine.UnitType);

    if (unitType === "LENGTHUNIT") result.length = readDeclaredUnit(api, modelID, unitLine);
    else if (unitType === "AREAUNIT") result.area = readDeclaredUnit(api, modelID, unitLine);
    else if (unitType === "VOLUMEUNIT") result.volume = readDeclaredUnit(api, modelID, unitLine);
  }

  return result;
}
