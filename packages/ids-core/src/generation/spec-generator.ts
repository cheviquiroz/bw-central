// Genera especificaciones IDS 1.0 para proyectos estructurales chilenos, a
// partir de la Matriz PlanBIM V3.0 + reglas OGUC. Es la contraparte
// portable de ids_builder_mappings.ts + la parte de construcción de
// especificaciones de ids_builder_generator.ts en el proyecto ids-builder:
// misma lógica real, pero produciendo el modelo de objetos genérico
// (IdsDocument/Specification, ver src/types/ids.ts) en vez de ir directo a
// un string XML acoplado al cuestionario de esa app.
//
// DESVIACIÓN DELIBERADA de la firma pedida originalmente
// (`generateChileanSpec(mandante, phase, bimUses)`): la lógica real que
// decide QUÉ entidades y propiedades se generan depende del sistema
// estructural (hormigón/acero/mixto/madera) y del destino OGUC - ninguno de
// los dos está en esa firma de 3 argumentos. `bimUses` en ids-builder nunca
// filtra entidades/propiedades (solo se usa para el TDI derivado, texto
// descriptivo); `mandante` no tiene hoy ninguna fuente de datos real que
// varíe requisitos (ver metadata/mandantes.ts). Pretender que un objeto
// `ChileanSpecInput` de 3 campos alcanza para generar la especificación real
// habría significado inventar reglas sin fuente, en un dominio de
// cumplimiento normativo - se prefirió una firma honesta sobre la firma
// pedida literalmente.

import type { IdsDocument, Specification, Requirements, PropertyFacet, AttributeFacet } from "../types/ids";
import type { DestinationCategory, Phase, Mandante, BIMUseId } from "../types/chilean-context";
import { getPropertiesByEtapa, type MatrixProperty } from "../metadata/planbim-v3";
import { getDataTypeForProperty, getCardinalityForNDI } from "../metadata/datatype-mapper";
import { ALL_BIM_USES, TDI_DEFINITIONS } from "../metadata/bim-uses";
import { deriveFireRule, shouldIncludeCategory } from "./chilean-rules";

export type StructuralSystem = "hormigon" | "acero" | "mixto" | "madera";

/** Bridge entre el nombre de clase IFC en mayúsculas (para el XML) y la clave de la Matriz PlanBIM (camelCase, como viene del Excel). */
const MATRIX_IFC_KEY: Partial<Record<string, string>> = {
  IFCCOLUMN: "IfcColumn",
  IFCBEAM: "IfcBeam",
  IFCSLAB: "IfcSlab",
  IFCFOOTING: "IfcFooting",
  IFCWALL: "IfcWall",
};

const ENTITY_BASE: Record<string, { predefinedType?: string; label: string }> = {
  IFCCOLUMN_hormigon: { predefinedType: "COLUMN", label: "Columnas de hormigón armado" },
  IFCBEAM_hormigon: { predefinedType: "BEAM", label: "Vigas de hormigón armado" },
  IFCSLAB_hormigon: { predefinedType: "FLOOR", label: "Losas" },
  IFCFOOTING_hormigon: { predefinedType: "FOOTING_BEAM", label: "Fundaciones" },
  IFCCOLUMN_acero: { predefinedType: "COLUMN", label: "Columnas de acero" },
  IFCBEAM_acero: { predefinedType: "BEAM", label: "Vigas de acero" },
  IFCMEMBER_acero: { predefinedType: "BRACE", label: "Arriostramientos" },
  IFCPLATE_acero: { predefinedType: "GUSSET_PLATE", label: "Placas de conexión" },
  IFCCOLUMN_mixto: { predefinedType: "COLUMN", label: "Columnas (hormigón / acero)" },
  IFCBEAM_mixto: { predefinedType: "BEAM", label: "Vigas (hormigón / acero)" },
  IFCSLAB_mixto: { predefinedType: "COMPOSITE", label: "Losas colaborantes" },
  IFCMEMBER_mixto: { predefinedType: "BRACE", label: "Arriostramientos metálicos" },
  IFCCOLUMN_madera: { predefinedType: "COLUMN", label: "Pilares de madera" },
  IFCBEAM_madera: { predefinedType: "BEAM", label: "Vigas de madera" },
  IFCMEMBER_madera: { predefinedType: "BRACE", label: "Diagonales / arriostramientos" },
};

