// src/routes/revision/PreCheckGate.tsx
//
// Presentational only - receives everything via props, computes nothing
// about the model itself. The actual Pre-Check run (readIfcFile +
// oguc-core's runPreCheck) happens in RevisionLayout.tsx, since it's
// async and route-owned state, not this component's concern.
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PreCheckIssue, PreCheckResult } from "@bw-central/oguc-core";
import { LoadingOverlay } from "../../ui/LoadingOverlay";
import "./precheck-gate.css";

interface PreCheckGateProps {
  /** Loaded model display names, keyed the same way as everywhere else in the app - used only to label which model each result set came from. */
  modelNames: Record<string, string>;
  /** One PreCheckResult per modelId, or an Error if that model's bytes couldn't be re-parsed - a malformed/incomplete model is a WARNING per this task's own edge-case rule, never a crash. */
  resultsByModel: Record<string, PreCheckResult | Error>;
  isLoading: boolean;
  onContinue: () => void;
  onBack: () => void;
}

function severityColor(severity: "blocking" | "warning" | "info"): string {
  if (severity === "blocking") return "#ef4444";
  if (severity === "warning") return "var(--amber)";
  return "var(--text-low)";
}

function IssueRow({
  issue,
  checked,
  onToggle,
}: {
  issue: PreCheckIssue;
  checked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <li className="precheck-issue">
      {onToggle && (
        <input type="checkbox" className="precheck-checkbox" checked={checked} onChange={onToggle} />
      )}
      <span className="precheck-issue-dot" style={{ background: severityColor(issue.severity) }} />
      <div className="precheck-issue-text">
        <p className="precheck-issue-message">{issue.message}</p>
        {issue.detail && <p className="precheck-issue-detail">{issue.detail}</p>}
      </div>
    </li>
  );
}

