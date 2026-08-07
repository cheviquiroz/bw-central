// src/routes/revision/FindingsTable.tsx
//
// Phase 2: refactored to render <Table> (src/ui/components/Table) instead
// of a hand-rolled <table>. Filter chips stay outside Table (adapter
// responsibility, not Table's - see FINDINGS_ADAPTER.md Section 6).
//
// Actions column (camera/note buttons) and the inline note editor are
// DEFERRED to v1.1, per the locked decision in PHASE_2_RISKS.md #4 - the
// sealed Column/Table contract has no mechanism for a row to render a
// second sibling <tr> (which the note editor needs), so onUpdateFinding
// (state changes, notes) has no UI surface anymore and is removed from
// this component's props entirely rather than left as dead plumbing -
// FindingsDock.tsx/RevisionLayout.tsx no longer pass or define it either.
//
// Row selection now owns its own camera-jump logic directly (via a new
// searchManager prop) instead of delegating to a parent onSelectFinding
// callback - TableItem's metadata.oguc doesn't carry a full Finding back
// to the caller, only the fields CONTRACT_FINAL_SEALED.md's Section 1
// lists, so the fallback chain (element not found -> fit-all, etc.) moves
// here, where the click actually happens.
import { useMemo, useState } from "react";
import type { Finding, FindingSeverity, FindingState } from "@bw-central/oguc-core";
import { Table } from "../../ui/components/Table";
import type { Column, TableConfig, TableItem } from "../../ui/components/Table";
import { severityToColor, badgeColorToCss } from "../../ui/components/Table/colorMap";
import { EmptyState } from "../../ui/EmptyState";
import type { SearchManager } from "../../viewer/SearchManager";
import { fitCameraToAllLoadedModels } from "../../core/IfcBootstrap";
import "./findings-table.css";

type FilterKey = "all" | "pending" | "errors" | "warnings";

const SEVERITY_LABEL: Record<FindingSeverity, string> = { error: "Error", warning: "Advertencia", info: "Info" };
const STATE_LABEL: Record<FindingState, string> = { pending: "Pendiente", accepted: "Aceptado", rejected: "Rechazado" };

// error/warning/info -> high/medium/low, per CONTRACT_AMENDMENTS.md's
// already-sealed Amendment 1 - "critical" is deliberately unused for this
// domain (Finding only has 3 severities, none map to it).
const SEVERITY_TO_LEVEL: Record<FindingSeverity, TableItem["level"]> = {
  error: "high",
  warning: "medium",
  info: "low",
};

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "errors", label: "Errores" },
  { key: "warnings", label: "Advertencias" },
];

function SeverityDot({ color }: { color: TableItem["badge"]["color"] }) {
  return <span className="findings-severity-dot" style={{ background: badgeColorToCss[color] }} />;
}

function StateLabel({ state }: { state: FindingState | undefined }) {
  if (!state) return <span className="findings-element-none">—</span>;
  return <span className={`findings-state-label state-${state}`}>{STATE_LABEL[state]}</span>;
}

interface FindingsTableProps {
  findings: Finding[];
  /** Null while the 3D viewer/search index isn't ready yet - same guard the pre-refactor onSelectFinding chain already had (see handleRowSelect below). */
  searchManager: SearchManager | null;
}

