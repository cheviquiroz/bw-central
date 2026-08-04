// Genera XML IDS 1.0 válido según el esquema de buildingSMART
// (https://standards.buildingsmart.org/IDS) a partir del modelo de objetos
// genérico (ver src/types/ids.ts).
//
// El formato de salida (indentación, orden de elementos, uso de
// <simpleValue>) está construido a mano en vez de con una librería XML
// genérica: reproduce exactamente lo verificado en la práctica contra el
// IDS-Audit-Tool oficial de buildingSMART y los ejemplos oficiales
// IDS_StructuralSafety.ids / IDS_oma_input.ids (ver comentarios en
// src/types/ids.ts). Una librería genérica de serialización XML no conoce
// estas reglas específicas del esquema IDS (qué va como atributo vs.
// elemento simpleValue, el orden real de las facetas dentro de
// <requirements>), así que construir el string directamente es más
// confiable que post-configurar una librería para replicarlas.

import type {
  IdsDocument,
  Specification,
  Applicability,
  Requirements,
  ClassificationFacet,
  AttributeFacet,
  PropertyFacet,
  MaterialFacet,
} from "../types/ids";

const IDS_XMLNS = "http://standards.buildingsmart.org/IDS";
const IDS_XSD_LOCATION = "http://standards.buildingsmart.org/IDS/1.0/ids.xsd";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function simpleValueTag(tag: string, value: string, level: number): string {
  return `${indent(level)}<${tag}><simpleValue>${escapeXml(value)}</simpleValue></${tag}>`;
}

function buildApplicabilityXml(applicability: Applicability): string[] {
  const minOccurs = applicability.minOccurs ?? 1;
  const maxOccurs = applicability.maxOccurs ?? "unbounded";
  const lines: string[] = [];

  lines.push(`${indent(3)}<applicability minOccurs="${minOccurs}" maxOccurs="${maxOccurs}">`);
  lines.push(`${indent(4)}<entity>`);
  lines.push(simpleValueTag("name", applicability.entity.name, 5));
  if (applicability.entity.predefinedType) {
    lines.push(simpleValueTag("predefinedType", applicability.entity.predefinedType, 5));
  }
  lines.push(`${indent(4)}</entity>`);
  lines.push(`${indent(3)}</applicability>`);
  return lines;
}

function buildClassificationXml(facet: ClassificationFacet): string[] {
  const lines: string[] = [];
  lines.push(`${indent(4)}<classification cardinality="${facet.cardinality ?? "required"}">`);
  lines.push(simpleValueTag("value", facet.value, 5));
  lines.push(simpleValueTag("system", facet.system, 5));
  lines.push(`${indent(4)}</classification>`);
  return lines;
}

function buildAttributeXml(facet: AttributeFacet): string[] {
  const lines: string[] = [];
  lines.push(`${indent(4)}<attribute cardinality="${facet.cardinality ?? "required"}">`);
  lines.push(simpleValueTag("name", facet.name, 5));
  lines.push(`${indent(4)}</attribute>`);
  return lines;
}

function buildPropertyXml(facet: PropertyFacet): string[] {
  const lines: string[] = [];
  lines.push(
    `${indent(4)}<property dataType="${escapeXml(facet.dataType)}" cardinality="${facet.cardinality ?? "required"}">`
  );
  lines.push(simpleValueTag("propertySet", facet.propertySet, 5));
  lines.push(simpleValueTag("baseName", facet.baseName, 5));
  lines.push(`${indent(4)}</property>`);
  return lines;
}

function buildMaterialXml(facet: MaterialFacet): string[] {
  const lines: string[] = [];
  lines.push(`${indent(4)}<material cardinality="${facet.cardinality ?? "required"}">`);
  if (facet.value) {
    lines.push(simpleValueTag("value", facet.value, 5));
  }
  lines.push(`${indent(4)}</material>`);
  return lines;
}

// Orden real dentro de <requirements>, verificado contra Schema/ids.xsd y el
// ejemplo oficial: entity (va en applicability, no acá), classification,
// attribute, property, material.
function buildRequirementsXml(requirements: Requirements): string[] {
  const lines: string[] = [];
  lines.push(`${indent(3)}<requirements>`);
  (requirements.classifications ?? []).forEach((f) => lines.push(...buildClassificationXml(f)));
  (requirements.attributes ?? []).forEach((f) => lines.push(...buildAttributeXml(f)));
  (requirements.properties ?? []).forEach((f) => lines.push(...buildPropertyXml(f)));
  (requirements.materials ?? []).forEach((f) => lines.push(...buildMaterialXml(f)));
  lines.push(`${indent(3)}</requirements>`);
  return lines;
}

// <specification> NO lleva minOccurs/maxOccurs (esos van en <applicability>).
function buildSpecificationXml(spec: Specification): string {
  const lines: string[] = [];
  lines.push(`${indent(2)}<specification name="${escapeXml(spec.name)}" ifcVersion="${spec.ifcVersion}">`);
  lines.push(...buildApplicabilityXml(spec.applicability));
  lines.push(...buildRequirementsXml(spec.requirements));
  lines.push(`${indent(2)}</specification>`);
  return lines.join("\n");
}

/** Genera el documento IDS 1.0 XML completo a partir del modelo de objetos. */
export function generateIDS(doc: IdsDocument): string {
  const { info } = doc;
  const date = info.date ?? new Date().toISOString().slice(0, 10);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<ids xmlns="${IDS_XMLNS}" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${IDS_XMLNS} ${IDS_XSD_LOCATION}">`,
    `${indent(1)}<info>`,
    `${indent(2)}<title>${escapeXml(info.title)}</title>`,
    `${indent(2)}<version>${escapeXml(info.version ?? "1.0")}</version>`,
  ];

  if (info.description) {
    lines.push(`${indent(2)}<description>${escapeXml(info.description)}</description>`);
  }

  lines.push(
    `${indent(2)}<author>${escapeXml(info.author)}</author>`,
    `${indent(2)}<date>${date}</date>`,
    `${indent(1)}</info>`,
    `${indent(1)}<specifications>`,
    ...doc.specifications.map(buildSpecificationXml),
    `${indent(1)}</specifications>`,
    "</ids>"
  );

  return lines.join("\n");
}
