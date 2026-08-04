import { describe, test, expect } from "vitest";
import { generateIDS } from "../serialization/xml-generator";
import { parseIDS } from "../serialization/xml-parser";
import type { IdsDocument } from "../types/ids";

function sampleDoc(): IdsDocument {
  return {
    info: {
      title: "IDS - Estructura (Hormigón Armado)",
      version: "1.0",
      description: "Especificación de prueba con acentos: información, año.",
      author: "chevi@bwisebim.com",
      date: "2026-03-14",
    },
    specifications: [
      {
        name: "Columnas de hormigón armado",
        ifcVersion: "IFC4",
        applicability: { minOccurs: 1, maxOccurs: "unbounded", entity: { name: "IFCCOLUMN", predefinedType: "COLUMN" } },
        requirements: {
          classifications: [{ system: "Normativa Aplicable", value: "OGUC", cardinality: "required" }],
          attributes: [{ name: "Name", cardinality: "required" }],
          properties: [
            { propertySet: "Qto_ColumnBaseQuantities", baseName: "Length", dataType: "IFCLENGTHMEASURE", cardinality: "required" },
            { propertySet: "Pset_ColumnCommon", baseName: "LoadBearing", dataType: "IFCBOOLEAN", cardinality: "optional" },
          ],
          materials: [{ value: "Hormigón Armado", cardinality: "required" }],
        },
      },
      {
        name: "Vigas de hormigón armado",
        ifcVersion: "IFC4",
        applicability: { entity: { name: "IFCBEAM" } },
        requirements: {
          properties: [{ propertySet: "Qto_BeamBaseQuantities", baseName: "Length", dataType: "IFCLENGTHMEASURE" }],
        },
      },
    ],
  };
}

describe("parseIDS", () => {
  test("hace round-trip completo: generateIDS -> parseIDS reconstruye el mismo documento", () => {
    const original = sampleDoc();
    const xml = generateIDS(original);
    const parsed = parseIDS(xml);

    expect(parsed.info.title).toBe(original.info.title);
    expect(parsed.info.author).toBe(original.info.author);
    expect(parsed.info.description).toBe(original.info.description);
    expect(parsed.info.date).toBe(original.info.date);

    expect(parsed.specifications).toHaveLength(2);
    expect(parsed.specifications[0].name).toBe("Columnas de hormigón armado");
    expect(parsed.specifications[0].applicability.entity).toEqual({ name: "IFCCOLUMN", predefinedType: "COLUMN" });
    expect(parsed.specifications[0].applicability.minOccurs).toBe(1);
    expect(parsed.specifications[0].applicability.maxOccurs).toBe("unbounded");
    expect(parsed.specifications[0].requirements.properties).toEqual(original.specifications[0].requirements.properties);
    expect(parsed.specifications[0].requirements.materials).toEqual(original.specifications[0].requirements.materials);
  });

  test("preserva un único elemento (specification/property) como array, no como objeto suelto", () => {
    const doc = sampleDoc();
    doc.specifications = [doc.specifications[1]]; // solo una spec, con una sola property
    const parsed = parseIDS(generateIDS(doc));

    expect(Array.isArray(parsed.specifications)).toBe(true);
    expect(parsed.specifications).toHaveLength(1);
    expect(Array.isArray(parsed.specifications[0].requirements.properties)).toBe(true);
    expect(parsed.specifications[0].requirements.properties).toHaveLength(1);
  });

  test("lanza un error claro si falta el elemento raíz <ids>", () => {
    expect(() => parseIDS("<not-ids></not-ids>")).toThrow(/<ids>/);
  });

  test("Requirements sin ninguna faceta quedan como objeto vacío, no undefined ni arrays vacíos fantasma", () => {
    const doc = sampleDoc();
    doc.specifications = [
      { name: "Sin requisitos", ifcVersion: "IFC4", applicability: { entity: { name: "IFCWALL" } }, requirements: {} },
    ];
    const parsed = parseIDS(generateIDS(doc));
    expect(parsed.specifications[0].requirements).toEqual({});
  });
});
