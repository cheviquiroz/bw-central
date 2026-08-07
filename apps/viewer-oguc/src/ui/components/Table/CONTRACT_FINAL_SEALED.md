# FINAL SEALED CONTRACT — Etapa 2 Phase 1

Status: **sealed**. This supersedes `TABLE_SPEC.md`, `TABLE_ADAPTER_GUIDE.md`, and `CONTRACT_AMENDMENTS.md` wherever they conflict with what's written here — those documents remain useful as design history/rationale, but this file is the single source of truth for Phase 2/3 implementation.

**One correction made before sealing:** the brief that produced this document stated, in its own context, "double-click handled in adapter wrapper, Table only does single-click" (Option B) — but its own draft Section 5 described `Table` itself listening for `dblclick` and calling `onSelectRow(item, 'double')`, which is Option A's behavior, not Option B's. These two statements contradicted each other. **Resolved as Option B**, confirmed explicitly before sealing: `Table` never listens for `dblclick` at all, `onSelectRow` never carries an `event` discriminator, and double-click detection — where a domain needs it (today: only BCF) — is entirely the wrapping adapter's own responsibility, outside `<Table>`. Every section below reflects Option B consistently; nothing here still describes Table-native double-click handling.

---

### 1. TableItem Interface (FINAL)

```typescript
interface TableItem {
  // Identity
  id: string;                    // unique: Finding ID or BCF guid
  index: number;                 // positional: 1, 2, 3 (recalculates on sort)

  // Presentation (neutral, adapter-controlled)
  title: string;
  level?: "critical" | "high" | "medium" | "low" | "info";  // OPTIONAL
  badge: {
    label: string;               // "Error", "Open", "Resolved", etc.
    color: "red" | "orange" | "green" | "blue" | "gray";
    semantics: "severity" | "status" | "priority";
  };

  // Domain-specific data (adapter-filled, Table never touches)
  metadata: {
    oguc?: {
      ruleId: string;
      severity: "error" | "warning" | "info";
      state: "pending" | "accepted" | "rejected";
      elementId?: number;
      elementName?: string;
      userNote?: string;
    };
    bcf?: {
      guid: string;
      priority: "Low" | "Medium" | "High";
      status: "Open" | "Pending Review" | "Resolved";
      assignee?: string;
      createdDate: string;
      viewpoint: BcfViewpoint;
    };
  };
}
```

### 2. Column Interface (FINAL)

```typescript
interface Column {
  key: string;                   // "severity", "title", "status" (matches TableItem field)
  label: string;                 // header display: "Severity", "Title", "Status"
  width: string;                 // CSS value: "120px", "1fr", "200px"
  sortable: boolean;             // can user click header to sort?
  render?: (item: TableItem) => React.ReactNode;  // custom render (optional)
  // If render omitted: Table uses item[key] or fallback to item.badge.label
}
```

### 3. TableConfig Interface (FINAL)

```typescript
interface TableConfig {
  columns: Column[];
  sortable: boolean;             // master toggle (if false, no sorting UI anywhere)
  sortOptions: Record<string, {
    label: string;               // display in sort dropdown/header
    compareFn: (a: TableItem, b: TableItem) => number;  // sort comparator
  }>;
  defaultSort: string;           // which sortOption to use on load (key of sortOptions)
}
```

### 4. TableProps Interface (FINAL)

```typescript
interface TableProps<T extends TableItem = TableItem> {
  items: T[];                                         // data to render
  columns: Column[];                                  // column definitions
  config: TableConfig;                                // sort config + column metadata
  emptyMessage: string;                               // shown when items.length === 0
  onSelectRow: (item: T) => void;                     // AMENDED — no event param; Table only ever means single-click, per the Option B correction above
  selectedIndex?: number;                             // optional highlight (controlled by adapter)
}
```

### 5. Table Rendering Logic (FINAL)

**1. Render:**
- `<table>` wrapper with grid CSS.
- `<thead>`: renders Header (columns + sort controls).
- `<tbody>`:
  - If `items.length === 0` → render `<tr><td colspan="all">{emptyMessage}</td></tr>`.
  - Else → render sorted items via `TableRow` component.
- `<tfoot>`: optional footer with row count/info.

**2. Sorting:**
- State: internal `useState(sortBy: string)`.
- On sort column click: update `sortBy`, re-sort items via `config.sortOptions[sortBy].compareFn`.
- Sorted items = `useMemo(() => [...items].sort(compareFn), [items, sortBy])`.

