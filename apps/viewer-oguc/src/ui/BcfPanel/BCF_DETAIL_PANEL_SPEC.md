# BCF_DETAIL_PANEL_SPEC.md

## What the panel shows today

`BcfDetailPanel.tsx` renders only fields that real BCF files actually populate, verified field-by-field against `bcf-core`'s parser (see the data-availability check below): title, status, priority, topic type (if present), author, creation date (formatted `YYYY-MM-DD`), assignee, description (with a `"Sin descripción"` fallback), a real comment count (`"Comentarios (N)"`, count only — full comment rendering is explicitly out of scope for this pass), and every viewpoint the topic has (not just the first — see "Removing the `viewpoints[0]` hardcode" below), each clickable to jump the camera to that specific view.

## Why real snapshots are deferred

`BcfTopic.markup.snapshots`/`markup.svg` are **not parsed by anything** in this pipeline — not `bcf-core`, not this app's own `BcfImporter.adaptTopic()` (confirmed by direct code read before this task started: that function never assigns `markup` at all). There is no real image data behind these fields to render. The Viewpoints section shows a placeholder camera icon + index number instead, with this comment marking where real images would go once parsing exists:
```tsx
{/* FUTURE: When bcf-core parses markup.snapshots, replace the placeholder
    icon with a real <img>. Panel structure stays the same.
    Requires proper sanitization (dompurify is currently only a transitive dep). */}
```

## Data-availability check (per-field, verified against real parsing code)

| Field | Populated? | Source |
|---|---|---|
| `title` | Yes | `bcf-core`'s `parseTopicFields` reads `<Title>`; adapter falls back to `"Untitled"` |
| `description` | Yes | `<Description>` (optional in XML); adapter defaults to `""` |
| `status` | Yes | `<Topic TopicStatus="...">`; normalized to a closed enum |
| `priority` | Yes | `<Priority>`; normalized to a closed enum |
| `topicType` | Yes, but **newly threaded through** | `<Topic TopicType="...">` — `bcf-core` already parsed this; `BcfImporter.adaptTopic()` never passed it to the adapted `BcfTopic` before this change. Added (`BcfTopic.topicType?: string`) specifically so this panel's badges row could show it — real data, not fabricated, just previously dropped at the adapter boundary. |
| `createdAuthor`/`creationAuthor` | Yes | `<CreationAuthor>`; adapter falls back to `"Unknown"` |
| `createdDate`/`creationDate` | Yes | `<CreationDate>`; adapter falls back to `new Date().toISOString()` if absent |
| `assignee` | Yes | `<AssignedTo>` (optional); `undefined` if absent, panel shows `"—"` |
| `comments` | Yes | Full `BcfComment[]` (author/date/text) already adapted; this panel only surfaces the **count**, not full rendering |
| `viewpoints[]` | Yes, **fixed this task** | `bcf-core` always parsed the full array (`CoreBcfTopic.viewpoints: CoreBcfViewpoint[]`); `BcfImporter.adaptTopic()` previously hardcoded `topic.viewpoints[0]`, discarding the rest |
| `markup.snapshots`/`markup.svg` | **No** | Confirmed: no parser anywhere produces this data. Not rendered anywhere in this panel. |

No field needed a `// NOT POPULATED YET` comment in the final implementation — every field this panel reads either already had real data flowing to it, or (in `topicType`'s case) had real *parsed* data that just wasn't threaded through the adapter yet, which this task fixed rather than working around.

## Files changed

- `src/viewer/bcf/types/bcf.ts` — `BcfTopic.viewpoint: BcfViewpoint` → `viewpoints: BcfViewpoint[]`; added `topicType?: string`.
- `src/viewer/bcf/BcfImporter.ts` — `adaptTopic()` now maps every viewpoint (`topic.viewpoints.map(adaptViewpoint)`, falling back to a single-element `[DEFAULT_VIEWPOINT]` array when a topic has none, so downstream code can always safely read `viewpoints[0]`); passes through `topicType`.
- `src/viewer/bcf/BcfExporter.ts` — `adaptTopic()` now exports every viewpoint, not just one. **Not fixed** (pre-existing, separate, out of this task's scope): still doesn't apply `CoordinateTransform.threeJSToBcf()` before writing, so exported viewpoint coordinates remain numerically wrong — flagged in the file's own comment, not silently left undocumented.
- `src/viewer/bcf/BcfPinRenderer.ts` — pin placement now reads `topic.viewpoints[0]` (the primary viewpoint) instead of the old singular field. Still one pin per topic, not one per viewpoint — out of this task's scope.
- `src/ui/Viewport/Viewport.tsx` — `bcfSyncRequest`'s type gained a required `viewpointIndex: number`; the camera-jump effect reads `topic.viewpoints[viewpointIndex]` (falling back to `[0]` defensively).
- `src/components/Layout/Layout.tsx` — `handleBcfTopicActivate(topic, viewpointIndex = 0)`; the default preserves the existing double-click-a-row behavior (always jumps to the primary viewpoint) with zero change for that caller.
- `src/ui/Dock/DockBottom.tsx`, `src/ui/BcfPanel/BcfPanel.tsx` — `onTopicActivate`'s type widened to accept an optional `viewpointIndex`, threaded through unchanged otherwise.
- `src/ui/BcfPanel/IssueTable.tsx` — the row thumbnail now reads `topic.viewpoints[0]` (unchanged visual behavior; still shows only the primary viewpoint's image, per its existing design as a compact list, not a detail view).
- **New**: `src/ui/BcfPanel/BcfDetailPanel.tsx`, styles appended to `src/ui/BcfPanel/bcf-panel.css` (`.bcf-body`, `.bcf-detail-panel` and its children).
- `src/ui/BcfPanel/BcfPanel.tsx` — renders `<BcfDetailPanel>` alongside `<IssueTable>` inside a new `.bcf-body` flex row; owns `selectedViewpointIndex` local state (resets to `0` whenever a different topic becomes active).

## Future extension point for `markup.snapshots`

Once `bcf-core` gains real parsing support for multi-snapshot/SVG markup (a `bcf-core`-level change, not a UI change — see `src/viewer/bcf/investigation/BCF_SNAPSHOT_RENDERING_PLAN.md` for that full analysis), the only change needed here is swapping the placeholder `<IconCamera />` in each viewpoint button for a real `<img>` sourced from the (by-then-real) `markup.snapshots[index]` — the panel's structure, data flow, and click handling all stay exactly as they are.

## Note on `dompurify`

Not a direct dependency of `apps/viewer-oguc` today — it exists in the monorepo's lockfile only as an optional transitive dependency of `jspdf` (used by `report-core` for PDF export). If `markup.svg` is ever rendered, raw SVG from an untrusted `.bcf` file **must** be sanitized first (script/event-handler injection risk) — `dompurify` (or equivalent) would need to be added as a real, direct dependency at that point, not assumed to already be safely importable.
