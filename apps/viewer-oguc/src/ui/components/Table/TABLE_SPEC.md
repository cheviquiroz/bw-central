# TABLE_SPEC.md — `Table<T>` component design

Status: **design only, no code**. Fields marked 🔒 come directly from CONTRATO FINAL as given and are treated as locked. Fields marked 🆕 are proposals filling gaps the contract left undefined (see `PHASE_1_RISKS.md` for why each gap exists) — these are **not locked**, they need sign-off before Phase 2 implementation.

## 1. Locked types (from CONTRATO FINAL, reproduced for reference)

```
🔒 TableItem:
  id: string
  index: number
  title: string
  level: "critical" | "high" | "medium" | "low" | "info"
  badge: { label: string; color: string; semantics: ??? }   // "semantics" type unspecified - see §5
  metadata: { oguc?: {...}; bcf?: {...} }
  onSelect: callback

🔒 TableConfig:
  columns: Column[]        // Column shape unspecified - see §2
  sortable: boolean
  sortOptions: Record<string, { label: string; compareFn: (a, b) => number }>
  defaultSort: string
```

## 2. 🆕 Proposed `Column<T>` shape (contract left this undefined)

```ts
interface Column<T extends TableItem> {
  key: string;                          // stable key, also a candidate sortOptions key
  header: string;                       // <th> label
  width?: string;                       // CSS width/minmax token, e.g. "120px" or "1fr"
  align?: "left" | "center" | "right";
  render?: (item: T) => ReactNode;      // custom cell - REQUIRED to support Findings' <select>/note-editor/camera-button (PHASE_1_RISKS.md #3)
  kind?: "text" | "badge" | "thumbnail"; // if no render given, Table renders a sane default per kind - "thumbnail" needed for BCF (PHASE_1_RISKS.md #9)
}
```
Rationale: without `render`, three real, currently-shipping Findings features (state `<select>`, inline note editor, redundant camera-icon button) have no way to exist inside a generic `<Table>`. Without `kind: "thumbnail"`, BCF's image column has no default renderer either. Both are additions to fill contract gaps, not part of the locked spec — flagged for confirmation.

## 3. Props interface (exact shape, pending §2/§5 sign-off)

```ts
interface TableProps<T extends TableItem> {
  items: T[];                    // already domain-filtered by the adapter (see §7) - Table never filters
  config: TableConfig;
  /** Table renders NOTHING (not even <table>) if this is set - contract's "Table only gets ready state" */
  emptyMessage?: ReactNode;
  /** Currently selected row id, if the caller wants controlled selection highlighting. Optional - Table can also track this internally if omitted (see §4). */
  selectedId?: string | null;
  onSelectRow: (item: T) => void;         // 🔒 wraps item.onSelect per CONTRATO FINAL's onSelect-per-item design - see note below
  onActivateRow?: (item: T) => void;      // 🆕 optional - see PHASE_1_RISKS.md #2, fills BCF's double-click gap. Undefined for Findings (single-tier).
}
```

**Note on `onSelect` placement:** CONTRATO FINAL puts `onSelect` *on `TableItem` itself* ("TableItem interface: ... onSelect: callback"), not as a `Table`-level prop. This spec treats that as: each item arrives pre-bound with its own `onSelect` closure (the adapter's job, per "Table only gets ready state" — Table shouldn't need to know how to call back into domain code, just call `item.onSelect()`). `Table`'s own `onSelectRow` prop above is what actually invokes `item.onSelect()` plus handles the row-highlighting side-effect — i.e. `Table` internally does `onClick={() => { setSelectedId(item.id); item.onSelect(); onSelectRow?.(item); }}`. Flagging this as an interpretation of the contract, not a re-definition — the contract doesn't say whether `Table` needs its own top-level select prop in addition to per-item `onSelect`, so this spec assumes yes (for the "which row is highlighted" state Table owns internally, see §4).

## 4. State management (🔒 internal `useState`, no Context, per CONTRATO FINAL)

