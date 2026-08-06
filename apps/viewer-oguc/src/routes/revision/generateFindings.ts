// src/routes/revision/generateFindings.ts
//
// Maps oguc-core's two compliance engines (calculateOccupancyLoad,
// evaluateStairCompliance) into Finding[] for FindingsTable.tsx. This
// orchestration lives in viewer-oguc, not oguc-core: Finding needs
// modelId (a federation concept oguc-core has no business knowing about)
// and elementName, both resolved from data already on hand in the
// IfcHeadlessDocument re-parsed for the Pre-Check gate (see
// RevisionLayout.tsx) - no new parsing, no live 3D queries at generation
// time. Camera framing at CLICK time (FindingsTable's onSelectFinding)
// is a separate concern, wired in RevisionLayout.tsx via
// SearchManager.selectAndFocus, which already re-derives an element's
// bounding box from the LIVE 3D model - this function never needs to.
import type { IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { approximateStoreyCount, calculateOccupancyLoad, determineStairRequirement, evaluateStairCompliance } from "@bw-central/oguc-core";
import type { Finding } from "@bw-central/oguc-core";

// Art. 4.2.4: any space whose occupancy status isn't "calculated" is a
// finding. The brief asks for "error (unclassified) | warning
// (mismatch)" - only the first half maps onto real data: "unmatched"
// (matchDestino found no destino category at all for this space's
// name/type) IS unclassified, so it's "error". There is no "mismatch"
// check anywhere in this engine to reuse for the second half: IFC does
// not carry a separate "declared OGUC destino" field to compare a
// calculated one against, and matchDestino only ever produces "what
// destino this space's data suggests," not "does that contradict a
// human-declared one" - inventing that comparison would mean fabricating
// data the file doesn't have. "no-area"/"unit-not-resolvable" (data
// present but unusable) are the closest real equivalent to "a problem
// short of full unclassification" and get "warning". "requires-manual-
// tier" (fixed seats / continuous bench rows Art. 4.2.4 explicitly
// leaves to a human) stays "info" - not a data problem, just an OGUC
// category this engine correctly refuses to guess at - see
// calculateOccupancyLoad.ts's own ManualOccupancyOverride doc comment.
function occupancyFindings(doc: IfcHeadlessDocument, modelId: string): Finding[] {
  const result = calculateOccupancyLoad(doc);
  const findings: Finding[] = [];

  const severityByStatus: Record<string, Finding["severity"]> = {
    unmatched: "error",
    "no-area": "warning",
    "unit-not-resolvable": "warning",
    "requires-manual-tier": "info",
  };
  const reasonByStatus: Record<string, string> = {
    unmatched: "No se pudo hacer coincidir el nombre/tipo del recinto con ninguna categoría de destino OGUC.",
    "no-area": "No se encontró un área declarada (NetFloorArea/GrossFloorArea) para este recinto.",
    "unit-not-resolvable": "El área está declarada, pero su unidad no se pudo resolver a metros cuadrados.",
    "requires-manual-tier": "Este destino requiere un dato manual (asientos fijos, largo de aposentaduría corrida) que este motor no calcula.",
  };

  for (const space of result.spaces) {
    if (space.status === "calculated") continue;

    findings.push({
      id: `occupancy:${modelId}:${space.spaceExpressId}`,
      ruleId: "occupancy",
      severity: severityByStatus[space.status] ?? "warning",
      title: space.status === "unmatched" ? "Espacio sin clasificación OGUC" : "Espacio con clasificación OGUC incompleta",
      description: reasonByStatus[space.status] ?? `Estado: ${space.status}.`,
      elementId: space.spaceExpressId,
      elementName: space.spaceName ?? space.spaceLongName ?? undefined,
      modelId,
      state: "pending",
      timestamp: Date.now(),
    });
  }

  return findings;
}

// Art. 4.2.10: reaffirmed in this task's revised brief, but still not
// possible against the real engine - evaluateStairCompliance takes
// storeyCount + a single building-wide occupancyLoad + confirmedStairCount
// and returns ONE verdict. There is no per-storey IfcRelContainedInSpatialStructure
// occupancy breakdown ifc-headless exposes ("this storey's occupancy load"
// specifically, as opposed to the building's total) and no "does storey
// n->n+1 have its own compliant stair width" function anywhere in
// oguc-core to call per transition. Synthesizing per-storey-pair
// verdicts by, say, dividing total occupancy evenly across storeys or
// guessing which stairs serve which transition would be exactly the
// invented-confidence this package's whole design discipline exists to
// avoid (its own storeyCount input here is already an approximation,
// documented at its definition). This produces exactly ONE
// building-level finding instead of one per storey pair - a deliberate,
// repeated adaptation of the brief to what the engine actually
// evaluates, not an oversight.
function stairFindings(doc: IfcHeadlessDocument, modelId: string): Finding[] {
  const storeyCount = approximateStoreyCount(doc);
  const occupancy = calculateOccupancyLoad(doc);
  const requirement = determineStairRequirement({ storeyCount });

  const compliance = evaluateStairCompliance({
    storeyCount,
    occupancyLoad: occupancy.totalOcupantes,
    confirmedStairCount: doc.stairs.length,
  });

  const severityByVerdict: Record<string, Finding["severity"]> = {
    PASS: "info",
    NOT_REQUIRED: "info",
    FAIL: "error",
    EXCEEDS_TABLE: "warning",
    INCOMPLETE_DATA: "warning",
  };

  // Sin un stair individual "responsable" del veredicto (es un chequeo a
  // nivel edificio) - se apunta al primer IfcStair detectado, si hay
  // alguno, solo para que el click en la tabla tenga algo real a qué
  // saltar en el 3D; 0 (sin salto posible, ver FindingsTable.tsx) si el
  // edificio no tiene ningún IfcStair.
  const firstStair = doc.stairs[0];

  return [
    {
      id: `stairs:${modelId}:building`,
      ruleId: "stairs",
      severity: severityByVerdict[compliance.verdict] ?? "warning",
      title: `Escaleras de evacuación (Art. 4.2.10): ${compliance.verdict}`,
      description: `${compliance.message} (${requirement.reason})`,
      elementId: firstStair?.expressId ?? 0,
      elementName: firstStair?.name ?? undefined,
      modelId,
      state: "pending",
      timestamp: Date.now(),
    },
  ];
}

export function generateFindings(doc: IfcHeadlessDocument, modelId: string): Finding[] {
  return [...occupancyFindings(doc, modelId), ...stairFindings(doc, modelId)];
}
