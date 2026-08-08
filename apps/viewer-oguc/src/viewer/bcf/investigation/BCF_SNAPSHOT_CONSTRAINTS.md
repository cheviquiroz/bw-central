# BCF_SNAPSHOT_CONSTRAINTS.md — technical limits, what's known vs. unknown

Investigation only, no code changes.

## Format: confirmed

Raw bytes → base64 `data:` URI, MIME type guessed from the snapshot filename's **extension only** (`guessImageMimeType` in `bcf-core/src/reader.ts`: `.jpg`/`.jpeg` → `image/jpeg`, anything else → `image/png`) — **not** by sniffing actual file bytes/magic numbers. This is a real, if narrow, gap: a snapshot file with a misleading or unusual extension would get mis-labeled, and the resulting `data:` URI would carry the wrong MIME type (browsers are somewhat tolerant of this for common raster formats, but it's not guaranteed to render correctly in all cases). No SVG MIME case exists in this function at all — consistent with `BCF_MARKUP_SVG.md`'s finding that SVG snapshots aren't a supported concept anywhere in this pipeline today.

## Typical real-world size: genuinely unknown, flagged rather than guessed

**Every fixture available to this investigation is a synthetic 1×1 pixel test image (70 bytes)** — `packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf`/`sample-3.0.bcf`, the only `.bcf`/`.bcfzip` files found anywhere in this repository (confirmed via `find` across the whole monorepo in an earlier task this session). **I have no real-world BCF export to measure against.** For context (not verified against this codebase, general industry knowledge): typical BCF snapshot exports from tools like Revit/Navisworks/Solibri are often in the 50KB–500KB range as PNG/JPEG, which base64-encodes to roughly 33% larger as a string (~65KB–650KB per topic). This is stated as background context, not a confirmed constraint for this app — flagged explicitly per this task's "don't guess at technical decisions" instruction.

## SVG: not renderable today, would need processing if implemented

Per `BCF_MARKUP_SVG.md`: no SVG data exists in the pipeline to even test rendering behavior against. If implemented, raw SVG strings from an untrusted source **must** be sanitized before rendering (script-injection risk, detailed in that doc) — this is "needs processing," not "renderable directly," as a matter of basic security practice, not a performance/compatib8ility question.

## Performance: loading N topics' worth of images simultaneously

**Not measured — no test performed this investigation with a realistic N or realistic image sizes**, since no real-world-sized fixtures exist to test against (see size section above). What can be said from reading the code, not measuring it:
- All `N` topics' snapshot data URIs are already fully in memory immediately after import (per `BCF_SNAPSHOT_DATA_FLOW.md` — not lazy), regardless of how many rows are actually visible/scrolled into view.
- `<table>`'s rows (via `Table.tsx`, Phase 1/2/3's shared component) are **not virtualized** — every row, and therefore every `<img>`, mounts into the DOM at once, even if far outside the visible scroll area of `.table-wrap`. For a small number of topics (the fixtures tested: 2) this is a non-issue. For a hypothetically large BCF file (hundreds of topics, each with a several-hundred-KB image) this could become a real memory/render-time concern — both because of total base64 string memory (each ~33% larger than the source binary) and because the browser has to decode every image immediately on mount, not just the visible ones.
- **This is a real, flagged-but-unverified risk, not a confirmed problem** — this app has never been tested against a BCF file anywhere near that scale (the largest real BCF fixture available anywhere in this repo has exactly 2 topics). Whether it's worth solving (lazy-loading images, or virtualizing table rows) depends entirely on what scale of BCF file this app is actually expected to handle in practice, which is a product question, not something derivable from the code alone.

## Summary of genuine unknowns (not guessed at, explicitly listed)

1. Real-world typical snapshot file size for this app's actual users.
2. Real-world typical topic count per BCF file for this app's actual users.
3. Whether extension-only MIME guessing has ever caused a real mis-rendered image for a real user (untestable without a real-world file exhibiting the case).
4. Whether SVG-format snapshots (as opposed to SVG *markup annotations*, a different concept per `BCF_MARKUP_SVG.md`) are something any authoring tool this app's users rely on actually produces.
