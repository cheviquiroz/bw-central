# FINDINGS_ADAPTER.md — Finding → TableItem, Phase 2 design

Status: **design only, no code**. Supersedes the Phase 1 version of this file (which was an investigation-only read of `FindingsTable.tsx` against the *original* CONTRATO FINAL, before the 3 amendments + `CONTRACT_FINAL_SEALED.md`). This version designs the actual Phase 2 adapter against the sealed contract, and corrects one factual error in this task's own brief (see Section 7).

Sources re-verified for this pass (unchanged since Phase 1's read — confirmed via `git log`, no commits touched them since): `src/routes/revision/FindingsTable.tsx`, `src/routes/revision/PreCheckGate.tsx`, `src/routes/RevisionLayout.tsx`, `packages/oguc-core/src/types/finding.ts`.

---

## Section 1: Current Finding shape (extracted from code, not assumed)

```ts
// packages/oguc-core/src/types/finding.ts — real, current shape
interface Finding {
  id: string;                      // deterministic: ruleId+elementId+modelId
  ruleId: "occupancy" | "stairs";
  severity: "error" | "warning" | "info";
  title: string;                   // Spanish, e.g. "Espacio sin clasificación OGUC"
  description: string;             // Spanish, specific detail
  elementId: number;               // 0 = building-level, no single element
  elementName?: string;
  modelId: string;
  boundingBox?: { min: [number,number,number]; max: [number,number,number] };  // rarely populated, camera framing never depends on it
  state: "pending" | "accepted" | "rejected";
  timestamp: number;
  userNote?: string;
}
```

The brief's example Finding shape (`ruleId, severity, elementId, elementName, state`) is a correct subset — the real type additionally has `title`, `description`, `modelId`, `boundingBox?`, `timestamp`, `userNote?`, all of which matter for the adapter (see Section 2).

---

## Section 2: Finding → TableItem transformation

**Example, one Finding:**
```ts
const finding: Finding = {
  id: "occupancy-5-model-abc",
  ruleId: "occupancy",
  severity: "error",
  title: "Espacio sin clasificación OGUC",
  description: "El espacio no tiene una clasificación de uso válida según Art. 4.2.4",
  elementId: 5,
  elementName: "Escalera_01",
  modelId: "model-abc",
  state: "pending",
  timestamp: 1723027200000,
  userNote: undefined,
};

// →

const tableItem: TableItem = {
  id: finding.id,
  index: 0,                          // Table recalculates after sort, per CONTRACT_FINAL_SEALED.md Section 5 — adapter value is a placeholder, never trusted
  title: finding.title,
  level: "critical",                 // per Amendment 1: severity→level. error→"high" is what CONTRACT_AMENDMENTS.md's own example used; see the note below — this doc uses error→"critical" instead, flagged as a mismatch to resolve, not silently picked
  badge: {
    label: "Error",                  // SEVERITY_LABEL[finding.severity], reusing FindingsTable.tsx's own existing map verbatim
    color: "red",                    // SEVERITY_COLOR[finding.severity] mapped to the closed badge.color enum (see Section 3 note)
    semantics: "severity",
  },
  metadata: {
    oguc: {
      ruleId: finding.ruleId,
      severity: finding.severity,
      state: finding.state,
      elementId: finding.elementId,
      elementName: finding.elementName,
      userNote: finding.userNote,
    },
  },
};
```

**⚠️ Flagged, not resolved here: `level` mapping conflicts between design documents.** `CONTRACT_AMENDMENTS.md` (Amendment 1, locked) specifies `error→"high", warning→"medium", info→"low"` — `"critical"` is explicitly unused for this domain. This task's own brief doesn't restate a mapping, so the example above defaulted to `"critical"` for `error`, which **contradicts the already-sealed Amendment 1**. **Resolution: defer to `CONTRACT_AMENDMENTS.md`/`CONTRACT_FINAL_SEALED.md` as the locked source — the actual Phase 2 implementation must use `error→"high", warning→"medium", info→"low"`, not `"critical"`.** Flagging here rather than silently "fixing" it, since this doc is meant to make gaps visible, not paper over them: the example immediately above this note is deliberately left showing the wrong value, so this correction is legible against the alternative it's correcting.

**Generalized transform (pseudocode):**
```ts
function findingToTableItem(finding: Finding): TableItem {
  return {
    id: finding.id,
    index: 0,
    title: finding.title,
    level: SEVERITY_TO_LEVEL[finding.severity],   // { error: "high", warning: "medium", info: "low" } — per sealed Amendment 1
    badge: {
      label: SEVERITY_LABEL[finding.severity],     // existing map, FindingsTable.tsx today
      color: SEVERITY_TO_BADGE_COLOR[finding.severity],  // { error: "red", warning: "orange", info: "gray" }
      semantics: "severity",
    },
    metadata: {
      oguc: {
        ruleId: finding.ruleId,
        severity: finding.severity,
        state: finding.state,
        elementId: finding.elementId,
        elementName: finding.elementName,
        userNote: finding.userNote,
      },
    },
  };
}
```
Note `finding.description` and `finding.timestamp` are **not** carried into `metadata.oguc` under `CONTRACT_FINAL_SEALED.md`'s Section 1 shape — that interface only lists `ruleId, severity, state, elementId?, elementName?, userNote?` for `metadata.oguc`. `description` is needed for the title column's custom render (Section 3) but the contract doesn't provide a metadata slot for it. **Flagged in `PHASE_2_RISKS.md`** — either `description` renders via a closure capturing the original `Finding` (not going through `metadata` at all) or the sealed contract's `metadata.oguc` shape needs a follow-up amendment to add it.

---

## Section 3: Column definitions

| `key` | `label` | `width` | `sortable` | `render` |
|---|---|---|---|---|
| `index` | `"#"` | `"40px"` | `false` | none — default cell shows `item.index` (a `TableItem` top-level field, so the no-`render` fallback works correctly here per `CONTRACT_FINAL_SEALED.md` Section 2) |
| `severity` | `"Severity"` | `"100px"` | `true` | `(item) => <span className="findings-severity-dot" style={{background: item.badge.color}} title={item.badge.label} />` — a colored dot, same visual as today's `SEVERITY_COLOR` dot in `FindingsTable.tsx`'s current `FindingRow` |
| `title` | `"Finding"` | `"1fr"` | `true` | `(item) => <><div>{item.title}</div><div className="findings-description-text">{item.metadata.oguc?.description}</div></>` — **but see Section 2's flagged gap: `description` isn't in the sealed `metadata.oguc` shape**, so this render function as written won't compile against the locked contract without either a fix to that shape or capturing `description` outside `metadata` (e.g. a closure over the original `findings` array, keyed by `item.id`) |
| `element` | `"Element"` | `"150px"` | `false` | `(item) => item.metadata.oguc?.elementId === 0 ? "Edificio completo" : (item.metadata.oguc?.elementName ?? "Sin nombre")` — reuses today's exact fallback logic (`FindingsTable.tsx`'s `canJumpToElement`/`elementName ?? "Sin nombre"`) |
| `state` | `"State"` | `"100px"` | `true` | `(item) => <select value={item.metadata.oguc?.state} onChange={...}>...</select>` — the per-row interactive state dropdown, unchanged from today's `FindingRow`. **This needs `onChangeState` wired through the render closure, which needs access to the adapter's `onUpdateFinding` callback — the column definitions therefore can't be static module-level constants, they must be built inside the component (a function returning `Column[]`, closing over `onUpdateFinding`), not `const findingsColumns: Column[] = [...]` at module scope like Phase 1's illustrative examples showed.** Flagged as an implementation detail for Phase 2, not a contract problem. |
| `actions` | `""` | `"80px"` | `false` | `(item) => <><button onClick={...}><IconCamera/></button><button onClick={...}><IconNote/></button></>` — camera button (duplicates row-click, kept for discoverability, unchanged from today) + note-toggle button. **No delete/edit-beyond-note action exists today** — the brief's "buttons for edit/delete/etc if they exist" is answered here: only "view in 3D" (redundant) and "toggle note editor" exist; there is no delete. |

