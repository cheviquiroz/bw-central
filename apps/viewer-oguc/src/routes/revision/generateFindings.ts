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
// finding - "flag if unclassified or mismatched" per this task's Part 1.
// "requires-manual-tier" (fixed seats / continuous bench rows Art. 4.2.4
// explicitly leaves to a human) is downgraded to "info", since it isn't
// a data problem, just an OGUC category this engine correctly refuses to
// guess at - see calculateOccupancyLoad.ts's own ManualOccupancyOverride
// doc comment.
function occupancyFindings(doc: IfcHeadlessDocument, modelId: string): Finding[] {
  const result = calculateOccupancyLoad(doc);
  const findings: Finding[] = [];

  for (const space of result.spaces) {
    if (space.status === "calculated") continue;

    const severity = space.status === "requires-manual-tier" ? "info" : "warning";
    const reasonByStatus: Record<string, string> = {
      unmatched: "No se pudo hacer coincidir el nombre/tipo del recinto con ninguna categoría de destino OGUC.",
      "no-area": "No se encontró un área declarada (NetFloorArea/GrossFloorArea) para este recinto.",
      "unit-not-resolvable": "El área está declarada, pero su unidad no se pudo resolver a metros cuadrados.",
      "requires-manual-tier": "Este destino requiere un dato manual (asientos fijos, largo de aposentaduría corrida) que este motor no calcula.",
    };

    findings.push({
      id: `occupancy:${modelId}:${space.spaceExpressId}`,
      ruleId: "occupancy",
      severity,
      title: "Espacio sin clasificación OGUC",
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

// Art. 4.2.10: the real engine evaluates STAIR ADEQUACY FOR THE WHOLE
// BUILDING (storeyCount + total occupancyLoad + confirmedStairCount ->
// one verdict), not per-storey-pair - there is no "does storey 3->4
// specifically have compliant stairs" function anywhere in oguc-core,
// and fabricating a per-transition breakdown the underlying engine
// doesn't compute would be exactly the kind of invented-confidence this
// package's entire design discipline exists to avoid (see this
// function's own storeyCount input: an approximation, documented as
// such below). This produces exactly ONE building-level finding, not
// one per storey pair, adapting the brief's Part 1 wording to what the
// engine actually evaluates.
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
