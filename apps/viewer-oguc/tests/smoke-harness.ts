// tests/smoke-harness.ts
/// <reference types="node" />
import { registerModel } from "../src/engine/application/registerModel";
import { InMemoryFederationRepository } from "../src/engine/adapters/InMemoryFederationRepository";
import type { FederationId } from "@bw-central/ifc-core";
import type { ModelLoader } from "../src/engine/application/registerModel";

/**
 * Smoke-Test Headless del Engine.
 *
 * Objetivo: probar que el dominio y la capa Application funcionan de punta
 * a punta SIN ningún renderer, sin React, sin That Open Components.
 * Es la verificación en la práctica de que el Engine es headless de verdad
 * (ver ADR 0002 y Principles.md), no solo una afirmación en un documento.
 *
 * No usa el IfcLoaderAdapter real (ese depende de WebGL/navegador).
 * Usa un loader falso — lo que importa acá es el Engine, no el renderer.
 */

const fakeLoader: ModelLoader = {
  load: async () => ({ id: "mock" }),
};

const federationId = "smoke-test-federation" as FederationId;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function runSmokeTest() {
  console.log("🚀 Iniciando Smoke-Test Headless del Engine...\n");

  const repository = new InMemoryFederationRepository();
  repository.seed({ id: federationId, models: [] });
  console.log("✅ Federación inicial creada en memoria.");

  // --- Caso 1: registrar un modelo nuevo debe funcionar ---
  const firstResult = await registerModel(
    {
      name: "ARQ_HospitalLaSerena.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId,
    },
    fakeLoader,
    repository
  );
  assert(firstResult.success === true, "Registrar un modelo nuevo debe tener éxito");

  // --- Caso 2: registrar el mismo modelo otra vez debe fallar ---
  const secondResult = await registerModel(
    {
      name: "ARQ_HospitalLaSerena.ifc",
      content: new Uint8Array([1, 2, 3]),
      federationId,
    },
    fakeLoader,
    repository
  );
  assert(secondResult.success === false, "Registrar el mismo modelo dos veces debe fallar");

  // --- Caso 3: registrar un modelo con archivo vacío debe fallar ---
  const emptyResult = await registerModel(
    {
      name: "EST_HospitalLaSerena.ifc",
      content: new Uint8Array([]),
      federationId,
    },
    fakeLoader,
    repository
  );
  assert(emptyResult.success === false, "Registrar un archivo vacío debe fallar");

  // --- Caso 4: registrar un modelo distinto en la misma Federación debe funcionar ---
  const secondModelResult = await registerModel(
    {
      name: "EST_HospitalLaSerena.ifc",
      content: new Uint8Array([4, 5, 6]),
      federationId,
    },
    fakeLoader,
    repository
  );
  assert(secondModelResult.success === true, "Registrar un segundo modelo distinto debe tener éxito");

  console.log("\n✅ [SMOKE-TEST PASSED]: El Engine funciona correctamente sin ninguna UI ni renderer.");
  process.exit(0);
}

runSmokeTest().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("\n❌ [SMOKE-TEST FAILED]:", errorMessage);
  process.exit(1);
});