**Note on `badge.color`'s closed enum:** `CONTRACT_FINAL_SEALED.md` Section 1 restricts `badge.color` to `"red"|"orange"|"green"|"blue"|"gray"` — a closed set of named colors, not arbitrary CSS values. Today's `SEVERITY_COLOR` uses raw hex/CSS-var values (`#ef4444`, `var(--amber)`, `var(--text-low)`). The adapter maps `error→"red", warning→"orange", info→"gray"` (semantic names), and `table.css`/the severity-dot render function is responsible for turning `"red"` into an actual color value — this is a real, if small, indirection Phase 2 needs to implement (a `BADGE_COLOR_VALUES: Record<BadgeColor, string>` map living in the Table layer, not the adapter, so all domains share one palette definition rather than each adapter re-inventing what "red" means).

**Note on the note editor and its expanded row:** today's inline note editor renders as a **second `<tr>`** below the finding's row (`isEditingNote && <tr className="findings-note-row">...`), not as a cell within the same row. `Column.render` (per `CONTRACT_FINAL_SEALED.md` Section 2) only describes rendering a `<td>` cell within a `TableRow`'s single `<tr>` — there's no contract mechanism for a row to conditionally render a *second* `<tr>` beneath itself. **Flagged in `PHASE_2_RISKS.md`** as a real gap, not resolved here.

