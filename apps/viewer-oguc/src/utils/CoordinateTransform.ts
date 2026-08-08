// src/utils/CoordinateTransform.ts
//
// BCF viewpoints store camera position/direction/up in the IFC project's
// own coordinate system, which is Z-up (confirmed directly against a real
// fixture's raw XML during the investigation that preceded this file -
// packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf's
// <CameraUpVector><Z>1.000</Z></CameraUpVector>). This app's Three.js
// scene is Y-up (src/core/IfcBootstrap.ts:324, `new THREE.Vector3(0, 1,
// 0)` as worldUp) - loaded IFC geometry already renders correctly
// oriented, meaning @thatopen/components' fragments loader silently
// converts Z-up geometry to Y-up internally, before this app's own code
// ever sees it. Nothing did the equivalent conversion for BCF camera/pin
// coordinates - that asymmetry was the root cause diagnosed in
// src/viewer/bcf/investigation/BCF_VIEWPOINTS_BUG.md: a BCF-driven camera
// jump landed pressed against the ground plane instead of at its
// intended height.
//
// The mapping used here (x stays x; the source's up-axis Z becomes
// Three.js's up-axis Y; Three.js's remaining axis becomes -Z) is the
// standard IFC/BCF-Z-up-to-Three.js-Y-up convention used broadly across
// web IFC viewers - a pure rotation (no translation), which is why it
// composes back to the identity exactly (see verifySymmetry below and
// CoordinateTransform.spec.ts). This was NOT independently confirmed
// against @thatopen/components' own internal transform matrix (out of
// reach for this investigation - it's applied deep inside a third-party
// loader, not exposed as a public API this app's code calls into) - it
// is the standard convention, empirically checked against real BCF data
// in this task's own browser verification (see commit message), but
// flagged here in case a future IFC file with a non-trivial site-origin
// offset or non-standard authoring tool ever shows a discrepancy this
// pure-rotation model doesn't account for.
import * as THREE from "three";
import type { BcfViewpoint, BcfVector3 } from "../viewer/bcf/types/bcf";

export class CoordinateTransform {
  /** BCF (Z-up) -> Three.js (Y-up). A pure rotation, no translation - correct for both position (point) and direction/up (free) vectors. */
  static bcfToThreeJS(v: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(v.x, v.z, -v.y);
  }

  /** Three.js (Y-up) -> BCF (Z-up). Exact inverse of bcfToThreeJS - BcfExporter will use this for symmetric export, so a round-tripped (import, no edits, export) BCF file's viewpoint numbers stay numerically identical to the original. */
  static threeJSToBcf(v: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(v.x, -v.z, v.y);
  }

  /** Convenience wrapper for BCF's own plain {x,y,z} shape (BcfVector3 - deliberately not a THREE.Vector3, keeping src/viewer/bcf/types/bcf.ts framework-agnostic, same as every other field on that type). */
  static transformBcfVector(v: BcfVector3): BcfVector3 {
    const transformed = this.bcfToThreeJS(new THREE.Vector3(v.x, v.y, v.z));
    return { x: transformed.x, y: transformed.y, z: transformed.z };
  }

  /**
   * Transforms every coordinate on a BcfViewpoint (camera position/
   * direction/up, and the clipping plane's location/direction, if
   * present) from BCF's Z-up space into this app's Y-up Three.js space.
   * Clipping planes are transformed too, not just the camera - left
   * un-transformed, importing a BCF section box would reintroduce the
   * exact same class of bug this file exists to fix, just for a
   * different feature.
   */
  static transformBcfViewpoint(viewpoint: BcfViewpoint): BcfViewpoint {
    return {
      ...viewpoint,
      camera: {
        position: this.transformBcfVector(viewpoint.camera.position),
        direction: this.transformBcfVector(viewpoint.camera.direction),
        up: this.transformBcfVector(viewpoint.camera.up),
      },
      clippingPlane: viewpoint.clippingPlane
        ? {
            location: this.transformBcfVector(viewpoint.clippingPlane.location),
            direction: this.transformBcfVector(viewpoint.clippingPlane.direction),
          }
        : undefined,
    };
  }

  /** Inverse of transformBcfVector - Three.js (Y-up) plain {x,y,z} -> BCF (Z-up) plain {x,y,z}. Same threeJSToBcf math, exposed the same way transformBcfVector exposes bcfToThreeJS, for BcfExporter.ts's call sites to use directly instead of constructing a THREE.Vector3 by hand at every field. */
  static transformThreeVector(v: BcfVector3): BcfVector3 {
    const transformed = this.threeJSToBcf(new THREE.Vector3(v.x, v.y, v.z));
    return { x: transformed.x, y: transformed.y, z: transformed.z };
  }

  /**
   * Inverse of transformBcfViewpoint - transforms every coordinate on a
   * BcfViewpoint (camera position/direction/up, and the clipping plane's
   * location/direction, if present) from this app's Three.js Y-up space
   * back into BCF's Z-up space, for export. BcfExporter.ts's adaptViewpoint
   * uses this so a round-tripped (import, no edits, export) BCF file's
   * viewpoint numbers stay numerically identical to the original.
   */
  static transformThreeViewpoint(viewpoint: BcfViewpoint): BcfViewpoint {
    return {
      ...viewpoint,
      camera: {
        position: this.transformThreeVector(viewpoint.camera.position),
        direction: this.transformThreeVector(viewpoint.camera.direction),
        up: this.transformThreeVector(viewpoint.camera.up),
      },
      clippingPlane: viewpoint.clippingPlane
        ? {
            location: this.transformThreeVector(viewpoint.clippingPlane.location),
            direction: this.transformThreeVector(viewpoint.clippingPlane.direction),
          }
        : undefined,
    };
  }

  /**
   * Verify that bcfToThreeJS and threeJSToBcf are mathematical inverses.
   * Exercised for real in CoordinateTransform.spec.ts, not just left as
   * an unused helper - when BcfExporter is implemented, its own tests
   * should call this too, to verify round-trip integrity for the export
   * path specifically, not only re-check the same forward transform.
   */
  static verifySymmetry(testVector: THREE.Vector3): boolean {
    const forward = this.bcfToThreeJS(testVector);
    const back = this.threeJSToBcf(forward);
    return back.distanceTo(testVector) < 0.0001;
  }
}
