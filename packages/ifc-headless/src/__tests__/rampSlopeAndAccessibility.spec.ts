import { describe, test, expect } from "vitest";
import { computeSlopePercentage } from "../internal/ramps";
import { textIndicatesAccessible } from "../internal/accessibility";

// Unit-level coverage of the pure logic that has NO real fixture to
// exercise it end-to-end against (see rampsAndElevators.spec.ts's own
// note: zero real IfcRamp/elevator anywhere in this reader's five
// fixtures). These at least pin down the documented, intentional
// behavior directly, rather than leaving it completely unverified.

describe("computeSlopePercentage: only converts a ratio measure, never a plane angle or unknown measure type", () => {
  test("a ratio measure of 0.0833... (1:12) converts to ~8.33%", () => {
    const pct = computeSlopePercentage({ value: 1 / 12, measureType: "IFCPOSITIVERATIOMEASURE" });
    expect(pct).not.toBeNull();
    expect(pct!).toBeCloseTo(8.333, 2);
  });

  test("a plane angle measure is NOT converted to a percentage - this reader does not do the trigonometry without a real fixture to validate against", () => {
    const pct = computeSlopePercentage({ value: 4.76, measureType: "IFCPLANEANGLEMEASURE" });
    expect(pct).toBeNull();
  });

  test("null slope (undeclared) stays null", () => {
    expect(computeSlopePercentage(null)).toBeNull();
  });
});

describe("textIndicatesAccessible: explicit keyword only, negation-aware, never a default", () => {
  test("a positive Spanish keyword returns true", () => {
    expect(textIndicatesAccessible("Rampa accesible")).toBe(true);
  });

  test("a positive English keyword returns true", () => {
    expect(textIndicatesAccessible("Accessible ramp")).toBe(true);
  });

  test("a negated keyword returns false, not true", () => {
    expect(textIndicatesAccessible("Rampa no accesible")).toBe(false);
  });

  test("text with no accessibility keyword at all returns null (caller then falls through to property search, then 'unknown')", () => {
    expect(textIndicatesAccessible("Rampa de servicio")).toBeNull();
  });
});