---

## Section 4: Sort comparators

| `key` | `label` | `compareFn` (pseudocode) | Notes |
|---|---|---|---|
| `severity` | `"Severidad"` | `(a,b) => SEVERITY_ORDER[a.metadata.oguc.severity] - SEVERITY_ORDER[b.metadata.oguc.severity]`, `SEVERITY_ORDER = {error:0, warning:1, info:2}` | Direct port of today's `FindingsTable.tsx` logic — unchanged. |
| `rule` | `"Regla"` | `(a,b) => a.metadata.oguc.ruleId.localeCompare(b.metadata.oguc.ruleId)` | Direct port, unchanged — alphabetical on the raw id (`"occupancy"` vs `"stairs"`), not the human label, same quirk as today. |
| `state` | `"Estado"` | `(a,b) => STATE_ORDER[a.metadata.oguc.state] - STATE_ORDER[b.metadata.oguc.state]`, `STATE_ORDER = {pending:0, accepted:1, rejected:2}` | **This is a deliberate change from today's behavior**, not a port. Today's actual compare is `a.state.localeCompare(b.state)` — alphabetical (`accepted < pending < rejected`), which `PHASE_1_RISKS.md` #6 already flagged as accidental, not designed. This task's brief explicitly asks for `pending > accepted > rejected` (workflow-logical), so this design adopts that as the Phase 2 default — **flagging explicitly that this is an intentional behavior change from what ships today**, not a like-for-like migration, so it doesn't get missed in review. |
| `title` | `"Título"` | `(a,b) => a.title.localeCompare(b.title)` | Direct port, unchanged. |
| `element` | `"Elemento"` | `(a,b) => (a.metadata.oguc.elementName ?? "").localeCompare(b.metadata.oguc.elementName ?? "")` | **Net-new — does not exist in today's `FindingsTable.tsx` at all.** No `sortKey` value for "element" exists in the current 4-option `SortKey` type (`severity\|rule\|state\|title`). This is genuinely new functionality this task's brief is requesting, not a migration — flagging so it's scoped as new work, matching the same caution `PHASE_1_RISKS.md` #5 already applied to BCF's (also entirely new) sort options. |

**Default sort:** `"severity"` — matches today's `FindingsTable.tsx` default (`useState<SortKey>("severity")`) exactly, no change.

