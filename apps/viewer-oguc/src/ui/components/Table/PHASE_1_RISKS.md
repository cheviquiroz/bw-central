# PHASE_1_RISKS.md — Conflicts between current UI, CONTRATO FINAL, and proposed resolutions

Each item below was found by direct comparison of the current, real `FindingsTable.tsx`/`IssueTable.tsx` (see `FINDINGS_ADAPTER.md`/`BCF_ADAPTER.md` for the full read-through) against the `TableItem`/`TableConfig` contract given in this task's brief. Nothing here is guessed — every conflict traces to a specific line/feature in the current code, or a specific gap in the contract as written.

---

## 1. `level`'s 5 values don't cleanly map from either domain — **HIGHEST PRIORITY, blocks a shared visual system**

- Finding has 3 severities (`error|warning|info`); BCF has `priority` (3 values, none named `critical`) and, separately, `status` (a workflow state, not a severity, semantically different from "how bad is this").
- **Conflict:** if `level` is meant to drive one consistent visual treatment (e.g. a colored left-border or dot) across both domains, the two domains currently disagree on what axis even *is* "level" — Findings has an obvious candidate (severity), BCF has two competing, non-equivalent candidates (priority vs. status).
- **Resolution options** (need a decision before Phase 2, not made here):
  - (a) Lock `level` to mean severity-only. BCF's adapter uses `priority` (its only severity-like field), and `status` becomes a separate, undefined-in-contract concept that needs its own home (see risk #4).
  - (b) Amend the contract: split `level` into two concerns (e.g. `severity` + `workflowState`), so each domain populates what it actually has instead of forcing one field to mean different things per domain.
  - **This document does not pick one** — flagging per this task's explicit instruction not to guess.

## 2. `onSelect` is a single callback; BCF's real UX has two distinct click behaviors

- Confirmed in `IssueTable.tsx`: single click → highlight only (`setActiveTopic`); double click → highlight **and** move the 3D camera (`setActiveTopic` + `bcfSyncRequest`). This is deliberate, documented behavior (avoids camera-jumping while scanning rows), not an accident.
- Findings' current `onSelect` is single-click-only and *always* moves the camera — no double-click concept exists there at all.
- **Conflict:** the contract's `TableItem.onSelect: callback` has no room for BCF's two-tier model. Naively wiring `onSelect` to single-click for both domains would either (a) silently regress BCF's UX (every click jumps the camera, contradicting a deliberate design decision), or (b) require BCF's adapter to fake double-click detection itself around a callback the base `Table` presumably already owns via `<tr onClick>`.
- **Resolution options:**
  - (a) Contract amendment: add an optional `onActivate` alongside `onSelect` on `TableItem`; Table wires single-click → `onSelect`, double-click → `onActivate ?? onSelect`. Findings simply never provides `onActivate` (its `onSelect` already does what it does today, unchanged).
  - (b) Defer to Phase 2: ship the base Table single-click-only for v1, and treat "restore BCF's double-click distinction" as a fast-follow once the shared component exists, accepting a temporary UX regression on `/` (BCF panel) during the transition.
  - **Recommend (a)** as it costs one optional prop and avoids shipping a known regression, but this is a recommendation, not a decision made unilaterally here.

## 3. Per-row custom interactive cells (Findings) have no defined mechanism in the contract

