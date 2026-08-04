import { describe, test, expect } from "vitest";
import { calculateSHA256, isValidIfcHeader } from "./utils";

describe("calculateSHA256", () => {
  test("es determinístico: mismo contenido produce el mismo hash", async () => {
    const a = await calculateSHA256(new Uint8Array([1, 2, 3]));
    const b = await calculateSHA256(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
  });

  test("produce hashes distintos para contenido distinto", async () => {
    const a = await calculateSHA256(new Uint8Array([1, 2, 3]));
    const b = await calculateSHA256(new Uint8Array([4, 5, 6]));
    expect(a).not.toBe(b);
  });

  test("devuelve un hex de 64 caracteres (SHA-256)", async () => {
    const hash = await calculateSHA256(new Uint8Array([1, 2, 3]));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isValidIfcHeader", () => {
  test("acepta un archivo IFC-SPF real", () => {
    const bytes = new TextEncoder().encode("ISO-10303-21;\nHEADER;\n");
    expect(isValidIfcHeader(bytes)).toBe(true);
  });

  test("rechaza contenido que no es IFC", () => {
    const bytes = new TextEncoder().encode("not an ifc file");
    expect(isValidIfcHeader(bytes)).toBe(false);
  });
});
