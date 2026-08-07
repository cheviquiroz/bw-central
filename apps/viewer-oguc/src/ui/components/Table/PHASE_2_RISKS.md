# PHASE_2_RISKS.md — gaps between current FindingsTable and the sealed Table contract

Each item traces to a specific finding in `FINDINGS_ADAPTER.md` (Phase 2 version). Nothing here is guessed — every risk is either a direct code comparison or an explicit contradiction between this task's brief and the already-sealed `CONTRACT_FINAL_SEALED.md`/`CONTRACT_AMENDMENTS.md`.

---

## 1. `level` mapping: this task's own example contradicts the already-sealed Amendment 1

- `FINDINGS_ADAPTER.md` Section 2's worked example used `error → "critical"`; the locked `CONTRACT_AMENDMENTS.md` (Amendment 1) specifies `error → "high"` (with `"critical"` deliberately unused for this domain).
- **Resolution: not a new decision — just enforce the already-sealed mapping.** `SEVERITY_TO_LEVEL = { error: "high", warning: "medium", info: "low" }`. Flagging only because this task's brief itself introduced the inconsistency; Phase 2 implementation must not copy the brief's example value.

## 2. `Finding.description` has no home in the sealed `metadata.oguc` shape

- `CONTRACT_FINAL_SEALED.md` Section 1 defines `metadata.oguc` as `{ ruleId, severity, state, elementId?, elementName?, userNote? }` — no `description` field. But the title column's current UI (`FindingsTable.tsx`'s `FindingRow`) shows both `finding.title` **and** `finding.description` stacked in one cell, and the Phase 2 column design (Section 3) needs both.
- **Resolution options** (not decided here):
  - (a) Follow-up amendment to `CONTRACT_FINAL_SEALED.md`, adding `description?: string` to `metadata.oguc`. Cheapest fix, but touches a document already marked "sealed."
  - (b) The title column's `render` closes over the original `Finding[]` array (keyed by `item.id`) instead of reading from `metadata` — works without touching the contract, but means the adapter needs to thread the original findings array into its column-builder function alongside `TableItem[]`, a small but real bit of extra plumbing.
  - **Recommend (b)** to avoid re-opening a sealed document for one field, but this is a recommendation, not a decision made unilaterally here.

## 3. Column definitions can't be static constants — they need live handlers

- The `state` column (a `<select>`) and `actions` column (camera + note-toggle buttons) both need to call back into `onUpdateFinding`/note-editing state that lives in the `FindingsTable` component itself. Phase 1's illustrative examples (`TABLE_SPEC.md`, `CONTRACT_FINAL_SEALED.md` Section 6) showed `const columns: Column[] = [...]` as a module-level constant — that pattern can't work once columns need closures over component state/props.
- **Resolution:** not a contract problem, an implementation-pattern note — `FINDINGS_COLUMNS` must be built by a function called during render (e.g. `buildFindingsColumns({ onUpdateFinding, noteEditingId, setNoteEditingId })`), not declared once outside the component. Low risk, just needs to not be missed.

## 4. The inline note editor renders as a *second `<tr>`* — no contract mechanism supports that

- Today, toggling the note editor for a finding inserts an entire extra `<tr className="findings-note-row">` directly below that finding's row, spanning all columns (`colSpan={6}`), containing a `<textarea>` + save button. `Column.render` (`CONTRACT_FINAL_SEALED.md` Section 2) only produces the contents of a single `<td>` inside one `<tr>` — there's no way for a column's `render` function to inject a sibling row.
- **This is a real, unresolved gap — not solved by this design document.** Options, none decided here:
  - (a) Extend `TableRow.tsx` (Phase 1's base component) with an optional "expanded content" concept — a second contract amendment to the base `Table`, not just the adapter.
  - (b) Move the note editor out of the table entirely (e.g. a side panel or modal triggered by the note button, instead of an inline expanding row) — changes the UX, not just the implementation.
  - (c) Defer: ship Phase 2 without inline note editing inside `<Table>`, keep the note feature on the old markup path temporarily, and treat "note editor inside Table" as its own follow-up phase.
  - **Flagging for a decision before Phase 2 implementation begins** — this is not a minor detail, it's a real feature (already shipping today) with no clear path forward under the current sealed contract as written.

## 5. `state` sort order is being deliberately changed, not preserved

- Not a contract gap, but a behavior-change risk worth calling out explicitly (per `FINDINGS_ADAPTER.md` Section 4): today's `state` sort is accidentally alphabetical (`accepted < pending < rejected`); this design adopts a workflow-logical order (`pending < accepted < rejected`) instead, per this task's own brief. **Flagging so this shows up in review as an intentional product decision, not an accidental regression** — if it's not actually wanted, Phase 2 should keep the alphabetical `localeCompare`, not this design's proposed `STATE_ORDER` map.

## 6. `"element"` sort option is entirely new functionality

- No `sortKey` value for sorting by element name exists in today's `FindingsTable.tsx` (`SortKey = "severity"|"rule"|"state"|"title"`, no `"element"`). This task's brief asks for it anyway. **Not a migration — budget as new feature work**, same caution already applied to BCF's (also entirely new) sort options in `PHASE_1_RISKS.md` #5.

## 7. `searchManager.selectAndFocus`'s real signature doesn't match this task's own brief's sketch

- Brief's Section 6 shows `searchManager.selectAndFocus(item.metadata.oguc.elementId)` — a single argument. The real method (`RevisionLayout.tsx`'s `handleSelectFinding`, unchanged) is `searchManager.selectAndFocus(modelId, elementId, onNotFound)` — three arguments, and `modelId` is required to disambiguate which loaded model (this app supports federated/multi-model loading) the `elementId` belongs to.
- **Resolution: `FINDINGS_ADAPTER.md` Section 5 already specifies the correct, real call** — flagging here only so Phase 2 implementation works from that corrected version and doesn't copy this task's brief's simplified sketch verbatim, which would silently break camera-framing for any session with more than one model loaded.

