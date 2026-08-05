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

/** World-space axis-aligned bounding box from real geometry (vertex data), never declared/estimated dimensions. Null when no real geometry could be found for this element (see IfcStair.boundingBox for the one case where that's resolved by unioning real children geometry instead of giving up immediately). */
export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * A single continuous run of steps between landings. Reused ifc-core's
 * unit-attachment convention (DeclaredUnit, not a synthesized string like
 * "MILLIMETRE") rather than the ad-hoc unitsContext shape sketched for
 * this task - IFC itself has no such unit name; MILLI+METRE is how a
 * file actually declares a millimetre. NumberOfRiser/TreadLength/
 * RiserHeight are direct IfcStairFlight attributes (confirmed against
 * real fixtures, not IfcPropertySet values) - riserCount, treadDepth,
 * and riserHeight are all null when a file simply does not declare them
 * (common - see the commit that adds this: CASA-ARQ's 19 real
 * IfcStairFlight entities all leave these attributes null). Never
 * defaulted to 0 or otherwise guessed to fill the gap.
 */
export interface IfcStairFlight {
  globalId: string | null;
  name: string | null;
  riserCount: number | null;
  /** Horizontal projection of one step, in `lengthUnit`. */
  treadDepth: number | null;
  /** Vertical rise of one step, in `lengthUnit`. */
  riserHeight: number | null;
  /**
   * Always "unknown" in this version: IFC2X3/IFC4 do not carry a
   * direction attribute on IfcStairFlight, and deriving it from geometry
   * (e.g. walking-line ordering) has no fixture in this reader's test
   * set with a verifiable ground truth to validate a derivation against -
   * exactly the "confident wrong answer" this package's whole design
   * discipline exists to avoid. Flagged, not guessed.
   */
  direction: "ascending" | "descending" | "unknown";
  /** Real geometry of this flight's own representation, or null if it has none (e.g. this file models geometry only on the parent IfcStair or on unrelated decomposition children - see IfcStair.boundingBox). */
  boundingBox: BoundingBox | null;
  /** The length unit treadDepth/riserHeight are expressed in - the file's own declared LENGTHUNIT (see FileUnits.length), repeated here so a stair record is self-contained without needing the document's top-level units. Null under the same conditions FileUnits.length is null. */
  lengthUnit: DeclaredUnit | null;
}

/**
 * A vertical circulation element - first-class output, parallel to
 * spaces, never folded into a space's boundingElements (stairs are
 * structural, not a space's surface boundary).
 */
export interface IfcStair {
  expressId: number;
  globalId: string | null;
  /** Raw, byte-identical to the source file. */
  name: string | null;
  /** Raw, byte-identical to the source file. */
  objectType: string | null;
  /**
   * Only ever populated from real IfcStairFlight entities decomposing
   * this stair via IfcRelAggregates. A real fixture (OLAS-ARQ-05.ifc, an
   * ArchiCAD export) has 24 real IfcStair entities and ZERO
   * IfcStairFlight anywhere in the file - each stair decomposes into
   * generic IfcBuildingElementProxy children instead. This reader does
   * NOT reinterpret those proxies as flights; such stairs correctly
   * return an empty array here, not a guess.
   */
  flights: IfcStairFlight[];
  /**
   * The IfcBuildingStorey containing this stair via
   * IfcRelContainedInSpatialStructure, or null if unresolvable. Matches
   * IfcSpaceRecord's storeyExpressId convention (an express-ID, not a
   * GlobalId) for consistency within this package. Deliberately only
   * resolves an actual IfcBuildingStorey - a stair contained directly at
   * IfcSite level (observed in a real fixture) has no storey to report
   * and correctly comes back null here, not the site's ID.
   */
  storeyExpressId: number | null;
  /**
   * "Zona vertical de seguridad" is an OGUC concept (Art. 4.2.10/4.2.11),
   * not a standard IFC one - no IFC schema attribute carries it. Read
   * only from an explicitly-named property (IsSecurityZone /
   * ZonaVerticalSeguridad, case-insensitive) in this stair's own property
   * sets. Absence of such a property means "unknown", never "false" -
   * there is no way to distinguish "not a safety stair" from "not marked
   * either way" from data alone.
   */
  isSecurityZone: boolean | "unknown";
  /**
   * Real geometry: the stair's own Representation if it has one,
   * otherwise the union of its real decomposed children's geometry (via
   * IfcRelAggregates - see internal/geometry.ts's unionAabb). Null only
   * if neither the stair nor any of its children have real geometry.
   * Never estimated from declared dimensions.
   */
  boundingBox: BoundingBox | null;
}

/**
 * A ramp's declared slope, kept together with the IFC measure type it
 * was wrapped in. Neither IfcRamp nor IfcRampFlight has a Slope
 * ATTRIBUTE in any IFC schema version (confirmed against web-ifc's own
 * generated schema, not assumed) - a declared slope, if present at all,
 * only ever comes from a property (typically named "Slope" in a project
 * or Pset_RampFlightCommon-style property set). Real-world exports are
 * not consistent about whether that property is a ratio (e.g. 0.0833 for
 * "1:12") or a plane angle in degrees - this reader does not guess which
 * one a given file means. `measureType` is the IFC measure type name the
 * property's value was actually wrapped in (e.g.
 * "IFCPOSITIVERATIOMEASURE", "IFCPLANEANGLEMEASURE"), read from the
 * file, not inferred from the number's magnitude.
 */
export interface DeclaredSlope {
  value: number;
  measureType: string;
}

