// .bwrev file format: a JSON snapshot of a /revision review session
// (viewer-oguc), portable across sessions/machines - close the browser,
// reopen later, load the same .bwrev, resume exactly where the review
// left off. Deliberately plain JSON (not binary): human-readable,
// diffable in git, inspectable without special tooling.
//
// Type only, same discipline as finding.ts - no save/load/serialization
// logic lives in oguc-core. That orchestration needs browser APIs (Blob,
// File, URL.createObjectURL) this domain package has no business
// depending on - see apps/viewer-oguc/src/routes/revision/bwrev.ts.
import type { Finding } from "./finding.js";
import type { PreCheckIssue } from "../precheck.js";

export const BWREV_VERSION = "1.0" as const;

export interface BwrevModelRef {
  name: string;
  /**
   * SHA-256 of the model's raw imported bytes. NOT the same as the live
   * viewer's technicalModelId (that's @thatopen/fragments' own internal
   * model identifier, unrelated to file content) - computed separately
   * at save time from the retained import bytes (see
   * apps/viewer-oguc/src/core/ModelBytesRegistry.ts), specifically so a
   * later load can tell "same file content" from "different file,
   * coincidentally same name" without trusting either the filename or
   * the live session's own internal IDs, which are not stable across
   * page reloads.
   */
  sha256: string;
}

export interface BwrevPreCheckResults {
  blocking: PreCheckIssue[];
  warnings: PreCheckIssue[];
  info: PreCheckIssue[];
  /** IDs of PreCheckIssue.id the user checked off in PreCheckGate before continuing - by construction, every warning must be acknowledged to pass Pre-Check (see PreCheckGate.tsx), so this is always ALL warning ids at save time. Recorded anyway rather than re-derived, so a future v2.0 that allows partial acknowledgment doesn't silently misrepresent old files. */
  acknowledgedWarnings: string[];
}

export interface BwrevFile {
  version: typeof BWREV_VERSION;
  /** Date.now() when this review was first saved - immutable across subsequent saves of the same session. */
  createdAt: number;
  /** Date.now() on every save, including the first (equal to createdAt then). */
  modifiedAt: number;
  modelsReviewed: BwrevModelRef[];
  preCheckResults: BwrevPreCheckResults;
  /** Exact Finding[] from the review session, ids intact - a later load restores state/userNote by matching on Finding.id, which is why generateFindings.ts derives ids deterministically (ruleId+modelId+elementId) rather than randomly. */
  findings: Finding[];
  reviewStatus: "in-progress" | "closed";
  reviewedBy?: string;
  notes?: string;
}

function isPreCheckIssueArray(value: unknown): value is PreCheckIssue[] {
  return Array.isArray(value) && value.every((v) => v && typeof v === "object" && typeof (v as PreCheckIssue).id === "string");
}

function isBwrevPreCheckResults(value: unknown): value is BwrevPreCheckResults {
  if (typeof value !== "object" || value === null) return false;
  const v = value as BwrevPreCheckResults;
  return (
    isPreCheckIssueArray(v.blocking) &&
    isPreCheckIssueArray(v.warnings) &&
    isPreCheckIssueArray(v.info) &&
    Array.isArray(v.acknowledgedWarnings) &&
    v.acknowledgedWarnings.every((id) => typeof id === "string")
  );
}

function isBwrevModelRef(value: unknown): value is BwrevModelRef {
  if (typeof value !== "object" || value === null) return false;
  const v = value as BwrevModelRef;
  return typeof v.name === "string" && typeof v.sha256 === "string";
}

/**
 * Structural validation only - never throws, always returns a boolean so
 * the caller (bwrev.ts's parse function) can show a clean error toast
 * instead of an unhandled exception on a malformed/hand-edited file.
 * version is checked for PRESENCE and type here, not equality to
 * BWREV_VERSION - a future v2.0 file should be recognized as
 * "structurally a bwrev file", with version-specific handling (or a
 * clean "unsupported version" message) left to the caller, not rejected
 * outright at this layer.
 */
export function isValidBwrevFile(value: unknown): value is BwrevFile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as BwrevFile;
  return (
    typeof v.version === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.modifiedAt === "number" &&
    Array.isArray(v.modelsReviewed) &&
    v.modelsReviewed.every(isBwrevModelRef) &&
    isBwrevPreCheckResults(v.preCheckResults) &&
    Array.isArray(v.findings) &&
    (v.reviewStatus === "in-progress" || v.reviewStatus === "closed")
  );
}
