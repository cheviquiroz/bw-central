# BCF_EXPORT_COORDINATE_FIX.md

## What bug was found

`BcfExporter.ts`'s `adaptViewpoint()` wrote a `BcfViewpoint`'s camera `position`/`direction`/`up` (and the clipping plane's `location`/`direction`, if present) straight to `bcf-core`'s `CoreBcfViewpoint` shape with **zero coordinate transform**. Those fields are always in this app's Three.js Y-up space (`BcfImporter.adaptViewpoint()` converts every real BCF viewpoint from Z-up to Y-up on the way in, via `CoordinateTransform.bcfToThreeJS`) — but BCF's own file format expects Z-up numbers. Writing Y-up numbers into a Z-up-format field is not a rounding error, it's writing the wrong axis into the wrong slot.

## Why it matters

Any `.bcf` file this app exported was numerically corrupted for every *other* BCF-compliant tool that might open it (BIMcollab, Solibri, Navisworks, etc.) — a camera position authored as "12.45, 8.32, 3.1 (height)" in the original file would round-trip through this app and come back out with height and depth swapped, the same class of "camera lands in the ground" symptom the import-side fix (Etapa 3 Punto 1a) already fixed for viewing — just now affecting anyone downstream who received an exported file from this app, not just this app's own viewer.

## How it was fixed

Added `CoordinateTransform.transformThreeVector`/`transformThreeViewpoint` — the exact mirror of the already-existing `transformBcfVector`/`transformBcfViewpoint` (import direction), applying `threeJSToBcf` instead of `bcfToThreeJS`, exposed the same plain-`{x,y,z}`-in/-out way so `BcfExporter.ts` didn't need to hand-construct `THREE.Vector3` objects at every call site. `BcfExporter.ts`'s `adaptViewpoint()` now calls `CoordinateTransform.transformThreeViewpoint(vp)` once per viewpoint before writing `camera.viewPoint`/`direction`/`upVector` and `clippingPlanes[0]`'s `location`/`direction` — every vector field the exporter touches, not just the three camera fields explicitly named in the task brief. No new transform math was written; both directions reuse the same rotation `CoordinateTransform.ts` already had, verified as exact inverses since the file was first created.

## Symmetry verification (round-trip test results)

Two independent verifications, both against real BCF data (`packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf`), not synthetic values:

**1. Exact numeric round-trip** (`src/viewer/bcf/BcfExporter.spec.ts`, new): parse the real fixture with `bcf-core` directly (ground truth, BCF/Z-up space) → import through `BcfImporter` → export through `BcfExporter` → re-parse the *exported* bytes with `bcf-core` directly again (ground truth, post-round-trip). Logged comparison:

```
camera_view_point  original: { x: 12.45, y: 8.32, z: 3.1 }   exported: { x: 12.45, y: 8.32, z: 3.1 }
camera_direction   original: { x: -0.707, y: -0.707, z: 0 }  exported: { x: -0.707, y: -0.707, z: 0 }
camera_up_vector   original: { x: 0, y: 0, z: 1 }             exported: { x: 0, y: 0, z: 1 }
```
Every component matched **exactly** (not merely within the requested `1e-5` tolerance — `Math.abs(a - b)` was `0` for every field in this run). A second test in the same file verifies the clipping plane's `location`/`direction` the same way, also exact.

**2. Live browser re-import verification** (Playwright, real UI, real download): imported the fixture, double-clicked its first topic (camera framed a specific facade view), exported via the real "Exportar BCF" button (a real file download, not a mocked call), then imported that *exported* file back into a fresh session and double-clicked the same topic again. Screenshots before and after are **pixel-identical** — same camera framing, same pin position, same panel content. Zero console errors across the entire import → export → re-import cycle.

## Files modified

- `src/utils/CoordinateTransform.ts` — added `transformThreeVector`/`transformThreeViewpoint` (mirrors the existing import-direction helpers, no new transform logic).
- `src/viewer/bcf/BcfExporter.ts` — `adaptViewpoint()` now applies the inverse transform before writing camera and clipping-plane fields.
- **New**: `src/viewer/bcf/BcfExporter.spec.ts` — the exact-numeric round-trip test described above.
- `src/viewer/bcf/BcfImporter.ts` — **not modified** (already correct from Etapa 3 Punto 1a, per this task's explicit scope boundary).

## Related work

- Etapa 3 Punto 1a — `CoordinateTransform.ts` created, `BcfImporter.ts`'s import-side fix (`bcfToThreeJS`), diagnosed and fixed the "camera lands in the ground" viewing bug.
- Etapa 3 Punto 1b — `BcfDetailPanel.tsx`, multi-viewpoint support (`BcfTopic.viewpoints[]`). This is where the export-side gap was *discovered* (while updating `BcfExporter.ts`'s `adaptTopic()` to export the full viewpoints array, it became visible that coordinates were never transformed there at all) — flagged then, fixed now, in this task.

## Separate issue flagged, not fixed here (per this task's explicit scope)

None found beyond what was already flagged in the Punto 1b work. `BcfExporter.ts` now exports every viewpoint a topic has (fixed in Punto 1b, unrelated to coordinates) — this task did not change how many viewpoints are exported, only whether their coordinates are correct.
