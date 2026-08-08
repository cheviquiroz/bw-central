# BCF_COORDINATES_ANALYSIS.md — coordinate systems in play

Investigation only, no code changes.

## How viewpoint coordinates are stored

`BcfViewpoint.camera` (`src/viewer/bcf/types/bcf.ts`):
```ts
camera: {
  position: BcfVector3;   // { x, y, z }
  direction: BcfVector3;
  up: BcfVector3;
};
```
Plain `{x,y,z}` triples, populated directly from the raw `.bcfv` XML's `<CameraViewPoint>`/`<CameraDirection>`/`<CameraUpVector>` elements (via `bcf-core`'s parser, then `BcfImporter.adaptViewpoint`'s pass-through: `vp.camera.viewPoint` → `position`, etc. — no transform applied at this layer either).

**Real example, extracted from `packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf`'s raw XML:**
```xml
<PerspectiveCamera>
  <CameraViewPoint><X>12.450</X><Y>8.320</Y><Z>3.100</Z></CameraViewPoint>
  <CameraDirection><X>-0.707</X><Y>-0.707</Y><Z>0.000</Z></CameraDirection>
  <CameraUpVector><X>0.000</X><Y>0.000</Y><Z>1.000</Z></CameraUpVector>
</PerspectiveCamera>
```
Note `CameraUpVector = (0, 0, 1)` — this alone is direct, explicit proof the source data's up axis is **Z**, per this specific fixture (and per the BCF spec's convention generally, since BCF viewpoints are defined in the IFC project's own coordinate system, which is always Z-up per the IFC spec).

## What space is this in — world (IFC-native) or local?

World, in the IFC project's own coordinate system — not relative to any model-local transform, and not screen space. `bcf-core`'s parser does no coordinate massaging (confirmed via `BcfImporter.ts`'s own comment: "el parseo real... vive ahí ahora" — bcf-core owns parsing, not domain transforms). Nothing between the raw XML numbers and `BcfViewpoint.camera` changes their meaning.

## How does `camera.position` actually get set in Three.js?

Two call sites, both read `position.x/y/z` **verbatim** as Three.js `x/y/z`:
1. `BcfPinRenderer.createPin()` — `mesh.position.set(position.x + ..., position.y + ..., position.z + ...)`.
2. `Viewport.tsx`'s `bcfSyncRequest` effect — `cameraControls.setLookAt(position.x, position.y, position.z, targetX, targetY, targetZ, true)`, where `cameraControls` is `@thatopen/components`' wrapper around the `camera-controls` library, itself a thin layer over a standard Three.js `PerspectiveCamera`.

Neither call site reads `camera.up` from the BCF data at all (`BcfViewpoint.camera.up` is parsed and stored but never consumed by either `BcfPinRenderer` or `Viewport.tsx` — confirmed by grep, `.up` only appears in the type definition and the adapter, never in a call site). This is a secondary, smaller gap: even if position/direction get corrected, the BCF-declared up vector is currently discarded entirely, meaning the camera's roll/orientation around its view direction is left to whatever `camera-controls`/`setLookAt` defaults to, not what the original BCF-authoring tool intended.

## Is there a coordinate transform step? What is it?

**No transform exists in this app's own code**, for either position or direction, anywhere in the BCF pipeline. The one transform that demonstrably *does* happen — geometry going from IFC's native Z-up into this app's Y-up Three.js scene — happens **inside `@thatopen/components`' fragments loader**, invisibly, before this app's code ever touches vertex data. Confirmed indirectly but strongly: `IfcBootstrap.ts:324` explicitly sets `worldUp = new THREE.Vector3(0, 1, 0)` (Y-up), and every loaded model in every screenshot this session renders with a correct, upright orientation — that correctness has to come from somewhere, and it isn't from any code in this app (grepped, no rotation/swap logic touches loaded model geometry anywhere in `apps/viewer-oguc/src`).

**The asymmetry, stated plainly:** geometry gets a Z-up→Y-up conversion (somewhere inside the loader dependency); BCF camera/pin coordinates get none (verified: zero transform code in this app touches them). Both are describing points in the *same* underlying IFC project coordinate system, so feeding one through a conversion and not the other is the structural mismatch this investigation set out to find.
