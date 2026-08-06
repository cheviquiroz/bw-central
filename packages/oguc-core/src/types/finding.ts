// A single compliance-review finding, surfaced in /revision's Review
// Space (viewer-oguc). Domain-shaped so it can be generated purely from
// oguc-core's own evaluation results (calculateOccupancyLoad,
// evaluateStairCompliance) - the VIEWER app (apps/viewer-oguc) owns the
// actual generateFindings() orchestration that maps those results into
// this shape, since it needs modelId (a federation concept oguc-core has
// no business knowing about) and, at click time, live 3D geometry for
// camera framing - see generateFindings.ts and FindingsTable.tsx.
//
// This file only defines the shape both sides agree on, per this task's
// explicit ask - no generation logic lives here.

export type FindingRuleId = "occupancy" | "stairs";
export type FindingSeverity = "error" | "warning" | "info";
export type FindingState = "pending" | "accepted" | "rejected";

export interface FindingBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Finding {
  /** Stable across sessions - derived deterministically from ruleId+elementId+modelId (see generateFindings.ts), not random, so re-running the same rule against the same model produces the same IDs (a real requirement once .bwrev save/load exists - Paso 4). */
  id: string;
  ruleId: FindingRuleId;
  severity: FindingSeverity;
  /** Spanish (Chile), e.g. "Espacio sin clasificación OGUC". */
  title: string;
  /** Spanish (Chile), the specific detail of this finding. */
  description: string;
  /** IfcSpace/IfcStair local ID (same numbering as the live 3D model's selection API) this finding is about. 0 for a building-level finding with no single element to point at (see the Art. 4.2.10 note in generateFindings.ts). */
  elementId: number;
  elementName?: string;
  /** Which model in the federation this finding's element belongs to. */
  modelId: string;
  /** Populated only when the source data already had it (e.g. ifc-headless's IfcStair.boundingBox) - camera framing does NOT depend on this being set; it re-derives the box live from the loaded 3D model instead (see FindingsTable's onSelectFinding wiring), since ifc-headless does not compute a boundingBox for IfcSpace at all. */
  boundingBox?: FindingBoundingBox;
  state: FindingState;
  timestamp?: number;
  userNote?: string;
}