**3. Selection — single-click only, Table-owned:**
- State: internal `useState(selectedIndex: number | null)`.
- On row click (single event, standard `onClick`, no `onDoubleClick` anywhere on `<tr>`): `setSelectedIndex(item.index)`, call `onSelectRow(item)`.
- Highlight: `TableRow` receives `isSelected` prop, applies `.table-row--selected` class.
- **Table never listens for `dblclick`.** A domain that needs double-click behavior (today: BCF, for camera-jump-to-viewpoint) wraps `<Table>` in its own container with its own `onDoubleClick` handler, reading which row was hit from the click event's target (e.g. `closest('tr')` + a `data-row-id` attribute, or tracking `selectedIndex` from the wrapper's own state synced via `onSelectRow`) — entirely outside `Table.tsx`, which stays unaware this distinction exists. This keeps the guarantee in Section 8 literally true: "Table does NOT know about OGUC, BCF, compliance, or coordination" extends here to "Table does not know some domains distinguish single vs. double click at all."

**4. Empty state:**
- Checked ONLY after sort logic (empty array still sorts clean — no special-casing needed, `[].sort()` is a no-op).
- Rendered as full-width message row, not outside table.
- Adapter responsible for NOT passing `Table` if loading/error/blocked (same as today — see Section 9).

### 6. How Adapters Use Table (FINAL)

#### FindingsTable adapter pattern:

```typescript
// Step 1: Convert Finding[] to TableItem[]
const adaptedFindings = findings.map((f, idx) => ({
  id: f.id,
  index: idx + 1,
  title: f.title,
  level: f.severity === "error" ? "high" : f.severity === "warning" ? "medium" : "low",
  badge: {
    label: f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
    color: f.severity === "error" ? "red" : f.severity === "warning" ? "orange" : "gray",
    semantics: "severity"
  },
  metadata: { oguc: { ruleId: f.ruleId, severity: f.severity, state: f.state, elementId: f.elementId, elementName: f.elementName, userNote: f.userNote } }
}));

// Step 2: Define columns
const findingsColumns: Column[] = [
  { key: "index", label: "#", width: "40px", sortable: false },
  { key: "severity", label: "Severity", width: "100px", sortable: true, render: (item) => <SeverityDot /> },
  { key: "title", label: "Finding", width: "1fr", sortable: true },
  { key: "elementName", label: "Element", width: "150px", sortable: false, render: (item) => item.metadata.oguc?.elementName || "—" },
  { key: "state", label: "State", width: "100px", sortable: true },
];

// Step 3: Define sort comparators
const findingsConfig: TableConfig = {
  columns: findingsColumns,
  sortable: true,
  sortOptions: {
    severity: {
      label: "Severity",
      compareFn: (a, b) => {
        const order = { error: 0, warning: 1, info: 2 };
        return order[a.metadata.oguc.severity] - order[b.metadata.oguc.severity];
      }
    },
    rule: { label: "Rule", compareFn: (a, b) => a.metadata.oguc.ruleId.localeCompare(b.metadata.oguc.ruleId) },
    // ... more sort options
  },
  defaultSort: "severity"
};

// Step 4: Render Table — single onSelectRow, no event param, no double-click concept here
return (
  <Table
    items={adaptedFindings}
    columns={findingsColumns}
    config={findingsConfig}
    emptyMessage="Tu modelo cumple todas las reglas"
    onSelectRow={(item) => {
      // Findings-specific logic: camera to element, unchanged from current behavior
      // (real signature is searchManager.selectAndFocus(modelId, elementId, onNotFound) —
      // this pseudocode simplifies it; see RevisionLayout.tsx's real handleSelectFinding
      // for the actual call during Phase 2 implementation)
      searchManager.selectAndFocus(item.metadata.oguc.elementId);
    }}
  />
);
```

#### IssueTable adapter pattern — the one domain that needs double-click:

