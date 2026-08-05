import { describe, test, expect } from "vitest";
import { lookupStairsRequirement } from "../dictionary/stairs";

describe("Art. 4.2.10 stairs table: boundary values, since that's where table lookups break", () => {
  test("exactly 50 people: 1 escalera, 1.10m (top of the first row)", () => {
    const r = lookupStairsRequirement(50);
    expect(r.status).toBe("table");
    if (r.status === "table") {
      expect(r.row).toEqual({ minPersons: 1, maxPersons: 50, minCount: 1, minWidthM: 1.1, articulo: "4.2.10" });
    }
  });

  test("exactly 51 people: crosses into the second row, 1.20m", () => {
    const r = lookupStairsRequirement(51);
    expect(r.status).toBe("table");
    if (r.status === "table") {
      expect(r.row.minWidthM).toBe(1.2);
      expect(r.row.minCount).toBe(1);
    }
  });

  test("exactly 250 vs 251: count jumps from 1 to 2 escaleras", () => {
    const at250 = lookupStairsRequirement(250);
    const at251 = lookupStairsRequirement(251);
    expect(at250.status).toBe("table");
    expect(at251.status).toBe("table");
    if (at250.status === "table" && at251.status === "table") {
      expect(at250.row.minCount).toBe(1);
      expect(at251.row.minCount).toBe(2);
      expect(at250.row.minWidthM).toBe(1.5);
      expect(at251.row.minWidthM).toBe(1.2);
    }
  });

  test("exactly 1000 people: still the last table row, not the study threshold", () => {
    const r = lookupStairsRequirement(1000);
    expect(r.status).toBe("table");
    if (r.status === "table") {
      expect(r.row).toEqual({ minPersons: 701, maxPersons: 1000, minCount: 2, minWidthM: 1.6, articulo: "4.2.10" });
    }
  });

  test("exactly 1001 people: requires Estudio de Evacuación, not an extrapolated table row", () => {
    const r = lookupStairsRequirement(1001);
    expect(r.status).toBe("requires-study");
    if (r.status === "requires-study") {
      expect(r.articulo).toBe("4.2.10");
      expect(r.detail).toMatch(/Estudio de Evacuación/);
    }
  });

  test("zero people: no requirement, not a crash or a fabricated row", () => {
    const r = lookupStairsRequirement(0);
    expect(r.status).toBe("no-requirement");
  });
});
