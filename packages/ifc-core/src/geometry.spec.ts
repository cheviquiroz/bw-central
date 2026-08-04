import { describe, test, expect } from "vitest";
import { detectDistantModels } from "./geometry";

describe("detectDistantModels", () => {
  test("no reporta nada si hay un solo modelo", () => {
    const result = detectDistantModels([
      { modelId: "A", min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    ]);
    expect(result).toEqual([]);
  });

  test("no reporta nada si las cajas se tocan o se superponen", () => {
    const result = detectDistantModels([
      { modelId: "A", min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      { modelId: "B", min: { x: 8, y: 0, z: 0 }, max: { x: 20, y: 10, z: 10 } },
    ]);
    expect(result).toEqual([]);
  });

  test("reporta el modelo cuya caja está lejos del grupo principal", () => {
    const result = detectDistantModels([
      { modelId: "ARQ", min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      { modelId: "EST", min: { x: 5, y: 0, z: 0 }, max: { x: 15, y: 10, z: 10 } },
      { modelId: "MEP", min: { x: 5000, y: 0, z: 0 }, max: { x: 5010, y: 10, z: 10 } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].modelId).toBe("MEP");
    expect(result[0].distanceFromGroupMeters).toBeCloseTo(4985, 0);
  });

  test("NO da falso positivo entre un modelo enorme (topografía) y uno chico (elemento) que están pegados", () => {
    // Este es el caso que motivó el rediseño: comparar centros habría dado
    // una distancia grande solo por la diferencia de tamaño, no de ubicación real.
    const result = detectDistantModels([
      { modelId: "TOPOGRAFIA", min: { x: -500, y: -500, z: -5 }, max: { x: 500, y: 500, z: 0 } },
      { modelId: "ASCENSOR", min: { x: 10, y: 10, z: 0 }, max: { x: 12, y: 12, z: 3 } },
    ]);
    expect(result).toEqual([]);
  });

  test("reporta el modelo cargado PRIMERO como alejado, si los que llegan después forman el grupo principal", () => {
    const result = detectDistantModels([
      { modelId: "ARQ_MAL_UBICADO", min: { x: 5000, y: 0, z: 0 }, max: { x: 5010, y: 10, z: 10 } },
      { modelId: "EST", min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } },
      { modelId: "MEP", min: { x: 8, y: 0, z: 0 }, max: { x: 18, y: 10, z: 10 } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].modelId).toBe("ARQ_MAL_UBICADO");
  });

  test("respeta un umbral personalizado", () => {
    const boxes = [
      { modelId: "A", min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
      { modelId: "B", min: { x: 50, y: 0, z: 0 }, max: { x: 51, y: 1, z: 1 } },
    ];
    expect(detectDistantModels(boxes, 100)).toEqual([]);
    expect(detectDistantModels(boxes, 10)).toHaveLength(1);
  });
});
