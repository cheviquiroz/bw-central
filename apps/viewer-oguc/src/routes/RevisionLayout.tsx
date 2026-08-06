// src/routes/RevisionLayout.tsx
//
// /revision is a separate URL with its own Layout, not a modal on top of
// "/" - but it shares the same UI vocabulary (Toolbar, DockLeft, Viewport,
// DockRight, the module registry) so navigating here feels like a mode
// switch within one application, not a jump to a different tool. Modeled
// on Layout.tsx; the parts that differ: no FileUploadModal (models come
// from "/", not uploaded here), DockBottom hosts FindingsDock instead of
// BCF, and the Toolbar carries a "← Volver" button back to "/".
//
// Two-state review flow:
//  1. Pre-Check gate (preCheckPassed === false): PreCheckGate.tsx,
//     rendered as an overlay INSIDE the same <main> grid, not a
//     conditional swap of the whole layout - the 3D viewer must not be
//     disposed/reloaded while Pre-Check runs (already loaded, from
//     AppContext/ModelBytesRegistry), so <Viewport> stays mounted
//     underneath at all times, only visually covered while the gate is up.
//  2. Review Space (preCheckPassed === true): the same DockLeft/Viewport/
//     DockRight, now with FindingsDock showing real findings - generated
//     exactly once Pre-Check passes (see the findings effect below),
//     from the SAME parsed IfcHeadlessDocument the Pre-Check gate already
//     produced (docsByModel) - no second re-parse.
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { readIfcFile, type IfcHeadlessDocument } from "@bw-central/ifc-headless";
import { runPreCheck, type Finding, type PreCheckResult } from "@bw-central/oguc-core";
import "../components/Layout/Layout.css";
import Viewport from "../ui/Viewport/Viewport";
import { DockLeft } from "../ui/Dock/DockLeft";
import { DockRight } from "../ui/Dock/DockRight";
import { StatusBar } from "../ui/StatusBar/StatusBar";
import { SearchBar } from "../ui/Search/SearchBar";
import { Toolbar } from "../ui/Toolbar/Toolbar";
import { useApp } from "../ui/AppContext";
import { LayoutStateProvider, useLayoutState } from "../ui/LayoutStateContext";
import { useModelToolActions } from "../components/Layout/useModelToolActions";
import { WEB_IFC_WASM_PATH, fitCameraToAllLoadedModels } from "../core/IfcBootstrap";
import { getModelBytes } from "../core/ModelBytesRegistry";
import { PreCheckGate } from "./revision/PreCheckGate";
import { FindingsDock } from "./revision/FindingsDock";
import { generateFindings } from "./revision/generateFindings";
import type { ModelDisplayNames } from "../engine/createApplication";
import type { ModuleRuntimeMap } from "../ui/registry/modules";

export default function RevisionLayout() {
  return (
    <LayoutStateProvider>
      <RevisionLayoutInner />
    </LayoutStateProvider>
  );
}

