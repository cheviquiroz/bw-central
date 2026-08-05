// Small shared helpers over the raw web-ifc API. Nothing here is exported
// from the package's public surface (see ../index.ts) - these are
// implementation details of talking to IfcAPI, not part of the domain
// model.

import * as WebIFC from "web-ifc";

export type IfcApi = InstanceType<typeof WebIFC.IfcAPI>;
export type RawLine = Record<string, unknown>;

/** web-ifc wraps most attribute values as { value: X, type: N } handles/measures; this unwraps one level. Express-ID handles (references to other lines) unwrap to the numeric ID itself. */
export function unwrap(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    return (v as { value: unknown }).value;
  }
  return v;
}

/** Same as unwrap, typed for the common case of an express-ID reference handle. */
export function unwrapId(v: unknown): number | null {
  const u = unwrap(v);
  return typeof u === "number" ? u : null;
}

/** unwrap, coerced to a non-empty string or null - used for GlobalId/Name/Description/ObjectType/LongName, which are always meant to be plain text (not further nested). */
export function unwrapString(v: unknown): string | null {
  const u = unwrap(v);
  return typeof u === "string" ? u : null;
}

export function getLine(api: IfcApi, modelID: number, expressId: number): RawLine {
  return api.GetLine(modelID, expressId, false) as RawLine;
}

/** Human-readable IFC entity type name (e.g. "IfcWall") for a line's numeric `.type` code. */
export function typeName(api: IfcApi, typeCode: number): string {
  return api.GetNameFromTypeCode(typeCode);
}

export function getLineIds(api: IfcApi, modelID: number, type: number): number[] {
  const ids = api.GetLineIDsWithType(modelID, type);
  const result: number[] = [];
  for (let i = 0; i < ids.size(); i++) result.push(ids.get(i));
  return result;
}

/** An attribute that is itself a list of express-ID handles (e.g. RelatedObjects, HasProperties). */
export function unwrapIdList(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map(unwrapId).filter((id): id is number => id !== null);
}
