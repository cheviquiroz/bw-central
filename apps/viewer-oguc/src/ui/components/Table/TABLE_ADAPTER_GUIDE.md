# TABLE_ADAPTER_GUIDE.md — how to write a domain adapter for `Table<T>`

This is the general pattern; domain-specific field mappings and gaps already live in `FINDINGS_ADAPTER.md` and `BCF_ADAPTER.md` (both based on a full read of the current, real `FindingsTable.tsx`/`IssueTable.tsx`, not assumptions). This document describes the *shape* of an adapter, not a specific one.

## What an adapter owns

Per CONTRATO FINAL ("each keeps its domain logic separate via adapters" / "sort comparators live in the adapter, not the Table" / "empty states resolved in the adapter, not the Table"), an adapter is responsible for everything domain-specific:

1. **Mapping** `DomainType[] → TableItem[]` (e.g. `Finding[] → TableItem[]`, `BcfTopic[] → TableItem[]`).
2. **Deciding whether to render `<Table>` at all** — the empty-state branch happens here, before `<Table>` is ever mounted (see `TABLE_SPEC.md` §8).
3. **Building `TableConfig`** — its `columns`, `sortOptions` (with real `compareFn`s reaching into that domain's fields), and `defaultSort`.
4. **Wiring row callbacks** back to real domain handlers (e.g. `onSelectFinding`, `onTopicSelect`/`onTopicActivate`) via the `metadata.oguc.original`/`metadata.bcf.original` passthrough proposed in `TABLE_SPEC.md` §10.
5. **Any per-column custom cell rendering** that's genuinely domain-specific (Findings' state `<select>`, BCF's thumbnail) — via the proposed `Column.render` (`TABLE_SPEC.md` §2).

## What an adapter does NOT own

- Sorting mechanics (click handling, direction toggling, recomputing `index`) — that's `Table`'s job; the adapter only supplies the comparator function per sort key.
- Row selection highlighting — `Table` tracks `selectedId` internally (or accepts it as a controlled prop); the adapter doesn't manage a parallel "which row is active" state for styling purposes (it may still care about "which item is active" for its *own* domain reasons, e.g. `BcfManager.activeTopic` — that's separate from Table's visual selection state, though in practice they'd likely be kept in sync by whichever component owns both).
- Table markup/CSS structure — the adapter supplies data and column config, not JSX for `<table>`/`<thead>`/`<tbody>`.

## Pseudo-code pattern (illustrative, not real code — per this task's scope)

```
function useFindingsAsTableItems(findings: Finding[]): TableItem[] {
  return findings.map((f) => ({
    id: f.id,
    index: 0,                      // overwritten by Table after sort, per TABLE_SPEC.md §4
    title: f.title,
    level: mapSeverityToLevel(f.severity),   // needs the §1 decision in PHASE_1_RISKS.md before this can be written for real
    badge: { label: SEVERITY_LABEL[f.severity], color: SEVERITY_COLOR[f.severity], semantics: ??? },  // TABLE_SPEC.md §5 - unresolved
    metadata: { oguc: { ...f, original: f } },
    onSelect: () => {},             // per TABLE_SPEC.md §3 interpretation, actual firing happens via Table's onSelectRow + metadata.oguc.original
  }));
}

const FINDINGS_SORT_OPTIONS: TableConfig["sortOptions"] = {
  severity: { label: "Severidad", compareFn: (a, b) => SEVERITY_ORDER[a.metadata.oguc.severity] - SEVERITY_ORDER[b.metadata.oguc.severity] },
  rule:     { label: "Regla",     compareFn: (a, b) => a.metadata.oguc.ruleId.localeCompare(b.metadata.oguc.ruleId) },
  state:    { label: "Estado",    compareFn: (a, b) => a.metadata.oguc.state.localeCompare(b.metadata.oguc.state) },  // alphabetical quirk, see PHASE_1_RISKS.md #6
  title:    { label: "Título",    compareFn: (a, b) => a.title.localeCompare(b.title) },
};
```

```
function useBcfTopicsAsTableItems(topics: BcfTopic[]): TableItem[] {
  return topics.map((t) => ({
    id: t.guid,
    index: 0,
    title: t.title,
    level: mapPriorityToLevel(t.priority),   // OR mapStatusToLevel(t.status) - unresolved, PHASE_1_RISKS.md #1
    badge: { label: t.priority, color: PRIORITY_COLOR[t.priority], semantics: ??? },
    metadata: { bcf: { ...t, original: t } },
    onSelect: () => {},
  }));
}

const BCF_SORT_OPTIONS: TableConfig["sortOptions"] = {
  // net-new - no existing comparators to port, see PHASE_1_RISKS.md #5. Proposed, not confirmed:
  priority: { label: "Prioridad", compareFn: (a, b) => PRIORITY_ORDER[b.metadata.bcf.priority] - PRIORITY_ORDER[a.metadata.bcf.priority] },
  date:     { label: "Fecha",     compareFn: (a, b) => new Date(a.metadata.bcf.createdDate).getTime() - new Date(b.metadata.bcf.createdDate).getTime() },
};
```

## Badge mapping — how each domain colors/labels its items

Both domains already have ready-made color/label maps in their current code — the adapter's badge mapping is a direct reuse, not new design work:
- Findings: `SEVERITY_COLOR`/`SEVERITY_LABEL` (`FindingsTable.tsx`, today) — `error → #ef4444 "Error"`, `warning → var(--amber) "Advertencia"`, `info → var(--text-low) "Info"`.
- BCF: `STATUS_COLOR`/`PRIORITY_COLOR` (`IssueTable.tsx`, today) — two separate maps, since BCF has two axes (see `PHASE_1_RISKS.md` #1 for why only one can become `badge`, pending decision).

The unresolved part is `badge.semantics` (`TABLE_SPEC.md` §5) — neither domain's current code has any equivalent concept to reuse, so this part of the badge mapping is genuinely new, not extractable from existing code.

## Empty state decision tree (per adapter, before `Table` ever receives data)

Both domains already implement this exact branching today — the adapter guide's job is just to name the pattern so it's consciously preserved, not reinvented differently per domain:

```
Findings (RevisionLayout → FindingsTable, today):
  1. no model loaded at all           → handled upstream, in PreCheckGate.tsx, before FindingsTable ever mounts
  2. Pre-Check still running          → LoadingOverlay, also upstream, before FindingsTable mounts
  3. findings.length === 0            → EmptyState "Tu modelo cumple todas las reglas..." (FindingsTable's own branch)
  4. else                             → render <Table> (post-refactor) / current <table> (today)

BCF (Layout → DockBottom → BcfPanel → IssueTable, today):
  1. topics.length === 0              → EmptyState "Importa un archivo BCF..." (IssueTable's own branch)
  2. else                             → render <Table> (post-refactor) / current <table> (today)
```
Note BCF has only one empty-state branch where Findings effectively has three (two of which live outside the table component entirely, upstream in the route). This asymmetry is real and pre-existing — not something the Table refactor needs to equalize, just something to be aware doesn't need "fixing" to match.