const ENTITIES_BY_SYSTEM: Record<StructuralSystem, string[]> = {
  hormigon: ["IFCCOLUMN", "IFCBEAM", "IFCSLAB", "IFCFOOTING"],
  acero: ["IFCCOLUMN", "IFCBEAM", "IFCMEMBER", "IFCPLATE"],
  mixto: ["IFCCOLUMN", "IFCBEAM", "IFCSLAB", "IFCMEMBER"],
  madera: ["IFCCOLUMN", "IFCBEAM", "IFCMEMBER"],
};

const MATERIAL_BY_SYSTEM: Record<StructuralSystem, string> = {
  hormigon: "Hormigón Armado",
  acero: "Acero Estructural",
  mixto: "Hormigón Armado o Acero Estructural",
  madera: "Madera Estructural",
};

/** Propiedades redundantes para ciertas entidades: una fundación es por definición portante, confirmar LoadBearing no aporta información real. */
const REDUNDANT_PROPERTY_BY_ENTITY: Partial<Record<string, string[]>> = {
  IFCFOOTING: ["LoadBearing"],
};

/** La Matriz extraída solo cubre DC/DB: DA hereda de DC (anteproyecto preliminar), DD hereda de DB. */
const MATRIX_PHASE_FALLBACK: Partial<Record<Phase, "DC" | "DB">> = { DA: "DC", DD: "DB" };

/** Propiedades mecánicas de detalle: fuera del recorte DC/DB de la Matriz, solo aplican en Diseño Ejecutivo (DD). */
function mechanicalPropertiesForDD(): PropertyFacet[] {
  return [
    {
      propertySet: "Pset_MaterialMechanical",
      baseName: "YieldStrength",
      dataType: getDataTypeForProperty("YieldStrength", "Pset_MaterialMechanical"),
      cardinality: "optional",
    },
    {
      propertySet: "Pset_MaterialMechanical",
      baseName: "ElasticModulus",
      dataType: getDataTypeForProperty("ElasticModulus", "Pset_MaterialMechanical"),
      cardinality: "optional",
    },
  ];
}

/**
 * Traduce una propiedad real de la Matriz PlanBIM a una faceta IDS
 * (property o attribute). Devuelve null para propiedades que no deben
 * exigirse como requisito individual:
 * - "Material" (HasAssociations): ya cubierto por el requisito de material
 *   a nivel de especificación.
 * - "PredefinedType": casi siempre presente en la práctica (BIMcollab),
 *   exigirlo no aporta información real.
 * - Filas sin ningún atributo o propiedad IFC real detrás (la Matriz no
 *   define ni Pset ni atributo IFC real): confirmado en la práctica
 *   (BIMcollab) que un <attribute> con un nombre inventado genera error de
 *   validación.
 */
function toRequirementFacet(
  prop: MatrixProperty
): { kind: "property"; facet: PropertyFacet } | { kind: "attribute"; facet: AttributeFacet } | null {
  if (prop.english === "HasAssociations") return null;
  if (prop.english === "PredefinedType") return null;
  if (!prop.pset && prop.english === prop.spanish) return null;

  const cardinality = getCardinalityForNDI(prop.ndi);

  if (prop.pset) {
    return {
      kind: "property",
      facet: {
        propertySet: prop.pset,
        baseName: prop.english,
        dataType: getDataTypeForProperty(prop.english, prop.pset),
        cardinality,
      },
    };
  }

  return { kind: "attribute", facet: { name: prop.english, cardinality } };
}

interface BuildEntityRequirementsOptions {
  ifcClass: string;
  phase: Phase;
  fireRatingRequired: boolean;
}

function buildEntityRequirements({ ifcClass, phase, fireRatingRequired }: BuildEntityRequirementsOptions): Requirements {
  const matrixKey = MATRIX_IFC_KEY[ifcClass];
  const matrixPhase = MATRIX_PHASE_FALLBACK[phase] ?? (phase as "DC" | "DB");
  const redundant = REDUNDANT_PROPERTY_BY_ENTITY[ifcClass] ?? [];

  const properties: PropertyFacet[] = [];
  const attributes: AttributeFacet[] = [];

  if (matrixKey) {
    for (const prop of getPropertiesByEtapa(matrixKey, matrixPhase)) {
      if (redundant.includes(prop.english)) continue;
      if (!shouldIncludeCategory(prop.category, fireRatingRequired)) continue;

      const facet = toRequirementFacet(prop);
      if (!facet) continue;
      if (facet.kind === "property") properties.push(facet.facet);
      else attributes.push(facet.facet);
    }
  }

  if (phase === "DD") {
    properties.push(...mechanicalPropertiesForDD());
  }

  const requirements: Requirements = {};
  if (attributes.length) requirements.attributes = attributes;
  if (properties.length) requirements.properties = properties;
  return requirements;
}

