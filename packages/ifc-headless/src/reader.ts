// Public entry point. Reads exactly one IFC file - there is no
// multi-file or merge API anywhere in this package, by design (see the
// commit that adds ifc-headless: federated models like CASA-ARQ/CASA-MEP
// or EOFF-ARQ/EOFF-SPC are processed independently, never fused).
//
// Runs in plain Node: zero DOM, zero Worker, zero network, no
// @thatopen/* dependency - raw web-ifc only, as proven in Step 07 and
// the Part 1 inventory of this task.

import * as WebIFC from "web-ifc";
import { getLine, getLineIds, unwrapString, type IfcApi } from "./internal/webifc.js";
import { readSchema } from "./internal/schema.js";
import { readFileUnits } from "./internal/units.js";
import { resolveSpatialHierarchy } from "./internal/spatialHierarchy.js";
import { resolveSpaceProperties } from "./internal/propertySets.js";
import { hasAnySpaceBoundaries, resolveAuthoritativeBoundaries } from "./internal/authoritativeBoundaries.js";
import { resolveGeometricBoundaries } from "./internal/geometricBoundaries.js";
import { resolveAdjacentSpaces } from "./internal/adjacency.js";
import { resolveStairs } from "./internal/stairs.js";
import { resolveRamps } from "./internal/ramps.js";
import { resolveElevators } from "./internal/elevators.js";
import type { IfcHeadlessDocument, IfcSpaceRecord, BoundingElementRef } from "./types.js";

export * from "./types.js";

/**
 * Where to fetch the web-ifc WASM binary from, forwarded verbatim to
 * IfcAPI.SetWasmPath() before Init(). Optional and additive - Node
 * callers (every test in this package) never pass this, and web-ifc's
 * own default resolution (relative to node_modules) keeps working
 * unchanged. A browser caller (viewer-oguc, which already points its own
 * @thatopen/components IfcLoader at a CDN URL for the same wasm binary -
 * see IfcBootstrap.ts) needs this because a bare `new WebIFC.IfcAPI()`
 * in a Vite/browser bundle has no node_modules to resolve against.
 */
export interface ReadIfcFileOptions {
  wasmPath?: string;
  wasmAbsolute?: boolean;
}

async function withApi<T>(fn: (api: IfcApi) => Promise<T> | T, options?: ReadIfcFileOptions): Promise<T> {
  const api = new WebIFC.IfcAPI();
  if (options?.wasmPath) {
    (api as unknown as { SetWasmPath: (path: string, absolute?: boolean) => void }).SetWasmPath(
      options.wasmPath,
      options.wasmAbsolute,
    );
  }
  await api.Init();
  try {
    return await fn(api);
  } finally {
    // No hay modelo abierto que cerrar acá a propósito: cada caller abre
    // y cierra su propio modelo, para poder reportar un error claro si
    // OpenModel falla antes de que exista un modelID válido.
  }
}

