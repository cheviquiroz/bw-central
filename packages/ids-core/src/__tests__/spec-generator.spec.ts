import { describe, test, expect } from "vitest";
import { generateChileanSpec } from "../generation/spec-generator";
import { isDocumentValid, validateDocument } from "../validation/ids-validator";
import { generateIDS } from "../serialization/xml-generator";

describe("generateChileanSpec", () => {
  test("genera una especificación por cada entidad del sistema estructural (hormigón: columna, viga, losa, fundación)", () => {
    const doc = generateChileanSpec({
      author: "test@bwisebim.com",
      ogucDestination: "oficinas",
      structuralSystem: "hormigon",
      phase: "DB",
    });

    const entityNames = doc.specifications.map((s) => s.applicability.entity.name);
    expect(entityNames).toEqual(["IFCCOLUMN", "IFCBEAM", "IFCSLAB", "IFCFOOTING"]);
  });

  test("genera un set distinto de entidades para acero", () => {
    const doc = generateChileanSpec({
      author: "test@bwisebim.com",
      ogucDestination: "industrial",
      structuralSystem: "acero",
      phase: "DB",
    });

    const entityNames = doc.specifications.map((s) => s.applicability.entity.name);
    expect(entityNames).toEqual(["IFCCOLUMN", "IFCBEAM", "IFCMEMBER", "IFCPLATE"]);
  });

  test("cada especificación exige el material correcto para el sistema estructural", () => {
    const doc = generateChileanSpec({
      author: "test@bwisebim.com",
      ogucDestination: "oficinas",
      structuralSystem: "acero",
      phase: "DB",
    });

    doc.specifications.forEach((spec) => {
      expect(spec.requirements.materials).toEqual([{ value: "Acero Estructural", cardinality: "required" }]);
    });
  });

  test("omite propiedades de categoría fuego cuando el destino OGUC no las exige (vivienda 1-2 pisos)", () => {
    const doc = generateChileanSpec({
      author: "test@bwisebim.com",
      ogucDestination: "vivienda",
      destinationCondition: "vivienda_1_2",
      structuralSystem: "hormigon",
      phase: "DC",
    });

    const columnSpec = doc.specifications.find((s) => s.applicability.entity.name === "IFCCOLUMN");
    const hasFireProperty = columnSpec?.requirements.properties?.some((p) => p.baseName === "FireRating");
    expect(hasFireProperty).toBe(false);
  });

  test("incluye propiedades de categoría fuego cuando el destino OGUC sí las exige (oficinas)", () => {
    const doc = generateChileanSpec({
      author: "test@bwisebim.com",
      ogucDestination: "oficinas",
      structuralSystem: "hormigon",
      phase: "DC",
    });

    const columnSpec = doc.specifications.find((s) => s.applicability.entity.name === "IFCCOLUMN");
    const hasFireProperty = columnSpec?.requirements.properties?.some((p) => p.baseName === "FireRating");
    expect(hasFireProperty).toBe(true);
  });

  test("agrega propiedades mecánicas de detalle solo en fase DD", () => {
    const dc = generateChileanSpec({ author: "a@b.cl", ogucDestination: "oficinas", structuralSystem: "hormigon", phase: "DC" });
    const dd = generateChileanSpec({ author: "a@b.cl", ogucDestination: "oficinas", structuralSystem: "hormigon", phase: "DD" });

    const hasYieldStrength = (specs: typeof dc.specifications) =>
      specs.some((s) => s.requirements.properties?.some((p) => p.baseName === "YieldStrength"));

    expect(hasYieldStrength(dc.specifications)).toBe(false);
    expect(hasYieldStrength(dd.specifications)).toBe(true);
  });

  test("convierte regulations en requisitos <classification>", () => {
    const doc = generateChileanSpec({
      author: "a@b.cl",
      ogucDestination: "oficinas",
      structuralSystem: "hormigon",
      phase: "DB",
      regulations: ["OGUC", "NCh433"],
    });

    expect(doc.specifications[0].requirements.classifications).toEqual([
      { system: "Normativa Aplicable", value: "OGUC", cardinality: "required" },
      { system: "Normativa Aplicable", value: "NCh433", cardinality: "required" },
    ]);
  });

  test("el documento generado pasa la validación completa y produce XML sin errores", () => {
    const doc = generateChileanSpec({
      author: "chevi@bwisebim.com",
      ogucDestination: "salud",
      destinationCondition: "salud_hospital",
      structuralSystem: "mixto",
      phase: "DD",
      bimUses: ["uso_09_analisis_estructural"],
      regulations: ["OGUC"],
    });

    const errors = validateDocument(doc);
    expect(errors.filter((e) => e.severity === "error")).toEqual([]);
    expect(isDocumentValid(doc)).toBe(true);
    expect(() => generateIDS(doc)).not.toThrow();
  });
});
