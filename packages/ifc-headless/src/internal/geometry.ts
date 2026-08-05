// Reads world-space axis-aligned bounding boxes for IFC elements via raw
// web-ifc geometry (GetFlatMesh + vertex data + the flat transformation
// matrix it returns already applied) - not for rendering, only to
// support the geometric boundary derivation in geometricBoundaries.ts.
// This never produces meshes or anything consumed for display; it
// discards vertex/normal data immediately after reducing it to an AABB.
//
// flatTransformation is a column-major 4x4 matrix, the same convention
// every web-ifc/IFC.js-based Three.js viewer relies on
// (THREE.Matrix4.fromArray expects exactly this layout) - confirmed
// against this reader's own real fixtures before writing this module,
// not assumed from documentation alone (web-ifc's own .d.ts does not
// spell out the layout).

import type { IfcApi } from "./webifc.js";

export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

function transformPoint(m: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** World-space AABB of an element's geometry, or null if it has no representation (some elements legitimately don't - e.g. a space stub with no solid, an element authored without geometry). */
export function worldAabb(api: IfcApi, modelID: number, expressId: number): Aabb | null {
  let flatMesh;
  try {
    flatMesh = api.GetFlatMesh(modelID, expressId);
  } catch {
    return null;
  }
  if (!flatMesh || flatMesh.geometries.size() === 0) return null;

  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let sawAny = false;

  for (let i = 0; i < flatMesh.geometries.size(); i++) {
    const placedGeom = flatMesh.geometries.get(i);
    const geom = api.GetGeometry(modelID, placedGeom.geometryExpressID);
    const vertexData = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const m = placedGeom.flatTransformation;

    for (let v = 0; v < vertexData.length; v += 6) {
      const [wx, wy, wz] = transformPoint(m, vertexData[v], vertexData[v + 1], vertexData[v + 2]);
      sawAny = true;
      if (wx < min[0]) min[0] = wx;
      if (wy < min[1]) min[1] = wy;
      if (wz < min[2]) min[2] = wz;
      if (wx > max[0]) max[0] = wx;
      if (wy > max[1]) max[1] = wy;
      if (wz > max[2]) max[2] = wz;
    }
  }

  return sawAny ? { min, max } : null;
}

/** Whether `box` intersects `space` expanded by `tolerance` on every axis. */
export function intersectsExpanded(space: Aabb, box: Aabb, tolerance: number): boolean {
  for (let axis = 0; axis < 3; axis++) {
    const spaceMin = space.min[axis] - tolerance;
    const spaceMax = space.max[axis] + tolerance;
    if (box.max[axis] < spaceMin || box.min[axis] > spaceMax) return false;
  }
  return true;
}

/** Whether `box` intersects `space` with no tolerance - real geometric overlap, used to distinguish "high" from "low" confidence in the inferred boundary derivation. */
export function intersects(space: Aabb, box: Aabb): boolean {
  return intersectsExpanded(space, box, 0);
}

/**
 * Unions real AABBs (e.g. an element's own geometry plus its decomposed
 * children's geometry, via IfcRelAggregates - see internal/stairs.ts,
 * where an IfcStair with no direct Representation of its own, common in
 * real ArchiCAD exports, is bounded by the union of its actual
 * IfcBuildingElementProxy children's real vertex data). Never an
 * estimate - every input box already came from worldAabb reading real
 * geometry of a real model element.
 */
export function unionAabb(boxes: Aabb[]): Aabb | null {
  if (boxes.length === 0) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const box of boxes) {
    for (let axis = 0; axis < 3; axis++) {
      if (box.min[axis] < min[axis]) min[axis] = box.min[axis];
      if (box.max[axis] > max[axis]) max[axis] = box.max[axis];
    }
  }
  return { min, max };
}
