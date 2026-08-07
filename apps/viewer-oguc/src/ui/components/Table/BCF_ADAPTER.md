# BCF_ADAPTER.md — BcfTopic → TableItem

Source read in full for this analysis: `src/ui/BcfPanel/IssueTable.tsx` (the real "topics table" — `src/ui/BcfPanel/BcfPanel.tsx` is its header/toolbar wrapper, not the table itself), plus `BcfTopic`/`BcfManagerState` from `src/viewer/bcf/types/bcf.ts`.

## Current structure (as it exists today, before any Table refactor)

- **Display:** a real `<table>` — columns today, in order: thumbnail (image or empty placeholder div), ID (`#` + first 8 chars of `guid`), title, status (colored pill + dot), priority (colored text, no pill), assignee (`—` if unset), created date (raw string, no formatting).
- **Sorting: does not exist.** Confirmed by reading the full file — there is no sort state, no sort UI, no compare function anywhere in `IssueTable.tsx` or `BcfPanel.tsx`. Rows render in whatever order `state.topics` (from `BcfManager`) holds them, which is import order from the parsed `.bcf` file. This is a **hard gap**, not a migration — sort comparators for this domain do not exist to extract; they have to be designed fresh in Phase 2.
- **Filtering:** exists, but by a different mechanism than Findings — `FilterBar.tsx`, a single dropdown/tabs by `status` (`All | Open | Pending Review | Resolved`) with live counts, filtering `state.topics` before they reach `IssueTable`. Conceptually parallel to Findings' filter chips, but implemented as an entirely separate component with a different UI pattern (dropdown vs. chip row).
- **Row interaction — two distinct tiers, confirmed in the JSX:**
  - Single click (`onClick={onSelect}`) → `BcfManager.setActiveTopic(topic)` only. Highlights the row (`.issue-row.active`) and re-emissive-glows the matching 3D pin (`BcfPinRenderer`). **No camera movement.**
  - Double click (`onDoubleClick={onActivate}`) → same `setActiveTopic`, **plus** `Layout.tsx` sets a `bcfSyncRequest` (topic + nonce) that `Viewport.tsx` picks up to move the camera via `cameraControls.setLookAt(...)`.
  - This two-tier model is deliberate, not incidental — commented in `Viewport.tsx`/`Layout.tsx` as avoiding constant camera jumps while a user is scanning the table with single clicks.
- **Empty state:** resolved before any table markup, same pattern as Findings — `if (topics.length === 0) return <EmptyState title="Importa un archivo BCF o crea una nueva incidencia" />` (see `PHASE_1_RISKS.md`/prior investigation: the "crea una nueva incidencia" half of that message has no real feature behind it today — a pre-existing gap, not something this Table refactor needs to fix, but worth not perpetuating uncritically in new copy).

## BcfTopic → TableItem field mapping

| TableItem field | Source on `BcfTopic` | Notes |
|---|---|---|
| `id` | `topic.guid` | Direct, already unique. |
| `index` | *(new)* | Same as Findings — positional, not sourced from anywhere today. |
| `title` | `topic.title` | Direct. |
| `level` | **ambiguous — see gap below** | BCF has two independent severity-like axes (`priority`, `status`), not one. |
| `badge` | derived from `priority` and/or `status` | `STATUS_COLOR`/`PRIORITY_COLOR` maps already exist in `IssueTable.tsx` today — direct source, but only covers one axis at a time; contract's single `badge` field needs a decision on which (or both, as two badges — not supported by the contract as given). |
| `metadata.bcf` | `{ description, createdAuthor, createdDate, assignee, priority, status, viewpoint, comments, markup }` | Everything not promoted to a top-level field. |
| `metadata.oguc` | *(absent)* | `undefined` for every BCF-sourced item. |
| `onSelect` | **ambiguous — see gap below** | Today this domain has TWO handlers (`onSelect` for highlight, `onActivate` for highlight+camera); the contract only defines one. |

## Gaps flagged (do not fit the contract as given, or require a decision)

1. **`level` has no unambiguous source.** BCF's two candidate axes:
   - `priority` (`Low\|Medium\|High`) — maps loosely to 3 of the 5 `level` values, same "3-into-5" gap as Findings' severity, plus BCF's set doesn't even include `critical`.
   - `status` (`Open\|Pending Review\|Resolved`) — this is a *workflow* state, not a severity, and semantically doesn't belong in a field called `level` at all; forcing it there would make `level` mean two different kinds of thing across the two domains (severity for Findings, workflow state for BCF), which would break any shared visual treatment (e.g. a severity-colored left border) that assumes `level` means "how bad is this."
   - This needs a product decision — is `level` meant to be severity-only (then BCF's `priority` is the honest source and `status` needs its own contract field, which doesn't exist), or is it meant to be "the most visually important classification regardless of domain semantics" (then either could work, but that's a different, looser contract than what's written).
2. **`onSelect` is one callback; this domain currently needs two.** The single-click/double-click distinction (highlight-only vs. highlight+camera) is real, shipping, deliberately-designed behavior — not incidental. A single `onSelect` on `TableItem` has nowhere to put the double-click behavior unless the base `Table` component itself understands click-vs-double-click and exposes both (which the contract doesn't mention), or the adapter reimplements double-click detection itself outside the row-click callback the Table gives it (awkward, since Table presumably owns the `<tr onClick>` wiring).
3. **No existing sort comparators to extract — they must be designed, not migrated.** Whatever `sortOptions` this adapter provides in Phase 2 will be new UX, not a refactor of existing behavior. Worth calling out explicitly so Phase 2 doesn't get scoped as "just wire up the sorting that's already there" — there isn't any.
4. **Filtering is a dropdown here, chips for Findings.** If both domains are meant to *look* consistent (not just share row-rendering internals), this is a real UI inconsistency to resolve — but again, filtering isn't in the `TableConfig` contract at all (see FINDINGS_ADAPTER.md gap #2 and PHASE_1_RISKS.md).
5. **Thumbnail column.** BCF's first column is an image thumbnail (`topic.viewpoint.snapshot`) or an empty placeholder div — Findings has no equivalent column. `Column[]`'s shape isn't defined in the contract, so whether it supports an "image" column type at all is unknown; flagged as a `Column` shape gap in `TABLE_SPEC.md`.
6. **ID display truncation.** BCF shows `#` + first 8 chars of a GUID as a human-readable row identifier; Findings has no equivalent (it has the new positional `index` instead). Not a conflict, just noting these solve the "how do I refer to a row" problem two different ways today — positional `index` in the new contract only cleanly replaces Findings' (nonexistent) numbering, not BCF's GUID-fragment display, which BCF may still want to keep (or drop) as `metadata.bcf.guid`, a separate design call outside the strict field-mapping table above.
