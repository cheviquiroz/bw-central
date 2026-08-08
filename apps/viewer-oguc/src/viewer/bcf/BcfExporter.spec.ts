/// <reference types="node" />
// src/viewer/bcf/BcfExporter.spec.ts
//
// The acid test for the Y-up/Z-up round-trip: parse a real fixture with
// bcf-core directly (ground truth BCF-space numbers) -> import through
// BcfImporter (BCF Z-up -> Three.js Y-up) -> export through BcfExporter
// (Three.js Y-up -> BCF Z-up) -> parse the EXPORTED bytes with bcf-core
// again (ground truth BCF-space numbers, post-round-trip) -> compare.
// If BcfExporter didn't apply the inverse transform, this would fail
// loudly (numbers landing in the wrong axis, not just "slightly off").
import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { parseBcf } from "@bw-central/bcf-core";
import { BcfImporter } from "./BcfImporter";
import { BcfExporter } from "./BcfExporter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../../../../../packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf");
const TOLERANCE = 1e-5;

function closeTo(a: number, b: number) {
  return Math.abs(a - b) < TOLERANCE;
}

describe("BcfExporter - coordinate round-trip", () => {
  test("import -> export preserves BCF camera_view_point/direction/up_vector within 1e-5", async () => {
    const originalBytes = new Uint8Array(readFileSync(FIXTURE_PATH));

    // Ground truth: bcf-core's own raw parse, BCF (Z-up) space, before
    // this app's code touches anything.
    const originalProject = await parseBcf(originalBytes);
    const originalCamera = originalProject.topics[0].viewpoints[0].camera;
    expect(originalCamera).toBeDefined();

    // Real values from this fixture's raw XML (asserted directly too, so
    // a future fixture change can't silently make this test meaningless
    // by comparing two already-wrong numbers to each other).
    expect(originalCamera!.viewPoint.x).toBeCloseTo(12.45);
    expect(originalCamera!.viewPoint.y).toBeCloseTo(8.32);
    expect(originalCamera!.viewPoint.z).toBeCloseTo(3.1);
    expect(originalCamera!.upVector.z).toBeCloseTo(1); // BCF is Z-up

    // Full pipeline: BCF -> BcfImporter (bcfToThreeJS) -> BcfExporter
    // (threeJSToBcf) -> BCF again.
    const file = new File([originalBytes], "sample-2.1.bcf");
    const importedProject = await BcfImporter.parse(file);
    const exportedBlob = await BcfExporter.create(importedProject);
    const exportedBytes = new Uint8Array(await exportedBlob.arrayBuffer());

    // Re-parse the EXPORTED file with bcf-core directly - ground truth,
    // BCF (Z-up) space, post-round-trip.
    const roundTrippedProject = await parseBcf(exportedBytes);
    const roundTrippedCamera = roundTrippedProject.topics[0].viewpoints[0].camera;
    expect(roundTrippedCamera).toBeDefined();

    const originalVP = originalCamera!.viewPoint;
    const rtVP = roundTrippedCamera!.viewPoint;
    const originalDir = originalCamera!.direction;
    const rtDir = roundTrippedCamera!.direction;
    const originalUp = originalCamera!.upVector;
    const rtUp = roundTrippedCamera!.upVector;

    // eslint-disable-next-line no-console
    console.log("camera_view_point  original:", originalVP, " exported:", rtVP);
    // eslint-disable-next-line no-console
    console.log("camera_direction   original:", originalDir, " exported:", rtDir);
    // eslint-disable-next-line no-console
    console.log("camera_up_vector   original:", originalUp, " exported:", rtUp);

    expect(closeTo(originalVP.x, rtVP.x)).toBe(true);
    expect(closeTo(originalVP.y, rtVP.y)).toBe(true);
    expect(closeTo(originalVP.z, rtVP.z)).toBe(true);

    expect(closeTo(originalDir.x, rtDir.x)).toBe(true);
    expect(closeTo(originalDir.y, rtDir.y)).toBe(true);
    expect(closeTo(originalDir.z, rtDir.z)).toBe(true);

    expect(closeTo(originalUp.x, rtUp.x)).toBe(true);
    expect(closeTo(originalUp.y, rtUp.y)).toBe(true);
    expect(closeTo(originalUp.z, rtUp.z)).toBe(true);
  });

  test("import -> export preserves the clipping plane's location/direction within 1e-5", async () => {
    const originalBytes = new Uint8Array(readFileSync(FIXTURE_PATH));
    const originalProject = await parseBcf(originalBytes);
    const originalPlane = originalProject.topics[0].viewpoints[0].clippingPlanes[0];
    expect(originalPlane).toBeDefined();

    const file = new File([originalBytes], "sample-2.1.bcf");
    const importedProject = await BcfImporter.parse(file);
    const exportedBlob = await BcfExporter.create(importedProject);
    const exportedBytes = new Uint8Array(await exportedBlob.arrayBuffer());
    const roundTrippedProject = await parseBcf(exportedBytes);
    const rtPlane = roundTrippedProject.topics[0].viewpoints[0].clippingPlanes[0];
    expect(rtPlane).toBeDefined();

    expect(closeTo(originalPlane!.location.x, rtPlane!.location.x)).toBe(true);
    expect(closeTo(originalPlane!.location.y, rtPlane!.location.y)).toBe(true);
    expect(closeTo(originalPlane!.location.z, rtPlane!.location.z)).toBe(true);
    expect(closeTo(originalPlane!.direction.x, rtPlane!.direction.x)).toBe(true);
    expect(closeTo(originalPlane!.direction.y, rtPlane!.direction.y)).toBe(true);
    expect(closeTo(originalPlane!.direction.z, rtPlane!.direction.z)).toBe(true);
  });
});
