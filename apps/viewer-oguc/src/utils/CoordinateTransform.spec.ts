// src/utils/CoordinateTransform.spec.ts
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CoordinateTransform } from "./CoordinateTransform";

describe("CoordinateTransform", () => {
  it("maps BCF's Z-up up-vector (0,0,1) onto Three.js's Y-up up-vector (0,1,0)", () => {
    const bcfUp = new THREE.Vector3(0, 0, 1);
    const threeUp = CoordinateTransform.bcfToThreeJS(bcfUp);
    expect(threeUp.x).toBeCloseTo(0);
    expect(threeUp.y).toBeCloseTo(1);
    expect(threeUp.z).toBeCloseTo(0);
  });

  it("bcfToThreeJS and threeJSToBcf are exact inverses (round-trip identity)", () => {
    const vectors = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(12.45, 8.32, 3.1), // real fixture value, sample-2.1.bcf
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(5.5, -3.2, 100),
    ];
    for (const v of vectors) {
      expect(CoordinateTransform.verifySymmetry(v)).toBe(true);
    }
  });

  it("threeJSToBcf is the literal inverse of bcfToThreeJS, not just symmetric by coincidence", () => {
    const original = new THREE.Vector3(12.45, 8.32, 3.1);
    const roundTripped = CoordinateTransform.threeJSToBcf(CoordinateTransform.bcfToThreeJS(original));
    expect(roundTripped.x).toBeCloseTo(original.x);
    expect(roundTripped.y).toBeCloseTo(original.y);
    expect(roundTripped.z).toBeCloseTo(original.z);
  });

  it("transformBcfViewpoint transforms camera position/direction/up and leaves other fields untouched", () => {
    const viewpoint = {
      guid: "vp-1",
      camera: {
        position: { x: 12.45, y: 8.32, z: 3.1 },
        direction: { x: -0.707, y: -0.707, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      },
      snapshot: "data:image/png;base64,abc",
    };
    const transformed = CoordinateTransform.transformBcfViewpoint(viewpoint);

    expect(transformed.guid).toBe("vp-1");
    expect(transformed.snapshot).toBe("data:image/png;base64,abc");
    // BCF's Z-up up-vector (0,0,1) should land on Three.js's Y axis.
    // toBeCloseTo per-component, not toEqual: -0 vs +0 are mathematically
    // identical but not === under strict deep-equal, and this transform
    // legitimately produces -0 for some zero inputs (negating 0 in JS).
    expect(transformed.camera.up.x).toBeCloseTo(0);
    expect(transformed.camera.up.y).toBeCloseTo(1);
    expect(transformed.camera.up.z).toBeCloseTo(0);
    // position.z (BCF's height, 3.1) should land on Three.js's y (height)
    expect(transformed.camera.position.y).toBeCloseTo(3.1);
  });

  it("transformBcfViewpoint also transforms the clipping plane when present", () => {
    const viewpoint = {
      guid: "vp-2",
      camera: {
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: -1 },
        up: { x: 0, y: 0, z: 1 },
      },
      clippingPlane: {
        location: { x: 10, y: 5, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
      },
    };
    const transformed = CoordinateTransform.transformBcfViewpoint(viewpoint);
    expect(transformed.clippingPlane?.direction.x).toBeCloseTo(0);
    expect(transformed.clippingPlane?.direction.y).toBeCloseTo(1);
    expect(transformed.clippingPlane?.direction.z).toBeCloseTo(0);
  });

  it("transformBcfViewpoint omits clippingPlane when the source has none", () => {
    const viewpoint = {
      guid: "vp-3",
      camera: {
        position: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: -1 },
        up: { x: 0, y: 0, z: 1 },
      },
    };
    expect(CoordinateTransform.transformBcfViewpoint(viewpoint).clippingPlane).toBeUndefined();
  });
});
