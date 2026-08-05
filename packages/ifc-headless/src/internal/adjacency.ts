// Two spaces are adjacent when they share a bounding element (typically
// a wall). This runs uniformly over whichever boundary source produced
// each space's boundingElements - authoritative (IfcRelSpaceBoundary) or
// inferred (geometric derivation) - inheriting that element's method and
// confidence for the adjacency itself, since the adjacency is only as
// trustworthy as the boundary relationship it was derived from.

import type { AdjacentSpaceRef, BoundingElementRef } from "../types.js";

export function resolveAdjacentSpaces(boundingElementsBySpace: Map<number, BoundingElementRef[]>): Map<number, AdjacentSpaceRef[]> {
  const spacesByElement = new Map<number, { spaceId: number; ref: BoundingElementRef }[]>();

  for (const [spaceId, refs] of boundingElementsBySpace) {
    for (const ref of refs) {
      const existing = spacesByElement.get(ref.expressId) ?? [];
      existing.push({ spaceId, ref });
      spacesByElement.set(ref.expressId, existing);
    }
  }

  const result = new Map<number, AdjacentSpaceRef[]>();
  for (const spaceId of boundingElementsBySpace.keys()) result.set(spaceId, []);

  for (const entries of spacesByElement.values()) {
    if (entries.length < 2) continue; // el elemento solo linda con un espacio conocido - nada que adjuntar

    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries.length; j++) {
        if (i === j) continue;
        const a = entries[i];
        const b = entries[j];
        const list = result.get(a.spaceId) ?? [];
        list.push({
          expressId: b.spaceId,
          globalId: null, // se completa en reader.ts, que ya tiene el GlobalId de cada space a mano
          method: b.ref.method,
          confidence: b.ref.confidence,
          viaElementExpressId: b.ref.expressId,
        });
        result.set(a.spaceId, list);
      }
    }
  }

  return result;
}
