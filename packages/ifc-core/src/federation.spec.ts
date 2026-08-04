import { describe, test, expect } from "vitest";
import { registerModelInFederation, removeModelFromFederation } from "./federation";
import { ModelId } from "./types";
import type { Federation, FederationId } from "./types";

const federationId = "fed-1" as FederationId;

function emptyFederation(): Federation {
  return { id: federationId, models: [] };
}

describe("registerModelInFederation", () => {
  test("registra un modelo nuevo con el nombre pedido", () => {
    const result = registerModelInFederation(emptyFederation(), new ModelId("hash-a"), "Modelo.ifc");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolvedName).toBe("Modelo.ifc");
      expect(result.value.models).toHaveLength(1);
    }
  });

  test("rechaza el mismo ModelId (mismo contenido) dos veces", () => {
    const first = registerModelInFederation(emptyFederation(), new ModelId("hash-a"), "Modelo.ifc");
    if (!first.success) throw new Error("setup failed");

    const second = registerModelInFederation(first.value, new ModelId("hash-a"), "OtroNombre.ifc");
    expect(second.success).toBe(false);
  });

  test("resuelve un nombre alternativo cuando el nombre ya está en uso por otro contenido", () => {
    const first = registerModelInFederation(emptyFederation(), new ModelId("hash-a"), "Modelo.ifc");
    if (!first.success) throw new Error("setup failed");

    const second = registerModelInFederation(first.value, new ModelId("hash-b"), "Modelo.ifc");
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.resolvedName).toBe("Modelo (1).ifc");
    }
  });
});

describe("removeModelFromFederation", () => {
  test("quita un modelo registrado por su ModelId", () => {
    const registered = registerModelInFederation(emptyFederation(), new ModelId("hash-a"), "Modelo.ifc");
    if (!registered.success) throw new Error("setup failed");

    const result = removeModelFromFederation(registered.value, new ModelId("hash-a"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.models).toHaveLength(0);
    }
  });

  test("falla si el modelo no está registrado", () => {
    const result = removeModelFromFederation(emptyFederation(), new ModelId("hash-a"));
    expect(result.success).toBe(false);
  });
});
