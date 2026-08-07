# CONTRACT_AMENDMENTS.md — resolving the 3 blocking ambiguities from Phase 1

Status: **design only, no code**. This amends `TABLE_SPEC.md`'s 🆕 proposals with actual decisions. Cross-references: `PHASE_1_RISKS.md` #1–#3 (the three ambiguities), `FINDINGS_ADAPTER.md`/`BCF_ADAPTER.md` (source-of-truth for what each domain currently does).

---

## Amendment 1: `level` mapping — CONFIRMED, resolves the gap

**Decision: accept the proposal as given.** `level` becomes optional, `badge` (with its new `semantics` field) becomes the primary visual signal, `level` becomes a secondary/sort-only hint each adapter may or may not populate.

**Why this actually resolves it** (not just defers it): the original problem was that `level` was being asked to mean two *different things* depending on domain — "how severe is this" for Findings, "how important" or "what workflow state" for BCF — with no honest single value covering both. Making it optional plus adding `badge.semantics: "severity"|"status"|"priority"` doesn't force a false equivalence anymore; it lets each domain say explicitly what its badge *means*, and `level` is now allowed to be absent rather than forced into a wrong-shaped answer.

**Mapping, locked:**
- Findings adapter: `level = severity` (`error→"high"`, `warning→"medium"`, `info→"low"`). Note: this uses `"high"/"medium"/"low"`, not `"critical"` — Findings never has a `"critical"` case, since `oguc-core`'s `FindingSeverity` only has 3 values and none of them map naturally to "worse than error." `"critical"` stays reserved/unused for this domain, which is fine now that `level` is optional and not required to cover the full enum.
- BCF adapter: `level = priority` (`High→"high"`, `Medium→"medium"`, `Low→"low"`), **not** `status`. Justification: `level` is described as a severity-adjacent concept ("critical/high/medium/low/info" reads as a severity scale, not a workflow scale), and `priority` is BCF's only field that's actually severity-shaped. `status` (`Open|Pending Review|Resolved`) is a workflow state, not a severity — it does not become `level` under this amendment, full stop.

**Residual item this creates (not one of the original 3, flagging per this task's "flag ambiguities" instruction): what happens to BCF's `status`, since it's now definitively excluded from `level`?** BCF's current UI shows *both* status (colored pill) and priority (colored text) simultaneously, as two separate visual elements — not one badge covering both. Under this amendment, `badge` covers `priority` (per the mapping above), and `status` has no `TableItem`-level field at all anymore. **Resolution: this is fine, not a gap** — thanks to Amendment 3 (below), the BCF adapter's `status` column simply renders directly from `metadata.bcf.status` via a custom `Column.render`, bypassing `badge`/`level` entirely for that column. Two independent visual indicators (badge for priority, a custom-rendered cell for status) instead of forcing both through one `badge` field. Confirmed compatible with the Column interface in Amendment 3 — no contract gap remains here.

---

## Amendment 2: `onSelect` callback — **DECISION: Option A**

**Chosen: Option A** — `Table` itself understands both single- and double-click, and reports which one occurred via a single callback signature: `onSelect: (item: TableItem, event?: 'single' | 'double') => void`.

**Justification:**
1. **Matches the "FINAL AMENDED CONTRACT" this task already sketched** — `onSelect(item, event?)` as one field, not two (`onSelectRow` + `onActivateRow`), which is what Option A naturally produces and what `TABLE_SPEC.md`'s original two-prop proposal (§3, `onActivateRow?`) would have diverged from. Folding it into the same field CONTRATO FINAL already named (`onSelect`) is a smaller amendment than introducing a second, parallel prop.
2. **Simpler for domains that don't need it.** Findings never had a double-click concept — under Option A, its adapter just ignores the `event` argument (or checks `event !== 'double'` defensively, though its current behavior — always camera-jump on click — doesn't even need to). No new complexity forced onto a domain that doesn't use it.
3. **`Table` owning the click/dblclick DOM wiring is the same class of decision it already owns for sorting** — per CONTRATO FINAL, `Table` owns interaction mechanics (sort-column-click, direction toggling), adapters own what happens as a *result*. Single vs. double click is mechanically the same kind of thing: a DOM interaction pattern, not domain logic. Option B would leak that mechanic into every adapter that needs it (today: BCF; potentially more domains later), each reimplementing double-click detection independently — worse for the stated goal of adapters staying thin.
4. **Native `<tr onClick>`/`<tr onDoubleClick>` is simpler than this app's own precedent for manual double-click detection.** Elsewhere in this codebase (`useModelToolActions.ts`, the double-middle-mouse-click → Fit All feature), double-click had to be hand-rolled via `Date.now()` timestamp comparison because the DOM has no native `dblclick` event for the middle mouse button. Table rows don't have that problem — the browser's native `dblclick` event works correctly for standard left-click on `<tr>` elements, so Option A costs *less* implementation complexity than that existing precedent, not more.