export function FindingsTable({ findings, searchManager }: FindingsTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filterCounts: Record<FilterKey, number> = {
    all: findings.length,
    pending: findings.filter((f) => f.state === "pending").length,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
  };

  const visible = useMemo(() => {
    if (filter === "pending") return findings.filter((f) => f.state === "pending");
    if (filter === "errors") return findings.filter((f) => f.severity === "error");
    if (filter === "warnings") return findings.filter((f) => f.severity === "warning");
    return findings;
  }, [findings, filter]);

  // Finding.description has no slot in TableItem.metadata.oguc
  // (CONTRACT_FINAL_SEALED.md's sealed shape doesn't include it - see
  // FINDINGS_ADAPTER.md Section 2 / PHASE_2_RISKS.md #2's chosen
  // resolution: a closure over the original Finding[], not a contract
  // change). Keyed by id, rebuilt whenever the filtered list changes.
  const descriptionById = useMemo(() => new Map(visible.map((f) => [f.id, f.description])), [visible]);

  const items: TableItem[] = useMemo(
    () =>
      visible.map((f, i) => ({
        id: f.id,
        index: i + 1,
        title: f.title,
        level: SEVERITY_TO_LEVEL[f.severity],
        badge: { label: SEVERITY_LABEL[f.severity], color: severityToColor[f.severity], semantics: "severity" },
        metadata: {
          oguc: {
            ruleId: f.ruleId,
            severity: f.severity,
            state: f.state,
            elementId: f.elementId,
            elementName: f.elementName,
            userNote: f.userNote,
            modelId: f.modelId,
          },
        },
      })),
    [visible]
  );

  const columns: Column[] = useMemo(
    () => [
      { key: "index", label: "#", width: "40px", sortable: false },
      { key: "severity", label: "Severity", width: "100px", sortable: true, render: (item) => <SeverityDot color={item.badge.color} /> },
      {
        key: "title",
        label: "Finding",
        width: "1fr",
        sortable: true,
        render: (item) => (
          <>
            <div className="findings-title-text">{item.title}</div>
            <div className="findings-description-text">{descriptionById.get(item.id)}</div>
          </>
        ),
      },
      { key: "elementName", label: "Element", width: "150px", sortable: false, render: (item) => item.metadata.oguc?.elementId === 0 ? "Edificio completo" : (item.metadata.oguc?.elementName ?? "Sin nombre") },
      { key: "state", label: "State", width: "100px", sortable: true, render: (item) => <StateLabel state={item.metadata.oguc?.state} /> },
    ],
    [descriptionById]
  );

  const config: TableConfig = useMemo(
    () => ({
      columns,
      sortable: true,
      sortOptions: {
        severity: {
          label: "Severity",
          compareFn: (a, b) => {
            const order: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };
            return order[a.metadata.oguc!.severity] - order[b.metadata.oguc!.severity];
          },
        },
        rule: { label: "Rule", compareFn: (a, b) => a.metadata.oguc!.ruleId.localeCompare(b.metadata.oguc!.ruleId) },
        state: {
          label: "State",
          compareFn: (a, b) => {
            const order: Record<FindingState, number> = { pending: 0, accepted: 1, rejected: 2 };
            return order[a.metadata.oguc!.state] - order[b.metadata.oguc!.state];
          },
        },
        title: { label: "Finding", compareFn: (a, b) => a.title.localeCompare(b.title) },
        element: { label: "Element", compareFn: (a, b) => (a.metadata.oguc?.elementName ?? "").localeCompare(b.metadata.oguc?.elementName ?? "") },
      },
      defaultSort: "severity",
    }),
    [columns]
  );

  // Direct port of the pre-refactor handleSelectFinding fallback chain
  // (was owned by RevisionLayout.tsx) - elementId===0 or no searchManager
  // -> frame the whole model; element not found live -> warn + fall back;
  // any error -> log + fall back. Never left in a broken camera state.
  const handleRowSelect = (item: TableItem) => {
    const oguc = item.metadata.oguc;
    if (!oguc || oguc.elementId === 0 || oguc.elementId === undefined || !searchManager || !oguc.modelId) {
      fitCameraToAllLoadedModels();
      return;
    }

    const onNotFound = () => {
      console.warn(`Element ${oguc.elementId} not found in model ${oguc.modelId} - falling back to fit-all.`);
      fitCameraToAllLoadedModels();
    };

    searchManager.selectAndFocus(oguc.modelId, oguc.elementId, onNotFound).catch((error) => {
      console.error("❌ Error al enfocar el hallazgo en el 3D:", error);
      fitCameraToAllLoadedModels();
    });
  };

  // Rendered even with 0 findings - the filter chips still need a place to
  // live conceptually, but with nothing to filter, showing just the empty
  // message is clearer than an interactive toolbar with every count at
  // zero. Only one empty message: see FINDINGS_ADAPTER.md Section 7 - by
  // the time this component can render at all, PreCheckGate has already
  // gated blocking issues one level up, so findings.length === 0 here can
  // only mean "rules ran, model is compliant."
  if (findings.length === 0) {
    return <EmptyState title="Tu modelo cumple todas las reglas revisadas en esta fase" />;
  }

  return (
    <div className="findings-table-wrap">
      <div className="findings-toolbar">
        <div className="findings-filter-chips">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              className={`findings-filter-chip${filter === chip.key ? " active" : ""}`}
              onClick={() => setFilter(chip.key)}
            >
              {chip.label} <span className="findings-filter-count">{filterCounts[chip.key]}</span>
            </button>
          ))}
        </div>
      </div>
      <Table
        items={items}
        columns={columns}
        config={config}
        emptyMessage="Tu modelo cumple todas las reglas revisadas en esta fase"
        onSelectRow={handleRowSelect}
      />
    </div>
  );
}
