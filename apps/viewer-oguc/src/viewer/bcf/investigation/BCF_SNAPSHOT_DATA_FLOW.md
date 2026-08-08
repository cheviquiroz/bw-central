# BCF_SNAPSHOT_DATA_FLOW.md — pipeline, current and proposed

Investigation/design only, no code changes.

## Current data flow (the one real snapshot, per viewpoint)

```
.bcf/.bcfzip file
  -> BcfManager.loadBcf(file)
    -> BcfImporter.parse(file)
      -> @bw-central/bcf-core's parseBcf()   [ZIP -> XML -> raw Uint8Array bytes]
      -> adaptTopic() -> adaptViewpoint()     [Uint8Array -> base64 data: URI, via bytesToBase64()]
    -> BcfManager's private `state.topics` (in-memory, class field - NOT React state, NOT Context)
  -> BcfManager.subscribe() listeners notified
    -> Layout.tsx's `bcfState` (React useState, re-set on every BcfManager change)
      -> BcfPanel.tsx (`state` prop) -> IssueTable.tsx (`topics` prop)
        -> topicToTableItem() [Phase 3 refactor] -> TableItem.metadata.bcf.viewpoint.snapshot
          -> Column.render (the "thumb" column) -> <img src={snapshot}>
```
Confirmed live, real fixture, this session: works end to end, no failures.

## Is the data URI held in memory the whole time, or loaded on demand?

**Held in memory, for every topic, all the time, from the moment a `.bcf` file is imported** — `BcfManager.state.topics` is a plain array of fully-adapted `BcfTopic` objects (not lazy references, not IDs to fetch later). Every topic's `viewpoint.snapshot` data URI (if present) exists as a full string in memory immediately after import, whether or not that topic's row is ever scrolled into view or its thumbnail ever actually renders. There is no on-demand/lazy loading step anywhere in this pipeline today — confirmed by reading the full chain above, no `fetch`, no `IntersectionObserver`, no virtualized list.

## Is anything cached (in the sense of avoiding recomputation), or is it recomputed?

**Not recomputed per render** — the data URI is computed exactly once, at import time (`adaptViewpoint`), and stored as a plain string on the topic object for the object's entire lifetime. `IssueTable.tsx`'s `topicToTableItem()` (Phase 3) runs on every render (it's not memoized with `useMemo` currently — confirmed: `const items: TableItem[] = topics.map(...)` runs unconditionally in the component body), but it only re-reads `topic.viewpoint.snapshot` (already a plain string, cheap to reference) rather than re-deriving it from raw bytes — so there's no expensive recomputation happening repeatedly, just a cheap object-literal rebuild on every render. Not a performance concern at today's scale, but worth naming precisely rather than saying "cached" when what's actually happening is "computed once, then just referenced."

## Proposed flow if a detail panel (Display Options doc's Option B) is added

No new data-fetching step needed — the panel would consume the **same already-in-memory** `activeTopic` (already tracked in `BcfManagerState`, already flowing to `BcfPanel.tsx` as a prop) and read `activeTopic.viewpoint.snapshot` / `activeTopic.comments` / `activeTopic.description` directly. This is a pure **rendering** addition, not a new data-flow branch:
```
BcfPanel.tsx (already has `state.activeTopic`)
  -> new <TopicDetailPanel topic={state.activeTopic} /> (new component, reads only)
```

## Open questions, flagged rather than decided

1. **Multi-viewpoint topics** (the `viewpoints[0]`-only gap, `BCF_SNAPSHOT_PARSING.md`): if a detail panel is built assuming "one image per topic," it inherits this existing limitation silently. Whether to fix the `viewpoints[0]` restriction *at the same time* as building a detail panel, or treat them as two separate, sequential pieces of work, is a scoping decision I'm flagging, not making — they're separable (a detail panel can ship showing the one already-available image; multi-viewpoint support is orthogonal, deeper `bcf-core` work).
2. **`markup.snapshots`/`markup.svg`**: per `BCF_SNAPSHOT_PARSING.md`/`BCF_MARKUP_SVG.md`, there is no real data-flow to design for these today — no parser produces them. Any "data flow" for them is speculative until `bcf-core` gains real parsing support. Not designed further here.
