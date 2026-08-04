// Modelo de objetos genérico para IDS (Information Delivery Specification) 1.0
// de buildingSMART (https://standards.buildingsmart.org/IDS).
//
// Cubre el subconjunto del esquema verificado en la práctica (IDS-Audit-Tool
// oficial, BIMcollab, y los ejemplos oficiales IDS_StructuralSafety.ids /
// IDS_oma_input.ids de buildingSMART/IDS):
// - <specification> NO lleva minOccurs/maxOccurs (esos atributos van en
//   <applicability>).
// - <property> usa <propertySet>/<baseName> como elementos hijos con
//   <simpleValue>, no como atributos; dataType SÍ es un atributo, y debe ser
//   un IFC Defined Type real en mayúsculas (patrón `[A-Z]+`, p.ej. IFCLABEL).
// - Los atributos nativos de IFC (Name, PredefinedType, sin PropertySet real)
//   van como <attribute>, que no admite dataType.
// - Dentro de <requirements>, el orden declarado es: entity, classification,
//   attribute, property, material.
//
// GAP CONOCIDO (fuera de alcance deliberado): este modelo no cubre
// restricciones xs:restriction (pattern/enumeration/bounds) para valores de
// Value, ni la faceta <partOf>. Todo valor es un <simpleValue> fijo, que es
// lo único que la generación real (ids-builder) necesitó hasta ahora.

export type Cardinality = "required" | "optional" | "prohibited";

export type IfcVersion = "IFC2X3" | "IFC4" | "IFC4X3_ADD2";

/** Faceta <entity>: nombre de clase IFC (p.ej. IFCCOLUMN) y predefinedType opcional. */
export interface EntityFacet {
  name: string;
  predefinedType?: string;
}

/** Faceta <attribute>: atributo nativo IFC (Name, PredefinedType, etc.) - sin dataType. */
export interface AttributeFacet {
  name: string;
  cardinality?: Cardinality;
}

/** Faceta <property>: propiedad de un PropertySet/QuantitySet real. */
export interface PropertyFacet {
  propertySet: string;
  baseName: string;
  /** IFC Defined Type en mayúsculas, p.ej. IFCLABEL, IFCLENGTHMEASURE. */
  dataType: string;
  cardinality?: Cardinality;
}

/** Faceta <classification>: norma o sistema de clasificación aplicable. */
export interface ClassificationFacet {
  system: string;
  value: string;
  cardinality?: Cardinality;
}

/** Faceta <material>: material exigido, con valor esperado opcional. */
export interface MaterialFacet {
  value?: string;
  cardinality?: Cardinality;
}

/**
 * Ámbito de aplicación de una especificación: a qué elementos del modelo
 * aplica. minOccurs/maxOccurs por defecto son 1/unbounded (cualquier
 * cantidad de elementos que matcheen).
 */
export interface Applicability {
  minOccurs?: number;
  maxOccurs?: number | "unbounded";
  entity: EntityFacet;
}

export interface Requirements {
  classifications?: ClassificationFacet[];
  attributes?: AttributeFacet[];
  properties?: PropertyFacet[];
  materials?: MaterialFacet[];
}

export interface Specification {
  name: string;
  ifcVersion: IfcVersion;
  applicability: Applicability;
  requirements: Requirements;
}

/**
 * Metadata de <info>. `author` debe cumplir el patrón de email exigido por
 * el XSD oficial de IDS 1.0 (`[^@]+@[^\.]+\..+`).
 */
export interface IdsInfo {
  title: string;
  version?: string;
  description?: string;
  author: string;
  /** Fecha ISO (yyyy-mm-dd). Si se omite, generateIDS usa la fecha actual. */
  date?: string;
}

/** Documento IDS completo: <info> + una o más <specification>. */
export interface IdsDocument {
  info: IdsInfo;
  specifications: Specification[];
}