**Edge case this decision creates, flagged for Phase 2 (not resolved here — a real implementation detail, not a design ambiguity):** the DOM fires `click`, `click`, then `dblclick`, in that order, for a genuine double-click — three events total, not one. If `Table` naively wires `onClick` → `onSelect(item, 'single')` and `onDoubleClick` → `onSelect(item, 'double')` with no debouncing, a real double-click would invoke `onSelect` **three times** (`'single'`, `'single'`, `'double'`), not once. For BCF this is likely harmless today (`setActiveTopic` on the same topic twice is idempotent), but it's still a real correctness gap worth fixing deliberately in Phase 2 (e.g. delay the `'single'` dispatch by a short timeout, cancelable if a `dblclick` arrives before it fires — a known, standard pattern for this exact problem) rather than discovering it as a bug after implementation. Flagging now so it's budgeted, not silently assumed away.

---

## Amendment 3: `Column` interface — CONFIRMED, with one flagged gap in the fallback-rendering rule

**Decision: accept the interface as given:**
```ts
interface Column {
  key: string;
  label: string;
  width: string;
  sortable: boolean;
  render?: (item: TableItem) => React.ReactNode;
}
```
This is a strict improvement over `TABLE_SPEC.md`'s original proposal (§2) — same shape, minus the `align`/`kind` fields that spec speculated about (fine to drop; neither is used by either domain's real columns per `FINDINGS_ADAPTER.md`/`BCF_ADAPTER.md`, no loss). Resolves the original gap cleanly: every per-row custom cell Findings needs today (state `<select>`, inline note editor, redundant camera-icon button — see `FINDINGS_ADAPTER.md` gap #3) and BCF needs (thumbnail image — `BCF_ADAPTER.md` gap #5) now has a home via `render`.

**Flagged gap — the no-`render` fallback rule, as written, doesn't match `TableItem`'s actual shape.** The task's own example comment says: *"If render not provided, Table uses `item[key]` or `item.metadata[key]` as fallback."* This doesn't type-check against the real `TableItem` interface and needs a decision, not a guess:
- `item[key]` only makes sense for `key` values that are actual top-level `TableItem` fields (`"id" | "index" | "title" | "level"` — `badge`/`metadata` are objects, not display-ready strings, so `item["badge"]` or `item["metadata"]` rendered raw would be wrong/broken).
- `item.metadata[key]` **cannot work as written** — `metadata` isn't a flat bag, it's `{ oguc?: {...}, bcf?: {...} }` (per CONTRATO FINAL, unchanged by these amendments). There is no `item.metadata["elementName"]` — it's `item.metadata.oguc?.elementName`. `Table` has no way to know, for an arbitrary `key` string, whether to look under `.oguc` or `.bcf` — that's domain knowledge Table isn't supposed to have (per "Table doesn't care if level exists or not" — same principle extends to not knowing metadata's internal shape).

**Resolution proposed for Phase 2 (flagged, not decided unilaterally here since it changes the stated fallback behavior):** narrow the no-`render` fallback to top-level `TableItem` fields only (`id`, `index`, `title`, `level` — stringified, with `level` fallback rendering nothing/`"—"` when absent per Amendment 1's optionality). Any column needing `metadata.oguc.*` or `metadata.bcf.*` data **must** supply `render` — which, empirically, is every real column both domains actually need beyond `index`/`title` (per the two adapter docs, every other current column already reads a domain-specific field). In practice this likely means `render` is required on nearly every column except `index`/`title`, and the "fallback" path mostly exists for those two plus `level`. Not a blocker — just correcting the stated fallback rule so Phase 2 doesn't implement a `item.metadata[key]` lookup that cannot actually resolve anything.

---

## Final amended contract (as it stands after all 3 amendments)

```ts
interface TableItem {
  id: string;
  index: number;                 // positional, recalculated by Table after sort — unchanged from Phase 1
  title: string;
  level?: "critical" | "high" | "medium" | "low" | "info";   // AMENDED: now optional
  badge: {
    label: string;
    color: "red" | "orange" | "green" | "blue" | "gray";      // AMENDED: closed enum, not a free CSS color string
    semantics: "severity" | "status" | "priority";             // AMENDED: resolves Phase 1's unresolved §5 "badge.semantics type" question too — closed union, not left as TODO anymore
  };
  metadata: { oguc?: {...}; bcf?: {...} };   // unchanged — inner shape still domain-defined, not part of this contract
  onSelect: (item: TableItem, event?: "single" | "double") => void;   // AMENDED (Amendment 2, Option A)
}

interface Column {
  key: string;
  label: string;
  width: string;
  sortable: boolean;
  render?: (item: TableItem) => React.ReactNode;   // AMENDED — resolves Amendment 3, with the fallback-rule caveat above
}

interface TableProps {
  items: TableItem[];
  columns: Column[];
  config: { sortable: boolean; sortOptions: Record<string, { label: string; compareFn: (a: TableItem, b: TableItem) => number }>; defaultSort: string };
  state: "ready" | "error";        // NEW FIELD — see flagged item below, not resolved by this amendment round
  emptyMessage: string;
  onSelectRow: (item: TableItem, event?: "single" | "double") => void;
}
```

**One more item flagged, not one of the original 3, appearing for the first time in this task's own "FINAL AMENDED CONTRACT" block: `state: 'ready' | 'error'`.** This wasn't part of Phase 1's contract (`TABLE_SPEC.md` §8 only ever discussed a "ready" implicit state, driven entirely by whether the adapter mounts `<Table>` at all) and wasn't one of the 3 ambiguities this task asked to resolve — so it isn't decided here, only surfaced: what does `state: 'error'` render (a distinct error UI, separate from `emptyMessage`)? Who sets it — does an adapter ever have an "error" case today? (Scanning `FINDINGS_ADAPTER.md`/`BCF_ADAPTER.md`: neither current domain has an error-table-state concept — `PreCheckGate` handles model-parse errors upstream, entirely outside `FindingsTable`; BCF has no error state at all today, a failed `.bcf` import just `alert()`s and never reaches `IssueTable`.) This needs its own decision before Phase 2, same treatment as the original 3 — recommend a follow-up amendment round rather than guessing what `'error'` should look like here.

## Summary of what's now locked vs. still open

| Item | Status |
|---|---|
| `level` optional, `badge` primary, mapping per domain | 🔒 Locked (Amendment 1) |
| BCF's `status` axis (now excluded from `level`/`badge`) | 🔒 Resolved — lives in a custom-rendered column instead |
| `onSelect(item, event?)`, Option A | 🔒 Locked (Amendment 2) |
| Triple-fire click/dblclick debouncing | 🆕 Flagged for Phase 2 implementation, not a design question |
| `Column` interface shape | 🔒 Locked (Amendment 3) |
| No-`render` fallback rule (`item.metadata[key]`) | 🆕 Flagged — stated rule doesn't type-check, narrowed proposal given, needs sign-off |
| `badge.color`/`badge.semantics` as closed enums | 🔒 Locked as part of Amendment 1 (also resolves Phase 1's open §5 question) |
| `TableProps.state: 'ready' \| 'error'` | 🆕 New, unresolved — not one of the original 3, needs its own amendment round |
