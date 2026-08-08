# BCF_CREATE_TECHNICAL_DESIGN.md — Part 3, Part 5

Investigation only, no code changes.

---

## Part 3: Viewpoint capture

**1. Camera access** — path: `apps/viewer-oguc/src/ui/Viewport/Viewport.tsx` (where the live viewer instance lives) and `apps/viewer-oguc/src/core/IfcBootstrap.ts` (where `world.camera` is set up). **Directly accessible: yes**, confirmed by three real, already-in-use call sites in this exact codebase (not a hypothetical API):
```ts
viewer.world.camera.three     // the raw THREE.PerspectiveCamera - already used in Viewport.tsx (SnapDetector, raycast) and IfcBootstrap.ts (near/far plane, updateProjectionMatrix)
viewer.world.camera.controls  // the camera-controls wrapper - already used for .setLookAt() in the existing BCF camera-jump effect
```
Reading position/direction/up is standard Three.js, all present on `world.camera.three`:
```ts
const camera = viewerHandles.world.camera.three; // THREE.PerspectiveCamera
const position = camera.position;                 // THREE.Vector3, direct property
const direction = camera.getWorldDirection(new THREE.Vector3()); // standard method, needs a target Vector3
const up = camera.up;                              // THREE.Vector3, direct property
```

**2. Existing viewpoint-creation code** — searched for `getCurrentViewpoint`/`captureViewpoint`/`cameraToViewpoint`: **zero matches anywhere in this app.** Confirmed nothing to reuse — this app has a well-exercised **write** path (BCF viewpoint → camera, via `Viewport.tsx`'s `bcfSyncRequest` effect and `cameraControls.setLookAt`), but no **read** path (camera → BCF viewpoint) exists at all today. This would be new code, not a refactor of something that already does 80% of the job.

**3. When to apply `CoordinateTransform.threeJSToBcf()`?** **At capture time, not only at export time** — and this is a real design decision worth being explicit about, not obvious from the brief's phrasing alone. Reasoning, based directly on how Punto 1a/1c actually built this: `BcfViewpoint.camera.position/direction/up` (this app's own type, `types/bcf.ts`) is **defined to always hold Three.js Y-up values** — that's the entire premise `BcfImporter.adaptViewpoint()` (Punto 1a) and `BcfExporter.adaptViewpoint()` (Punto 1c) were both built around: import converts BCF→Three.js once, on the way in; export converts Three.js→BCF once, on the way out; everything **in between** (this app's own `BcfViewpoint` objects, flowing through `BcfManager`, `BcfPinRenderer`, `BcfDetailPanel`, etc.) is uniformly Three.js-space, never BCF-space. A newly-captured viewpoint has to honor that same invariant to avoid becoming a special case every other piece of code has to know about. **Concretely: capture the raw Three.js camera values as-is into a `BcfViewpoint` (no transform at capture time) — `BcfExporter.adaptViewpoint()`'s already-existing `CoordinateTransform.transformThreeViewpoint()` call (Punto 1c) then converts it to BCF-space automatically, for free, the same way it already does for every imported-then-exported viewpoint.** Applying the transform a second time at capture would double-convert and reintroduce exactly the kind of bug Punto 1a/1c fixed, just via a different code path.

**4. Minimal `BcfViewpoint` from current camera — code pattern:**
```ts
function captureCurrentViewpoint(viewerHandles: IfcViewerHandles): BcfViewpoint {
  const camera = viewerHandles.world.camera.three;
  const direction = camera.getWorldDirection(new THREE.Vector3());
  return {
    guid: crypto.randomUUID(),
    camera: {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
    },
    // no clippingPlane, no snapshot - both genuinely optional on BcfViewpoint
  };
}
```
**Does it round-trip cleanly?** Not directly tested with this exact function (it doesn't exist in the codebase, this is a proposed pattern, not implemented code per this task's investigation-only scope) — but the *mechanism* it depends on (a `BcfViewpoint` with only `guid`+`camera` populated, no `clippingPlane`/`snapshot`, passed through `BcfExporter.adaptViewpoint()` → re-parsed by `bcf-core`) is **exactly** what the temporary investigation test in `BCF_CREATE_IMPLEMENTATION_PLAN.md` already verified end-to-end, with a synthetic camera position — confirmed working, not assumed.