- Findings' rows contain, beyond a clickable row: a `<select>` for `state` (own `onChange`, `stopPropagation`'d from row-click), an inline expandable note editor (textarea + save button, also `stopPropagation`'d), and a redundant "view in 3D" icon button duplicating the row-click action.
- **Conflict:** `TableConfig.columns: Column[]` is referenced in the brief but `Column`'s shape is never defined. Without some per-column custom-cell-renderer slot, these three real, currently-shipping Findings features have nowhere to go in a generic `Table`.
- **Resolution:** propose (not lock) a `Column` shape in `TABLE_SPEC.md` that includes an optional `render: (item: T) => ReactNode` per column, letting the adapter own these domain-specific interactive cells while Table only owns row-level layout/click/sort. Flagged there as a **proposal**, since the contract doesn't define `Column` at all — this is new surface area, not an extraction from an existing rule.

## 4. Filtering has no home in `TableConfig` at all

- Both domains filter today (Findings: 4 chips by severity/state; BCF: 1 dropdown by status), via entirely different UI patterns, entirely outside whatever "sorting" means in the contract.
- **Conflict:** `TableConfig` only defines `sortable`/`sortOptions`/`defaultSort` — nothing about filters. If filtering stays outside `<Table>` entirely (adapter-owned, same as today), that's consistent with "Table only gets ready state" — but the brief doesn't say this explicitly, so it's assumed, not confirmed.
- **Resolution:** assume filtering remains 100% adapter/wrapper-owned (matches current architecture for both domains already), and Table never knows filters exist — it just receives whatever pre-filtered `items` array the adapter hands it. **Flagging this assumption explicitly** since the brief is silent on it; if wrong, Phase 2 scope changes meaningfully (Table would need a filter-config concept symmetrical to `sortOptions`).

## 5. BCF has zero existing sort comparators — "adapt" actually means "design new UX"

- Confirmed by full read-through of `IssueTable.tsx`/`BcfPanel.tsx`: no sort state, no sort UI, no compare functions exist anywhere for this domain today.
- **Conflict:** none, technically — but a *scoping* risk. If Phase 2 is estimated as "extract existing sort logic per domain," BCF has none to extract; its `sortOptions` (by priority, by status, by date, etc.) are net-new design + implementation work, not a refactor. Likely to be underestimated if this isn't called out now.
- **Resolution:** treat BCF's sort comparators as new feature work in Phase 2 planning, not a mechanical port. No comparator logic proposed here (out of scope for a read-only design phase) beyond noting the two obvious candidate axes (`priority`, `createdDate`) that mirror Findings' existing `severity`/no-date-field asymmetry (Findings has no date field to sort by at all — another minor domain asymmetry worth naming).

## 6. `state`'s (Findings) current sort order is alphabetical, not designed

- `a.state.localeCompare(b.state)` sorts `accepted < pending < rejected` purely because that's alphabetical — there's no evidence in the code or comments that this order was chosen deliberately (unlike `SEVERITY_ORDER`, which clearly was).
- **Conflict:** none with the contract directly, but a silent-carry-forward risk — if the adapter migration just ports this compare function verbatim, an accidental ordering gets enshrined as if it were intentional.
- **Resolution:** flag for a product decision during Phase 2 implementation (should the order be workflow-logical, e.g. `pending → accepted/rejected`, instead of alphabetical?) rather than silently preserving current behavior by default.

## 7. Numeración (`index`) is entirely new for both domains

- Neither `FindingsTable.tsx` nor `IssueTable.tsx` numbers rows today (Findings: no row numbers at all; BCF: shows a GUID fragment, not a position). This isn't a conflict to resolve — just noting it's 100% new UI for both domains, not a migration of an existing feature, so there's no "current behavior" to preserve or break here.

## 8. Empty-state copy inherited uncritically would perpetuate an existing gap

- BCF's current empty state promises "...crea una nueva incidencia" (create a new BCF topic) — a feature with zero implementation anywhere in the codebase (confirmed via grep in the prior investigation task). Not something this Table refactor needs to fix, but the adapter design in Phase 2 shouldn't copy this string verbatim without either implementing the feature or fixing the copy — otherwise the same broken promise just moves into the new component.

## 9. Visual pattern mismatch: filter UI (chips vs. dropdown), thumbnail column (BCF-only), ID display (GUID fragment vs. none)

- Not blocking, but worth listing together since they're all "the two domains currently look different from each other in ways the contract doesn't address": BCF's thumbnail column and GUID-fragment ID have no Findings equivalent; Findings' filter-chip row and BCF's filter-dropdown are different components solving the same problem differently. None of these break the `TableItem`/`TableConfig` contract as written, since `Column[]`'s shape (once defined, see risk #3) can presumably make columns optional per domain — flagging only so Phase 2 doesn't assume visual parity beyond row-selection/sorting is already guaranteed by adopting a shared `Table`.

---

## Summary table

| # | Conflict | Blocking? | Proposed resolution |
|---|---|---|---|
| 1 | `level`'s 5 values vs. domains' real axes (severity for Findings; priority **or** status, not both, for BCF) | Yes — needs a decision before any adapter code | Contract decision needed: lock `level`=severity-only, or split into two fields |
| 2 | Single `onSelect` vs. BCF's real single/double-click model | Yes — silent UX regression otherwise | Recommend: add optional `onActivate` to `TableItem` |
| 3 | `Column` shape undefined; Findings needs per-cell custom renderers | Yes — Findings' `<select>`/note-editor/redundant-button have nowhere to go otherwise | Propose `Column.render?: (item) => ReactNode` in `TABLE_SPEC.md` |
| 4 | Filtering has no contract field | Assumption made, not blocking | Assume adapter-owned, outside Table entirely; confirm before Phase 2 |
| 5 | BCF has no existing sort logic to port | Scoping risk only | Budget as new feature work, not a refactor |
| 6 | Findings' `state` sort order is accidental (alphabetical) | Not blocking | Decide intentionally during Phase 2, don't silently preserve |
| 7 | `index` numbering is new for both domains | Not a conflict | Just noting it's greenfield, not a migration |
| 8 | BCF empty-state copy promises an unimplemented feature | Not blocking | Don't copy the string forward uncritically in Phase 2 |
| 9 | Visual pattern mismatches (filter UI, thumbnail column, ID display) | Not blocking | Resolve per-column via `Column[]`, once shaped |