export interface ChileanSpecInput {
  /** Título del documento IDS. Por defecto: "IDS - Estructura (<sistema>)". */
  title?: string;
  /** Email del autor, exigido por el XSD oficial de IDS 1.0. */
  author: string;
  description?: string;
  ogucDestination: DestinationCategory;
  /** Condición asociada al destino (p.ej. cantidad de pisos), si aplica - ver metadata/oguc-fire-safety.ts. */
  destinationCondition?: string;
  structuralSystem: StructuralSystem;
  phase: Phase;
  /** Normativas aplicables, como requisitos <classification>. */
  regulations?: string[];
  /**
   * Usos BIM aplicables (Estándar BIM Tabla 06). Trazabilidad únicamente
   * (queda reflejado en info.description vía el TDI derivado) - no filtra
   * qué entidades/propiedades se generan, igual que en ids-builder.
   */
  bimUses?: BIMUseId[];
  /** Ver metadata/mandantes.ts: catálogo únicamente, no afecta la generación todavía. */
  mandante?: Mandante;
}

const STRUCTURAL_SYSTEM_LABELS: Record<StructuralSystem, string> = {
  hormigon: "Hormigón Armado",
  acero: "Acero",
  mixto: "Mixto (Hormigón + Acero)",
  madera: "Madera",
};

function deriveTDI(bimUseIds: BIMUseId[]): string[] {
  const selected = ALL_BIM_USES.filter((use) => bimUseIds.includes(use.id));
  const tdi = new Set<string>();
  selected.forEach((use) => use.tdiRequired.forEach((t) => tdi.add(t)));
  return Array.from(tdi).sort();
}

/** Genera un documento IDS 1.0 completo para un proyecto estructural chileno, según Matriz PlanBIM V3.0 + reglas OGUC. */
export function generateChileanSpec(input: ChileanSpecInput): IdsDocument {
  const fireRule = deriveFireRule(input.ogucDestination, input.destinationCondition);
  const systemLabel = STRUCTURAL_SYSTEM_LABELS[input.structuralSystem];

  const specifications: Specification[] = ENTITIES_BY_SYSTEM[input.structuralSystem].map((ifcClass) => {
    const base = ENTITY_BASE[`${ifcClass}_${input.structuralSystem}`];
    const requirements = buildEntityRequirements({
      ifcClass,
      phase: input.phase,
      fireRatingRequired: fireRule.fireRatingRequired,
    });

    requirements.materials = [{ value: MATERIAL_BY_SYSTEM[input.structuralSystem], cardinality: "required" }];

    if (input.regulations?.length) {
      requirements.classifications = input.regulations.map((regulation) => ({
        system: "Normativa Aplicable",
        value: regulation,
        cardinality: "required",
      }));
    }

    return {
      name: base?.label ?? ifcClass,
      ifcVersion: "IFC4",
      applicability: { entity: { name: ifcClass, predefinedType: base?.predefinedType } },
      requirements,
    };
  });

  const bimUses = input.bimUses ?? [];
  const derivedTDI = deriveTDI(bimUses);

  const description =
    input.description?.trim() ||
    [
      `Sistema estructural: ${systemLabel}.`,
      `Destino OGUC: ${input.ogucDestination}.`,
      `Fase: ${input.phase}.`,
      fireRule.fireRatingRequired ? `Resistencia al fuego exigida: ${fireRule.fireSafetyType}.` : null,
      fireRule.verticalSafetyRequired ? "Requiere zona vertical de seguridad (OGUC)." : null,
      derivedTDI.length
        ? `TDI requeridos: ${derivedTDI.map((id) => TDI_DEFINITIONS[id as keyof typeof TDI_DEFINITIONS]?.label ?? id).join(", ")}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

  return {
    info: {
      title: input.title?.trim() || `IDS - Estructura (${systemLabel})`,
      version: "1.0",
      description,
      author: input.author,
    },
    specifications,
  };
}
