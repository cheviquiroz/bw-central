/// <reference types="node" />
import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseBcf } from "@bw-central/bcf-core";
import { bytesToBase64, base64ToBytes } from "./base64";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Misma fixture BCF 2.1 real que usa packages/bcf-core (ver ese paquete
// para su procedencia: copiada del fixture real de
// bcf-pdf-exporter/test-fixtures/sample.bcf), referenciada acá en vez de
// duplicada.
const FIXTURE_PATH = path.join(__dirname, "../../../../../packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf");

describe("bytesToBase64 / base64ToBytes - round-trip", () => {
  test(
    "un array de varios MB (muy por encima de cualquier límite de argumentos de engine) sobrevive el round-trip byte a byte",
    () => {
      // 5,000,000 bytes: la implementación vieja (String.fromCharCode(...chunk)
      // con CHUNK_SIZE=0x8000) hacía ~153 llamadas variádicas de 32768
      // argumentos cada una - esto ejercita el mismo volumen total de datos
      // sin depender de NINGÚN límite de argumentos, porque el loop indexado
      // nunca hace una llamada variádica. Timeout explícito: es una prueba
      // de volumen a propósito, no una operación normal de la app.
      const size = 5_000_000;
      const original = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        original[i] = i % 256;
      }

      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);

      expect(decoded.length).toBe(original.length);
      expect(decoded).toEqual(original);
    },
    20_000,
  );

  test("el snapshot.png real de la fixture BCF 2.1 sobrevive el round-trip byte a byte", async () => {
    const fileBytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    const project = await parseBcf(fileBytes);
    const snapshot = project.topics[0]?.viewpoints[0]?.snapshot;
    expect(snapshot).toBeInstanceOf(Uint8Array);
    expect(snapshot!.length).toBeGreaterThan(0);

    const encoded = bytesToBase64(snapshot!);
    const decoded = base64ToBytes(encoded);
    expect(decoded).toEqual(snapshot);
  });

  test("input vacío no crashea", () => {
    const empty = new Uint8Array(0);
    expect(bytesToBase64(empty)).toBe("");
    expect(base64ToBytes("")).toEqual(new Uint8Array(0));
  });

  test("input de un solo byte no crashea", () => {
    const one = new Uint8Array([200]);
    const encoded = bytesToBase64(one);
    expect(base64ToBytes(encoded)).toEqual(one);
  });
});
