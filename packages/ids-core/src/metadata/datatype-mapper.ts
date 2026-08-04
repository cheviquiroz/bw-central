// Determina el `dataType` real que debe llevar cada parámetro en el IDS
// según el esquema oficial IDS 1.0 de buildingSMART (Schema/ids.xsd): el
// atributo `dataType` de <property> debe ser "the name of an IFC Defined
// Type, all uppercase" (patrón `[A-Z]+`), por ejemplo IFCLABEL, IFCBOOLEAN,
// IFCLENGTHMEASURE — NO un vocabulario genérico inventado como
// "STRING"/"REAL"/"BOOLEAN". Verificado contra el ejemplo oficial
// IDS_StructuralSafety.ids (buildingSMART/IDS), que usa dataType="IFCLABEL".

export type IFCDataType = string;

const LENGTH_PROPERTIES = ["Height", "Length", "Width", "Depth", "Radius", "Diameter", "Perimeter", "NominalThickness", "Thickness"];
const AREA_PROPERTIES = [
  "CrossSectionArea",
  "OuterSurfaceArea",
  "GrossSurfaceArea",
  "GrossFootprintArea",
  "GrossSideArea",
  "NetSurfaceArea",
  "GrossArea",
];
const VOLUME_PROPERTIES = ["GrossVolume", "NetVolume"];
const BOOLEAN_PROPERTIES = ["IsExternal", "LoadBearing", "IsStructural", "Combustible", "FireRated"];
const IDENTIFIER_PROPERTIES = ["Tag", "Reference"];

/**
 * Clasifica un parámetro (por su nombre técnico real, p.ej. "Height",
 * "LoadBearing") en un IFC Defined Type real, en mayúsculas. Solo debe
 * llamarse para propiedades que SÍ pertenecen a un PropertySet real —
 * los atributos nativos de IFC (Name, PredefinedType, etc.) no tienen
 * `dataType` en el esquema IDS, van como <attribute> en vez de <property>.
 *
 * IMPORTANTE sobre Height/Length/Width en cantidades (Qto_*BaseQuantities):
 * el ejemplo oficial de buildingSMART (IDS_oma_input.ids) usa literalmente
 * dataType="IFCLENGTHMEASURE" para Qto_SignBaseQuantities.Height/Width — NO
 * "IFCPOSITIVELENGTHMEASURE". Ese tipo sí es correcto, pero solo para
 * propiedades reales que la documentación de IFC4 declara así (p.ej. "Span"
 * en Pset_BeamCommon, o dimensiones de escalera en Pset_StairCommon), nunca
 * para cantidades de un Qto_*.
 */
export function getDataTypeForProperty(propertyName: string, propertySet: string): IFCDataType {
  // Verificado con el IDS-Audit-Tool real (oficial de buildingSMART) contra
  // el esquema IFC4 exacto: para Pset_PrecastSlab.NominalThickness el único
  // valor aceptado en contexto Ifc4 es IFCPOSITIVELENGTHMEASURE (la doc web
  // de IFC4X3 que se había consultado antes describe una versión distinta
  // del schema y no aplica aquí).
  if (propertySet === "Pset_PrecastSlab" && propertyName === "NominalThickness") {
    return "IFCPOSITIVELENGTHMEASURE";
  }

  if (propertyName.includes("MassDensity")) return "IFCMASSDENSITYMEASURE";
  if (propertyName.includes("ThermalTransmittance")) return "IFCTHERMALTRANSMITTANCEMEASURE";
  if (propertyName === "Slope" || propertyName === "PitchAngle") return "IFCPLANEANGLEMEASURE";
  if (propertyName.includes("YieldStrength")) return "IFCPRESSUREMEASURE";
  if (propertyName.includes("ElasticModulus")) return "IFCMODULUSOFELASTICITYMEASURE";
  if (VOLUME_PROPERTIES.some((p) => propertyName.includes(p))) return "IFCVOLUMEMEASURE";
  if (AREA_PROPERTIES.some((p) => propertyName.includes(p))) return "IFCAREAMEASURE";
  if (LENGTH_PROPERTIES.some((p) => propertyName.includes(p))) return "IFCLENGTHMEASURE";
  if (BOOLEAN_PROPERTIES.some((p) => propertyName.includes(p))) return "IFCBOOLEAN";
  if (IDENTIFIER_PROPERTIES.some((p) => propertyName.includes(p))) return "IFCIDENTIFIER";
  // Todo lo demás (FireRating, Status, y texto libre en general) es IfcLabel
  // en el esquema IFC4 real, aunque conceptualmente parezcan "cerrados".
  return "IFCLABEL";
}

/**
 * Cardinalidad IDS real (atributo `cardinality` de <property>/<attribute>:
 * "required" | "prohibited" | "optional") según el NDI de la Matriz PlanBIM:
 * NDI-1 es información mínima obligatoria; NDI-2 en adelante es detalle
 * adicional/opcional.
 */
export function getCardinalityForNDI(ndi: string): "required" | "optional" {
  return ndi === "NDI-1" ? "required" : "optional";
}