/**
 * A vertical circulation element - first-class output, parallel to
 * stairs. UNTESTED AGAINST REAL DATA: none of this reader's five real
 * fixtures (CASA-ARQ, CASA-MEP, EOFF-ARQ, EOFF-SPC, OLAS-ARQ-05) contain
 * a single IfcRamp - every field below is implemented per the IFC schema
 * and this package's usual "never fabricate" discipline, but none of its
 * behavior on a real declared slope/accessibility marker has been
 * exercised against a real file. Flagged, not hidden.
 */
export interface IfcRamp {
  expressId: number;
  globalId: string | null;
  /** Raw, byte-identical to the source file. */
  name: string | null;
  /** Raw, byte-identical to the source file. */
  objectType: string | null;
  /** Raw declared slope + the measure type it came wrapped in, or null if no property named "Slope"/"Pendiente" was found on this ramp or its flights. */
  slope: DeclaredSlope | null;
  /**
   * Only ever computed when `slope.measureType` is a ratio measure
   * (IFCPOSITIVERATIOMEASURE/IFCRATIOMEASURE, i.e. rise/run - the
   * percentage is that ratio x 100). Null when slope is null OR when
   * slope was declared as a different kind of measure (e.g. a plane
   * angle) this reader does not convert, since angle-to-percentage would
   * require trigonometry this reader has no real declared-angle fixture
   * to validate against.
   */
  slopePercentage: number | null;
  /**
   * NOTE: this reader does NOT compute an "exceeds OGUC maximum slope"
   * flag. The 8.33% (1:12) accessibility threshold is an OGUC number
   * (Art. 4.1.7) - embedding it here would put a regulation constant
   * inside the facts-only reader, the exact boundary this whole package
   * exists to keep (see packages/oguc-core, which is the only place OGUC
   * numbers are allowed to live). A compliance check comparing
   * slopePercentage against that threshold belongs in oguc-core, the
   * same way Art. 4.2.10's stair count/width check does, not here.
   */
  storeyExpressId: number | null;
  /**
   * Explicit keyword search only (ObjectType/Name for "accesible" /
   * "accessible" / "sin barrera", or a property set marker with the same
   * names) - never inferred from slope or geometry. "unknown" when no
   * such marking exists, never coerced to false.
   */
  isAccessible: boolean | "unknown";
  /** Real geometry: the ramp's own Representation if it has one, otherwise the union of its real decomposed children's geometry (see IfcStair.boundingBox for the same pattern). Null only if neither has real geometry. */
  boundingBox: BoundingBox | null;
}

/**
 * IFC2X3/IFC4/IFC4X3 have no dedicated "IfcElevator" entity - a fact
 * confirmed against web-ifc's own type registry (WebIFC.IFCELEVATOR is
 * undefined in all three schemas this reader targets; IfcElevator only
 * exists starting IFC4.3, which none of this reader's fixtures use).
 * Elevators are modeled as IfcTransportElement with a discriminator set
 * to ELEVATOR - OperationType in IFC2X3, PredefinedType in IFC4/IFC4X3
 * (also confirmed against web-ifc's generated schema, not assumed - see
 * internal/elevators.ts). UNTESTED AGAINST REAL DATA for the same reason
 * as IfcRamp: none of the five real fixtures contain an elevator-typed
 * IfcTransportElement.
 */
export interface IfcElevator {
  expressId: number;
  globalId: string | null;
  /** Raw, byte-identical to the source file. */
  name: string | null;
  /** Raw, byte-identical to the source file. */
  objectType: string | null;
  /** Same keyword-search discipline as IfcRamp.isAccessible - never inferred, "unknown" when unmarked. */
  isAccessible: boolean | "unknown";
  /** Real geometry, same pattern as IfcStair/IfcRamp. */
  boundingBox: BoundingBox | null;
  /**
   * Only the single storey this element is directly contained in via
   * IfcRelContainedInSpatialStructure (an elevator car's "home"
   * position), wrapped in a one-element array for forward-compatibility
   * with a real multi-storey range - NOT the full set of storeys the
   * elevator shaft actually serves. Determining that would need either a
   * declared property this reader has never seen in a real file, or
   * geometric reasoning (matching the shaft's vertical extent against
   * every storey's elevation) this reader does not attempt without a
   * real fixture to validate the result against. Null if even the home
   * storey is unresolvable.
   */
  servedStoreyExpressIds: number[] | null;
  /**
   * From IfcTransportElement's own CapacityByNumber attribute (persons) -
   * IFC2X3 only. IFC4/IFC4X3 dropped this as a direct attribute
   * entirely; a capacity for those schemas, if declared, would live in a
   * property set this reader does not currently search (no real fixture
   * to confirm a property name convention against). Null under both
   * "not declared" and "this schema version doesn't carry it as an
   * attribute" - this reader does not distinguish the two.
   */
  carryingCapacity: number | null;
}

export interface IfcHeadlessDocument {
  schema: IfcSchemaVersion;
  units: FileUnits;
  /** Whether this file declares any IfcRelSpaceBoundary at all. When false, every space's boundingElements/adjacentSpaces (if any) were geometrically inferred, not read from the file. */
  hasDeclaredSpaceBoundaries: boolean;
  spaces: IfcSpaceRecord[];
  /** Every IfcStair in the model, first-class output parallel to spaces. Empty array (never undefined, never an error) for files with no stairs. */
  stairs: IfcStair[];
  /** Every IfcRamp in the model. Empty array (never undefined, never an error) for files with none. */
  ramps: IfcRamp[];
  /** Every elevator-typed IfcTransportElement in the model (see IfcElevator's own doc comment for why it isn't a literal "IfcElevator" entity). Empty array for files with none. */
  elevators: IfcElevator[];
}
