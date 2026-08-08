# BCF_VIEWPOINTS_BUG.md — exact symptom + hypothesis

Investigation only, no code changes. Tested live, real browser, real fixture.

## Test setup

- Loaded `packages/oguc-core/fixtures/CASA-ARQ.ifc` (a small house model — walls, roof, pool, all visibly correct orientation in the normal fit-all view).
- Imported `packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf` (2 real topics, real viewpoint XML with `CameraViewPoint (12.450, 8.320, 3.100)`, `CameraDirection (-0.707, -0.707, 0.000)`, `CameraUpVector (0, 0, 1)` — see `BCF_COORDINATES_ANALYSIS.md`).
- Double-clicked the first topic row (triggers `Viewport.tsx`'s real `bcfSyncRequest` → `cameraControls.setLookAt` path — the same code path a real user hits).

## Exact symptom (screenshot evidence)

**Before activating the topic:** normal fit-all view, full house model visible, correctly oriented (screenshot: `bcf-before-activate.png`, captured this investigation).

**After double-clicking the topic:** the camera lands pressed up against a flat tan/brown textured surface filling nearly the entire viewport — no recognizable building geometry, no walls, no distinguishable element. Only the very top-left corner shows a sliver of a dark edge (screenshot: `bcf-after-activate.png`, captured this investigation).

This is **not** "off-screen" (the pin/camera aren't outside the visible frustum — something IS rendering, filling the screen) and **not** "multiple viewpoints stacked in the same spot" (only one topic was activated). It's the third category the brief asked to distinguish: **on-screen, wrong position** — specifically, the camera appears to have ended up very close to and looking directly at the model's ground/terrain surface (the tan/brown color matches the ground-plane material visible in the normal fit-all screenshot), consistent with the camera landing near ground level instead of at its intended elevated vantage point.

## Hypothesis

Directly explained by the Y/Z axis mismatch documented in `BCF_COORDINATES_ANALYSIS.md`: the fixture's real `CameraUpVector = (0,0,1)` confirms the source data is Z-up. If `position.z` (a **small height value in the source data's up axis**, `3.100`) gets used as Three.js's `z` (a **horizontal depth axis** in this app's Y-up scene) instead of `y` (height), while `position.y` (`8.320`, a horizontal coordinate in the source data) gets used as Three.js's `y` (height) — the camera would be placed at roughly **8.3 units of height**, not 3.1, with its actual intended height (3.1) instead pushed onto the depth axis. Depending on the model's real scale, a camera parachuted to an unintended height and misapplied depth offset landing very close to (or just above/below) the ground plane, aimed downward/sideways into it, is exactly consistent with "camera pressed against a flat surface filling the screen" — the observed symptom.

This is a **hypothesis grounded in the observed symptom, the confirmed absence of any axis-remap code, and the confirmed presence of a Y-up scene convention** — not a certainty. I did not modify code to test a fix (out of scope for this investigation), so I cannot yet confirm that swapping Y/Z (with an appropriate sign) fully resolves the symptom versus only partially explaining it. Flagged as the leading hypothesis, not a proven root cause.

## What I could not verify in this investigation

- Whether the correct fix is a simple axis swap (`three.y = bcf.z; three.z = -bcf.y` or similar, the common IFC→Three.js Z-up-to-Y-up convention) or something more involved (e.g. `@thatopen/components` may expose a project-coordinate transform matrix that should be applied to BCF points too, rather than a hand-rolled swap done independently in this app's own BCF code — I did not find evidence either way, since I didn't dig into `@thatopen/components`' internal API surface for this).
- Whether the model's own internal placement (`IfcSite`/`IfcBuilding` local origin offset, common in real-world IFC files with survey-point offsets) also needs to be applied to BCF coordinates, independent of the axis question — untested, would need a real-world fixture with a non-zero site origin offset to observe (the fixtures used here are small, likely origin-centered test data).