/** Reads a single IFC file (already-read bytes) into the headless document model. Throws with a clear message on malformed/truncated input - never returns a silent empty result for a file that failed to parse. */
export async function readIfcFile(bytes: Uint8Array, options?: ReadIfcFileOptions): Promise<IfcHeadlessDocument> {
  return withApi(async (api) => {
    let modelID: number;
    try {
      modelID = api.OpenModel(bytes);
    } catch (err) {
      throw new Error(`Could not open IFC file (malformed or truncated): ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!api.IsModelOpen(modelID)) {
      throw new Error("Could not open IFC file: web-ifc did not report the model as open after OpenModel.");
    }

    // OpenModel/IsModelOpen alone do not catch every malformed input:
    // verified empirically that a STEP file with a valid header but a
    // truncated DATA section (cut off mid-entity) opens successfully and
    // reports IsModelOpen === true, parsing whatever happened to complete
    // before the cut and nothing more - which would otherwise come back
    // as a silent, indistinguishable-from-legitimate empty result. Every
    // valid IFC file has exactly one IfcProject (a schema requirement,
    // not a convention); its absence is a reliable signal of a broken
    // file, not a legitimately space-free one (CASA-MEP and EOFF-ARQ
    // both have zero IfcSpace but a real IfcProject).
    if (getLineIds(api, modelID, WebIFC.IFCPROJECT).length === 0) {
      api.CloseModel(modelID);
      throw new Error("Could not open IFC file: no IfcProject found - the file is likely truncated or malformed.");
    }

    try {
      return buildDocument(api, modelID);
    } finally {
      api.CloseModel(modelID);
    }
  }, options);
}

/** Convenience wrapper: reads the file at `filePath` from disk (Node fs) and calls readIfcFile. */
export async function readIfcFilePath(filePath: string): Promise<IfcHeadlessDocument> {
  const { readFileSync } = await import("fs");
  const bytes = new Uint8Array(readFileSync(filePath));
  return readIfcFile(bytes);
}

function buildDocument(api: IfcApi, modelID: number): IfcHeadlessDocument {
  const schema = readSchema(api, modelID);
  const units = readFileUnits(api, modelID);

  const stairs = resolveStairs(api, modelID, units);
  const ramps = resolveRamps(api, modelID);
  const elevators = resolveElevators(api, modelID);

  const spaceIds = getLineIds(api, modelID, WebIFC.IFCSPACE);
  const spaceIdSet = new Set(spaceIds);

  if (spaceIds.length === 0) {
    return { schema, units, hasDeclaredSpaceBoundaries: hasAnySpaceBoundaries(api, modelID), spaces: [], stairs, ramps, elevators };
  }

  const { spaceStorey, storeyElements } = resolveSpatialHierarchy(api, modelID, spaceIdSet);
  const propertiesBySpace = resolveSpaceProperties(api, modelID, spaceIds, units);

  const hasBoundaries = hasAnySpaceBoundaries(api, modelID);
  const boundingElementsBySpace: Map<number, BoundingElementRef[]> = hasBoundaries
    ? resolveAuthoritativeBoundaries(api, modelID, spaceIdSet)
    : resolveGeometricBoundaries(api, modelID, spaceIds, spaceStorey, storeyElements);

  // Espacios sin ninguna relación de boundary encontrada (autoritativa o
  // inferida) igual deben aparecer con una lista vacía, no ausentes.
  for (const id of spaceIds) if (!boundingElementsBySpace.has(id)) boundingElementsBySpace.set(id, []);

  const adjacentBySpace = resolveAdjacentSpaces(boundingElementsBySpace);

  // Pre-pasada: se necesita el GlobalId de TODOS los espacios antes de
  // resolver las listas de adyacencia (un espacio puede referenciar a
  // otro que todavía no se procesó en el orden de spaceIds).
  const globalIdBySpace = new Map<number, string | null>();
  for (const id of spaceIds) {
    globalIdBySpace.set(id, unwrapString(getLine(api, modelID, id).GlobalId));
  }

  const spaces: IfcSpaceRecord[] = spaceIds.map((expressId) => {
    const line = getLine(api, modelID, expressId);
    const globalId = globalIdBySpace.get(expressId) ?? null;

    const props = propertiesBySpace.get(expressId) ?? { propertySets: {}, quantitySets: {} };

    return {
      expressId,
      globalId,
      name: unwrapString(line.Name),
      longName: unwrapString(line.LongName),
      description: unwrapString(line.Description),
      objectType: unwrapString(line.ObjectType),
      storeyExpressId: spaceStorey.get(expressId) ?? null,
      propertySets: props.propertySets,
      quantitySets: props.quantitySets,
      boundingElements: boundingElementsBySpace.get(expressId) ?? [],
      adjacentSpaces: (adjacentBySpace.get(expressId) ?? []).map((adj) => ({
        ...adj,
        globalId: globalIdBySpace.get(adj.expressId) ?? null,
      })),
    };
  });

  return { schema, units, hasDeclaredSpaceBoundaries: hasBoundaries, spaces, stairs, ramps, elevators };
}
