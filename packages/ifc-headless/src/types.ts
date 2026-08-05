// Domain model for headless IFC reading. Pure data shapes - no web-ifc
// types leak past reader.ts, so consumers never need to know this package
// is built on raw web-ifc underneath.
//
// LANGUAGE CONVENTION (see also packages/oguc-core, established here for
// the whole monorepo going forward): identifiers, types and comments are
// English. User-facing strings are Spanish (Chile) - none exist in this
// package. Domain terms with no accurate English equivalent keep their
// Spanish spelling as identifiers (recinto, destino, superficieUtil,
// superficieEdificada, cargaDeOcupacion) - none of those concepts belong
// in this package either, since this package reads facts, not OGUC
// regulation. Nothing here decides what a "recinto habitable" is.

/** Pass-through of IfcAPI.GetModelSchema() - "IFC2X3" | "IFC4" | "IFC4X3" observed so far, but not restricted to those literals: an unrecognized schema string is still returned verbatim rather than coerced or rejected. */
export type IfcSchemaVersion = string;

/**
 * A unit exactly as declared in the file's IfcUnitAssignment (IfcSIUnit)
 * - never converted, never assumed. `prefix` is null for a bare SI unit
 * (e.g. METRE) and a value like "MILLI" when the file declares a prefixed
 * unit (e.g. MILLI + METRE = millimetre). `name` is null when the unit
 * could not be read from the file (e.g. no IfcProject, no
 * UnitsInContext, or a unit type this reader does not resolve, such as a
 * conversion-based unit) - callers must handle that case explicitly
 * rather than assume a default.
 */
export interface DeclaredUnit {
  name: string | null;
  prefix: string | null;
}

export interface FileUnits {
  length: DeclaredUnit | null;
  area: DeclaredUnit | null;
  volume: DeclaredUnit | null;
}

/** A single quantity from an IfcElementQuantity (Qto_*), with its raw value and the unit actually declared for its measure type in this file. */
export interface QuantityEntry {
  /** Raw value as a string, via ifc-core's readIfcPropertyValue. Null if no recognized *Value field was found on this quantity. */
  value: string | null;
  /** The IFC entity type name of this quantity (e.g. "IFCQUANTITYLENGTH"), read from the file, not guessed from the quantity's name. */
  ifcType: string;
  /** The declared unit for this quantity's measure category (length/area/volume), or null if this reader does not resolve that category (e.g. IfcQuantityCount, IfcQuantityWeight, IfcQuantityTime) or the file has no matching unit declared. */
  unit: DeclaredUnit | null;
}

/** How a bounding-element or adjacent-space relationship was determined. */
export type RelationMethod = "authoritative" | "inferred";

/** A building element (wall, window, door, ...) associated with a space. */
export interface BoundingElementRef {
  expressId: number;
  /** IFC entity type name, e.g. "IFCWALL". */
  ifcType: string;
  globalId: string | null;
  method: RelationMethod;
  /**
   * Only meaningful when method is "inferred" (geometric derivation has no
   * ground truth to be certain against, unlike an authoritative
   * IfcRelSpaceBoundary declared in the file). Undefined for
   * "authoritative" results - those are never less than fully confident,
   * because they are the file's own declared relationship, not this
   * package's guess.
   */
  confidence?: "high" | "low";
}

/** Another IfcSpace that shares a bounding element with this one. */
export interface AdjacentSpaceRef {
  expressId: number;
  globalId: string | null;
  method: RelationMethod;
  confidence?: "high" | "low";
  /** The bounding element (typically a wall) both spaces share, if one could be identified. */
  viaElementExpressId?: number;
}

export interface IfcSpaceRecord {
  expressId: number;
  globalId: string | null;
  /** Raw, byte-identical to the source file. Never trimmed, cased, or corrected. */
  name: string | null;
  /** Raw, byte-identical to the source file. */
  longName: string | null;
  /** Raw, byte-identical to the source file. */
  description: string | null;
  /** Raw, byte-identical to the source file. */
  objectType: string | null;
  /** The storey this space belongs to via IfcRelAggregates, or null if none was found. */
  storeyExpressId: number | null;
  /**
   * Property sets under their ACTUAL name in this file (e.g.
   * "Pset_SpaceCommon" in one file, "IFC_Pset_Caratteristiche" in
   * another) - never assumed. Values are flattened strings (see
   * ifc-core's extractPsetValues); this reader does not attach units to
   * plain properties, only to quantities (see quantitySets below), since
   * a property's measure type is not uniformly determinable the way a
   * quantity's is.
   */
  propertySets: Record<string, Record<string, string>>;
  /** Quantity sets under their actual name in this file (e.g. "Qto_SpaceBaseQuantities", or a bare "BaseQuantities" - CASA-ARQ uses the latter). Each quantity carries the unit actually declared in this file. */
  quantitySets: Record<string, Record<string, QuantityEntry>>;
  boundingElements: BoundingElementRef[];
  adjacentSpaces: AdjacentSpaceRef[];
}

export interface IfcHeadlessDocument {
  schema: IfcSchemaVersion;
  units: FileUnits;
  /** Whether this file declares any IfcRelSpaceBoundary at all. When false, every space's boundingElements/adjacentSpaces (if any) were geometrically inferred, not read from the file. */
  hasDeclaredSpaceBoundaries: boolean;
  spaces: IfcSpaceRecord[];
}
