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

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0 1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" />
    </svg>
  );
}

type SortKey = "rule" | "severity" | "state";
type FilterKey = "all" | "pending" | "errors";

const SEVERITY_ORDER: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };
const SEVERITY_COLOR: Record<FindingSeverity, string> = { error: "#ef4444", warning: "var(--amber)", info: "var(--text-low)" };
const SEVERITY_LABEL: Record<FindingSeverity, string> = { error: "Error", warning: "Advertencia", info: "Info" };
const RULE_LABEL: Record<Finding["ruleId"], string> = { occupancy: "Art. 4.2.4 Ocupación", stairs: "Art. 4.2.10 Escaleras" };
const STATE_LABEL: Record<FindingState, string> = { pending: "Pendiente", accepted: "Aceptado", rejected: "Rechazado" };

interface FindingsTableProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  onChangeState: (findingId: string, state: FindingState) => void;
  onDeleteFinding: (findingId: string) => void;
}

export function FindingsTable({ findings, onSelectFinding, onChangeState, onDeleteFinding }: FindingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [filter, setFilter] = useState<FilterKey>("all");

  const visible = useMemo(() => {
    let list = findings;
    if (filter === "pending") list = list.filter((f) => f.state === "pending");
    else if (filter === "errors") list = list.filter((f) => f.severity === "error");

    const sorted = [...list];
    if (sortKey === "rule") sorted.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    else if (sortKey === "severity") sorted.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    else if (sortKey === "state") sorted.sort((a, b) => a.state.localeCompare(b.state));
    return sorted;
  }, [findings, filter, sortKey]);

  if (findings.length === 0) {
    return <div className="findings-empty">Sin hallazgos - las reglas de cumplimiento aún no se han ejecutado, o el modelo no generó ninguno.</div>;
  }

  return (
    <div className="findings-table-wrap">
      <div className="findings-toolbar">
        <select className="findings-select" value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)}>
          <option value="all">Todas ({findings.length})</option>
          <option value="pending">Pendientes ({findings.filter((f) => f.state === "pending").length})</option>
          <option value="errors">Errores ({findings.filter((f) => f.severity === "error").length})</option>
        </select>
        <select className="findings-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="severity">Ordenar por severidad</option>
          <option value="rule">Ordenar por regla</option>
          <option value="state">Ordenar por estado</option>
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
              onSelect={() => onSelectFinding(finding)}
              onChangeState={(state) => onChangeState(finding.id, state)}
              onDelete={() => onDeleteFinding(finding.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindingRow({
  finding,
  onSelect,
  onChangeState,
  onDelete,
}: {
  finding: Finding;
  onSelect: () => void;
  onChangeState: (state: FindingState) => void;
  onDelete: () => void;
}) {
  const canJumpToElement = finding.elementId !== 0;

  return (
    <tr className={`findings-row state-${finding.state}`} onClick={canJumpToElement ? onSelect : undefined}>
      <td className="findings-col-icon">
        <span className="findings-severity-dot" style={{ background: SEVERITY_COLOR[finding.severity] }} title={SEVERITY_LABEL[finding.severity]} />
      </td>
      <td className="findings-col-rule">{RULE_LABEL[finding.ruleId]}</td>
      <td className="findings-col-title">
        <div className="findings-title-text">{finding.title}</div>
        <div className="findings-description-text">{finding.description}</div>
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
        {canJumpToElement && (
          <button className="findings-action-btn" onClick={onSelect} title="Ver en 3D"><IconCamera /></button>
        )}
        <button className="findings-action-btn findings-delete-btn" onClick={onDelete} title="Eliminar hallazgo"><IconTrash /></button>
      </td>
    </tr>
  );
}
