# BCF_SNAPSHOT_RENDERING_PLAN.md

Investigation/design only — no code changes were made as part of this task.

## Section 1: Current state

- The **one real snapshot mechanism** (`viewpoint.snapshot`, one per topic — technically one per the *first* viewpoint of a topic, see below) works correctly end-to-end and already renders as a 36×24px thumbnail in `IssueTable.tsx`. Verified live with real fixture data, no bug found here (this session, an earlier task).
- **`BcfTopic.markup.snapshots`/`markup.svg` are not "unused" — they don't exist as real data anywhere in the pipeline.** Neither `bcf-core`'s parser nor this app's `BcfImporter.adaptTopic()` ever populates them. There is no parsing step to fix; a real implementation of "markup snapshots" would need new `bcf-core` parsing work first, not just new UI.
- A topic with more than one `Viewpoints` entry (and therefore, potentially, more than one distinct snapshot) only ever surfaces its **first** viewpoint's image — `adaptTopic()` hardcodes `topic.viewpoints[0]`. `bcf-core`'s own source comment already documents this as a known simplification.
- No detail/expanded view of any kind exists for a selected BCF topic today — confirmed live: single-clicking a topic (already wired to `onSelect`/`setActiveTopic`) produces no visual change beyond the row highlight and 3D pin glow. `topic.comments` and `topic.description` are likewise parsed and available but never rendered anywhere.

## Section 2: Proposed rendering location

Per `BCF_SNAPSHOT_DISPLAY_OPTIONS.md`: keep the existing row thumbnail as-is; add a **detail panel that reacts to the already-tracked `activeTopic`**, showing the full-size image, full description, and comment thread. Not a 3D-viewport overlay (redundant with the existing, correctly-working double-click camera-jump). Not a new top-level route/section (this app's existing convention keeps domain content inside its owning dock, reserving new routes for genuinely different *modes*, per `/revision`'s own precedent).

**Flagged, not decided:** exact panel *shape* (a fixed side column next to the table vs. an expandable in-place row vs. something else) — a real UI-design decision, not something to settle in an investigation doc. Whatever shape is chosen, the data-flow answer (Section 3) is the same regardless.

## Section 3: Data flow

No new fetching/async step needed — per `BCF_SNAPSHOT_DATA_FLOW.md`, everything a detail panel would need (`activeTopic.viewpoint.snapshot`, `.comments`, `.description`) is already fully in memory the moment a BCF file is imported, and `activeTopic` already flows from `BcfManager` → `Layout.tsx`'s `bcfState` → `BcfPanel.tsx` today. A detail panel is a pure new **rendering consumer** of existing state, not a new data pipeline.

## Section 4: Technical implementation (proposed file paths, not implemented)

- **New component**: `src/ui/BcfPanel/TopicDetailPanel.tsx` — reads `activeTopic: BcfTopic | null` (already available as a prop `BcfPanel.tsx` already receives via `state.activeTopic`), renders full-size `<img src={activeTopic.viewpoint.snapshot}>` (or a clear "no snapshot" state if absent, same pattern `EmptyState`/the existing thumb-empty fallback already use elsewhere in this app), full `description`, and a simple comment list (`activeTopic.comments`, already typed as `BcfComment[]` with `author`/`date`/`text`).
- **Wiring**: `BcfPanel.tsx` would render `<TopicDetailPanel topic={state.activeTopic} />` alongside (not instead of) `<IssueTable>` — exact layout (side-by-side column vs. below the table) is the UI-design decision flagged in Section 2, not resolved here.
- **No changes needed** to `BcfManager.ts`, `Layout.tsx`, `Viewport.tsx`, or the `Table`/`IssueTable` components built in Phase 1-3 — this is additive, new-component work sitting alongside the existing, already-refactored table, not a further refactor of it.
- **Not in scope for this plan**: fixing the `viewpoints[0]`-only limitation (a `bcf-core` change, separable per `BCF_SNAPSHOT_DATA_FLOW.md`'s flagged open question) or implementing real `markup.snapshots`/`markup.svg` parsing (blocked on `bcf-core` gaining that capability first, per Section 1).

## Section 5: Performance considerations

- At the scale actually tested (2 topics, 70-byte synthetic images): no measurable concern.
- At an unverified, hypothetically large scale (per `BCF_SNAPSHOT_CONSTRAINTS.md`'s explicitly-flagged unknowns around real topic counts/image sizes): the existing `Table` component doesn't virtualize rows, so every thumbnail already mounts/decodes regardless of scroll position — a detail panel showing only the *single active* topic's full-size image doesn't make this worse (it's still just one large image at a time, not N), so this specific feature doesn't introduce a new performance risk beyond what already exists in the table's thumbnail column.
- **Lazy-loading / caching**: not recommended to design proactively without a real measured need — per this project's own established conventions (avoid solving problems that can't be shown to exist), and per `BCF_SNAPSHOT_CONSTRAINTS.md`'s finding that real-world scale is genuinely unknown to this investigation. If a real performance problem is later measured against real-world-sized data, `loading="lazy"` on the `<img>` tags (a native, zero-dependency browser feature) would be the first, cheapest thing to try before reaching for a virtualization library.

## Section 6: Risks

- **SVG injection** (only relevant if `markup.svg` is ever implemented, which is blocked on new `bcf-core` parsing per Section 1): raw SVG from an untrusted `.bcf` file can carry `<script>`/event-handler XSS payloads. Must be sanitized (e.g. `DOMPurify`, not currently a direct dependency of this app — only present transitively via `jspdf`, see `BCF_MARKUP_SVG.md`) before ever being injected as HTML. **Not a risk for the detail-panel work proposed in Section 4**, since that only touches already-working `<img src={dataURI}>` and plain text (comments/description) — no `dangerouslySetInnerHTML` anywhere in this plan.
- **Memory**: covered in Section 5 — flagged as unverified at scale, not proposed to be solved speculatively.
- **Scope creep risk**: it would be easy to bundle "fix `viewpoints[0]`" and "implement `markup.svg` from scratch" into what should be a small, additive detail-panel feature. Section 4 explicitly excludes both from this plan's scope for that reason.

## Section 7: Test strategy

- **Real fixtures available today**: `packages/bcf-core/src/__tests__/fixtures/sample-2.1.bcf`/`sample-3.0.bcf` — both have real (if tiny) embedded snapshots and real comments, sufficient to verify a detail panel's basic rendering (image shows, comments list shows, description shows) end-to-end, the same way this session already verified the row thumbnail.
- **Not currently testable without new fixtures**: multi-viewpoint topics (would need a fixture with 2+ `Viewpoints` entries on one topic — neither existing fixture has this, confirmed by inspecting their raw XML in an earlier task), `markup.snapshots`/`markup.svg` (no fixture exercises this at all, since nothing parses it), realistic-scale performance (would need either a large real-world BCF export or a synthetically generated large fixture, neither of which exists in this repo today).
- **Recommended before implementation**: if this plan moves forward, requesting (or synthetically constructing) at least one BCF fixture with a realistically-sized image (tens to hundreds of KB, not 70 bytes) would let Section 5's performance flags actually be tested rather than remain permanently unverified.