---

## Part 5: Blockers and gaps

**1. Element selection multi-select.** Per `BCF_CREATE_CURRENT_STATE.md` Part 2: `ApplicationInstance.getSelection()`'s shape (`Record<modelId, string[]>`) already supports more than one GUID per model structurally. Whether a user can actually *produce* a multi-element selection today: `EntitySelector.ts`'s drag-box selection can select multiple elements within one box (`highlighter.highlightByID("select", modelIdMap, true, false)` receives a map that can contain multiple IDs) — so box-select multi-select exists. Click-to-*add*-to-an-existing-selection (ctrl/shift+click accumulating across separate clicks) was **not evidenced** in `EntitySelector.ts` — not confirmed either way without deeper tracing, flagged as unverified rather than assumed. **Model Tree selection:** `ModelTree.tsx`'s `TreeNode` calls `app.requestSelectByLocalId(modelId, node.localId)` on click — a single-element selection call, no multi-select signature found there. **For MVP: skip element reference entirely** (already the Part 2 recommendation) — this makes the multi-select question moot for this specific feature; it only matters if/when element-reference support is added later. **Not a blocker: a clean deferral**, since `BcfTopic` has no field to attach it to anyway.

**2. Form/Dialog UI pattern.** This codebase has **no single generic, reusable `<Modal>` component** — grepped for one, found none. It **does** have a proven, twice-repeated concrete pattern: a `position: fixed` full-viewport backdrop `<div>` + a separately-positioned centered content box, its own stacking context (both `FileUploadModal.tsx` and `KeyboardShortcutsModal.tsx` use this exact structure, the latter also already handling Escape-to-close and click-outside-to-close). **Not a blocker** — a "Create Topic" dialog would follow this same established pattern (new component, matching precedent, not a new pattern invented from scratch) rather than reusing one of those two components directly (neither is generic/parameterized for arbitrary form content — reusing either verbatim would mean threading form-specific props into a component that wasn't designed for it).

**3. Snapshots/images.** **Decision: skip for MVP**, not because it's technically hard but because it's explicitly out of scope per the investigation this task builds on (`BCF_SNAPSHOT_RENDERING_PLAN.md`, Punto 1b's prior investigation): `markup.snapshots` has no parser anywhere, and `BcfViewpoint.snapshot` (the one real, working per-viewpoint image field) is populated from **imported** BCF bytes (`bytesToBase64(vp.snapshot)` inside `BcfImporter.adaptViewpoint`) — there's no existing "capture the live 3D canvas as a PNG" capability in this app to source a snapshot from for a *newly created* topic either. Leaving `snapshot: undefined` on a created viewpoint is harmless — `IssueTable`'s thumbnail column and `BcfDetailPanel` both already have a defined, working fallback for a missing snapshot (confirmed, not assumed — this is the same fallback path every BCF-imported topic without a snapshot already exercises today).

**4. Validation: export-reimport round-trip.** **Yes, this needs explicit testing before ship — and it already has a proven pattern to follow, not new test infrastructure to build.** `BcfExporter.spec.ts` (Punto 1c, already exists, already passing) established the exact test shape needed: parse-with-bcf-core-directly → run through this app's pipeline → parse-the-output-with-bcf-core-directly → compare. A "create topic" test would follow the identical shape, just starting from a hand-built `BcfTopic` instead of an imported one (as this investigation's temporary test already confirmed works). **No special-casing needed** — a created topic and an imported-then-passed-through topic are, by construction, the same `BcfTopic` shape flowing through the same `BcfExporter`; there's nothing structurally different about a topic's *origin* that the export path would need to know about or handle differently.
