// src/routes/revision/FindingsTable.tsx
//
// Presentational, same discipline as PreCheckGate.tsx: findings/state
// mutation live in RevisionLayout.tsx (the single owner of application
// state, per this project's established convention - see Layout.tsx's
// own moduleRuntime comment). Sort/filter are local UI-only state (never
// need to leave this component - nothing else cares how the table is
// currently sorted).
import { useMemo, useState } from "react";
import type { Finding, FindingSeverity, FindingState } from "@bw-central/oguc-core";
import { EmptyState } from "../../ui/EmptyState";
import "./findings-table.css";

// SVG, no emoji - same discipline as ModelTree.tsx/IssueTable.tsx
// elsewhere in this app (visual consistency with the rest of the icon
// set, strokeWidth 1.6/viewBox 24 to match).
function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

function IconNote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  );
}

type SortKey = "severity" | "rule" | "state" | "title";
type FilterKey = "all" | "pending" | "errors" | "warnings";

const SEVERITY_ORDER: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };
const SEVERITY_COLOR: Record<FindingSeverity, string> = { error: "#ef4444", warning: "var(--amber)", info: "var(--text-low)" };
const SEVERITY_LABEL: Record<FindingSeverity, string> = { error: "Error", warning: "Advertencia", info: "Info" };
const RULE_LABEL: Record<Finding["ruleId"], string> = { occupancy: "Art. 4.2.4 Ocupación", stairs: "Art. 4.2.10 Escaleras" };
const STATE_LABEL: Record<FindingState, string> = { pending: "Pendiente", accepted: "Aceptado", rejected: "Rechazado" };

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "errors", label: "Errores" },
  { key: "warnings", label: "Advertencias" },
];

interface FindingsTableProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  onUpdateFinding: (findingId: string, patch: Partial<Finding>) => void;
}

export function FindingsTable({ findings, onSelectFinding, onUpdateFinding }: FindingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);

  const filterCounts: Record<FilterKey, number> = {
    all: findings.length,
    pending: findings.filter((f) => f.state === "pending").length,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
  };

  const visible = useMemo(() => {
    let list = findings;
    if (filter === "pending") list = list.filter((f) => f.state === "pending");
    else if (filter === "errors") list = list.filter((f) => f.severity === "error");
    else if (filter === "warnings") list = list.filter((f) => f.severity === "warning");

    const sorted = [...list];
    if (sortKey === "rule") sorted.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    else if (sortKey === "severity") sorted.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    else if (sortKey === "state") sorted.sort((a, b) => a.state.localeCompare(b.state));
    else if (sortKey === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [findings, filter, sortKey]);

  // Rendered even with 0 findings (Part 7's own acceptance criterion) -
  // the toolbar/filter chips still need a place to live conceptually,
  // but with nothing to filter/sort, showing just the empty message is
  // clearer than an interactive toolbar with every count at zero.
  //
  // Only one empty message, not the three-way split (still-running /
  // blocked / compliant) - by the time this component can render at all,
  // RevisionLayout has already routed through PreCheckGate, which itself
  // blocks onContinue while there are unresolved blocking issues (see
  // PreCheckGate.tsx's canContinue) and shows its own LoadingOverlay while
  // isPreCheckLoading. So findings.length === 0 here can only mean "rules
  // ran, model is compliant" - the other two states aren't reachable at
  // this component.
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
        <select className="findings-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="severity">Ordenar por severidad</option>
          <option value="rule">Ordenar por regla</option>
          <option value="state">Ordenar por estado</option>
          <option value="title">Ordenar por título</option>
        </select>
      </div>
      <table className="findings-table">
        <thead>
          <tr>
            <th className="findings-col-icon" />
            <th className="findings-col-rule">Regla</th>
            <th className="findings-col-title">Hallazgo</th>
            <th className="findings-col-element">Elemento</th>
            <th className="findings-col-state">Estado</th>
            <th className="findings-col-actions" />
          </tr>
        </thead>
        <tbody>
          {visible.map((finding) => (
            <FindingRow
              key={finding.id}
              finding={finding}
              isEditingNote={noteEditingId === finding.id}
              onSelect={() => onSelectFinding(finding)}
              onChangeState={(state) => onUpdateFinding(finding.id, { state })}
              onToggleNoteEditor={() => setNoteEditingId((prev) => (prev === finding.id ? null : finding.id))}
              onSaveNote={(userNote) => {
                onUpdateFinding(finding.id, { userNote });
                setNoteEditingId(null);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindingRow({
  finding,
  isEditingNote,
  onSelect,
  onChangeState,
  onToggleNoteEditor,
  onSaveNote,
}: {
  finding: Finding;
  isEditingNote: boolean;
  onSelect: () => void;
  onChangeState: (state: FindingState) => void;
  onToggleNoteEditor: () => void;
  onSaveNote: (userNote: string) => void;
}) {
  const canJumpToElement = finding.elementId !== 0;
  const [draftNote, setDraftNote] = useState(finding.userNote ?? "");

  return (
    <>
      <tr className={`findings-row state-${finding.state}`} onClick={onSelect}>
        <td className="findings-col-icon">
          <span className="findings-severity-dot" style={{ background: SEVERITY_COLOR[finding.severity] }} title={SEVERITY_LABEL[finding.severity]} />
        </td>
        <td className="findings-col-rule">{RULE_LABEL[finding.ruleId]}</td>
        <td className="findings-col-title">
          <div className="findings-title-text">{finding.title}</div>
          <div className="findings-description-text">{finding.description}</div>
          {finding.userNote && (
            <div className="findings-note-text">
              <IconNote /> {finding.userNote}
            </div>
          )}
        </td>
        <td className="findings-col-element">
          {canJumpToElement ? (
            <>
              {finding.elementName ?? "Sin nombre"} <span className="findings-element-id">#{finding.elementId}</span>
              <span className="findings-camera-hint" title="Ver en 3D"><IconCamera /></span>
            </>
          ) : (
            <span className="findings-element-none">Edificio completo</span>
          )}
        </td>
        <td className="findings-col-state" onClick={(e) => e.stopPropagation()}>
          <select
            className={`findings-state-select state-${finding.state}`}
            value={finding.state}
            onChange={(e) => onChangeState(e.target.value as FindingState)}
          >
            <option value="pending">{STATE_LABEL.pending}</option>
            <option value="accepted">{STATE_LABEL.accepted}</option>
            <option value="rejected">{STATE_LABEL.rejected}</option>
          </select>
        </td>
        <td className="findings-col-actions" onClick={(e) => e.stopPropagation()}>
          <button className="findings-action-btn" onClick={onSelect} title="Ver detalles en 3D"><IconCamera /></button>
          <button className="findings-action-btn" onClick={onToggleNoteEditor} title="Agregar/editar nota">
            <IconNote />
          </button>
        </td>
      </tr>
      {isEditingNote && (
        <tr className="findings-note-row" onClick={(e) => e.stopPropagation()}>
          <td colSpan={6}>
            <div className="findings-note-editor">
              <textarea
                className="findings-note-input"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Nota sobre este hallazgo..."
                rows={2}
              />
              <button className="findings-note-save" onClick={() => onSaveNote(draftNote)}>Guardar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
