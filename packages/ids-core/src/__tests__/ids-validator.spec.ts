import { describe, test, expect } from "vitest";
import { validateSpecification, validateAgainstSchema, validateDocument, isDocumentValid } from "../validation/ids-validator";
import type { IdsDocument, Specification } from "../types/ids";

function validSpec(): Specification {
  return {
    name: "Columnas de hormigón",
    ifcVersion: "IFC4",
    applicability: { entity: { name: "IFCCOLUMN", predefinedType: "COLUMN" } },
    requirements: {
      properties: [{ propertySet: "Qto_ColumnBaseQuantities", baseName: "Length", dataType: "IFCLENGTHMEASURE", cardinality: "required" }],
    },
  };
}

describe("validateSpecification", () => {
  test("una especificación bien formada no produce errores", () => {
    expect(validateSpecification(validSpec())).toEqual([]);
    expect(validateAgainstSchema(validSpec())).toBe(true);
  });

  test("detecta nombre de especificación vacío", () => {
    const spec = { ...validSpec(), name: "" };
    const errors = validateSpecification(spec);
    expect(errors.some((e) => e.path.endsWith(".name") && e.severity === "error")).toBe(true);
    expect(validateAgainstSchema(spec)).toBe(false);
  });

  test("detecta un dataType que no es un IFC Defined Type real en mayúsculas", () => {
    const spec = validSpec();
    spec.requirements.properties = [{ propertySet: "Pset_X", baseName: "Y", dataType: "string" }];
    const errors = validateSpecification(spec);
    expect(errors.some((e) => e.path.includes("dataType") && e.severity === "error")).toBe(true);
    expect(validateAgainstSchema(spec)).toBe(false);
  });

  test("advierte (no error) si la entidad no parece una clase IFC real", () => {
    const spec = { ...validSpec(), applicability: { entity: { name: "Muro" } } };
    const errors = validateSpecification(spec);
    const entityError = errors.find((e) => e.path.includes("entity.name"));
    expect(entityError?.severity).toBe("warning");
    // Un warning no debe bloquear validateAgainstSchema.
    expect(validateAgainstSchema(spec)).toBe(true);
  });

  test("advierte si la especificación no exige ningún requisito", () => {
    const spec = { ...validSpec(), requirements: {} };
    const errors = validateSpecification(spec);
    expect(errors.some((e) => e.path.endsWith(".requirements") && e.severity === "warning")).toBe(true);
  });
});

describe("validateDocument / isDocumentValid", () => {
  function validDoc(): IdsDocument {
    return { info: { title: "IDS de prueba", author: "chevi@bwisebim.com" }, specifications: [validSpec()] };
  }

  test("un documento bien formado no produce errores", () => {
    expect(validateDocument(validDoc())).toEqual([]);
    expect(isDocumentValid(validDoc())).toBe(true);
  });

  test("rechaza un email de autor inválido (exigencia real del XSD oficial)", () => {
    const doc = { ...validDoc(), info: { ...validDoc().info, author: "no-es-un-email" } };
    expect(isDocumentValid(doc)).toBe(false);
    expect(validateDocument(doc).some((e) => e.path === "info.author")).toBe(true);
  });

  test("rechaza un documento sin especificaciones", () => {
    const doc = { ...validDoc(), specifications: [] };
    expect(isDocumentValid(doc)).toBe(false);
  });

  test("rechaza un título vacío", () => {
    const doc = { ...validDoc(), info: { ...validDoc().info, title: "  " } };
    expect(isDocumentValid(doc)).toBe(false);
  });
});
