import { describe, test, expect } from "vitest";
import { readIfcName, readIfcPropertyValue, groupPropertySets, extractPsetValues } from "./traversal";

describe("readIfcName", () => {
  test("desenvuelve { value } (forma típica de @thatopen/fragments)", () => {
    expect(readIfcName({ Name: { value: "Muro Exterior" } })).toBe("Muro Exterior");
  });

  test("acepta un string plano", () => {
    expect(readIfcName({ Name: "Muro Exterior" })).toBe("Muro Exterior");
  });

  test("null si no hay Name o está vacío", () => {
    expect(readIfcName({})).toBeNull();
    expect(readIfcName({ Name: "" })).toBeNull();
    expect(readIfcName(null)).toBeNull();
  });
});

describe("readIfcPropertyValue", () => {
  test("encuentra el campo que termina en Value, sin importar el tipo IFC", () => {
    expect(readIfcPropertyValue({ Name: "Material", NominalValue: { value: "Acero" } })).toBe("Acero");
    expect(readIfcPropertyValue({ Name: "Area", AreaValue: { value: 12.5 } })).toBe("12.5");
  });

  test("ignora claves internas y Name", () => {
    expect(readIfcPropertyValue({ Name: "X", _category: "Y" })).toBeNull();
  });

  test("null si no hay ningún campo *Value con valor real", () => {
    expect(readIfcPropertyValue({ Name: "Material", NominalValue: { value: null } })).toBeNull();
    expect(readIfcPropertyValue(null)).toBeNull();
  });
});

describe("groupPropertySets", () => {
  test("agrupa HasProperties y Quantities por nombre de Pset, sin transformar valores", () => {
    const data = {
      IsDefinedBy: [
        { Name: { value: "Pset_WallCommon" }, HasProperties: [{ Name: "LoadBearing", NominalValue: { value: true } }] },
        { Name: { value: "Qto_WallBaseQuantities" }, Quantities: [{ Name: "Length", LengthValue: { value: 3.2 } }] },
      ],
    };

    const sets = groupPropertySets(data);
    expect(Object.keys(sets)).toEqual(["Pset_WallCommon", "Qto_WallBaseQuantities"]);
    expect(sets.Pset_WallCommon).toHaveLength(1);
  });

  test("usa el nombre de fallback por índice cuando la relación no tiene Name", () => {
    const data = { IsDefinedBy: [{ HasProperties: [{ Name: "X", NominalValue: { value: 1 } }] }] };
    const sets = groupPropertySets(data);
    expect(Object.keys(sets)).toEqual(["PropertySet_#0"]);
  });

  test("vacío si no hay IsDefinedBy", () => {
    expect(groupPropertySets({})).toEqual({});
    expect(groupPropertySets(null)).toEqual({});
  });
});

describe("extractPsetValues", () => {
  test("aplana Psets y Quantities a Record<string,string>", () => {
    const data = {
      IsDefinedBy: [
        { Name: { value: "Pset_WallCommon" }, HasProperties: [{ Name: "LoadBearing", NominalValue: { value: true } }] },
      ],
    };

    expect(extractPsetValues(data)).toEqual({ Pset_WallCommon: { LoadBearing: "true" } });
  });

  test("usa 'Pset' como fallback de nombre y omite propiedades sin Name o sin valor", () => {
    const data = {
      IsDefinedBy: [
        { HasProperties: [{ Name: "X", NominalValue: { value: null } }, { NominalValue: { value: 1 } }] },
      ],
    };

    expect(extractPsetValues(data)).toEqual({ Pset: {} });
  });
});
