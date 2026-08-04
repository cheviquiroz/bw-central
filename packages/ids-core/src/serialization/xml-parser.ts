// Parsea XML IDS 1.0 (buildingSMART) hacia el modelo de objetos genérico
// (ver src/types/ids.ts). No existía un parser previo en ids-builder (esa
// app solo generaba IDS, nunca los leía de vuelta) - esta es la contraparte
// inversa de xml-generator.ts, construida para reconstruir exactamente la
// misma forma que este paquete genera.
//
// Usa fast-xml-parser (isomorfo: funciona igual en Node y en el browser, sin
// depender de document.DOMParser) en vez de un parser XML escrito a mano -
// a diferencia de la generación (donde el formato de salida es una decisión
// de este paquete y por eso construirlo a mano es más confiable), leer XML
// arbitrario bien formado es un problema genérico que una librería madura
// resuelve mejor que una reimplementación propia.

import { XMLParser } from "fast-xml-parser";
import type {
  IdsDocument,
  Specification,
  Applicability,
  Requirements,
  ClassificationFacet,
  AttributeFacet,
  PropertyFacet,
  MaterialFacet,
  Cardinality,
  IfcVersion,
} from "../types/ids";

const FORCED_ARRAY_TAGS = new Set(["specification", "classification", "attribute", "property", "material"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (tagName) => FORCED_ARRAY_TAGS.has(tagName),
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Lee el texto de un elemento envuelto en <simpleValue> (p.ej. <name><simpleValue>X</simpleValue></name>). */
function simpleValueOf(node: unknown): string {
  const value = (node as { simpleValue?: unknown } | undefined)?.simpleValue;
  return typeof value === "string" ? value : "";
}

function parseCardinality(node: Record<string, unknown>): Cardinality | undefined {
  const raw = node["@_cardinality"];
  return raw === "required" || raw === "optional" || raw === "prohibited" ? raw : undefined;
}

function parseApplicability(node: Record<string, unknown> | undefined): Applicability {
  const applicabilityNode = node ?? {};
  const minOccursRaw = applicabilityNode["@_minOccurs"];
  const maxOccursRaw = applicabilityNode["@_maxOccurs"];
  const entityNode = (applicabilityNode.entity as Record<string, unknown>) ?? {};

  return {
    minOccurs: minOccursRaw !== undefined ? Number(minOccursRaw) : undefined,
    maxOccurs: maxOccursRaw === "unbounded" ? "unbounded" : maxOccursRaw !== undefined ? Number(maxOccursRaw) : undefined,
    entity: {
      name: simpleValueOf(entityNode.name),
      predefinedType: entityNode.predefinedType ? simpleValueOf(entityNode.predefinedType) : undefined,
    },
  };
}

function parseClassification(node: Record<string, unknown>): ClassificationFacet {
  return {
    system: simpleValueOf(node.system),
    value: simpleValueOf(node.value),
    cardinality: parseCardinality(node),
  };
}

function parseAttribute(node: Record<string, unknown>): AttributeFacet {
  return {
    name: simpleValueOf(node.name),
    cardinality: parseCardinality(node),
  };
}

function parseProperty(node: Record<string, unknown>): PropertyFacet {
  return {
    propertySet: simpleValueOf(node.propertySet),
    baseName: simpleValueOf(node.baseName),
    dataType: String(node["@_dataType"] ?? ""),
    cardinality: parseCardinality(node),
  };
}

function parseMaterial(node: Record<string, unknown>): MaterialFacet {
  return {
    value: node.value !== undefined ? simpleValueOf(node.value) : undefined,
    cardinality: parseCardinality(node),
  };
}

function parseRequirements(node: Record<string, unknown> | undefined): Requirements {
  const requirementsNode = node ?? {};
  const classifications = toArray(requirementsNode.classification as Record<string, unknown>[]).map(parseClassification);
  const attributes = toArray(requirementsNode.attribute as Record<string, unknown>[]).map(parseAttribute);
  const properties = toArray(requirementsNode.property as Record<string, unknown>[]).map(parseProperty);
  const materials = toArray(requirementsNode.material as Record<string, unknown>[]).map(parseMaterial);

  const requirements: Requirements = {};
  if (classifications.length) requirements.classifications = classifications;
  if (attributes.length) requirements.attributes = attributes;
  if (properties.length) requirements.properties = properties;
  if (materials.length) requirements.materials = materials;
  return requirements;
}

function parseSpecification(node: Record<string, unknown>): Specification {
  return {
    name: String(node["@_name"] ?? ""),
    ifcVersion: (String(node["@_ifcVersion"] ?? "IFC4") as IfcVersion),
    applicability: parseApplicability(node.applicability as Record<string, unknown>),
    requirements: parseRequirements(node.requirements as Record<string, unknown>),
  };
}

/**
 * Parsea un XML IDS 1.0 hacia el modelo de objetos genérico. Lanza un Error
 * con un mensaje claro si falta el elemento raíz <ids> (XML malformado o de
 * otro esquema) - no intenta adivinar ni recuperar una estructura parcial.
 */
export function parseIDS(xmlString: string): IdsDocument {
  const parsed = parser.parse(xmlString) as { ids?: Record<string, unknown> };
  const idsNode = parsed.ids;
  if (!idsNode) {
    throw new Error("XML inválido: no se encontró el elemento raíz <ids>.");
  }

  const infoNode = (idsNode.info as Record<string, unknown>) ?? {};
  const specificationsNode = (idsNode.specifications as Record<string, unknown>) ?? {};
  const specNodes = toArray(specificationsNode.specification as Record<string, unknown>[]);

  return {
    info: {
      title: String(infoNode.title ?? ""),
      version: infoNode.version !== undefined ? String(infoNode.version) : undefined,
      description: infoNode.description !== undefined ? String(infoNode.description) : undefined,
      author: String(infoNode.author ?? ""),
      date: infoNode.date !== undefined ? String(infoNode.date) : undefined,
    },
    specifications: specNodes.map(parseSpecification),
  };
}
