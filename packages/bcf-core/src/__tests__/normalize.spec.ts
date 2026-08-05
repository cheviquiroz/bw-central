import { describe, test, expect } from "vitest";
import { normalizePriority, normalizeStatus } from "../normalize";

describe("normalizePriority", () => {
  test("reconoce variantes en español e inglés", () => {
    expect(normalizePriority("Alta")).toBe("High");
    expect(normalizePriority("high")).toBe("High");
    expect(normalizePriority("Baja")).toBe("Low");
    expect(normalizePriority(undefined)).toBe("Medium");
    expect(normalizePriority("valor-no-reconocido")).toBe("Medium");
  });
});

describe("normalizeStatus", () => {
  test("reconoce variantes en español e inglés por substring", () => {
    expect(normalizeStatus("Resolved")).toBe("Resolved");
    expect(normalizeStatus("Cerrado")).toBe("Resolved");
    expect(normalizeStatus("Pending Review")).toBe("Pending Review");
    expect(normalizeStatus("En Revisión")).toBe("Pending Review");
    expect(normalizeStatus("Open")).toBe("Open");
    expect(normalizeStatus(null)).toBe("Open");
  });
});