## 8. `badge.color`'s closed enum needs a palette-resolution layer that doesn't exist yet

- `CONTRACT_FINAL_SEALED.md` restricts `badge.color` to 5 named values (`red|orange|green|blue|gray`); today's actual colors are raw hex/CSS-vars (`#ef4444`, `var(--amber)`). Someone has to map `"red"` → an actual paintable value. This doesn't belong in the Findings adapter specifically (BCF will need the exact same resolution for its own badges) — it belongs in the shared `Table`/`table.css` layer as a `BADGE_COLOR_VALUES` map, which doesn't exist yet (Phase 1's `table.css` didn't need it, since Phase 1 shipped no badge column). **Flagged as Phase 2 (or a small Phase 1.5) scope, not something the Findings adapter alone should invent its own copy of** — if BCF's Phase 3 adapter independently invents a second color-resolution map, that's the exact kind of drift this whole Table effort is supposed to prevent.

## 9. Empty-state responsibility is correctly already resolved by existing code — flagging so Phase 2 doesn't "fix" something that isn't broken

- Per `FINDINGS_ADAPTER.md` Section 7: this task's own brief mischaracterized `FindingsTable.tsx` as having a `preCheckBlocked` branch it doesn't actually have. The real architecture (overlay z-index hiding an always-mounted `FindingsTable`) already correctly prevents the wrong message from ever being visible, without `FindingsTable` needing any blocked-state awareness. **Risk: if Phase 2 implementation trusts this task's brief instead of the corrected Section 7, it might add unnecessary `preCheckBlocked`-handling code to the adapter that duplicates what `PreCheckGate.tsx` already does correctly.** No code change recommended here — just flagging so Phase 2 doesn't invent a fix for a non-problem, consistent with this session's repeated finding that several "bugs" investigated earlier this session didn't actually exist in the current code.

---

## Summary table

| # | Risk | Blocking? | Resolution |
|---|---|---|---|
| 1 | `level` example in this task's brief contradicts sealed Amendment 1 | No — just don't copy the brief's wrong example | Use `error→"high"` per already-sealed contract |
| 2 | `Finding.description` has no slot in sealed `metadata.oguc` | Yes for the title column's current UI | Recommend: render closes over original `Finding[]`, not `metadata` |
| 3 | Columns need live closures, can't be static constants | Implementation-pattern only | Build columns via a function, not a module constant |
| 4 | Inline note editor needs a second `<tr>`, no contract mechanism exists | **Yes — real, unresolved** | Needs a decision: extend base Table, move UX out of table, or defer |
| 5 | `state` sort order changes from accidental-alphabetical to designed-workflow order | Not blocking, but a real behavior change | Confirm intentional before Phase 2 ships it |
| 6 | `"element"` sort is net-new, not a port | Scoping risk only | Budget as new feature work |
| 7 | Brief's `selectAndFocus` call sketch doesn't match the real 3-arg signature | Yes if copied verbatim | Use the corrected version already in `FINDINGS_ADAPTER.md` Section 5 |
| 8 | `badge.color` closed enum needs a shared palette-resolution layer | Yes, but shared across domains, not Findings-specific | Build once in Table/table.css layer, not per-adapter |
| 9 | Brief mischaracterizes current empty-state architecture as needing new work | No — existing architecture already correct | Don't build unneeded blocked-state handling into the adapter |
