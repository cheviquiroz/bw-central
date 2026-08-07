# FINDINGS_ADAPTER.md — Finding → TableItem

Source read in full for this analysis: `src/routes/revision/FindingsTable.tsx` (current, real file — the brief's assumed path doesn't exist), plus the `Finding` type it consumes from `packages/oguc-core/src/types/finding.ts`.

## Current structure (as it exists today, before any Table refactor)

- **Sorting:** `useMemo` inside the component, not extracted anywhere reusable. Four `sortKey` values: `severity` (default), `rule`, `state`, `title`. Each is a `.sort()` call inline in the memo body — there is no `Record<string, compareFn>` shape today; the compare logic is a chain of `if/else if` on `sortKey`.
  - `severity`: `SEVERITY_ORDER = { error: 0, warning: 1, info: 2 }` — ascending numeric, most severe first.
  - `rule`: `a.ruleId.localeCompare(b.ruleId)` — alphabetical on the raw id (`"occupancy"` vs `"stairs"`), not on the human label.
  - `state`: `a.state.localeCompare(b.state)` — **alphabetical on the raw string** (`accepted` < `pending` < `rejected`). This is not a logical workflow order, just incidental alphabetical ordering. Worth flagging: nobody appears to have designed this order on purpose.
  - `title`: `a.title.localeCompare(b.title)`.
- **Filtering:** separate from sorting, four `FilterKey` chips (`all | pending | errors | warnings`), each with a live count derived from the full `findings` array (not the sorted/filtered view). This is a second, independent axis from sort — the contract's `TableConfig` doesn't mention filtering at all (see PHASE_1_RISKS.md).
- **Row click:** `onSelect` fires `onSelectFinding(finding)`, wired in `RevisionLayout.tsx` to `handleSelectFinding` — single click only, no double-click distinction. Selecting always attempts a camera frame (via `searchManager.selectAndFocus`, falling back to `fitCameraToAllLoadedModels()` if `elementId === 0` or the element can't be found live).
- **Per-row extra interactivity beyond selection:**
  - A `<select>` dropdown embedded in each row for `state` (pending/accepted/rejected), with its own `onChange` — **not** a row click, deliberately `stopPropagation`'d.
  - A note editor: a toggle button expands an inline `<textarea>` + "Guardar" button in an extra `<tr>` below the row. Also deliberately isolated from row-click via `stopPropagation`.
  - A "view in 3D" camera icon button that does the same thing as clicking the row itself — a redundant explicit affordance for discoverability.
- **Empty state:** resolved **before** any table markup renders — `if (findings.length === 0) return <EmptyState .../>` — the toolbar/filter-chips row doesn't render at all when empty. This already matches the contract's "empty state resolved in adapter, not Table" requirement.

## Finding → TableItem field mapping

| TableItem field | Source on `Finding` | Notes |
|---|---|---|
| `id` | `finding.id` | Already a stable, deterministic id (`ruleId+elementId+modelId`) per oguc-core's own doc comment — no adapter work needed. |
| `index` | *(new)* | Positional, computed by Table itself after sort — Finding has no equivalent today (no findings are numbered in the current UI at all). |
| `title` | `finding.title` | Direct. |
| `level` | `finding.severity` (`error\|warning\|info`) | **Gap — see below.** Contract's `level` has 5 values; Finding only has 3. |
| `badge` | derived from `finding.severity` | `SEVERITY_COLOR`/`SEVERITY_LABEL` maps already exist today (`#ef4444` error, `var(--amber)` warning, `var(--text-low)` info) — direct source for the adapter's badge mapping. |
| `metadata.oguc` | `{ ruleId, elementId, elementName, modelId, boundingBox, state, userNote, description }` | Everything not already promoted to a top-level TableItem field lands here. |
| `metadata.bcf` | *(absent)* | `undefined` for every Finding-sourced item. |
| `onSelect` | wraps `onSelectFinding(finding)` | Direct passthrough — no double-click distinction exists today (see BCF comparison, PHASE_1_RISKS.md). |

## Gaps flagged (do not fit the contract as given, or require a decision)

1. **`level` has 5 values, Finding's `severity` has 3.** `critical`/`high` vs `medium`/`low` have no natural Finding source. Proposed options (not decided here, needs a call before Phase 2):
   - (a) Collapse: `error→critical, warning→medium, info→info`, leaving `high`/`low` permanently unused by this domain.
   - (b) Extend `oguc-core`'s `FindingSeverity` to 5 values — a real breaking change to a published domain type, out of scope for a UI-layer adapter.
   - This needs a decision, not a guess — flagged in PHASE_1_RISKS.md.
2. **Filtering has no home in the contract.** `TableConfig` defines `sortable`/`sortOptions`/`defaultSort` but nothing for filter chips. Findings' filter-by-severity/state UI would need to live entirely outside `<Table>`, in the adapter/wrapper component, the same way it already does today conceptually — but the contract doesn't say where "outside" is, or whether Table should expose a hook for it.
3. **Per-row custom interactive cells** (state `<select>`, inline note editor, redundant camera-icon button) aren't addressed by the contract at all. `TableConfig.columns: Column[]` is referenced but never shaped in the brief — the base `Table` needs *some* per-column custom-cell-renderer mechanism, or these three real, currently-shipping features have nowhere to go.
4. **`state`'s current sort order is alphabetical, not logical.** If unified sorting is meant to be an improvement (not just a refactor), whether to preserve this quirk or fix it during migration needs a decision, not an assumption baked silently into the adapter.