function RevisionLayoutInner() {
  const app = useApp();
  const navigate = useNavigate();
  const {
    viewportRef,
    searchManager,
    externalQuery,
    isSectionBoxActive,
    isMeasuring,
    handleViewerReady,
    toolModuleRuntime,
  } = useModelToolActions(app);
  const [modelDisplayNames, setModelDisplayNames] = useState<ModelDisplayNames>(app.getModelDisplayNames());
  // Estado propio, no compartido con "/" (Layout.tsx tiene el suyo) - las
  // visibilidades por elemento no viajan entre rutas todavía; es
  // aceptable en esta fase ("sin lógica de negocio aún"), ver el reporte
  // de la tarea.
  const [hiddenByModel, setHiddenByModel] = useState<Record<string, Set<number>>>({});
  const { zones, toggleZone, setZoneVisible } = useLayoutState();

  const hasModels = Object.keys(modelDisplayNames).length > 0;

  useEffect(() => {
    return app.subscribeToModelDisplayNames(setModelDisplayNames);
  }, [app]);

  // Pre-Check gate state. preCheckPassed resets naturally on every fresh
  // /revision mount (this component remounts per navigation, it's not
  // persisted) - re-entering review always re-runs the gate, never skips
  // it from stale state.
  const [preCheckPassed, setPreCheckPassed] = useState(false);
  const [preCheckResults, setPreCheckResults] = useState<Record<string, PreCheckResult | Error> | null>(null);
  const [isPreCheckLoading, setIsPreCheckLoading] = useState(false);
  // Parsed docs are kept (not discarded after Pre-Check) so the findings
  // effect below can reuse them - re-parsing the same bytes a second
  // time for the same visit would be pure waste.
  const [docsByModel, setDocsByModel] = useState<Record<string, IfcHeadlessDocument>>({});

  // Re-parses each loaded model's RETAINED bytes (ModelBytesRegistry -
  // the live @thatopen/components viewer never exposed a form oguc-core
  // can read) through ifc-headless, independently per model (ifc-headless
  // never merges files - see reader.ts) - then runs oguc-core's
  // runPreCheck on each. A model whose bytes were never retained (loaded
  // before this feature existed, or a real parse failure) resolves to an
  // Error instead of throwing - PreCheckGate renders that as a warning,
  // per this task's edge-case rule ("malformed/incomplete -> WARNING,
  // never a crash").
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
  }, [hasModels, modelDisplayNames]);

  // Review Space, Part 1: run exactly the two compliance rules once
  // Pre-Check passes - never before (a blocked model has no business
  // generating findings), and freshly every time (no caching across
  // /revision visits, per this task's own constraint).
  const [findings, setFindings] = useState<Finding[]>([]);
  useEffect(() => {
    if (!preCheckPassed) return;
    const generated = Object.entries(docsByModel).flatMap(([modelId, doc]) => generateFindings(doc, modelId));
    setFindings(generated);
    // Findings are the actual point of the Review Space (per this task's
    // own framing) - opening the bottom dock automatically on entry means
    // the user sees them immediately, instead of an empty canvas plus a
    // toolbar button they'd have to discover on their own.
    setZoneVisible("bottom", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preCheckPassed]);

  // Part 4's explicit fallback chain: prefer the live element's real
  // bounding box (via searchManager.selectAndFocus -> model.getMergedBox);
  // if the model or the element can't be found (corrupted data, a
  // building-level finding with no elementId, or - the actual reason
  // this currently fires on /revision, see this task's own report - the
  // known gap where 3D geometry doesn't yet survive "/" -> /revision
  // navigation), log a warning and fall back to framing the whole model
  // instead. Never throws, never leaves the camera in a broken state,
  // the finding stays selectable either way.
  const handleSelectFinding = (finding: Finding) => {
    if (finding.elementId === 0 || !searchManager) {
      fitCameraToAllLoadedModels();
      return;
    }

    const onNotFound = () => {
      console.warn(`Element ${finding.elementId} not found in model ${finding.modelId} - falling back to fit-all.`);
      fitCameraToAllLoadedModels();
    };

    searchManager.selectAndFocus(finding.modelId, finding.elementId, onNotFound).catch((error) => {
      console.error("❌ Error al enfocar el hallazgo en el 3D:", error);
      fitCameraToAllLoadedModels();
    });
  };

  const handleUpdateFinding = (findingId: string, patch: Partial<Finding>) => {
    setFindings((prev) => prev.map((f) => (f.id === findingId ? { ...f, ...patch } : f)));
  };

  const handleToggleElementVisibility = (modelId: string, localId: number) => {
    setHiddenByModel((prev) => {
      const current = new Set(prev[modelId] ?? []);
      const nextVisible = current.has(localId);
      if (current.has(localId)) current.delete(localId);
      else current.add(localId);

      app.setElementVisibility(modelId, localId, nextVisible).catch((error) => {
        console.error("❌ Error cambiando visibilidad del elemento:", error);
      });

      return { ...prev, [modelId]: current };
    });
  };

  const handleToggleTreePanel = () => toggleZone("left");
  const handleTogglePropertiesPanel = () => toggleZone("right");
  const handleToggleFindingsPanel = () => toggleZone("bottom");
  const handleStartReview = () => navigate("/revision");

  // Mismos atajos que "/" (Layout.tsx) - Ctrl/Cmd+1/2/3 para
  // tree/data/hallazgos. Duplicado a propósito, no extraído a un hook
  // compartido: son ~15 líneas atadas a los toggles LOCALES de cada
  // layout (zones de su propio LayoutStateProvider), extraerlas pediría
  // pasar 3 funciones por los límites de un hook para ahorrar menos de
  // lo que costaría la indirección.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "1") {
        event.preventDefault();
        handleToggleTreePanel();
      } else if (event.key === "2") {
        event.preventDefault();
        if (hasModels) handleTogglePropertiesPanel();
      } else if (event.key === "3") {
        event.preventDefault();
        if (hasModels) handleToggleFindingsPanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasModels]);

  const moduleRuntime: ModuleRuntimeMap = useMemo(
    () => ({
      ...toolModuleRuntime,
      "start-review": { onClick: handleStartReview },
      "panel-tree": { onClick: handleToggleTreePanel, isActive: zones.left },
      "panel-data": { onClick: handleTogglePropertiesPanel, isActive: zones.right },
      "panel-issues": { onClick: handleToggleFindingsPanel, isActive: zones.bottom },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolModuleRuntime, zones.left, zones.right, zones.bottom]
  );

  // El modelo tiene que venir de "/" - esta ruta no sube archivos (no hay
  // FileUploadModal acá). Si no hay ningún modelo cargado (sesión nueva,
  // o el usuario llegó directo a /revision por URL), se redirige a "/" en
  // vez de mostrar un estado vacío sin salida - la carga de modelos ya
  // tiene un flujo real allá, no hace falta duplicarlo ni inventar uno
  // nuevo acá.
  if (!hasModels) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="layout">
      <Toolbar
        searchBar={<SearchBar searchManager={searchManager} externalQuery={externalQuery} />}
        moduleRuntime={moduleRuntime}
        hasModel={hasModels}
        backTo={{ label: "← Volver", path: "/" }}
      />

      <main ref={viewportRef} className="viewport">
        <DockLeft hiddenByModel={hiddenByModel} onToggleElementVisibility={handleToggleElementVisibility} hasModel={hasModels} />
        <Viewport onViewerReady={handleViewerReady} isSectionBoxActive={isSectionBoxActive} isMeasuring={isMeasuring} hasModels={hasModels} />
        <DockRight />
        <FindingsDock
          findings={findings}
          onSelectFinding={handleSelectFinding}
          onUpdateFinding={handleUpdateFinding}
        />

        {!preCheckPassed && (
          <div className="precheck-overlay">
            <PreCheckGate
              modelNames={modelDisplayNames}
              resultsByModel={preCheckResults ?? {}}
              isLoading={isPreCheckLoading}
              onContinue={() => setPreCheckPassed(true)}
              onBack={() => navigate("/")}
            />
          </div>
        )}
      </main>

      <StatusBar />
    </div>
  );
}
