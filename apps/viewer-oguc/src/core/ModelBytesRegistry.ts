// src/core/ModelBytesRegistry.ts
//
// Module-level singleton (same pattern as IfcBootstrap.ts's registry
// object), not React state: retains the raw bytes of every imported IFC
// file, keyed by the same modelId AppContext/modelDisplayNames use. This
// is what /revision's Pre-Check gate reads to re-parse each loaded model
// through ifc-headless (readIfcFile) and run oguc-core's runPreCheck -
// the live @thatopen/components viewer never exposed this data in a form
// oguc-core can use, and nothing else in the app retained the original
// bytes after import (they were previously discarded once
// app.importNewModel resolved).
const bytesByModelId = new Map<string, Uint8Array>();

export function setModelBytes(modelId: string, bytes: Uint8Array): void {
  bytesByModelId.set(modelId, bytes);
}

export function getModelBytes(modelId: string): Uint8Array | undefined {
  return bytesByModelId.get(modelId);
}

export function getAllModelBytes(): Record<string, Uint8Array> {
  return Object.fromEntries(bytesByModelId);
}

export function clearModelBytes(modelId: string): void {
  bytesByModelId.delete(modelId);
}
