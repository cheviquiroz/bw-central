// Shared "is this element marked accessible" keyword search, used by
// both ramps.ts and elevators.ts. Deliberately narrow: checks
// ObjectType/Name for an explicit keyword, plus a same-named boolean
// property in the element's own property sets. Never inferred from
// slope, geometry, or element type alone - accessibility is a real,
// project-specific classification, not something this reader derives.

import * as WebIFC from "web-ifc";
import { getLine, unwrap, unwrapId, unwrapIdList, unwrapString, type IfcApi } from "./webifc.js";

const POSITIVE_KEYWORDS = ["accesible", "accessible", "sin barrera"];
const NEGATION_PREFIXES = ["no ", "not ", "non-", "sin acceso"];

export function textIndicatesAccessible(text: string): boolean | null {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  for (const keyword of POSITIVE_KEYWORDS) {
    const index = normalized.indexOf(keyword);
    if (index === -1) continue;
    const precedingText = normalized.slice(Math.max(0, index - 12), index);
    const negated = NEGATION_PREFIXES.some((prefix) => precedingText.trimStart().endsWith(prefix.trim()) || precedingText.endsWith(prefix));
    return !negated;
  }
  return null;
}

const ACCESSIBILITY_PROPERTY_NAMES = new Set(["isaccessible", "accesible", "accessible"]);

function readAccessibilityProperty(api: IfcApi, modelID: number, elementId: number, relDefinesByPropertiesIds: number[]): boolean | null {
  for (const relId of relDefinesByPropertiesIds) {
    const rel = getLine(api, modelID, relId);
    if (!unwrapIdList(rel.RelatedObjects).includes(elementId)) continue;
    const pdId = unwrapId(rel.RelatingPropertyDefinition);
    if (pdId === null) continue;
    const pd = getLine(api, modelID, pdId);
    if (pd.type !== WebIFC.IFCPROPERTYSET) continue;
    for (const propId of unwrapIdList(pd.HasProperties)) {
      const prop = getLine(api, modelID, propId);
      const rawName = unwrapString(prop.Name);
      const normalizedName = rawName
        ?.normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      if (!normalizedName || !ACCESSIBILITY_PROPERTY_NAMES.has(normalizedName)) continue;
      const value = unwrap(prop.NominalValue);
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        if (/^(true|yes|si|s[ií])$/i.test(value.trim())) return true;
        if (/^(false|no)$/i.test(value.trim())) return false;
      }
    }
  }
  return null;
}

/**
 * "unknown" whenever no explicit marking was found anywhere - never
 * coerced to false, since absence of a marking is not the same claim as
 * "explicitly not accessible".
 */
export function readIsAccessible(
  api: IfcApi,
  modelID: number,
  elementId: number,
  name: string | null,
  objectType: string | null,
  relDefinesByPropertiesIds: number[]
): boolean | "unknown" {
  for (const text of [objectType, name]) {
    if (!text) continue;
    const fromText = textIndicatesAccessible(text);
    if (fromText !== null) return fromText;
  }
  const fromProperty = readAccessibilityProperty(api, modelID, elementId, relDefinesByPropertiesIds);
  if (fromProperty !== null) return fromProperty;
  return "unknown";
}
