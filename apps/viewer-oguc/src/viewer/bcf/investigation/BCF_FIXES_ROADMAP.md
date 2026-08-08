# BCF_FIXES_ROADMAP.md

Investigation only — this document proposes a path forward, but no code has been changed as part of this task.

## Section 1: Viewpoint bug — diagnosis + hypothesis

**Diagnosis:** BCF viewpoint coordinates (position/direction/up) are stored in the IFC project's native Z-up coordinate system (confirmed via a real fixture's `CameraUpVector = (0,0,1)`), but are used verbatim as Three.js x/y/z coordinates with no axis conversion anywhere in this app's own code — while the loaded model's *geometry* silently gets converted from Z-up to this app's Y-up scene inside the `@thatopen/components` loader. Live-tested: double-clicking a real BCF topic sends the camera to a position pressed against the ground/terrain surface, consistent with height and depth values being swapped.

**Fix hypothesis (not implemented, not verified against a fix):** apply the same Z-up→Y-up conversion to BCF `position`/`direction`/`up` vectors that the loader already silently applies to geometry, before using them in `BcfPinRenderer.createPin()` and `Viewport.tsx`'s `setLookAt` call. The conventional IFC-Z-up-to-Three.js-Y-up mapping is `three.x = ifc.x, three.y = ifc.z, three.z = -ifc.y` (a 90° rotation about X) — but this is the *standard* convention, not something confirmed against this specific app/loader's exact behavior. Before implementing, Phase 2 of any fix work should confirm the exact transform `@thatopen/components`' fragments loader actually applies (by inspecting a known IFC point's world position pre/post-load, or checking the library's own source/docs) rather than assuming the textbook convention is exactly what's needed here — getting the swap direction or sign wrong would silently trade one wrong-position bug for a different wrong-position bug.

## Section 2: Image loading — diagnosis + hypothesis

**Diagnosis: not a bug, as tested.** Real BCF fixture with a real embedded snapshot imports and renders correctly, exact pixel-for-pixel match, no console errors. The "images don't load" premise from this task's brief does not reproduce with the data available to this investigation.

**Hypothesis for what a *real* report of this might actually be:** two untested, real gaps exist that could plausibly produce "images don't show" symptoms for a specific user's real file, neither confirmed:
1. `BcfTopic.markup.snapshots`/`markup.svg` (multi-snapshot/annotation-overlay BCF features) are parsed into the type but have **zero rendering code anywhere** — if a real authoring tool's export relies on these instead of (or in addition to) `viewpoint.snapshot`, nothing in this app shows them, ever, regardless of any "loading" bug.
2. Larger real-world snapshot files (untested — only 70-byte synthetic fixtures were available) could theoretically behave differently, though nothing in the conversion code suggests a size-dependent code path exists.

## Section 3: What needs to change — files and functions

**For the viewpoint/coordinate fix (once the exact transform is confirmed, per Section 1's caveat):**
- `src/viewer/bcf/BcfImporter.ts` — `adaptViewpoint()` is the single choke point where every `BcfViewpoint` gets constructed from raw parsed data; applying the transform here (once, at import time) means `BcfPinRenderer.ts` and `Viewport.tsx` never need to know a transform happened, and both consumers get corrected coordinates automatically. This is a smaller, more contained change than fixing both consumers independently, and avoids either one applying the fix while the other doesn't.
- Alternatively, `BcfPinRenderer.createPin()` and `Viewport.tsx`'s `bcfSyncRequest` effect directly, if there's a reason the transform needs to happen closer to consumption (e.g. if `up` also needs applying and each consumer needs it differently) — but this risks the two call sites drifting out of sync, which is exactly the class of bug this investigation exists to prevent.
- **Recommend the `BcfImporter.ts` single-choke-point approach** unless a concrete reason emerges during implementation to do otherwise.

**For the `camera.up` gap** (currently parsed but never consumed, Section on coordinates): `Viewport.tsx`'s `setLookAt` call would need a `camera-controls` API that accepts an up vector, or a manual `cameraControls.camera.up.set(...)` before the `setLookAt` call — needs investigation into whether `camera-controls`'s `setLookAt` respects a pre-set `.up`, not assumed here.

**No changes needed for images** — Section 2 found no bug in the tested path.

## Section 4: Risk assessment — will a fix break anything else?

- **OrientationCube's view math** (`theta`/`phi` spherical angles) reads `camera.azimuthAngle`/`polarAngle` directly from `camera-controls`, entirely independent of BCF — a BCF coordinate fix touches none of that code, low risk of cross-contamination.
- **`fitCameraToAllLoadedModels()`** (the fallback used when a BCF element can't be found) computes its own framing from live model geometry, not from BCF coordinates at all — unaffected by a BCF-specific fix.
- **Existing BCF export** (`BcfExporter.ts`, round-tripping topics back to a `.bcf` file) — if a fix converts coordinates on *import*, export needs the **inverse** transform applied, or a re-exported BCF file would itself be wrong (silently corrupting a working export feature to fix a broken import one). This is a real, concrete risk that must be addressed in the same change, not treated as a separate follow-up — otherwise import gets fixed while export gets broken.
- **The 3D pin's approximate nature** (`PIN_VIEW_DISTANCE` projection, not the element's real position) is unrelated to the axis question and shouldn't change as part of this fix — worth being explicit that "wrong coordinates" and "approximate, not exact, pin placement" are two different, independent properties of the current system; fixing the former doesn't and shouldn't fix the latter (that would be a different, larger feature — associating BCF topics with real IFC elements, not in scope here).

## Section 5: Test strategy

- **Regression baseline first:** before any fix, capture the current (wrong) camera-jump screenshot for the same fixture/topic used in this investigation (`sample-2.1.bcf`, first topic) — already captured this session (`bcf-after-activate.png`) and can serve as the "before" reference.
- **Real fixture, known coordinates:** use `sample-2.1.bcf`'s first topic (`CameraViewPoint (12.450, 8.320, 3.100)`, known `CameraUpVector (0,0,1)`) against `CASA-ARQ.ifc` — after a fix, the camera should land at a position that visibly relates to the model (even if not "correct" in an absolute sense, since this fixture's coordinates were never authored against this specific model) rather than jammed into the ground plane.
- **A same-origin, real-world pairing would be stronger evidence than mismatched test fixtures** — if a real BCF file authored *against* one of this app's own IFC fixtures becomes available (not the case today), that would let this be verified as "camera frames the actual flagged element," not just "camera looks more plausible than before."
- **Export round-trip test:** import a BCF, don't modify anything, export it again, diff the re-exported viewpoint XML's raw numbers against the original import — should be byte-identical (or at least numerically identical) if the import fix's inverse is correctly applied on export (Section 4's risk).
- **`camera.up` consumption**, if implemented: visually confirm the camera's roll/orientation after a jump matches what a reasonable reviewer would have framed (walls vertical, not tilted) — no automated way to verify "looks right" without a human check, flag this as a manual verification step, not a scriptable assertion.
- **Images:** no fix is proposed (Section 2), so no new test strategy needed beyond what already passed in this investigation — if `markup.snapshots`/`markup.svg` rendering is added later as a *feature* (not a bug fix), that would need its own separate test plan with a real fixture that actually populates those fields (none was found among this repo's existing fixtures during this investigation).
