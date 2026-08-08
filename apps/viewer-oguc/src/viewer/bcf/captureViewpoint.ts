// src/viewer/bcf/captureViewpoint.ts
//
// Reads the live Three.js camera and builds a BcfViewpoint from it - the
// read-side counterpart to Viewport.tsx's existing write-side
// bcfSyncRequest effect (BCF viewpoint -> camera). No such read path
// existed anywhere in this app before this file (confirmed by grepping
// for getCurrentViewpoint/captureViewpoint/cameraToViewpoint during the
// investigation that preceded this task - zero matches).
//
// Deliberately a standalone function, not a BcfManager method (an
// earlier brief for this task sketched it that way) - BcfManager has
// zero Three.js/viewer coupling today (it doesn't import "three", isn't
// constructed with viewerHandles, and every existing method - setFilter,
// setActiveTopic - is pure data manipulation). Giving it a suddenly-new
// dependency on the live 3D engine, just for this one method, would be a
// real architectural regression, not a natural extension - BcfPinRenderer.ts
// already establishes the actual, existing precedent for "BCF code that
// needs Three.js lives in src/viewer/bcf/, as its own file", so this
// follows that instead.
//
// CRITICAL (per this task's own Part 9): does NOT apply
// CoordinateTransform here. The returned BcfViewpoint is stored in this
// app's Three.js Y-up space, same as every other BcfViewpoint already
// flowing through BcfManager/BcfPinRenderer/BcfDetailPanel -
// BcfExporter.adaptViewpoint() (Punto 1c) is the ONE place the Y-up ->
// Z-up conversion happens, for every viewpoint regardless of whether it
// was imported or captured live. Applying it here too would double-convert.
import * as THREE from "three";
import type { IfcViewerHandles } from "../../core/IfcBootstrap";
import type { BcfViewpoint } from "./types/bcf";

export function captureCurrentViewpoint(viewerHandles: IfcViewerHandles): BcfViewpoint {
  const camera = viewerHandles.world.camera.three;
  const direction = camera.getWorldDirection(new THREE.Vector3());

  return {
    guid: crypto.randomUUID(),
    camera: {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
    },
  };
}
