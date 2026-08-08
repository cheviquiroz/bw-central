# BCF_IMAGES_BUG.md — exact symptom (or lack thereof)

Investigation only, no code changes.

## Finding: not reproducible with real BCF data

Per `BCF_IMAGES_ANALYSIS.md`'s live test: imported a real `.bcf` fixture with real embedded PNG snapshots, and the thumbnail rendered correctly (matching the fixture's actual 1×1 green pixel color exactly) for both topics, with zero console errors.

Answering the brief's three diagnostic questions directly, since I could actually test all three against real data:
- **"Are they parsed from BCF but not rendered?"** No — parsing produces a correct `data:` URI (verified: `bcf-core` → `BcfImporter.adaptViewpoint` → `<img src>`), and it does render (verified: screenshot shows the correct pixel color).
- **"Or not parsed in the first place?"** No — the raw fixture's `snapshot.png` bytes make it all the way to a correctly-formed data URI; confirmed by the rendered color matching the source file exactly.
- **"Or parsed/rendered but fail silently?"** No silent failure observed — no console errors, no broken-image icon, no fallback placeholder shown (the `.issue-thumb-empty` fallback only renders when `snapshot` is `undefined`, and it wasn't in this test).

**No bug found in the images pipeline with the tools and data available to this investigation.** This directly contradicts the "images don't load" premise in this task's own CONTEXT.

## Caveats — what this investigation could not rule out

I only tested with `bcf-core`'s own small test fixtures (1×1 pixel synthetic images). I could not test:
- **Larger, real-world snapshot images** (a real screenshot export from Revit/Navisworks/Solibri, typically hundreds of KB) — a large base64 data URI could conceivably hit a different code path or performance characteristic than a 70-byte 1×1 PNG, though nothing in the code (`BcfImporter.ts`'s `bytesToBase64`, a plain byte-to-base64 conversion with no size branching) suggests it would behave differently.
- **Multiple snapshots per topic, or the `markup.snapshots`/`markup.svg` fields** (`BcfTopic.markup?.snapshots?: string[]`, `svg?: string`) — these exist in the type but I found **no code anywhere that reads them** (grepped `markup.snapshots` and `markup.svg` across `apps/viewer-oguc/src`: zero consumers). This is a real, separate gap from "the one viewpoint snapshot doesn't load" — it's "markup snapshots/SVG annotations are parsed into the type but have no UI at all," which is a different, narrower kind of missing feature, not a loading bug.
- **BCF files that fail to import entirely** (malformed ZIP/XML) — `Layout.tsx`'s `handleImportBcf` catches and `alert()`s on any `loadBcf` failure, so a genuinely broken file would surface as an alert, not a silently-blank thumbnail — untested here since I only used known-valid fixtures.

## Conclusion

If a user is genuinely seeing missing images with a real-world exported BCF file, the most likely explanations **not yet ruled out** are: (a) something specific to that file's snapshot encoding/size that these tiny test fixtures don't exercise, or (b) the file uses `markup.snapshots`/`markup.svg` instead of (or in addition to) a per-viewpoint `snapshot`, which genuinely has no rendering code at all today. Both are testable with a real exported BCF file from an actual authoring tool, which wasn't available to this investigation — flagged as the next concrete step rather than guessed at.