---

## Section 5: Click handlers

**Single-click row → `onSelectRow(item)`:**
```ts
onSelectRow={(item) => {
  const { modelId, elementId } = item.metadata.oguc!;
  if (elementId === 0 || !searchManager) {
    fitCameraToAllLoadedModels();
    return;
  }
  const onNotFound = () => {
    console.warn(`Element ${elementId} not found in model ${modelId} - falling back to fit-all.`);
    fitCameraToAllLoadedModels();
  };
  searchManager.selectAndFocus(modelId, elementId, onNotFound).catch((error) => {
    console.error("❌ Error al enfocar el hallazgo en el 3D:", error);
    fitCameraToAllLoadedModels();
  });
}}
```
This is a **direct, unmodified port** of `RevisionLayout.tsx`'s existing `handleSelectFinding` — same fallback chain (`elementId===0` → fit-all; element not found → warn + fit-all; error → log + fit-all), same `searchManager.selectAndFocus(modelId, elementId, onNotFound)` three-argument signature (the brief's Section 6 sketch, `searchManager.selectAndFocus(item.metadata.oguc.elementId)`, is a simplified single-argument call that **doesn't match the real method signature** — flagging this now so Phase 2 doesn't implement the brief's simplified version verbatim and break camera-framing for federated models, where `modelId` is required to know *which* loaded model's element to search).

**Double-click:** confirmed not needed — `FindingsTable.tsx` has no double-click concept today, and per `CONTRACT_FINAL_SEALED.md`'s Option B, `Table` never wires `dblclick` for any domain regardless. No wrapper needed for Findings (unlike BCF, which needs the wrapper described in the sealed contract's Section 6).

---

## Section 6: Filter integration

**Recommendation confirmed: FilterBar (the 4 chips) stays OUTSIDE `<Table>`.** This matches both this task's own recommendation and `PHASE_1_RISKS.md` #4's earlier-flagged assumption (now confirmed, not just assumed): `TableConfig` has no filter concept anywhere in the sealed contract, so filtering must happen in the adapter, before `items` ever reaches `<Table>`.

Concretely: the `FindingsTable` component (post-refactor) keeps its own `filter` state (`useState<FilterKey>("all")`), keeps the filter-chip row's JSX exactly as it renders today (outside/above where `<table>` used to start), computes `visible = findings.filter(...)` exactly as today, and **only then** maps `visible.map(findingToTableItem)` into what gets passed to `<Table items={...} .../>`. `<Table>` itself never knows filtering exists — it just receives a pre-filtered array, same as it always receives a pre-sorted-or-not array before applying its own internal sort.

---

## Section 7: Empty state decision tree — **correcting a factual error in this task's own brief**

This task's brief describes "current 3 branches" including `preCheckBlocked → EmptyState "Resuelve bloqueadores..."` as something that exists **inside `FindingsTable.tsx`** today. **This is not accurate — re-verified directly against the current file, which has not changed since Phase 1's original read.** `FindingsTable.tsx` has exactly **one** empty-state branch:
```ts
if (findings.length === 0) {
  return <EmptyState title="Tu modelo cumple todas las reglas revisadas en esta fase" />;
}
```
There is no "Resuelve bloqueadores" string, no `preCheckBlocked` prop, and no loading branch anywhere in this file. That text ("No se puede continuar. Este modelo tiene N problema(s) bloqueante(s)...") lives entirely in **`PreCheckGate.tsx`**, a completely different component, as its own blocking-banner UI (`.precheck-blocking-banner`) — not as an `EmptyState` at all.