```typescript
// Steps 1-3: same shape as Findings — BcfTopic[] → TableItem[], columns, config,
// using metadata.bcf instead of metadata.oguc, badge.semantics = "priority".

// Step 4: Render Table wrapped in a double-click detector, since Table itself
// never fires anything but single-click (Section 5.3):
function IssueTable({ topics, onTopicSelect, onTopicActivate }: IssueTableProps) {
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);
  const DOUBLE_CLICK_THRESHOLD_MS = 300; // same constant/pattern this app already
                                          // uses for its other manual double-click
                                          // detector (useModelToolActions.ts's
                                          // double-middle-mouse-click → Fit All)

  const handleSelectRow = (item: TableItem) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === item.id && now - last.time < DOUBLE_CLICK_THRESHOLD_MS) {
      onTopicActivate(item.metadata.bcf.original);  // double-click: move camera
      lastClickRef.current = null;
    } else {
      onTopicSelect(item.metadata.bcf.original);     // single-click: highlight only
      lastClickRef.current = { id: item.id, time: now };
    }
  };

  return <Table items={adaptedTopics} columns={bcfColumns} config={bcfConfig} emptyMessage="..." onSelectRow={handleSelectRow} />;
}
```
This reuses the exact timestamp-comparison pattern already proven elsewhere in this codebase, rather than relying on native `dblclick` (which `Table` deliberately never wires up, per the sealed Option B decision) — consistent, not a new technique being introduced just for this.

### 7. CSS Class Hooks (FINAL)

Table.tsx renders with these class patterns for styling in `table.css`:

```css
.table { /* wrapper */ }
.table-header { /* <thead> */ }
.table-header-cell { /* <th> */ }
.table-header-cell--sortable { /* if column.sortable */ }
.table-header-cell--sort-asc { /* active sort ascending */ }
.table-header-cell--sort-desc { /* active sort descending */ }
.table-body { /* <tbody> */ }
.table-row { /* each <tr> */ }
.table-row--hovered { /* on hover */ }
.table-row--selected { /* if isSelected */ }
.table-cell { /* each <td> */ }
.table-empty-row { /* the empty message row */ }
```

### 8. Contract Guarantees (FINAL)

These things are GUARANTEED by this contract:

✅ Table does NOT know about OGUC, BCF, compliance, or coordination
✅ Table does NOT manage empty state decision (adapter does)
✅ Table does NOT handle loading/error states (adapter does, outside Table)
✅ Table does NOT know how to sort (adapter provides compareFn)
✅ Table does NOT render custom UI (adapter provides Column.render)
✅ Table does NOT know single-click from double-click exists as a domain concept — it only ever emits one kind of selection event
✅ Table ONLY knows: render items, sort them, highlight selection, call callback

✅ Adapters ARE responsible for:
  - Converting domain model → TableItem
  - Deciding when to show Table vs. loading/error/empty
  - Providing Column definitions
  - Providing sort comparators
  - Handling `onSelectRow` callback with domain logic
  - Detecting double-click themselves, if their domain needs it (today: BCF only)

### 9. Non-Breaking (FINAL)

This contract is DESIGNED to NOT break existing code:

- FindingsTable.tsx stays in /revision, same route
- IssueTable.tsx stays in /, same route
- LoadingOverlay stays as-is (FindingsTable still uses it)
- PreCheckGate stays as-is (still blocks before Table renders)
- All domain logic stays EXACTLY where it is

What changes:
- Manual `<table>` HTML → `<Table />` component
- Column rendering → `Column.render` slots
- Sort logic → passed via `TableConfig.sortOptions`
- BCF's existing single/double-click distinction → moves from being handled inline in `IssueTable.tsx`'s row JSX to being handled in a thin wrapper around `<Table>` in that same file (see Section 6) — the *behavior* is unchanged for the end user, only *where in the file* it's implemented moves
- Everything else: identical

### 10. Phase 2 & 3 Execution (FINAL)

**Phase 2 (FindingsTable refactor):**
- Day 1: Write `Table.tsx`, `TableRow.tsx`, `table.css` per this contract
- Day 2: Create `FINDINGS_ADAPTER.md` (Finding → TableItem conversion) — *note: an investigation-grade version of this already exists from Phase 1 (this same directory); Day 2 work is converting that analysis into the actual adapter code, not writing the analysis from scratch*
- Day 3: Refactor `FindingsTable.tsx` to use `<Table />`
- Day 4: Test + iterate

**Phase 3 (IssueTable refactor):**
- Same 4-day pattern for IssueTable, plus the double-click wrapper described in Section 6 (net-new code, not a port — Phase 1's `BCF_ADAPTER.md` already flagged that BCF has no existing sort logic to port either, so Phase 3 is more net-new work than Phase 2 throughout, not just for this one piece)

Total: ~1–1.5 weeks, zero breaking changes.
