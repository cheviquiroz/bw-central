// Resolves IfcRelDefinesByProperties for each space into the shape
// ifc-core's readIfcName/readIfcPropertyValue already expect - raw
// web-ifc's IfcPropertySingleValue/IfcQuantityLength etc. already carry a
// *Value field matching ifc-core's readIfcPropertyValue convention
// directly (that convention comes from the IFC schema itself, not from
// @thatopen/fragments), so no adaptation is needed once handles are
// dereferenced. See the commit that adds ifc-headless for why reusing
// these functions instead of reimplementing them matters - this is
// exactly the kind of duplication caught and fixed in SpatialTreeManager
// during Step 06.
//
// NOTE on groupPropertySets/extractPsetValues specifically: they are not
// called directly here, even though they exist for exactly this shape.
// Both flatten a mix of property sets AND quantity sets into one Record
// keyed by name, with no way to tell afterwards which entries came from
// HasProperties (a property set) versus Quantities (a quantity set) -
// this reader needs that distinction to attach units only to quantities.
// The per-name fallback convention they use (readIfcName(rel) ??
// `PropertySet_#${index}`) is replicated inline below for that reason;
// readIfcName and readIfcPropertyValue themselves - the actual
// value-reading logic - are reused unchanged.
//
// Property sets (Pset_*, or whatever name the file actually uses - see
// CASA-ARQ's IFC_Pset_Caratteristiche* vocabulary) are flat strings, no
// unit attached: a property's measure type is not uniformly determinable
// from a generic IfcPropertySingleValue the way a quantity's is from its
// concrete IfcQuantityLength/Area/Volume/... entity type.
//
// Quantity sets (Qto_*, or a bare "BaseQuantities" - CASA-ARQ uses that
// name, not the buildingSMART-standard "Qto_SpaceBaseQuantities") each
// carry the unit actually declared in this file's IfcUnitAssignment for
// their measure category.

import * as WebIFC from "web-ifc";
import { readIfcPropertyValue, readIfcName } from "@bw-central/ifc-core";
import { getLine, getLineIds, unwrapId, unwrapIdList, type IfcApi, type RawLine } from "./webifc.js";
import type { FileUnits, QuantityEntry } from "../types.js";

const QUANTITY_TYPE_NAMES: Record<number, string> = {
  [WebIFC.IFCQUANTITYLENGTH]: "IFCQUANTITYLENGTH",
  [WebIFC.IFCQUANTITYAREA]: "IFCQUANTITYAREA",
  [WebIFC.IFCQUANTITYVOLUME]: "IFCQUANTITYVOLUME",
  [WebIFC.IFCQUANTITYCOUNT]: "IFCQUANTITYCOUNT",
  [WebIFC.IFCQUANTITYWEIGHT]: "IFCQUANTITYWEIGHT",
  [WebIFC.IFCQUANTITYTIME]: "IFCQUANTITYTIME",
};

function unitForQuantityType(ifcType: number, units: FileUnits) {
  if (ifcType === WebIFC.IFCQUANTITYLENGTH) return units.length;
  if (ifcType === WebIFC.IFCQUANTITYAREA) return units.area;
  if (ifcType === WebIFC.IFCQUANTITYVOLUME) return units.volume;
  // IfcQuantityCount/Weight/Time: this reader does not resolve
  // COUNTUNIT/MASSUNIT/TIMEUNIT (none of the four fixtures needed it -
  // OGUC space checks are area/length/volume-driven). Real gap, not a
  // verified-safe omission.
  return null;
}

interface ResolvedRelation {
  name: string | null;
  kind: "property" | "quantity";
  members: RawLine[];
}

/** space express-ID -> resolved relations that apply to it, in file order. */
function indexRelDefinesByProperties(api: IfcApi, modelID: number): Map<number, ResolvedRelation[]> {
  const relIds = getLineIds(api, modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
  const byObject = new Map<number, ResolvedRelation[]>();

  for (const relId of relIds) {
    const rel = getLine(api, modelID, relId);
    const relatedObjectIds = unwrapIdList(rel.RelatedObjects);
    if (relatedObjectIds.length === 0) continue;

    const pdId = unwrapId(rel.RelatingPropertyDefinition);
    if (pdId === null) continue;
    const pd = getLine(api, modelID, pdId);

    const isQuantitySet = pd.type === WebIFC.IFCELEMENTQUANTITY;
    const isPropertySet = pd.type === WebIFC.IFCPROPERTYSET;
    if (!isQuantitySet && !isPropertySet) continue; // ni Pset ni Qto reconocido - se ignora, no se inventa una forma

    const memberIds = unwrapIdList(isQuantitySet ? pd.Quantities : pd.HasProperties);
    const members = memberIds.map((id) => getLine(api, modelID, id));

    const resolved: ResolvedRelation = {
      name: readIfcName(pd),
      kind: isQuantitySet ? "quantity" : "property",
      members,
    };

    for (const objectId of relatedObjectIds) {
      const existing = byObject.get(objectId) ?? [];
      existing.push(resolved);
      byObject.set(objectId, existing);
    }
  }

  return byObject;
}

export interface SpacePropertyData {
  propertySets: Record<string, Record<string, string>>;
  quantitySets: Record<string, Record<string, QuantityEntry>>;
}

export function resolveSpaceProperties(api: IfcApi, modelID: number, spaceIds: number[], units: FileUnits): Map<number, SpacePropertyData> {
  const relIndex = indexRelDefinesByProperties(api, modelID);
  const result = new Map<number, SpacePropertyData>();

  for (const spaceId of spaceIds) {
    const relations = relIndex.get(spaceId) ?? [];
    const propertySets: Record<string, Record<string, string>> = {};
    const quantitySets: Record<string, Record<string, QuantityEntry>> = {};

    relations.forEach((rel, index) => {
      const setName = rel.name ?? `PropertySet_#${index}`;

      if (rel.kind === "quantity") {
        const values: Record<string, QuantityEntry> = {};
        for (const q of rel.members) {
          const qName = readIfcName(q);
          if (qName === null) continue;
          const qType = q.type as number;
          values[qName] = {
            value: readIfcPropertyValue(q),
            ifcType: QUANTITY_TYPE_NAMES[qType] ?? `UNKNOWN(${qType})`,
            unit: unitForQuantityType(qType, units),
          };
        }
        quantitySets[setName] = values;
      } else {
        const values: Record<string, string> = {};
        for (const p of rel.members) {
          const pName = readIfcName(p);
          if (pName === null) continue;
          const value = readIfcPropertyValue(p);
          if (value !== null) values[pName] = value;
        }
        propertySets[setName] = values;
      }
    });

    result.set(spaceId, { propertySets, quantitySets });
  }

  return result;
}
