import { describe, test, expect } from "vitest";
import { generateIDS } from "../serialization/xml-generator";
import type { IdsDocument } from "../types/ids";

function minimalDoc(): IdsDocument {
  return {
    info: { title: "IDS de prueba", author: "test@bwisebim.com", date: "2026-01-01" },
    specifications: [
      {
        name: "Columnas de hormigón",
        ifcVersion: "IFC4",
        applicability: { entity: { name: "IFCCOLUMN", predefinedType: "COLUMN" } },
        requirements: {
          properties: [
            { propertySet: "Qto_ColumnBaseQuantities", baseName: "Length", dataType: "IFCLENGTHMEASURE", cardinality: "required" },
          ],
          attributes: [{ name: "Name", cardinality: "required" }],
          classifications: [{ system: "Normativa Aplicable", value: "OGUC", cardinality: "required" }],
          materials: [{ value: "Hormigón Armado", cardinality: "required" }],
        },
      },
    ],
  };
}

describe("generateIDS", () => {
  test("emite el XML declaration, namespace y schemaLocation del esquema oficial", () => {
    const xml = generateIDS(minimalDoc());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://standards.buildingsmart.org/IDS"');
    expect(xml).toContain("http://standards.buildingsmart.org/IDS/1.0/ids.xsd");
  });

  test("<specification> no lleva minOccurs/maxOccurs; esos van en <applicability>", () => {
    const xml = generateIDS(minimalDoc());
    const specLine = xml.split("\n").find((l) => l.trim().startsWith("<specification "));
    expect(specLine).not.toContain("minOccurs");
    const applicabilityLine = xml.split("\n").find((l) => l.trim().startsWith("<applicability "));
    expect(applicabilityLine).toContain('minOccurs="1"');
    expect(applicabilityLine).toContain('maxOccurs="unbounded"');
  });

  test("property lleva dataType como atributo y propertySet/baseName como simpleValue", () => {
    const xml = generateIDS(minimalDoc());
    expect(xml).toContain('<property dataType="IFCLENGTHMEASURE" cardinality="required">');
    expect(xml).toContain("<propertySet><simpleValue>Qto_ColumnBaseQuantities</simpleValue></propertySet>");
    expect(xml).toContain("<baseName><simpleValue>Length</simpleValue></baseName>");
  });

  test("attribute NO lleva dataType", () => {
    const xml = generateIDS(minimalDoc());
    const attributeBlock = xml.slice(xml.indexOf("<attribute"), xml.indexOf("</attribute>") + "</attribute>".length);
    expect(attributeBlock).not.toContain("dataType");
  });

  test("escapa caracteres especiales en texto libre", () => {
    const doc = minimalDoc();
    doc.info.title = 'Título con "comillas" & <tag>';
    const xml = generateIDS(doc);
    expect(xml).toContain("&quot;comillas&quot;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;tag&gt;");
  });

  test("usa la fecha dada, o la fecha actual si se omite", () => {
    const withDate = generateIDS(minimalDoc());
    expect(withDate).toContain("<date>2026-01-01</date>");

    const doc = minimalDoc();
    doc.info.date = undefined;
    const withoutDate = generateIDS(doc);
    const today = new Date().toISOString().slice(0, 10);
    expect(withoutDate).toContain(`<date>${today}</date>`);
  });

  test("respeta el orden real de requirements: classification, attribute, property, material", () => {
    const xml = generateIDS(minimalDoc());
    const requirementsBlock = xml.slice(xml.indexOf("<requirements>"), xml.indexOf("</requirements>"));
    const order = ["<classification", "<attribute", "<property", "<material"].map((tag) => requirementsBlock.indexOf(tag));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