```ts
const [sortBy, setSortBy] = useState<string>(config.defaultSort);
const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
```
- `selectedId` prop (§3) overrides `internalSelectedId` when provided (controlled vs. uncontrolled selection, same pattern as a controlled `<input>`), else Table manages its own.
- `sortBy`/`sortDirection` are always internal — the contract doesn't mention a controlled-sort prop, and nothing in either domain's current code needs sort state to live outside the table (Findings' current `sortKey` state is already component-local today).
- No `useEffect` needed for sorting — sorted items are derived via `useMemo(() => [...items].sort(sortOptions[sortBy].compareFn), [items, sortBy, sortDirection])`, applying `sortDirection` as a final reverse if `"desc"`.
- `index` (🔒 positional numbering) is computed in the same `useMemo`, **after** sorting — `sorted.map((item, i) => ({ ...item, index: i + 1 }))` — never trusted from whatever `index` value the adapter happened to set, since the contract explicitly says it "recalculates on sort."

## 5. 🆕 Open question: `badge.semantics` type

CONTRATO FINAL includes `badge: { label, color, semantics }` but never defines what `semantics` is for or what type it holds. This spec does **not** guess a shape for it (per this task's explicit "don't guess, flag ambiguities" instruction) — proposed candidates to choose from before Phase 2:
- An ARIA-facing string (e.g. `"error"|"warning"|"success"` for `aria-label`/screen-reader context, decoupled from the visual `color`).
- A colorblind-safe icon/shape hint (e.g. `"circle"|"triangle"|"square"`, so severity is distinguishable without relying on color alone).
- Something else entirely tied to a design system not yet described to this investigation.
Left as an explicit **TODO — needs answer before Phase 2**, not filled in with a guess.

## 6. Rendering logic

```
<table class="table">
  <thead>
    <tr>
      {config.columns.map(col => (
        <th
          class={sortBy === col.key ? `table-header--sort-${sortDirection}` : ""}
          onClick={config.sortable && sortOptions[col.key] ? () => handleSortClick(col.key) : undefined}
        >
          {col.header}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {sortedIndexedItems.map(item => (
      <tr
        key={item.id}
        class={[
          isSelected(item.id) && "table-row--selected",
          // hover is CSS-only (:hover), not JS state - see table.css §"hover" -
          // no need for a table-row--hovered class unless a future requirement
          // needs JS to react to hover, which nothing in either domain does today
        ].filter(Boolean).join(" ")}
        onClick={() => handleRowClick(item)}
        onDoubleClick={onActivateRow ? () => handleRowActivate(item) : undefined}
      >
        {config.columns.map(col => (
          <td>{col.render ? col.render(item) : defaultCellRender(item, col)}</td>
        ))}
      </tr>
    ))}
  </tbody>
</table>
```
- `handleSortClick(key)`: if `sortBy === key`, toggle `sortDirection`; else `setSortBy(key); setSortDirection("asc")`. This is 🆕 (the contract says sorting exists but not the toggle-direction interaction pattern) — proposed as the standard "click again to reverse" convention, needs confirmation it's actually wanted (neither current domain's UI has direction-toggling today; Findings' `<select>`-based sort picker has no concept of direction at all).
- `handleRowClick`/`handleRowActivate` both update `internalSelectedId` (if uncontrolled) and call the respective item/prop callbacks per §3.
- Footer: not mentioned in the contract and neither current table has one — proposed as **out of scope for v1**, not designed here.

## 7. Sorting behavior — how `sortOptions` flows through

1. Adapter builds `config.sortOptions = { severity: { label: "Severidad", compareFn: (a,b) => ... }, ... }` — one entry per sortable column, using that domain's own comparators (see `FINDINGS_ADAPTER.md`/`BCF_ADAPTER.md`).
2. `config.defaultSort` names which key is active on first render (e.g. `"severity"` for Findings — matches its current default).
3. Table never inspects `TableItem.metadata` to decide sort order itself — `compareFn(a: TableItem, b: TableItem)` receives the *full* `TableItem`, so a domain's `compareFn` can reach into `a.metadata.oguc.ruleId` etc. as needed. This keeps "sort comparators live in the adapter, not Table" (🔒 CONTRATO FINAL) literally true — Table just calls whatever function it's handed.

## 8. Empty state slot

🔒 Per CONTRATO FINAL, "Table only gets ready state" — meaning the adapter decides zero-items handling **before** calling `<Table>` at all, matching what both `FindingsTable.tsx` and `IssueTable.tsx` already do today (`if (items.length === 0) return <EmptyState .../>`, never reaching table markup). Given that, `Table`'s own `emptyMessage` prop (§3) is a defensive fallback only — e.g. if an adapter passes `items={[]}` without checking, Table renders `emptyMessage` instead of a headerless empty `<table>`. Not the primary empty-state mechanism; the primary mechanism is the adapter never mounting `<Table>` in the first place, same as today.

## 9. Hover/selection CSS hooks

- `.table-row--selected` — 🔒 named directly in the brief.
- `.table-row--hovered` — 🔒 named directly in the brief, but per §6, this spec proposes hover stays pure-CSS (`:hover` pseudo-class) rather than a JS-managed class, since nothing in either domain's current behavior needs JS to know about hover state. If a future requirement needs JS-hover (e.g. a hover-triggered 3D pin highlight, mirroring BCF's existing *selection*-triggered pin glow), the class name is reserved and this note explains why it's not wired to `useState` yet — flagged, not decided.
- `.table-header--sort-asc` / `.table-header--sort-desc` — 🔒 named directly in the brief, applied per §6.

## 10. Example usage (pseudocode only, per this task's "no real code yet")

```
// FindingsTable.tsx, after refactor (illustrative, not final):
<Table<TableItem>
  items={findingsAsTableItems}          // from FINDINGS_ADAPTER
  config={{
    columns: FINDINGS_COLUMNS,           // icon, rule, title+desc, element, state-select, actions
    sortable: true,
    sortOptions: FINDINGS_SORT_OPTIONS,  // severity/rule/state/title compareFns
    defaultSort: "severity",
  }}
  onSelectRow={(item) => onSelectFinding(item.metadata.oguc.original)}
  // no onActivateRow - single-tier click model, unchanged from today
/>

// IssueTable.tsx, after refactor (illustrative, not final):
<Table<TableItem>
  items={topicsAsTableItems}            // from BCF_ADAPTER
  config={{
    columns: BCF_COLUMNS,                // thumbnail, id, title, status, priority, assignee, date
    sortable: true,
    sortOptions: BCF_SORT_OPTIONS,       // net-new, see PHASE_1_RISKS.md #5
    defaultSort: "priority",             // proposed, not extracted from existing behavior (none exists)
  }}
  onSelectRow={(item) => onTopicSelect(item.metadata.bcf.original)}
  onActivateRow={(item) => onTopicActivate(item.metadata.bcf.original)}  // preserves double-click camera-jump, PHASE_1_RISKS.md #2
/>
```
Both examples assume `metadata.oguc`/`metadata.bcf` carry an `original: Finding | BcfTopic` reference back to the source object, since the contract's `metadata` shape is `{...}` (unspecified inner fields) — proposed here so the adapter's callbacks can call the *real* domain handlers (`onSelectFinding`, `onTopicSelect`, etc.) without Table needing to know those types exist. Flagged as a proposal, not confirmed by the contract.