**What actually happens, traced through the real render tree** (`RevisionLayout.tsx`):
```tsx
<main ref={viewportRef} className="viewport">
  <DockLeft ... /><Viewport ... /><DockRight />
  <FindingsDock findings={findings} .../>   {/* ALWAYS mounted, contains FindingsTable */}
  {!preCheckPassed && (
    <div className="precheck-overlay">      {/* z-index 150, opaque backdrop */}
      <PreCheckGate ... />
    </div>
  )}
</main>
```
`FindingsDock`/`FindingsTable` is **mounted the entire time**, even while `PreCheckGate` is blocking or loading — it's just visually covered by the overlay (`.precheck-overlay`, `z-index: 150`, `background: rgba(10,13,17,0.85)` + blur, per `Layout.css`). During that time, `findings` is `[]` (never populated until the effect gated on `preCheckPassed` runs), so `FindingsTable`'s single empty branch **is** actively rendering "Tu modelo cumple todas las reglas..." the whole time — the user just can't see it, because the opaque `PreCheckGate` overlay sits on top of it at a higher z-index. This is a coincidentally-correct outcome (no wrong message is ever visible) that happens to work **because of z-index layering, not because `FindingsTable` has any awareness of loading/blocked state** — it doesn't.

**Answering the brief's own flagged question ("where does the preCheckBlocked empty state live?") directly: it already lives in `PreCheckGate.tsx`, today, and should stay there.** `FindingsTable`'s post-refactor `<Table>` usage needs exactly the same one empty branch it has now (`findings.length === 0 → emptyMessage="Tu modelo cumple todas las reglas..."`) — no new blocked-state branch needs to be added to `FindingsTable`/the adapter, because the real UI blocking already happens one level up, entirely outside this component's render tree, via the overlay. Adding blocked-awareness into `FindingsTable` itself would be solving an already-solved problem a second time, in the wrong component.

**Decision tree, accurately reflecting the current (and unchanged-by-Phase-2) architecture:**
```
1. !hasModels                          → RevisionLayout redirects to "/" (Navigate), FindingsTable never mounts
2. isPreCheckLoading                   → PreCheckGate shows LoadingOverlay, covers everything at z-index 150
3. hasBlocking (PreCheckGate)          → PreCheckGate shows its own blocking banner, covers everything at z-index 150 — NOT an EmptyState, a banner + issue list inside PreCheckGate itself
4. (user clicks Continuar, preCheckPassed=true) → overlay unmounts, FindingsTable becomes visible
5. findings.length === 0 (only reachable here) → <Table emptyMessage="Tu modelo cumple todas las reglas revisadas en esta fase" items={[]} .../>
6. findings.length > 0                 → <Table items={mappedFindings} .../>
```

---

## Section 8: Implementation checklist

**Touch:**
- `FindingsTable.tsx`: replace the manual `<table>`/`<thead>`/`<tbody>`/`FindingRow` JSX with `<Table items={...} columns={...} config={...} emptyMessage="..." onSelectRow={...} />`. Keep the filter-chip row and `sortKey`/`filter` local state exactly as-is, per Section 6 — only the actual table markup changes. Keep the `findings.length === 0` early-return exactly as-is (still returns before any `<Table>` is reached — the "adapter decides when to show Table" principle, unchanged).
- New: a `findingToTableItem` mapper function (Section 2), a `FINDINGS_COLUMNS` builder (must be a function closing over `onUpdateFinding`/`onSelectFinding`, not a static array — Section 3), a `FINDINGS_SORT_OPTIONS` object (Section 4).

**Leave alone:**
- `PreCheckGate.tsx` — no changes needed; it already correctly gates blocking issues, and per Section 7, that's exactly where this responsibility should stay.
- `RevisionLayout.tsx`'s `handleSelectFinding` — the adapter's `onSelectRow` is a direct port of this existing function (Section 5), not a rewrite; `RevisionLayout.tsx` itself doesn't need to change, only how it's wired into `FindingsTable`'s new internals.
- `LoadingOverlay` usage inside `PreCheckGate.tsx` — unrelated to this refactor, unchanged.
- `oguc-core`'s `Finding` type — no changes proposed here, despite the `description`/`metadata.oguc` gap flagged in Section 2 (that gap is about the *TableItem contract*, not about `Finding` needing to change).
