// src/ui/Panels/ReviewInfoPanel.tsx
//
// Etapa 4b-6 - presentational only, mismo criterio que PreCheckGate.tsx ya
// documenta en su propio header ("computes nothing about the model
// itself"). El Pre-Check/findings real vive en
// src/components/Layout/useReviewInfoState.ts, llamado una sola vez desde
// Layout.tsx (que nunca se desmonta) - NO acá: FloatingPanel.tsx desmonta
// sus children por completo al cerrarse (`if (!panelState.open) return
// null`), así que cualquier estado local de ESTE componente se habría
// perdido en cada close/reopen, rompiendo el criterio del brief "cerrar y
// reabrir no debe re-correr el Pre-Check" - encontrado en vivo verificando
// ese mismo criterio, ver el comentario en useReviewInfoState.ts.
import { FindingsTable } from "../../routes/revision/FindingsTable";
import { PreCheckGate } from "../../routes/revision/PreCheckGate";
import type { SearchManager } from "../../viewer/SearchManager";
import type { ModelDisplayNames } from "../../engine/createApplication";
import type { ReviewMode } from "../../components/Layout/useReviewInfoState";
import type { Finding, PreCheckResult } from "@bw-central/oguc-core";
import "./review-info-panel.css";

const REVIEW_MODE_LABEL: Record<ReviewMode, string> = { oguc: "OGUC", ids: "IDS", other: "Otro" };

interface ReviewInfoPanelProps {
  searchManager: SearchManager | null;
  hasModels: boolean;
  modelDisplayNames: ModelDisplayNames;
  preCheckPassed: boolean;
  preCheckResults: Record<string, PreCheckResult | Error> | null;
  isPreCheckLoading: boolean;
  findings: Finding[];
  reviewMode: ReviewMode;
  setReviewMode: (mode: ReviewMode) => void;
  allModelsFailed: boolean;
  onContinue: () => void;
  onRetry: () => void;
}

export function ReviewInfoPanel({
  searchManager,
  hasModels,
  modelDisplayNames,
  preCheckPassed,
  preCheckResults,
  isPreCheckLoading,
  findings,
  reviewMode,
  setReviewMode,
  allModelsFailed,
  onContinue,
  onRetry,
}: ReviewInfoPanelProps) {
  if (!hasModels) {
    return <p className="review-info-empty">Carga un modelo para iniciar revisión</p>;
  }

  if (!preCheckPassed) {
    return (
      <div className="review-info-gate-wrap">
        {allModelsFailed && (
          <div className="review-info-retry-banner">
            <span>No se pudo re-analizar ningún modelo cargado.</span>
            <button className="review-info-retry-btn" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        )}
        <PreCheckGate
          modelNames={modelDisplayNames}
          resultsByModel={preCheckResults ?? {}}
          isLoading={isPreCheckLoading}
          onContinue={onContinue}
          // No hay a dónde "volver": este Pre-Check vive dentro de un panel
          // flotante de "/", no de la ruta /revision - PreCheckGate.tsx
          // siempre renderiza el botón (prop requerida, componente
          // compartido con /revision, no se modificó), así que se deja
          // como no-op documentado en vez de tocar ese componente para un
          // caso que solo aplica a este caller.
          onBack={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="review-info-panel">
      <div className="review-info-mode-selector">
        {(Object.keys(REVIEW_MODE_LABEL) as ReviewMode[]).map((mode) => (
          <button
            key={mode}
            className={`review-info-mode-btn${reviewMode === mode ? " active" : ""}`}
            onClick={() => setReviewMode(mode)}
          >
            {REVIEW_MODE_LABEL[mode]}
          </button>
        ))}
      </div>

      <div className="review-info-table-wrap">
        <FindingsTable findings={findings} searchManager={searchManager} />
      </div>
    </div>
  );
}