function CollapsibleSection({
  title,
  count,
  color,
  startExpanded,
  children,
}: {
  title: string;
  count: number;
  color: string;
  startExpanded: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  return (
    <section className="precheck-section">
      <button className="precheck-section-header" onClick={() => setExpanded((v) => !v)}>
        <span className="precheck-section-badge" style={{ background: color }}>{count}</span>
        <span className="precheck-section-title">{title}</span>
        <span className={`precheck-section-chevron${expanded ? " open" : ""}`}>▾</span>
      </button>
      {expanded && <div className="precheck-section-body">{children}</div>}
    </section>
  );
}

export function PreCheckGate({ modelNames, resultsByModel, isLoading, onContinue, onBack }: PreCheckGateProps) {
  const modelIds = Object.keys(resultsByModel);

  // Cada modelo cargado corre su propio Pre-Check por separado (ifc-headless
  // no fusiona archivos - ver reader.ts) - acá se combinan sus listas para
  // una sola vista, con el nombre del modelo antepuesto cuando hay más de
  // uno, así un hallazgo sigue siendo identificable en un caso federado.
  const { blocking, warnings, info, parseErrors } = useMemo(() => {
    const blocking: PreCheckIssue[] = [];
    const warnings: PreCheckIssue[] = [];
    const info: PreCheckIssue[] = [];
    const parseErrors: { modelId: string; message: string }[] = [];

    for (const modelId of modelIds) {
      const result = resultsByModel[modelId];
      const label = modelIds.length > 1 ? `${modelNames[modelId] ?? modelId}: ` : "";
      if (result instanceof Error) {
        parseErrors.push({ modelId, message: result.message });
        continue;
      }
      for (const issue of result.blocking) blocking.push({ ...issue, id: `${modelId}:${issue.id}`, message: label + issue.message });
      for (const issue of result.warnings) warnings.push({ ...issue, id: `${modelId}:${issue.id}`, message: label + issue.message });
      for (const issue of result.info) info.push({ ...issue, id: `${modelId}:${issue.id}`, message: label + issue.message });
    }
    return { blocking, warnings, info, parseErrors };
  }, [resultsByModel, modelNames, modelIds]);

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  const toggleAcknowledged = (id: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Un modelo que no se pudo re-parsear (bytes corruptos, o simplemente
  // nunca se retuvieron - ver ModelBytesRegistry.ts) es una ADVERTENCIA,
  // no un bloqueo: la Fase 5 de este brief pide explícitamente no romper
  // la UI ni tratarlo como bloqueante salvo que impida los checks
  // centrales - acá no impide nada, cada modelo se evalúa independiente.
  const hasBlocking = blocking.length > 0;
  const allWarningsAcknowledged = warnings.every((w) => acknowledged.has(w.id)) && parseErrors.every((e) => acknowledged.has(`parse-error:${e.modelId}`));
  const canContinue = !hasBlocking && allWarningsAcknowledged;

  if (modelIds.length === 0 && !isLoading) {
    return (
      <div className="precheck-gate">
        <div className="precheck-empty-state">
          <p>Carga un modelo primero en la vista de exploración.</p>
          <button className="precheck-back-btn" onClick={onBack}>← Volver</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    // isLoading is RevisionLayout.tsx's existing isPreCheckLoading - not
    // a new isPreCheckRunning flag duplicating it under a different name
    // (this prop already tracked exactly that state before this task).
    // "paso 2 de 3" matches this task's own message, describing the real
    // sequence: (1) el modelo ya se cargó en "/", (2) esto - re-parsear +
    // correr Pre-Check -, (3) la revisión misma.
    return <LoadingOverlay isVisible message="Validando pre-requisitos (paso 2 de 3)" />;
  }

  return (
    <div className="precheck-gate">
      <div className="precheck-panel">
        <header className="precheck-header">
          <h2>Pre-Check</h2>
          <p className="precheck-subtitle">Validación de calidad y disponibilidad de datos antes de iniciar la revisión OGUC.</p>
        </header>

        {hasBlocking && (
          <div className="precheck-blocking-banner">
            <strong>No se puede continuar.</strong> Este modelo tiene {blocking.length} problema(s) bloqueante(s) que deben resolverse antes de iniciar la revisión.
          </div>
        )}

        <CollapsibleSection title="Bloqueantes" count={blocking.length} color="#ef4444" startExpanded>
          {blocking.length === 0 ? (
            <p className="precheck-section-empty">Sin problemas bloqueantes.</p>
          ) : (
            <ul className="precheck-issue-list">
              {blocking.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
            </ul>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Advertencias" count={warnings.length + parseErrors.length} color="var(--amber)" startExpanded>
          {warnings.length === 0 && parseErrors.length === 0 ? (
            <p className="precheck-section-empty">Sin advertencias.</p>
          ) : (
            <ul className="precheck-issue-list">
              {parseErrors.map((e) => (
                <IssueRow
                  key={`parse-error:${e.modelId}`}
                  issue={{ id: `parse-error:${e.modelId}`, severity: "warning", message: `${modelNames[e.modelId] ?? e.modelId}: no se pudo volver a analizar el modelo (${e.message}).` }}
                  checked={acknowledged.has(`parse-error:${e.modelId}`)}
                  onToggle={() => toggleAcknowledged(`parse-error:${e.modelId}`)}
                />
              ))}
              {warnings.map((issue) => (
                <IssueRow key={issue.id} issue={issue} checked={acknowledged.has(issue.id)} onToggle={() => toggleAcknowledged(issue.id)} />
              ))}
            </ul>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Información" count={info.length} color="var(--text-low)" startExpanded={false}>
          {info.length === 0 ? (
            <p className="precheck-section-empty">Sin información adicional.</p>
          ) : (
            <ul className="precheck-issue-list">
              {info.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
            </ul>
          )}
        </CollapsibleSection>

        <footer className="precheck-footer">
          <button className="precheck-back-btn" onClick={onBack}>← Volver</button>
          {!hasBlocking && (warnings.length > 0 || parseErrors.length > 0) && !allWarningsAcknowledged && (
            <span className="precheck-ack-hint">Marca "Entendido" en cada advertencia para continuar.</span>
          )}
          <button className="precheck-continue-btn" disabled={!canContinue} onClick={onContinue}>
            Continuar
          </button>
        </footer>
      </div>
    </div>
  );
}
