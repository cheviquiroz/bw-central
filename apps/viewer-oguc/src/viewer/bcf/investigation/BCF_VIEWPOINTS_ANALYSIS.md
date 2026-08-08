# BCF_VIEWPOINTS_ANALYSIS.md — how BCF viewpoints/pins render today

Investigation only, no code changes. Path correction first: `src/viewer/bcf/BcfPinRenderer.tsx` doesn't exist — the real file is `src/viewer/bcf/BcfPinRenderer.ts` (no JSX, plain Three.js).

## Where pins are computed

`BcfPinRenderer.createPin()` (the only place a pin's 3D position is computed):
```ts
const { position, direction } = topic.viewpoint.camera;
mesh.position.set(
  position.x + direction.x * PIN_VIEW_DISTANCE,
  position.y + direction.y * PIN_VIEW_DISTANCE,
  position.z + direction.z * PIN_VIEW_DISTANCE,
);
```
`PIN_VIEW_DISTANCE = 10`. This projects a point 10 units along the camera's viewing direction from where the camera stood — a deliberate, documented approximation (BCF's spec stores where the reviewer's camera was, not the flagged element's real coordinates), **not** the bug. The comment above it in the real file explains this reasoning clearly and correctly.

## `TopicPinWorldCoordinates` — does not exist

Grepped the entire `apps/viewer-oguc/src` tree again for this exact task: zero matches, same finding as an earlier investigation this session. No function, variable, or type by that name exists anywhere in this codebase. Whatever bug this name refers to, it isn't a real identifier in this repo — flagging again so it isn't assumed to exist in any fix that follows this investigation.

## Coordinate system used — the actual finding

`position.x/y/z` and `direction.x/y/z` from `BcfViewpoint.camera` are used **verbatim** as Three.js `mesh.position.x/y/z` — no transform, no axis remap, nothing. Same is true in `Viewport.tsx`'s camera-sync effect (`cameraControls.setLookAt(position.x, position.y, position.z, ...)`, also verbatim).

This matters because of a real, verified mismatch:
- **BCF's coordinate convention** (`CameraViewPoint`/`CameraDirection`/`CameraUpVector` in the raw `.bcfv` XML, per the BCF spec) is the IFC project's own coordinate system — IFC is **Z-up**.
- **This app's Three.js scene is Y-up** — confirmed directly in `src/core/IfcBootstrap.ts:324`: `const worldUp = new THREE.Vector3(0, 1, 0);`. Every loaded model already renders correctly oriented (walls vertical, roofs up, ground flat — visible in every screenshot taken across this whole session), which means the `@thatopen/components` fragments loader is **already converting IFC's native Z-up geometry into this app's Y-up scene internally**, transparently, before any of this app's own code ever sees it.
- Grepped for any equivalent axis-swap applied to BCF data specifically (`swapYZ`, `Y-up`, `Z-up`, `axis swap`, rotation matrices near BCF code): **none exists anywhere.** The only rotation-matrix code in the entire app (`IfcBootstrap.ts:322-344`) is unrelated — it orients the section-box clipping-plane helper, not BCF geometry or cameras.

**Conclusion for this section:** the model's geometry gets the Z-up→Y-up conversion (inside the loader, outside this app's own code); BCF viewpoint camera/pin coordinates do not go through any equivalent conversion anywhere in this app's own code before being used. That asymmetry is the real, concrete candidate root cause — detailed with live evidence in `BCF_VIEWPOINTS_BUG.md`.
