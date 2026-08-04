import { describe, test, expect } from "vitest";
import { ALL_BIM_USES, TDI_DEFINITIONS, getUsesByIDSPhase } from "../metadata/bim-uses";
import { getPropertiesByEtapa, getEntitiesForEtapa } from "../metadata/planbim-v3";
import { OGUC_DESTINATIONS, deriveOgucFireSafety } from "../metadata/oguc-fire-safety";
import { MANDANTES } from "../metadata/mandantes";

describe("metadata: Estándar BIM Tabla 06/07", () => {
  test("tiene los 25 Usos BIM (Tabla 06)", () => {
    expect(ALL_BIM_USES).toHaveLength(25);
  });

  test("tiene los 15 TDI (Tabla 07)", () => {
    expect(Object.keys(TDI_DEFINITIONS)).toHaveLength(15);
  });

  test("getUsesByIDSPhase filtra por fase real", () => {
    const dc = getUsesByIDSPhase("dc");
    expect(dc.length).toBeGreaterThan(0);
    dc.forEach((use) => expect(use.idsPhases).toContain("dc"));
  });
});

describe("metadata: Matriz PlanBIM V3.0", () => {
  test("expone propiedades reales para las 5 entidades cubiertas", () => {
    for (const ifc of ["IfcColumn", "IfcBeam", "IfcSlab", "IfcFooting", "IfcWall"]) {
      expect(getPropertiesByEtapa(ifc, "DC").length).toBeGreaterThan(0);
    }
  });

  test("getEntitiesForEtapa devuelve solo entidades con datos en esa etapa", () => {
    expect(getEntitiesForEtapa("DC").sort()).toEqual(["IfcBeam", "IfcColumn", "IfcFooting", "IfcSlab", "IfcWall"].sort());
  });
});

describe("metadata: destinos OGUC", () => {
  test("deriveOgucFireSafety usa el formato real sin guion (F60, no F-60)", () => {
    const result = deriveOgucFireSafety("oficinas", undefined);
    expect(result.fireSafetyType).toBe("F60");
  });

  test("todas las claves de OGUC_DESTINATIONS son consistentes con su id", () => {
    for (const [key, config] of Object.entries(OGUC_DESTINATIONS)) {
      expect(config.id).toBe(key);
    }
  });
});

describe("metadata: mandantes", () => {
  test("catálogo cubre los ids declarados en el tipo Mandante", () => {
    expect(Object.keys(MANDANTES).sort()).toEqual(["MINDEP", "MINEDUC", "MINSAL", "MINVU", "MOP", "OTRO"].sort());
  });
});
