# BCF_IMAGES_ANALYSIS.md — how BCF images/snapshots load today

Investigation only, no code changes. Path correction: `src/viewer/bcf/BcfImporter.tsx` doesn't exist — real file is `src/viewer/bcf/BcfImporter.ts`.

## Are snapshots parsed from .bcf/.bcfzip?

Yes, confirmed by direct code read. `BcfImporter.parse(file)` calls `parseBcf(file)` from the separate `@bw-central/bcf-core` package (real ZIP/XML parsing lives there — `jszip` + `fast-xml-parser`, confirmed via `packages/bcf-core/package.json`). `bcf-core` returns raw snapshot bytes on each `CoreBcfViewpoint`; `BcfImporter.ts`'s `adaptViewpoint()` converts them:
```ts
const snapshot = vp.snapshot
  ? `data:${vp.snapshotMimeType ?? "image/png"};base64,${bytesToBase64(vp.snapshot)}`
  : undefined;
```
This produces a full `data:` URI (not raw base64), specifically so it can be used directly in an `<img src>` with no further conversion — confirmed by the file's own comment.

## Where are they rendered?

`src/ui/BcfPanel/IssueTable.tsx` (post-Phase-3-refactor: a `Column.render` for the "thumb" column):
```tsx
render: (item) => {
  const snapshot = item.metadata.bcf?.viewpoint.snapshot;
  return snapshot ? <img className="issue-thumb" src={snapshot} alt="" /> : <div className="issue-thumb issue-thumb-empty" />;
},
```
Direct `<img src={dataUri}>` — no fetch, no async loading step, no separate image-loading state to fail silently in.

## Live verification with a real fixture — confirmed working, not broken

Used `packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf` (a real BCF test fixture with actual embedded snapshots) in a real browser:
- Unzipped the fixture directly and inspected `snapshot.png`: `PNG image data, 1 x 1, 8-bit/color RGBA` — a deliberate 1×1 solid green pixel `(0, 255, 0, 127)`, a minimal synthetic test image, not a broken/corrupt file.
- Imported this fixture through the real UI (`#btn-bcf-import` → file chooser → real `BcfManager.loadBcf`), screenshotted the resulting table: **both rows show a solid green thumbnail** in the thumb column — exactly matching the real 1×1 green pixel's color. This is the image loading and rendering correctly, end to end, not a placeholder or a fallback.
- Zero console errors during import or render.

**Conclusion: images are not broken.** The full pipeline (ZIP → XML → raw bytes → base64 data URI → `<img src>`) works correctly with real BCF data. See `BCF_IMAGES_BUG.md` for what this means for the "images don't load" claim.
