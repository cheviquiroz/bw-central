// src/routes/revision/bwrev.ts
//
// Client-side save/load for .bwrev review sessions - no backend, no
// binary format (plain JSON, per this task's explicit constraint).
// Builds/parses the BwrevFile shape (oguc-core) from/into
// RevisionLayout.tsx's React state; the actual Blob/File/download
// mechanics live here since oguc-core has no business depending on
// browser APIs.
import { calculateSHA256 } from "@bw-central/ifc-core";
import { BWREV_VERSION, isValidBwrevFile } from "@bw-central/oguc-core";
import type { BwrevFile, BwrevModelRef, BwrevPreCheckResults, Finding, PreCheckResult } from "@bw-central/oguc-core";
import { getModelBytes } from "../../core/ModelBytesRegistry";

export interface BuildBwrevInput {
  modelDisplayNames: Record<string, string>;
  preCheckResults: Record<string, PreCheckResult | Error>;
  findings: Finding[];
  /** null on the first save of this session; the previously-saved/loaded value on every subsequent save - see the createdAt/modifiedAt rule in bwrev.ts's own doc comment. */
  existingCreatedAt: number | null;
  reviewStatus: "in-progress" | "closed";
  reviewedBy?: string;
  notes?: string;
}

/**
 * Builds a BwrevFile from the current review session. SHA-256 hashes are
 * computed here, from ModelBytesRegistry's retained import bytes - the
 * live viewer's own technicalModelId is @thatopen/fragments' internal
 * ID, unrelated to file content (see bwrev.ts type's own doc comment in
 * oguc-core), so it cannot serve as the "same file content" check a
 * later load needs.
 */
export async function buildBwrevFile(input: BuildBwrevInput): Promise<BwrevFile> {
  const now = Date.now();

  const modelsReviewed: BwrevModelRef[] = await Promise.all(
    Object.entries(input.modelDisplayNames).map(async ([modelId, name]) => {
      const bytes = getModelBytes(modelId);
      const sha256 = bytes ? await calculateSHA256(bytes) : "";
      return { name, sha256 };
    })
  );

  const acknowledgedWarnings = Object.values(input.preCheckResults).flatMap((result) =>
    result instanceof Error ? [] : result.warnings.map((w) => w.id)
  );

  const preCheckResults: BwrevPreCheckResults = {
    blocking: Object.values(input.preCheckResults).flatMap((r) => (r instanceof Error ? [] : r.blocking)),
    warnings: Object.values(input.preCheckResults).flatMap((r) => (r instanceof Error ? [] : r.warnings)),
    info: Object.values(input.preCheckResults).flatMap((r) => (r instanceof Error ? [] : r.info)),
    acknowledgedWarnings,
  };

  return {
    version: BWREV_VERSION,
    createdAt: input.existingCreatedAt ?? now,
    modifiedAt: now,
    modelsReviewed,
    preCheckResults,
    findings: input.findings,
    reviewStatus: input.reviewStatus,
    reviewedBy: input.reviewedBy,
    notes: input.notes,
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** YYYYMMDD_HHmm, local time - matches this task's exact filename example (bwrev_CASA-ARQ_20260806_1432.bwrev). */
function formatTimestampForFilename(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}${m}${d}_${hh}${mm}`;
}

/** Strips a trailing .ifc/.ifczip extension and any character a filesystem would choke on - never throws, falls back to "modelo_sin_nombre" per this task's explicit ask. */
export function sanitizeModelNameForFilename(modelName: string | undefined): string {
  if (!modelName) return "modelo_sin_nombre";
  const withoutExtension = modelName.replace(/\.(ifc|ifczip)$/i, "");
  const safe = withoutExtension.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe.length > 0 ? safe : "modelo_sin_nombre";
}

/** Blob + URL.createObjectURL + a throwaway <a> click - the standard client-side "download this generated content" trick, no server round-trip. */
export function downloadBwrevFile(file: BwrevFile, modelName: string | undefined): string {
  const safeModelName = sanitizeModelNameForFilename(modelName);
  const filename = `bwrev_${safeModelName}_${formatTimestampForFilename(new Date())}.bwrev`;

  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return filename;
}

export type ParseBwrevResult = { ok: true; file: BwrevFile } | { ok: false; error: string };

/**
 * Never throws - invalid JSON and a structurally-wrong-but-valid-JSON
 * file both come back as { ok: false, error } for the caller to show as
 * a toast, per this task's explicit defensive-programming constraint.
 */
export function parseBwrevFile(raw: string): ParseBwrevResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El archivo no es JSON válido." };
  }

  if (!isValidBwrevFile(parsed)) {
    return { ok: false, error: "El archivo no tiene la estructura esperada de un .bwrev (faltan campos requeridos)." };
  }

  if (parsed.version !== BWREV_VERSION) {
    // Graceful degradation per this task's own ask: warn via the error
    // channel is too strong for "different but structurally valid"
    // version - accepted anyway (isValidBwrevFile already only checks
    // version is a string, not equality), this branch exists so a
    // future v2.0 reader could special-case migration here without
    // touching isValidBwrevFile's structural check.
    console.warn(`.bwrev version "${parsed.version}" does not match the version this app writes ("${BWREV_VERSION}") - loading anyway.`);
  }

  return { ok: true, file: parsed };
}

/**
 * True if NONE of the .bwrev's recorded model hashes match any currently
 * loaded model's hash - a mismatch dialog (Part 3) should only interrupt
 * the user when there's a REAL discrepancy, not on every load of a file
 * that happens to reference one model out of several currently loaded.
 */
export async function bwrevModelsMismatchCurrentlyLoaded(
  file: BwrevFile,
  currentModelBytesByModelId: Record<string, Uint8Array>
): Promise<boolean> {
  if (file.modelsReviewed.length === 0) return false;

  const currentHashes = await Promise.all(Object.values(currentModelBytesByModelId).map((bytes) => calculateSHA256(bytes)));
  const currentHashSet = new Set(currentHashes);

  return !file.modelsReviewed.some((ref) => currentHashSet.has(ref.sha256));
}
