// src/components/Layout/useReviewInfoState.ts
//
// Etapa 4b-6 - vive en Layout.tsx (never unmounts), NO dentro de
// ReviewInfoPanel.tsx (src/ui/Panels/) a propósito: FloatingPanel.tsx
// (`if (!panelState.open) return null`, sin cambios en esta tarea)
// desmonta sus children por completo al cerrarse - encontrado en vivo
// verificando el criterio "cerrar y reabrir no debe re-correr el
// Pre-Check" de este mismo brief, que con el estado local que tenía
// ReviewInfoPanel originalmente era literalmente imposible de cumplir
// (cada reapertura perdía preCheckPassed/findings y volvía a arrancar
// desde cero). Mismo patrón que bcfState ya usa para BcfPanel/BCF
// FloatingPanel - el estado que debe sobrevivir un close/reopen vive en
// Layout.tsx, el panel en sí queda presentacional.
import { useEffect, useRef, useState } from "react";
import { readIfcFile, type IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { runPreCheck, type Finding, type PreCheckResult } from "@bw-central/oguc-core";
import { generateFindings } from "../../routes/revision/generateFindings";
import { WEB_IFC_WASM_PATH } from "../../core/IfcBootstrap";
import { getModelBytes } from "../../core/ModelBytesRegistry";
import type { ModelDisplayNames } from "../../engine/createApplication";

export type ReviewMode = "oguc" | "ids" | "other";

export function useReviewInfoState(hasModels: boolean, modelDisplayNames: ModelDisplayNames) {
  const [preCheckPassed, setPreCheckPassed] = useState(false);
  const [preCheckResults, setPreCheckResults] = useState<Record<string, PreCheckResult | Error> | null>(null);
  const [isPreCheckLoading, setIsPreCheckLoading] = useState(false);
  const [docsByModel, setDocsByModel] = useState<Record<string, IfcHeadlessDocument>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("oguc");
  const [retryNonce, setRetryNonce] = useState(0);

  // Edge case del brief: "usuario carga un modelo nuevo con el panel
  // abierto -> debe resetear (Pre-Check corre de nuevo)". Comparado por
  // firma (ids ordenados) - modelDisplayNames es un objeto nuevo en cada
  // notify de AppContext aunque el set de ids no cambie (p.ej. un modelo
  // renombrado no debería resetear el review).
  const modelSetSignature = Object.keys(modelDisplayNames).sort().join(",");
  const prevSignatureRef = useRef(modelSetSignature);
  useEffect(() => {
    if (prevSignatureRef.current === modelSetSignature) return;
    prevSignatureRef.current = modelSetSignature;
    setPreCheckPassed(false);
    setDocsByModel({});
    setFindings([]);
  }, [modelSetSignature]);

  // Mismo Pre-Check que RevisionLayout.tsx/routes/revision - re-parsea vía
  // ifc-headless + oguc-core.runPreCheck sobre los bytes retenidos en
  // ModelBytesRegistry. Un modelo cuyos bytes no se pudieron re-parsear
  // resuelve a Error, no a un throw (PreCheckGate ya lo renderiza como
  // advertencia reconocible, nunca como bloqueo).
  useEffect(() => {
    if (!hasModels) return;
    let cancelled = false;
    setIsPreCheckLoading(true);

    const modelIds = Object.keys(modelDisplayNames);
    Promise.all(
      modelIds.map(async (modelId): Promise<[string, PreCheckResult | Error, IfcHeadlessDocument | null]> => {
        const bytes = getModelBytes(modelId);
        if (!bytes) {
          return [modelId, new Error("bytes originales no disponibles (modelo cargado antes de esta función, o descartado)"), null];
        }
        try {
          const doc = await readIfcFile(bytes, { wasmPath: WEB_IFC_WASM_PATH, wasmAbsolute: true });
          return [modelId, runPreCheck(doc), doc];
        } catch (err) {
          console.error("Pre-Check: error al re-analizar el modelo", modelId, err);
          return [modelId, err instanceof Error ? err : new Error(String(err)), null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setPreCheckResults(Object.fromEntries(entries.map(([id, result]) => [id, result])));
      setDocsByModel(Object.fromEntries(entries.filter(([, , doc]) => doc !== null).map(([id, , doc]) => [id, doc as IfcHeadlessDocument])));
      setIsPreCheckLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasModels, modelDisplayNames, retryNonce]);

  useEffect(() => {
    if (!preCheckPassed) return;
    const generated = Object.entries(docsByModel).flatMap(([modelId, doc]) => generateFindings(doc, modelId));
    setFindings(generated);
  }, [preCheckPassed, docsByModel]);

  const allModelsFailed =
    !isPreCheckLoading &&
    preCheckResults !== null &&
    Object.keys(preCheckResults).length > 0 &&
    Object.values(preCheckResults).every((r) => r instanceof Error);

  return {
    preCheckPassed,
    preCheckResults,
    isPreCheckLoading,
    findings,
    reviewMode,
    setReviewMode,
    allModelsFailed,
    onContinue: () => setPreCheckPassed(true),
    onRetry: () => setRetryNonce((n) => n + 1),
  };
}
