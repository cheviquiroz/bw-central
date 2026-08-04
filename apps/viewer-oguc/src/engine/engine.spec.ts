// src/engine/engine.spec.ts
import { describe, test, expect } from "vitest";
import { registerModel } from "./application/registerModel";
import type { FederationRepository } from "./ports/FederationRepository";
import type { Federation, FederationId } from "@bw-central/ifc-core";

interface ModelLoader {
  load(
    content: Uint8Array,
    name: string,
    onProgress?: (progress: { percentage: number; statusMessage: string }) => void
  ): Promise<{ id: string; name: string; byteSize: number }>;
}

describe("Sprint 1: Caso de Uso - registerModel", () => {
  const fakeLoader: ModelLoader = {
    load: async (content, name) => ({ id: "mock-id", name, byteSize: content.length }),
  };

  const fakeFederationId = "fake-federation" as FederationId;

  function createFakeFederationRepository(): FederationRepository {
    let federation: Federation = { id: fakeFederationId, models: [] };
    return {
      get: async (id) => (id === fakeFederationId ? federation : null),
      save: async (updated) => {
        federation = updated;
      },
    };
  }

  test("Debería fallar con un Result controlado si el contenido del archivo está vacío", async () => {
    const input = {
      name: "HospitalLaSerena.ifc",
      content: new Uint8Array([]),
      federationId: fakeFederationId,
    };

    const result = await registerModel(input, fakeLoader, createFakeFederationRepository());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("El archivo del modelo está vacío");
    }
  });

  test("Debería fallar si la Federación no existe", async () => {
    const input = {
      name: "HospitalLaSerena.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId: "no-existe" as FederationId,
    };

    const result = await registerModel(input, fakeLoader, createFakeFederationRepository());
    expect(result.success).toBe(false);
  });

  test("Debería registrar el modelo exitosamente en una Federación válida", async () => {
    const input = {
      name: "HospitalLaSerena.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId: fakeFederationId,
    };

    const result = await registerModel(input, fakeLoader, createFakeFederationRepository());

    expect(result.success).toBe(true);
  });

  test("Debería rechazar un archivo con el MISMO CONTENIDO ya registrado (aunque tenga distinto nombre)", async () => {
    // Repositorio compartido entre las dos llamadas, para simular el mismo estado real
    const repository = createFakeFederationRepository();

    const firstInput = {
      name: "HospitalLaSerena.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId: fakeFederationId,
    };

    const firstResult = await registerModel(firstInput, fakeLoader, repository);

    expect(firstResult.success).toBe(true);

    // Mismo contenido (mismo hash → mismo ModelId), nombre distinto a propósito:
    // debe rechazarse igual, porque lo que identifica al modelo es el contenido, no el nombre.
    const secondInput = {
      name: "OtroNombreDistinto.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId: fakeFederationId,
    };

    const secondResult = await registerModel(secondInput, fakeLoader, repository);
    expect(secondResult.success).toBe(false);
  });

  test("Debería renombrar automáticamente cuando el NOMBRE se repite pero el CONTENIDO es distinto", async () => {
    const repository = createFakeFederationRepository();

    const firstInput = {
      name: "Modelo.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId: fakeFederationId,
    };
    const firstResult = await registerModel(firstInput, fakeLoader, repository);
    expect(firstResult.success).toBe(true);
    if (firstResult.success) {
      expect(firstResult.value.name).toBe("Modelo.ifc");
    }

    // Mismo nombre, contenido DISTINTO ([4,5,6] en vez de [1,2,3]) → no es duplicado,
    // debe registrarse con el nombre resuelto automáticamente "Modelo (1).ifc"
    const secondInput = {
      name: "Modelo.ifc",
      content: new Uint8Array([4, 5, 6]),
      federationId: fakeFederationId,
    };
    const secondResult = await registerModel(secondInput, fakeLoader, repository);

    expect(secondResult.success).toBe(true);
    if (secondResult.success) {
      expect(secondResult.value.name).toBe("Modelo (1).ifc");
    }
  });
});
