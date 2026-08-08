# BCF_SNAPSHOT_PARSING.md — current state, re-verified precisely

Investigation only, no code changes. This corrects and sharpens a claim made in an earlier investigation this session (`BCF_IMAGES_BUG.md`), which said `markup.snapshots`/`markup.svg` are "parsed but not rendered." Re-checked against `packages/bcf-core`'s actual parser: **that's not quite right — they're not parsed at all, by anything, anywhere.**

## Where the ONE real snapshot is parsed (this part works, confirmed in a prior task)

`packages/bcf-core/src/reader.ts`'s `resolveViewpoint()`:
```ts
snapshot = await snapFile.async("uint8array");   // raw bytes, from JSZip
snapshotMimeType = guessImageMimeType(snapPath);  // extension-based: .jpg/.jpeg -> "image/jpeg", else "image/png"
```
Shape: **raw `Uint8Array`**, explicitly documented in `bcf-core`'s own type comment (`packages/bcf-core/src/types.ts:27`): *"El snapshot se guarda como bytes crudos (Uint8Array), nunca como data URI ni un objeto DOM"* (raw bytes, never a data URI or DOM object — that conversion happens one layer up). One snapshot **per viewpoint**, not per topic.

`src/viewer/bcf/BcfImporter.ts`'s `adaptViewpoint()` is where it becomes a data URI:
```ts
const snapshot = vp.snapshot
  ? `data:${vp.snapshotMimeType ?? "image/png"};base64,${bytesToBase64(vp.snapshot)}`
  : undefined;
```
Lives at `BcfTopic.viewpoint.snapshot` (this app's own type, `src/viewer/bcf/types/bcf.ts`) — a single optional string per topic. This is the one real, working, rendered image path (confirmed live with real fixture data in an earlier task this session).

## `BcfTopic.markup.snapshots` / `markup.svg` — the actual finding

`src/viewer/bcf/types/bcf.ts` declares:
```ts
markup?: {
  snapshots?: string[]; // base64
  svg?: string;
};
```
**Re-verified this task: nothing populates this field, ever.** `BcfImporter.ts`'s `adaptTopic()` (the only function that constructs a `BcfTopic`) builds an object with `guid, title, description, createdAuthor, createdDate, priority, status, assignee, viewpoint, comments` — **`markup` is never assigned**, so it's `undefined` on every single topic this app ever produces, unconditionally.

More importantly: **`bcf-core` itself has no equivalent concept to adapt from.** Its own `BcfTopic` type (`packages/bcf-core/src/types.ts`) has no `markup` field, no multi-snapshot array, no SVG field of any kind. Grepped `packages/bcf-core/src/reader.ts` for `markup`/`snapshot`/`svg`: the only matches are (a) `markup.bcf`, the *filename* BCF uses for a topic's own metadata+comments+viewpoint-refs XML file (a BCF-spec naming convention, unrelated to "annotation markup" as a feature), and (b) the single per-viewpoint `snapshot`/`snapshotMimeType` fields already covered above.

**Conclusion: `BcfTopic.markup` is a speculative field that was added to this app's own type but has no parser, no adapter logic, and no real BCF data backing it anywhere in this codebase.** It isn't "parsed but not rendered" — there is no parsing step for it to have skipped. This changes the shape of any fix: there's no existing pipeline to hook a renderer onto; a real implementation would need real parsing added to `bcf-core` first (multi-viewpoint-snapshot support, specifically) before this app's own type/UI work would have anything real to consume.

## A real, related, smaller gap worth noting

`bcf-core`'s own comment (`reader.ts:24`, translated): *"a topic can have more than one Viewpoints element (each with its own viewpoint.bcfv/markup.bcf); viewer-oguc only reads the first."* Confirmed in `BcfImporter.ts`'s `adaptTopic()`: `viewpoint: adaptViewpoint(topic.viewpoints[0])` — hardcoded index 0. So even for the ONE real, working snapshot mechanism, a topic with 2+ viewpoints (each potentially with its own distinct snapshot) only ever surfaces the first one's image to the UI. This is a real, narrower, already-acknowledged limitation (comment says so explicitly) distinct from the `markup.snapshots` non-issue above — worth tracking separately, since a fix for one doesn't fix the other.
